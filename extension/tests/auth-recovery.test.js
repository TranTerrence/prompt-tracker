// Test du rétablissement de session : node extension/tests/auth-recovery.test.js
//
// POURQUOI CE FICHIER. Le 15/09/2026, une installation a envoyé pendant des
// heures, une fois par minute, un jeton du nouveau projet Supabase à l'ancien :
// PostgREST répondait 401 PGRST301 (« no suitable key »), rest() jetait le
// corps brut, le popup l'affichait tel quel, et rien ne s'arrêtait jamais —
// l'horloge locale tenait le jeton pour valide, donc ensureSession() ne le
// rafraîchissait pas et ne le purgeait pas. Ce fichier verrouille les trois
// réponses à un jeton refusé :
//
//   * un 401 REST déclenche UN rafraîchissement forcé et UNE relance ;
//   * un refus définitif purge la session et pose le marqueur : la bannière
//     dit « session expirée », la boucle s'arrête (zéro appel au tour suivant) ;
//   * un jeton d'une autre stack ne part jamais, et n'est PAS purgé par le
//     worker (il peut être le périmé) : c'est l'utilisateur qui relie.
//
// Et deux garde-fous : un 5xx ne rafraîchit rien (comportement historique),
// une session d'avant le marqueur `stack` est réputée d'ici.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Harnais de heartbeat.test.js, avec une file de réponses : chaque appel
// réseau consomme la suivante, la dernière reste en place.
function makeApi(seed = {}) {
  const store = { ...seed };
  const calls = [];
  let queue = [];

  const chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (store[k] !== undefined) out[k] = store[k];
          cb(out);
        },
        set(obj, cb) { Object.assign(store, obj); cb && cb(); },
        remove(keys, cb) {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          cb && cb();
        },
      },
    },
    runtime: { getManifest: () => ({ version: "1.0.2" }) },
  };

  const fetchStub = async (url, opts) => {
    calls.push({
      url: String(url),
      method: (opts && opts.method) || "GET",
      headers: (opts && opts.headers) || {},
      body: opts && opts.body ? JSON.parse(opts.body) : null,
    });
    const r = queue.length > 1 ? queue.shift() : queue[0] || { ok: true, status: 200, body: {} };
    if (r instanceof Error) throw r;
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
      text: async () => (r.body === "" ? "" : JSON.stringify(r.body)),
    };
  };

  const sandbox = {
    chrome,
    fetch: fetchStub,
    self: {},
    crypto: { randomUUID: () => "11111111-2222-4333-8444-555555555555" },
    Date, Math, JSON, Object, Promise, Error, TypeError, Boolean, Number, Array, Set, Map,
    setTimeout, clearTimeout, AbortController, console: { ...console, debug() {} },
  };
  const src =
    fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8") +
    "\n" +
    fs.readFileSync(path.join(__dirname, "..", "src", "supabase.js"), "utf8");
  const keys = Object.keys(sandbox);
  const api = new Function(...keys, `${src}\nreturn CoachApi;`)(...keys.map((k) => sandbox[k]));

  return { api, store, calls, setNext: (r) => (queue = Array.isArray(r) ? [...r] : [r]) };
}

const STACK = "https://kbbrkrvacazkxraudvng.supabase.co";
const AUTRE_STACK = "https://ovbvwawzrciwpudnaysp.supabase.co";

// Session que l'horloge locale tient pour valide : c'est le cœur du défaut,
// un jeton « valide » que le serveur refuse.
const seedConnecte = (extra = {}) => ({
  session: {
    access_token: "at1",
    refresh_token: "rt1",
    expires_at: Date.now() + 3600e3,
    user_id: "u1",
    email: "x@y.z",
    stack: STACK,
  },
  ...extra,
});

const seedSynchronisable = (extra = {}) =>
  seedConnecte({
    profile: { org_id: "org1", role: "member" },
    orgConfig: { orgId: "org1", dataRequests: {} },
    consents: {},
    baselineConsent: { accepted: true, source: "server", acceptedAt: "2026-07-01T00:00:00Z" },
    events: [{ id: "e1", ts: Date.now() - 60e3, site: "chatgpt", category: "x", words: 3, scores: {}, synced: false }],
    ...extra,
  });

