// Test de la session et du rafraîchissement : node extension/tests/session.test.js
//
// POURQUOI CE FICHIER. Le 25/08/2026, les journaux de production ont montré
// 1134 requêtes `token?grant_type=refresh_token` en HTTP 400 sur 24 h — une par
// minute, sans interruption, pour une installation qui ne synchronisait plus
// rien. Cause : `ensureSession()` retournait null sans purger la session morte,
// donc `expires_at` restait dans le passé et chaque tick d'alarme retentait le
// même jeton révoqué. Rien dans le code ne testait ce chemin.
//
// Ce fichier verrouille les deux moitiés de la correction :
//   * un refus DÉFINITIF (400/401) purge la session et arrête la boucle ;
//   * une panne PASSAGÈRE (réseau, 5xx) ne déconnecte pas et espace les essais.
// La seconde compte autant que la première : déconnecter quelqu'un dont le
// wifi a hoqueté serait pire que le défaut d'origine.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

function makeApi({ session = null, sessionExpired = null } = {}) {
  // On n'écrit que les clés réellement présentes : `chrome.storage` ne rend
  // pas une clé absente, et un `null` posé par le harnais ferait passer un
  // « absent » pour un « vide », ce qui masquerait exactement ce qu'on teste.
  const store = {};
  if (session) store.session = session;
  if (sessionExpired) store.sessionExpired = sessionExpired;
  const calls = [];
  let next = null; // { ok, status, body } ou une Error à lever

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
  };

  const fetchStub = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (next instanceof Error) throw next;
    const r = next || { ok: true, status: 200, body: {} };
    return { ok: r.ok, status: r.status, json: async () => r.body };
  };

  const sandbox = {
    chrome,
    fetch: fetchStub,
    self: {},
    Date, Math, JSON, Object, Promise, Error, Boolean, Number, Array, Set, Map,
    setTimeout, clearTimeout, AbortController, console,
  };
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "supabase.js"), "utf8");
  const keys = Object.keys(sandbox);
  const api = new Function(...keys, `${src}\nreturn CoachApi;`)(...keys.map((k) => sandbox[k]));

  return { api, store, calls, setNext: (r) => (next = r) };
}

const okRefresh = {
  ok: true,
  status: 200,
  body: { access_token: "at2", refresh_token: "rt2", expires_in: 3600, user: { id: "u1", email: "x@y.z" } },
};
const refus400 = { ok: false, status: 400, body: { error: "invalid_grant", error_description: "Invalid Refresh Token" } };
const panne503 = { ok: false, status: 503, body: { msg: "service unavailable" } };

const sessionExpiree = (extra = {}) => ({
  access_token: "at1",
  refresh_token: "rt1",
  expires_at: Date.now() - 1000, // périmée
  user_id: "u1",
  email: "x@y.z",
  ...extra,
});

// ---------------------------------------------------------------------------

async function testSessionValide() {
  const { api, calls } = makeApi({ session: { ...sessionExpiree(), expires_at: Date.now() + 3600e3 } });
  const s = await api.ensureSession();
  assert.ok(s, "une session encore valide est rendue telle quelle");
  assert.strictEqual(calls.length, 0, "aucun appel réseau tant que la session est bonne");
  console.log("  ✓ session valide : aucun aller-retour réseau");
}

async function testRefusDefinitifPurge() {
  const env = makeApi({ session: sessionExpiree() });
  env.setNext(refus400);

  assert.strictEqual(await env.api.ensureSession(), null, "un jeton refusé ne rend pas de session");
  assert.strictEqual(env.store.session, undefined, "la session morte est PURGÉE");
  assert.ok(env.store.sessionExpired, "un marqueur d'expiration est posé");
  assert.strictEqual(env.calls.length, 1);

  // LE POINT DU TEST : le tick suivant ne doit plus rien tenter.
  assert.strictEqual(await env.api.ensureSession(), null);
  assert.strictEqual(await env.api.ensureSession(), null);
  assert.strictEqual(env.calls.length, 1, "la boucle est cassée : plus aucune requête après la purge");
  console.log("  ✓ refus 400 : session purgée, boucle arrêtée (1 requête, pas 1134)");
}

