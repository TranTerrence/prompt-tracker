// Test de l'annonce de présence : node extension/tests/presence.test.js
//
// POURQUOI CE FICHIER. src/presence.js est le SEUL code de l'extension qui
// pose des données dans une page web. L'origine est la nôtre, mais tout ce qui
// est posé dans le DOM est lisible par n'importe quel script chargé sur cette
// page : la liste des champs annoncés est donc un contrat, pas un détail
// d'implémentation. `buildAnnouncement` est pure exprès — elle s'évalue ici
// sans DOM, et c'est elle qu'on verrouille.
//
// L'invariant, en une phrase : ce qui sort décrit l'ÉTAT DE L'INSTALLATION,
// jamais la personne (pas d'e-mail) ni sa session (pas de jeton).

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Ni `document` ni `chrome` dans le sandbox : le fichier doit s'évaluer quand
// même (c'est la garde de fin de fichier qui l'y autorise). S'il venait à
// toucher le DOM au chargement, ce test échouerait ici, à l'évaluation.
const sandbox = {
  JSON, Date, Object, Boolean, Number, Array, Set, Math, String, console,
};
const src = fs.readFileSync(path.join(__dirname, "..", "src", "presence.js"), "utf8");
const keys = Object.keys(sandbox);
const presence = new Function(...keys, `${src}\nreturn CoachPresence;`)(...keys.map((k) => sandbox[k]));

const build = (data, version = "1.0.2") => presence.buildAnnouncement(data, version);

const CLES = ["active", "deviceId", "lastSyncAt", "paired", "pending", "syncReason", "userId", "v", "version"];

// ---------------------------------------------------------------------------

// Installation fraîche, rien en storage : tout est faux ou nul, jamais undefined.
{
  const a = build({});
  assert.deepStrictEqual(Object.keys(a).sort(), CLES, "les neuf clés du contrat, ni plus ni moins");
  assert.strictEqual(a.v, 1, "version du contrat");
  assert.strictEqual(a.version, "1.0.2");
  assert.strictEqual(a.active, false, "divulgation non acceptée : l'extension est en veille");
  assert.strictEqual(a.paired, false);
  assert.strictEqual(a.userId, null);
  assert.strictEqual(a.deviceId, null);
  assert.strictEqual(a.lastSyncAt, null);
  assert.strictEqual(a.pending, 0);
  assert.strictEqual(a.syncReason, null);
  // `paired` est lu comme un booléen par l'app : jamais une valeur « truthy ».
  assert.strictEqual(typeof a.paired, "boolean");
  assert.strictEqual(typeof a.active, "boolean");
  console.log("  ✓ sans rien en storage : paired false, aucune clé manquante");
}

// Installation armée et liée.
{
  const a = build({
    disclosure: { accepted: true, version: 3 },
    session: { user_id: "u1", email: "eleve@mines.paris", access_token: "at1", refresh_token: "rt1" },
    deviceId: "11111111-2222-4333-8444-555555555555",
    syncStatus: { pending: 2, lastOkAt: 1757937600000, reason: null, error: null },
  });
  assert.strictEqual(a.active, true);
  assert.strictEqual(a.paired, true);
  assert.strictEqual(a.userId, "u1");
  assert.strictEqual(a.deviceId, "11111111-2222-4333-8444-555555555555");
  assert.strictEqual(a.lastSyncAt, new Date(1757937600000).toISOString(), "lastOkAt devient un ISO");
  assert.strictEqual(a.pending, 2);

  // LA garde : l'annonce est lisible par la page.
  const json = JSON.stringify(a);
  assert.ok(!json.includes("eleve@mines.paris"), "aucune adresse e-mail n'est annoncée");
  assert.ok(!json.includes("at1") && !json.includes("rt1"), "aucun jeton n'est annoncé");
  assert.ok(!json.includes("email") && !json.includes("token"), "ni même le nom de ces champs");
  console.log("  ✓ compte lié : paired true, userId, et ni e-mail ni jeton");
}

// Session expirée : l'app doit pouvoir le dire, c'est une régression visible.
{
  const a = build({ sessionExpired: { at: 1757937600000, reason: "invalid_grant" } });
  assert.strictEqual(a.paired, false, "une session expirée n'est plus une liaison");
  assert.strictEqual(a.syncReason, "session_expired");
  console.log("  ✓ session expirée : syncReason = session_expired");
}

// Un blocage de sync déjà nommé prime sur le repli ci-dessus.
{
  const a = build({
    syncStatus: { pending: 5, reason: "no_baseline_consent" },
    sessionExpired: { at: 1 },
  });
  assert.strictEqual(a.syncReason, "no_baseline_consent", "la raison du journal de sync prime");
  assert.strictEqual(a.pending, 5);
  console.log("  ✓ un blocage nommé prime sur le repli session_expired");
}

// Entrées dégradées : storage vide, clés à null, version absente.
{
  for (const bad of [undefined, null, {}, { session: null, syncStatus: null, disclosure: null }]) {
    const a = presence.buildAnnouncement(bad, undefined);
    assert.deepStrictEqual(Object.keys(a).sort(), CLES);
    assert.strictEqual(a.paired, false);
    assert.strictEqual(a.version, "0.0.0", "version inconnue : repli, jamais undefined");
  }
  console.log("  ✓ entrées dégradées : jamais d'exception, jamais de clé undefined");
}

console.log("presence.test.js : l'annonce décrit l'installation, jamais la personne ✓");