const refus401 = { ok: false, status: 401, body: { code: "PGRST301", message: "No suitable key or wrong key type" } };
const post201Vide = { ok: true, status: 201, body: "" };
const refreshOk = (n) => ({
  ok: true,
  status: 200,
  body: { access_token: `at${n}`, refresh_token: `rt${n}`, expires_in: 3600, user: { id: "u1", email: "x@y.z" } },
});
const invalidGrant = { ok: false, status: 400, body: { error: "invalid_grant", error_description: "Invalid Refresh Token" } };

const urls = (calls) => calls.map((c) => c.url.replace(`${STACK}/`, ""));

// ---------------------------------------------------------------------------

async function test401RafraichitEtRejoue() {
  const { api, store, calls, setNext } = makeApi(seedSynchronisable());
  setNext([refus401, refreshOk(2), post201Vide]);
  const res = await api.syncEvents();
  assert.strictEqual(res.pushed, 1, "l'événement est parti au second essai");
  assert.deepStrictEqual(
    urls(calls),
    ["rest/v1/prompt_events?on_conflict=user_id,client_event_id", "auth/v1/token?grant_type=refresh_token", "rest/v1/prompt_events?on_conflict=user_id,client_event_id"],
    "401 → un refresh forcé → une relance, dans cet ordre"
  );
  assert.strictEqual(calls[2].headers.Authorization, "Bearer at2", "la relance porte le jeton neuf");
  assert.strictEqual(store.session.access_token, "at2");
  assert.strictEqual(store.session.stack, STACK, "le marqueur de stack est posé par saveSession");
  assert.strictEqual(store.syncStatus.error, null);
  assert.strictEqual(store.syncStatus.reason, null);
  assert.strictEqual(store.sessionExpired, undefined, "rien n'a expiré : la session vit");
  console.log("  ✓ 401 → un rafraîchissement forcé, une relance, la file part");
}

async function test401PuisRefusDefinitifCasseLaBoucle() {
  const { api, store, calls, setNext } = makeApi(seedSynchronisable());
  setNext([refus401, invalidGrant]);
  await assert.rejects(api.syncEvents(), /rest_401/, "l'échec remonte au worker (journal + badge)");
  assert.strictEqual(store.session, undefined, "session purgée");
  assert.strictEqual(store.sessionExpired.reason, "invalid_grant", "marqueur posé avec la raison du serveur");
  assert.strictEqual(store.syncStatus.reason, "session_expired", "le journal dit « session expirée », pas du JSON");
  assert.strictEqual(store.syncStatus.error, null);
  assert.strictEqual(store.syncStatus.pending, 1, "l'événement attend toujours, rien n'est perdu");

  const avant = calls.length;
  const res = await api.syncEvents();
  assert.strictEqual(calls.length, avant, "tour suivant : ZÉRO appel réseau, la boucle est cassée");
  assert.strictEqual(res.reason, "session_expired");
  console.log("  ✓ 401 puis refus définitif : purge, marqueur, et plus un seul appel");
}

async function test401PuisPanneReseauGardeLaSession() {
  const { api, store, calls, setNext } = makeApi(seedSynchronisable());
  setNext([refus401, new TypeError("Failed to fetch")]);
  await assert.rejects(api.syncEvents(), /rest_401/);
  assert.ok(store.session, "une panne pendant le refresh ne déconnecte personne");
  assert.ok(store.session.retryAfter > Date.now(), "frein d'échec passager posé");
  assert.strictEqual(store.sessionExpired, undefined);
  assert.match(store.syncStatus.error, /^rest_401/, "l'erreur reste lisible dans le journal");

  // Tour suivant : le 401 repart (le jeton n'a pas changé) mais le frein
  // empêche de marteler GoTrue — un seul appel, aucun refresh.
  setNext([refus401]);
  const avant = calls.length;
  await assert.rejects(api.syncEvents(), /rest_401/);
  assert.strictEqual(calls.length - avant, 1, "un appel REST, pas de refresh pendant le frein");
  assert.ok(!urls(calls).slice(avant).some((u) => u.startsWith("auth/")), "aucun appel GoTrue sous frein");
  console.log("  ✓ 401 puis panne réseau : session gardée, frein respecté même en refresh forcé");
}

