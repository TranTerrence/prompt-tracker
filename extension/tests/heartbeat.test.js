// Test du battement de présence : node extension/tests/heartbeat.test.js
//
// POURQUOI CE FICHIER. Le battement est la seule écriture de l'extension qui
// ne sert à personne sur la machine : elle sert à l'app, pour répondre à
// « l'extension est-elle installée et remonte-t-elle encore ? ». Trois choses
// peuvent la rendre nuisible, et ce fichier les verrouille :
//
//   * elle pourrait envoyer plus que l'état d'installation (le contrat, ce
//     sont SIX colonnes : ni e-mail, ni jeton, ni `last_seen_at`, que le
//     trigger serveur estampille) ;
//   * elle pourrait maquiller une sync en échec : heartbeat() n'écrit JAMAIS
//     `syncStatus`, qui pilote la bannière du popup et le badge de l'icône ;
//   * elle pourrait marteler : l'alarme bat toutes les minutes, une
//     installation au repos ne doit pas écrire 1440 lignes par jour.
//
// L'identifiant d'appareil, lui, doit être STABLE : c'est la clé primaire de
// la ligne avec user_id. Un identifiant qui change fabrique des appareils
// fantômes dans la liste que voit le tuteur.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Harnais de sync.test.js, augmenté de ce que le battement touche en plus :
// crypto.randomUUID (l'identifiant d'appareil) et chrome.runtime.getManifest
// (la version). Les deux manquent au sandbox d'origine, et c'est justement
// pour ça que le code de production les garde sous try/catch.
function makeApi(seed = {}, { uuids = null, clockStepMs = 0 } = {}) {
  const store = { ...seed };
  const calls = [];
  let next = null; // { ok, status, body } ou une Error à lever
  let uuidIndex = 0; // pour le test de course : un identifiant distinct par appel

  // Horloge : la vraie par défaut. `clockStepMs` fait avancer Date.now() d'un
  // pas fixe à chaque lecture, pour que deux passages ne tombent jamais dans la
  // même milliseconde — sans quoi un test qui compare des horodatages écrits
  // coup sur coup passerait par accident. Le pas reste minuscule devant les
  // 5 min du frein, qu'il ne doit surtout pas franchir tout seul.
  let horloge = Date.now();
  const DateStub = clockStepMs
    ? class extends Date {
        static now() {
          horloge += clockStepMs;
          return horloge;
        }
      }
    : Date;

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
    if (next instanceof Error) throw next;
    const r = next || { ok: true, status: 200, body: {} };
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
    crypto: { randomUUID: () => (uuids ? uuids[uuidIndex++] : "11111111-2222-4333-8444-555555555555") },
    Date: DateStub, Math, JSON, Object, Promise, Error, TypeError, Boolean, Number, Array, Set, Map,
    // console.debug muet : le code de production journalise volontairement un
    // battement raté, ce n'est pas une ligne de résultat de test.
    setTimeout, clearTimeout, AbortController, console: { ...console, debug() {} },
  };
  const src =
    fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8") +
    "\n" +
    fs.readFileSync(path.join(__dirname, "..", "src", "supabase.js"), "utf8");
  const keys = Object.keys(sandbox);
  const api = new Function(...keys, `${src}\nreturn CoachApi;`)(...keys.map((k) => sandbox[k]));

  return { api, store, calls, setNext: (r) => (next = r) };
}

const seedConnecte = (extra = {}) => ({
  session: {
    access_token: "at1",
    refresh_token: "rt1",
    expires_at: Date.now() + 3600e3,
    user_id: "u1",
    email: "x@y.z",
  },
  ...extra,
});

// Installation connectée, org jointe, socle accepté : le seul état où
// syncEvents() va jusqu'au bout et écrit le journal (copié de sync.test.js).
const seedSynchronisable = (extra = {}) =>
  seedConnecte({
    profile: { org_id: "org1", role: "member" },
    orgConfig: { orgId: "org1", dataRequests: {} },
    consents: {},
    baselineConsent: { accepted: true, source: "server", acceptedAt: "2026-07-01T00:00:00Z" },
    ...extra,
  });

const post201Vide = { ok: true, status: 201, body: "" };