async function testRefus401() {
  const env = makeApi({ session: sessionExpiree() });
  env.setNext({ ok: false, status: 401, body: { msg: "unauthorized" } });
  await env.api.ensureSession();
  assert.strictEqual(env.store.session, undefined, "401 est traité comme définitif, au même titre que 400");
  console.log("  ✓ refus 401 : traité comme définitif");
}

async function testPanneNeDeconnectePas() {
  // Coupure réseau : fetch lève une TypeError, sans statut.
  const env = makeApi({ session: sessionExpiree() });
  env.setNext(new TypeError("Failed to fetch"));
  assert.strictEqual(await env.api.ensureSession(), null);
  assert.ok(env.store.session, "une coupure réseau NE déconnecte PAS");
  assert.strictEqual(env.store.sessionExpired, undefined, "et ne pose aucun marqueur d'expiration");
  assert.ok(env.store.session.retryAfter > Date.now(), "une échéance de nouvel essai est posée");

  // Dans la fenêtre d'attente : aucune requête.
  assert.strictEqual(await env.api.ensureSession(), null);
  assert.strictEqual(env.calls.length, 1, "on n'insiste pas avant l'échéance");

  // 5xx : même traitement.
  const cinqCent = makeApi({ session: sessionExpiree() });
  cinqCent.setNext(panne503);
  await cinqCent.api.ensureSession();
  assert.ok(cinqCent.store.session, "un 503 ne déconnecte pas non plus");
  console.log("  ✓ panne passagère : session conservée, essais espacés");
}

async function testAttenteCroissante() {
  const attentes = [];
  let session = sessionExpiree();
  for (let i = 0; i < 5; i++) {
    const env = makeApi({ session });
    env.setNext(new TypeError("Failed to fetch"));
    await env.api.ensureSession();
    attentes.push(Math.round((env.store.session.retryAfter - Date.now()) / 60000));
    // On simule l'échéance atteinte pour le tour suivant.
    session = { ...env.store.session, retryAfter: 0 };
  }
  assert.deepStrictEqual(attentes, [1, 5, 15, 60, 60], `attente croissante en minutes, obtenu ${attentes}`);
  console.log("  ✓ attente croissante : 1, 5, 15, 60 min puis plafond");
}

async function testReconnexionRemetTout() {
  const env = makeApi({
    session: sessionExpiree({ refreshFailures: 3, retryAfter: 0 }),
    sessionExpired: { at: Date.now() - 1000, reason: "invalid_grant" },
  });
  env.setNext(okRefresh);
  const s = await env.api.ensureSession();
  assert.ok(s, "le rafraîchissement réussi rend une session");
  assert.strictEqual(env.store.sessionExpired, undefined, "le marqueur d'expiration est effacé");
  assert.strictEqual(env.store.session.refreshFailures, undefined, "le compteur d'échecs repart de zéro");
  assert.strictEqual(env.store.session.retryAfter, undefined, "l'échéance d'attente disparaît");
  assert.ok(env.store.session.expires_at > Date.now() + 3500e3, "la nouvelle échéance est bien dans une heure");
  console.log("  ✓ reconnexion : marqueur, compteur et attente remis à zéro");
}

async function testSyncDistingueLesDeuxAbsences() {
  // Jamais connecté : mode 100 % local, nominal, on n'alarme pas.
  const jamais = makeApi();
  const r1 = await jamais.api.syncEvents();
  assert.strictEqual(r1.reason, "not_authenticated");

  // Connecté puis expiré : l'utilisateur perd quelque chose, il doit le voir.
  const expire = makeApi({ session: sessionExpiree() });
  expire.setNext(refus400);
  const r2 = await expire.api.syncEvents();
  assert.strictEqual(r2.reason, "session_expired", "la sync distingue expiré de jamais connecté");
  assert.strictEqual(expire.store.syncStatus.reason, "session_expired", "et le journal le dit aussi");
  console.log("  ✓ la sync distingue « jamais connecté » de « session expirée »");
}

(async () => {
  await testSessionValide();
  await testRefusDefinitifPurge();
  await testRefus401();
  await testPanneNeDeconnectePas();
  await testAttenteCroissante();
  await testReconnexionRemetTout();
  await testSyncDistingueLesDeuxAbsences();
  console.log("session.test.js : la boucle de rafraîchissement est bornée ✓");
  process.exit(0);
})();