async function testJetonNeufToujoursRefuse() {
  const { api, store, setNext } = makeApi(seedSynchronisable());
  setNext([refus401, refreshOk(2), refus401]);
  await assert.rejects(api.syncEvents(), /rest_401/);
  assert.strictEqual(store.session, undefined, "jeton neuf refusé : ce compte n'est plus accepté ici, purge");
  assert.strictEqual(store.sessionExpired.reason, "rejected_after_refresh");
  assert.strictEqual(store.syncStatus.reason, "session_expired");
  console.log("  ✓ jeton tout neuf toujours refusé : purge et « session expirée »");
}

async function test5xxSansRafraichissement() {
  const { api, store, calls, setNext } = makeApi(seedSynchronisable());
  setNext([{ ok: false, status: 503, body: { message: "unavailable" } }]);
  await assert.rejects(api.syncEvents(), /rest_503/);
  assert.strictEqual(calls.length, 1, "un 5xx n'appelle pas GoTrue");
  assert.strictEqual(store.session.access_token, "at1", "session intacte");
  assert.match(store.syncStatus.error, /^rest_503/);
  assert.strictEqual(store.syncStatus.reason, null);
  console.log("  ✓ 5xx : pas de rafraîchissement, l'erreur est journalisée, on réessaiera");
}

async function testStackEtrangereNeParleJamais() {
  const { api, store, calls, setNext } = makeApi(
    seedSynchronisable({ session: { ...seedConnecte().session, stack: AUTRE_STACK } })
  );
  setNext([post201Vide]);
  const res = await api.syncEvents();
  assert.strictEqual(res.reason, "stack_changed", "raison propre, pour la bannière « relier à nouveau »");
  assert.strictEqual(calls.length, 0, "un jeton d'ailleurs ne part NULLE PART, même pas en refresh");
  assert.ok(store.session, "et il n'est PAS purgé : ce worker peut être le périmé");
  assert.strictEqual(store.syncStatus.reason, "stack_changed");
  assert.strictEqual(await api.heartbeat(), null, "le battement se tait aussi");
  assert.strictEqual(calls.length, 0);
  console.log("  ✓ jeton d'une autre stack : zéro appel, zéro purge, raison « stack_changed »");
}

async function testSessionSansStackEstDIci() {
  const seed = seedSynchronisable();
  delete seed.session.stack;
  const { api, calls, setNext } = makeApi(seed);
  setNext([post201Vide]);
  const res = await api.syncEvents();
  assert.strictEqual(res.pushed, 1, "session d'avant le marqueur : réputée d'ici, elle synchronise");
  assert.strictEqual(calls.length, 1);
  console.log("  ✓ session sans marqueur de stack : réputée d'ici (mise à jour sans déconnexion)");
}

async function testRefreshConcurrentUnique() {
  const { api, store, calls, setNext } = makeApi(
    seedConnecte({ session: { ...seedConnecte().session, expires_at: Date.now() - 1000 } })
  );
  setNext([refreshOk(2)]);
  const [a, b] = await Promise.all([api.ensureSession(), api.ensureSession()]);
  assert.strictEqual(calls.length, 1, "deux appelants simultanés, UN seul échange du refresh token");
  assert.strictEqual(a.access_token, "at2");
  assert.strictEqual(b.access_token, "at2");
  assert.strictEqual(store.session.access_token, "at2");
  console.log("  ✓ rafraîchissements concurrents : un seul en vol");
}

(async () => {
  console.log("auth-recovery.test.js");
  await test401RafraichitEtRejoue();
  await test401PuisRefusDefinitifCasseLaBoucle();
  await test401PuisPanneReseauGardeLaSession();
  await testJetonNeufToujoursRefuse();
  await test5xxSansRafraichissement();
  await testStackEtrangereNeParleJamais();
  await testSessionSansStackEstDIci();
  await testRefreshConcurrentUnique();
  console.log("OK");
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