// ---------------------------------------------------------------------------

async function testDeviceIdStable() {
  const env = makeApi(seedConnecte());
  const a = await env.api.ensureDeviceId();
  const b = await env.api.ensureDeviceId();
  assert.strictEqual(a, b, "le même identifiant est rendu deux fois");
  assert.strictEqual(env.store.deviceId, a, "il est écrit une fois pour toutes");
  assert.strictEqual(env.calls.length, 0, "tirer un identifiant ne parle à personne");

  // Il survit à la déconnexion : logout() efface une liste explicite de clés,
  // deviceId n'y est pas — sinon chaque reconnexion créerait un appareil.
  await env.api.logout();
  assert.strictEqual(env.store.deviceId, a, "deviceId survit à logout()");
  console.log("  ✓ ensureDeviceId : stable, local, conservé à travers logout()");
}

async function testDeviceIdConcurrent() {
  // Fraîche installation, deux appelants en même temps (alarme + `sync-now`
  // du popup) : sans la promesse en vol de module, chacun lirait « rien en
  // storage » et tirerait SON UUID — deux appareils fantômes pour une seule
  // machine. Deux identifiants distincts dans la pioche rendent la course
  // visible : sans le correctif, `a` et `b` diffèrent et le store finit avec
  // l'un des deux au hasard de l'ordre d'écriture.
  const env = makeApi(seedConnecte(), { uuids: ["aaaaaaaa-0000-4000-8000-000000000001", "bbbbbbbb-0000-4000-8000-000000000002"] });
  const [a, b] = await Promise.all([env.api.ensureDeviceId(), env.api.ensureDeviceId()]);
  assert.strictEqual(a, b, "deux appels concurrents rendent le même identifiant");
  assert.strictEqual(env.store.deviceId, a, "le store ne contient que celui-là, pas un appareil fantôme");
  console.log("  ✓ ensureDeviceId : deux appels concurrents ne fabriquent qu'un seul appareil");
}

async function testPostSixColonnes() {
  const env = makeApi(
    seedConnecte({ syncStatus: { at: 1, pending: 3, lastOkAt: 1757937600000, reason: null, error: null } })
  );
  env.setNext(post201Vide);
  const row = await env.api.heartbeat();

  assert.strictEqual(env.calls.length, 1, "un seul appel réseau");
  const call = env.calls[0];
  assert.strictEqual(
    call.url,
    "https://kbbrkrvacazkxraudvng.supabase.co/rest/v1/extension_devices?on_conflict=user_id,device_id",
    "upsert sur la clé (user_id, device_id)"
  );
  assert.strictEqual(call.method, "POST");
  assert.strictEqual(call.headers.Prefer, "resolution=merge-duplicates,return=minimal");
  assert.ok(Array.isArray(call.body) && call.body.length === 1, "une ligne, en tableau (PostgREST)");

  const sent = call.body[0];
  assert.deepStrictEqual(
    Object.keys(sent).sort(),
    ["browser_hint", "device_id", "last_sync_at", "pending_count", "user_id", "version"],
    "exactement les six colonnes du contrat : pas de last_seen_at (trigger serveur)"
  );
  assert.strictEqual(sent.user_id, "u1");
  assert.strictEqual(sent.device_id, env.store.deviceId);
  assert.strictEqual(sent.version, "1.0.2", "la version vient du manifest");
  assert.strictEqual(sent.last_sync_at, new Date(1757937600000).toISOString(), "horodatage ISO");
  assert.strictEqual(sent.pending_count, 3);
  assert.deepStrictEqual(row, sent, "la ligne envoyée est rendue à l'appelant");

  // Ce qui ne doit JAMAIS sortir.
  const json = JSON.stringify(sent);
  assert.ok(!json.includes("x@y.z"), "aucune adresse e-mail");
  assert.ok(!json.includes("at1") && !json.includes("rt1"), "aucun jeton");
  assert.ok(!("last_seen_at" in sent), "last_seen_at n'est jamais envoyé");
  console.log("  ✓ heartbeat : un upsert, six colonnes, ni e-mail ni jeton");
}

