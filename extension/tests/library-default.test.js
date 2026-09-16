// Test du défaut de bibliothèque de pré-prompts : node extension/tests/library-default.test.js
//
// POURQUOI CE FICHIER. Jusqu'à la 1.0.1, `organizations.library_url` à NULL
// voulait dire « pas de bibliothèque » : la carte « Activer » restait affichée,
// la permission d'hôte était facultative, et personne n'avait de pré-prompts
// tant que l'école n'avait pas publié une URL. Depuis la 1.0.2, la permission
// d'hôte sur l'origine de l'app est OBLIGATOIRE (manifest) : le flux servi par
// l'app elle-même est lisible sans rien demander, et devient le défaut.
//
// CONTREPARTIE ASSUMÉE, verrouillée ici : une organisation ne peut plus
// éteindre la bibliothèque en laissant NULL — mais elle garde la main pour la
// REMPLACER par la sienne, et c'est cette moitié-là qui casserait en silence
// si le défaut écrasait la valeur publiée.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Les réponses sont routées par URL : refreshOrgConfig enchaîne quatre appels
// REST (profil, puis templates + demandes + consentements en parallèle).
function makeApi(libraryUrl) {
  const store = {
    session: { access_token: "at1", refresh_token: "rt1", expires_at: Date.now() + 3600e3, user_id: "u1" },
  };
  const calls = [];

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

  const routes = (url) => {
    if (url.includes("/profiles?")) {
      return [
        {
          id: "u1",
          org_id: "org1",
          role: "member",
          disabled: false,
          baseline_consent_at: "2026-07-01T00:00:00Z",
          organizations: {
            name: "Mines Paris",
            brand_name: null,
            brand_color: null,
            logo_url: null,
            threshold: 40,
            capture_mode: "metadata",
            llm_enabled: true,
            intercept_enabled: true,
            show_score: true,
            library_url: libraryUrl,
          },
        },
      ];
    }
    return []; // socratic_templates, org_data_requests, consents
  };

  const fetchStub = async (url, opts) => {
    calls.push(String(url));
    const body = routes(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };

  const sandbox = {
    chrome,
    fetch: fetchStub,
    self: {},
    Date, Math, JSON, Object, Promise, Error, TypeError, Boolean, Number, Array, Set, Map,
    setTimeout, clearTimeout, AbortController, console,
  };
  const src =
    fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8") +
    "\n" +
    fs.readFileSync(path.join(__dirname, "..", "src", "supabase.js"), "utf8");
  const keys = Object.keys(sandbox);
  const api = new Function(...keys, `${src}\nreturn CoachApi;`)(...keys.map((k) => sandbox[k]));
  return { api, store, calls };
}

(async () => {
  // NULL en base : le flux de l'app, servi par défaut.
  {
    const env = makeApi(null);
    const config = await env.api.refreshOrgConfig();
    const attendu = `${env.api.APP_URL}/api/prompt-library`;
    assert.strictEqual(env.api.defaultLibraryUrl(), attendu, "le défaut dérive d'APP_URL, rien n'est recopié");
    assert.strictEqual(config.libraryUrl, attendu, "library_url NULL → flux de l'app");
    assert.strictEqual(env.store.orgConfig.libraryUrl, attendu, "et c'est ce qui est mis en cache");
    // C'est bien l'origine déclarée dans le manifest : sans ça, la permission
    // obligatoire ne couvrirait pas le flux et la carte « Activer » reviendrait.
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    assert.ok(
      (manifest.host_permissions || []).includes(`${new URL(attendu).origin}/*`),
      "l'origine du flux par défaut est une permission d'hôte obligatoire"
    );
    console.log("  ✓ library_url NULL → le flux de pré-prompts de l'app");
  }

  // Valeur publiée : elle prime, le défaut ne l'écrase pas.
  {
    const publie = "https://ecole.example/prompts.json";
    const env = makeApi(publie);
    const config = await env.api.refreshOrgConfig();
    assert.strictEqual(config.libraryUrl, publie, "une URL publiée par l'org reste la sienne");
    console.log("  ✓ library_url publiée → c'est elle, pas le défaut");
  }

  console.log("library-default.test.js : les pré-prompts sont servis par défaut, sans écraser l'org ✓");
  process.exit(0);
})().catch((e) => {
  console.error("library-default.test.js ✗", e);
  process.exit(1);
});