async function testSansSessionAucunAppel() {
  const env = makeApi();
  const r = await env.api.heartbeat();
  assert.strictEqual(r, null, "pas de session : rien à signaler");
  assert.strictEqual(env.calls.length, 0, "et surtout aucun appel réseau");
  assert.strictEqual(env.store.syncStatus, undefined, "le journal de sync reste intact");
  console.log("  ✓ heartbeat : sans session, aucun appel");
}

async function testEchecMuet() {
  const journal = { at: 1, pending: 12, lastOkAt: null, reason: "no_org", error: null, pushed: 0 };
  const env = makeApi(seedConnecte({ syncStatus: journal }));
  env.setNext(new TypeError("Failed to fetch"));
  const r = await env.api.heartbeat();
  assert.strictEqual(r, null, "un échec rend null, il ne lève pas");
  assert.deepStrictEqual(env.store.syncStatus, journal, "syncStatus n'est PAS touché (badge + bannière)");
  assert.strictEqual(env.store.heartbeatState, undefined, "un échec ne pose pas d'empreinte");
  console.log("  ✓ heartbeat : réseau coupé → null, et le journal de sync reste le sien");
}

async function testEmpreinteEtForce() {
  const env = makeApi(seedConnecte({ syncStatus: { pending: 0, lastOkAt: 1757937600000 } }));
  env.setNext(post201Vide);
  await env.api.heartbeat();
  assert.strictEqual(env.calls.length, 1, "premier battement : il part");

  await env.api.heartbeat();
  assert.strictEqual(env.calls.length, 1, "rien n'a changé depuis moins de 5 min : on se tait");

  await env.api.heartbeat({ force: true });
  assert.strictEqual(env.calls.length, 2, "force bypasse le frein (appairage, sync-now)");

  // Ce qui change l'empreinte fait repartir un battement sans attendre.
  env.store.syncStatus = { pending: 4, lastOkAt: 1757937600000 };
  await env.api.heartbeat();
  assert.strictEqual(env.calls.length, 3, "une file qui bouge est une nouvelle après");

  // Et un battement vieux de plus de 5 minutes repart, à empreinte égale.
  env.store.heartbeatState = { ...env.store.heartbeatState, at: Date.now() - 300001 };
  await env.api.heartbeat();
  assert.strictEqual(env.calls.length, 4, "au-delà de 5 min, on redit qu'on est là");
  console.log("  ✓ heartbeat : muet à empreinte égale sous 5 min, force et changements passent");
}

async function testFreinInstallationAuRepos() {
  // Le frein tel qu'il vit VRAIMENT. testEmpreinteEtForce pose `syncStatus` à
  // la main ; ici c'est syncEvents() qui l'écrit, comme sur une machine, et il
  // le réécrit à CHAQUE passage — même quand il n'y a rien à pousser. Une
  // installation au repos alterne alarme de sync et battement toutes les
  // minutes : si l'empreinte dépend de cette écriture, chaque minute repart en
  // base et l'installation écrit 1440 lignes par jour pour redire la même
  // chose. Rien n'a changé ici : un seul upsert doit partir.
  const env = makeApi(seedSynchronisable({ events: [] }), { clockStepMs: 5 });
  env.setNext(post201Vide);
  await env.api.heartbeat();
  await env.api.syncEvents();
  await env.api.heartbeat();
  await env.api.syncEvents();
  await env.api.heartbeat();

  const battements = env.calls.filter((c) => c.url.includes("extension_devices"));
  assert.strictEqual(
    battements.length,
    1,
    "trois battements encadrant deux syncs à vide : un seul upsert doit partir"
  );
  console.log("  ✓ heartbeat : une installation au repos ne rebat pas à chaque sync");
}

(async () => {
  await testDeviceIdStable();
  await testDeviceIdConcurrent();
  await testPostSixColonnes();
  await testSansSessionAucunAppel();
  await testEchecMuet();
  await testEmpreinteEtForce();
  await testFreinInstallationAuRepos();
  console.log("heartbeat.test.js : l'état d'installation part, rien d'autre, et jamais au prix de la sync ✓");
  process.exit(0);
})().catch((e) => {
  console.error("heartbeat.test.js ✗", e);
  process.exit(1);
});
