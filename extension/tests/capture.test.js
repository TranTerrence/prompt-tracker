// Test du chemin d'ENREGISTREMENT : node extension/tests/capture.test.js
//
// POURQUOI CE FICHIER. scoring.test.js couvre le module pur, les harnais HTML
// couvrent les surfaces. Entre les deux, personne ne vérifiait la chose dont
// tout le produit dépend : qu'un prompt envoyé finit bien dans
// `chrome.storage.local.events`, avec les bons champs, sur les QUATRE issues
// (envoyé, amélioré, envoyé quand même, annulé). Un événement perdu là est
// invisible — ni erreur, ni journal, juste une courbe de progression qui ne
// monte pas et une organisation qui ne reçoit rien.
//
// content.js est une IIFE qui parle à chrome.* et aux modules Coach* : on les
// simule tous, on charge le vrai fichier, et on capture les rappels qu'il
// passe à CoachAdapter.init pour piloter le flux comme le ferait un site.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const tick = () => new Promise((r) => setImmediate(r));
const read = (f) => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");

// ---------------------------------------------------------------------------
// Environnement simulé
// ---------------------------------------------------------------------------

function makeEnv({ settings = {}, orgConfig = null, consents = {}, disclosure = true, filNeuf = false } = {}) {
  const store = {
    settings: { captureMode: "metadata", interceptEnabled: true, threshold: 40, theme: "light", ...settings },
    orgConfig,
    consents,
    disclosure: disclosure ? { accepted: true, version: 2 } : null,
    events: [],
  };
  const captured = { modal: null, toast: null, flash: null, submitted: [] };

  const chrome = {
    storage: {
      local: {
        // Rappels synchrones : tout le flux d'enregistrement le reste, ce qui
        // rend le test déterministe sans minuteur.
        get(keys, cb) {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (k in store) out[k] = store[k];
          cb(out);
        },
        set(obj, cb) {
          Object.assign(store, obj);
          cb && cb();
        },
        remove(keys, cb) {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          cb && cb();
        },
      },
      onChanged: { addListener() {} },
    },
    runtime: { sendMessage(_m, cb) { cb && cb(null); }, lastError: null, getURL: (p) => p },
    i18n: { getUILanguage: () => "fr" },
  };

  const adapter = {
    site: "chatgpt",
    _conv: filNeuf ? "chatgpt:root" : "chatgpt:c/abc",
    _isNew: filNeuf,
    conversationKey() { return this._conv; },
    isNewConversation() { return this._isNew; },
    onResponse() {},
    armResponseWatch() {},
    submitText(text) { captured.submitted.push(text); return Promise.resolve(true); },
    healthy() { return true; },
    probe() { return { assistant: true, model: true }; },
    init(handlers) { this.handlers = handlers; },
  };

  const sandbox = {
    chrome,
    self: {},
    setTimeout: (fn, ms) => (ms >= 5000 ? null : setTimeout(fn, ms)), // on neutralise la sonde de santé
    clearTimeout,
    Date,
    Math,
    Set,
    Map,
    Promise,
    console,
    CoachAdapter: adapter,
    CoachTheme: { set() {}, DEFAULT_ACCENT: "#000" },
    CoachBadge: { render() {}, remove() {} },
    CoachModels: { VERSION: 1 },
    CoachMirror: {
      show(msg) { captured.toast = msg; },
      flash(msg) { captured.flash = msg; },
      showPost() {},
      closePost() {},
      showModal(opts) { captured.modal = opts; },
      closeModal() {},
      onFeedback: null,
      onClose: null,
      onPause: null,
    },
  };

  // scoring.js et i18n.js sont chargés pour de vrai : ce sont eux qu'on veut
  // voir à l'œuvre, pas une doublure.
  const bootstrap = read("scoring.js") + "\n" + read("i18n.js") + "\n" + read("content.js");
  const keys = Object.keys(sandbox);
  const mods = new Function(...keys, `${bootstrap}\nreturn { CoachScoring, CoachI18n };`)(
    ...keys.map((k) => sandbox[k])
  );

  return { store, captured, adapter, sandbox, ...mods };
}

// ---------------------------------------------------------------------------
// 1. Prompt fort : parti normalement, enregistré avec outcome "sent"
// ---------------------------------------------------------------------------

async function testPromptFort() {
  const env = makeEnv();
  const text =
    "Je suis étudiant en première année. Rédige un plan de dissertation sur la souveraineté numérique pour un public non spécialiste. Cite tes sources et donne les limites de ton raisonnement.";

  assert.strictEqual(env.adapter.handlers.shouldIntercept(text), false, "un prompt riche ne doit pas être intercepté");
  env.adapter.handlers.onSubmit(text);
  await tick();

  assert.strictEqual(env.store.events.length, 1, "un prompt envoyé produit exactement un événement");
  const e = env.store.events[0];
  assert.strictEqual(e.outcome, "sent");
  assert.strictEqual(e.intercepted, false);
  assert.strictEqual(e.synced, false, "l'événement doit rester à pousser");
  assert.ok(e.id && e.ts, "identifiant et horodatage présents");
  assert.strictEqual(e.site, "chatgpt");
  assert.strictEqual(e.conv, "chatgpt:c/abc");
  assert.strictEqual(e.scoringVersion, 3, "le barème est versionné sur l'événement");
  assert.ok(e.scores && e.scores.total > 0, "les scores sont enregistrés");
  assert.strictEqual(e.words, env.CoachScoring.wordCount(text));
  assert.strictEqual(e.promptChars, text.length);
  assert.strictEqual(e.category, "rédaction");
  console.log("  ✓ prompt fort → enregistré (outcome sent)");
}

// ---------------------------------------------------------------------------
// 2. Les quatre issues d'une interception
// ---------------------------------------------------------------------------

async function testQuatreIssues() {
  const faible = "fais mes devoirs de maths";

  // --- amélioré ---
  {
    const env = makeEnv({ filNeuf: true });
    assert.strictEqual(env.adapter.handlers.shouldIntercept(faible), true, "un prompt faible est intercepté");
    env.adapter.handlers.onIntercept(faible);
    const m = env.captured.modal;
    assert.ok(m, "la modale est ouverte");
    const final = faible + "\n\nMa réflexion préalable :\n- Ma tentative : je dirais que 2x+3=7";
    m.onSend(final, { rounds: 4, answersCount: 4, rerolls: 0, answers: [{ q: "Q", a: "R", axis: "hypothese" }] });
    await tick();

    assert.strictEqual(env.store.events.length, 1);
    const e = env.store.events[0];
    assert.strictEqual(e.outcome, "improved");
    assert.strictEqual(e.intercepted, true);
    assert.strictEqual(e.mirrorShown, true);
    assert.strictEqual(e.rounds, 4);
    assert.strictEqual(e.answersCount, 4);
    assert.ok(e.scoreBefore !== null && e.scoreAfter !== null, "avant/après enregistrés");
    assert.ok(e.scoreAfter > e.scoreBefore, "le prompt amélioré score plus haut");
    assert.deepStrictEqual(env.captured.submitted, [final], "le texte final est bien envoyé au site");
    console.log("  ✓ interception → amélioré (scoreBefore/scoreAfter, dialogue)");
  }

  // --- envoyé quand même ---
  {
    const env = makeEnv({ filNeuf: true });
    env.adapter.handlers.shouldIntercept(faible);
    env.adapter.handlers.onIntercept(faible);
    env.captured.modal.onSendAnyway({ rounds: 1, answersCount: 0, rerolls: 0, answers: [] });
    await tick();
    const e = env.store.events[0];
    assert.strictEqual(e.outcome, "sent_anyway");
    assert.strictEqual(e.scoreBefore, e.scoreAfter, "aucun travail : le score ne bouge pas");
    assert.deepStrictEqual(env.captured.submitted, [faible], "c'est la demande initiale qui part");
    console.log("  ✓ interception → envoyé quand même");
  }

  // --- annulé : rien ne part, mais l'événement EXISTE ---
  {
    const env = makeEnv({ filNeuf: true });
    env.adapter.handlers.shouldIntercept(faible);
    env.adapter.handlers.onIntercept(faible);
    env.captured.modal.onCancel({ rounds: 2, answersCount: 1, rerolls: 0, answers: [] });
    await tick();
    const e = env.store.events[0];
    assert.strictEqual(e.outcome, "cancelled");
    assert.deepStrictEqual(env.captured.submitted, [], "rien n'est envoyé au site");
    assert.strictEqual(e.responsePending, false, "un prompt annulé n'attend aucune réponse");
    console.log("  ✓ interception → annulé (tracé, rien envoyé)");
  }

  // --- pause : le fil se tait, l'événement reste ---
  {
    const env = makeEnv({ filNeuf: true });
    env.adapter.handlers.shouldIntercept(faible);
    env.adapter.handlers.onIntercept(faible);
    env.captured.modal.onPause({ rounds: 1, answersCount: 0, rerolls: 0, answers: [] });
    await tick();
    const e = env.store.events[0];
    assert.strictEqual(e.outcome, "cancelled");
    assert.strictEqual(e.mirrorFeedback, "paused_thread");
    console.log("  ✓ interception → pause du fil");
  }
}

// ---------------------------------------------------------------------------
// 3. Le TEXTE du prompt : capturé seulement quand c'est autorisé
// ---------------------------------------------------------------------------

async function testTexteDuPrompt() {
  const text = "Explique la guerre froide simplement pour un exposé de terminale";

  // Mode métadonnées, aucune organisation : le texte ne doit PAS être gardé.
  {
    const env = makeEnv();
    env.adapter.handlers.onSubmit(text);
    await tick();
    assert.strictEqual(env.store.events[0].text, undefined, "mode metadata : aucun texte gardé");
  }

  // Réglage local « conserver le texte » : gardé localement.
  {
    const env = makeEnv({ settings: { captureMode: "full" } });
    env.adapter.handlers.onSubmit(text);
    await tick();
    assert.strictEqual(env.store.events[0].text, text, "captureMode full : texte gardé en local");
  }

  // Organisation qui demande le texte ET utilisateur qui a consenti.
  {
    const env = makeEnv({
      orgConfig: { orgId: "o", dataRequests: { prompt_text: { requested: true } } },
      consents: { prompt_text: true },
    });
    env.adapter.handlers.onSubmit(text);
    await tick();
    assert.strictEqual(env.store.events[0].text, text, "demandé + consenti : texte capturé");
  }

  // Organisation qui demande, utilisateur qui REFUSE : rien.
  {
    const env = makeEnv({
      orgConfig: { orgId: "o", dataRequests: { prompt_text: { requested: true } } },
      consents: { prompt_text: false },
    });
    env.adapter.handlers.onSubmit(text);
    await tick();
    assert.strictEqual(env.store.events[0].text, undefined, "consentement refusé : aucun texte");
  }
  console.log("  ✓ texte du prompt : capturé si et seulement si autorisé");
}

// ---------------------------------------------------------------------------
// 4. Veille avant acceptation : rien n'est enregistré du tout
// ---------------------------------------------------------------------------

async function testVeille() {
  const env = makeEnv({ disclosure: false, filNeuf: true });
  assert.strictEqual(env.adapter.handlers.shouldIntercept("fais mes devoirs"), false);
  env.adapter.handlers.onSubmit("fais mes devoirs de maths pour demain");
  await tick();
  assert.strictEqual(env.store.events.length, 0, "avant acceptation de la divulgation, RIEN n'est capturé");
  console.log("  ✓ veille avant divulgation : aucune capture");
}

// ---------------------------------------------------------------------------
// 5. Le dialogue socratique n'est gardé que s'il a été travaillé
// ---------------------------------------------------------------------------

async function testDialogue() {
  const faible = "fais mes devoirs de maths";
  const env = makeEnv({ filNeuf: true });
  env.adapter.handlers.shouldIntercept(faible);
  env.adapter.handlers.onIntercept(faible);
  env.captured.modal.onSend("texte final", {
    rounds: 2,
    answersCount: 2,
    rerolls: 0,
    answers: [
      { q: "Ta tentative ?", a: "2x+3=7", axis: "hypothese" },
      { q: "Ton contexte ?", a: "contrôle demain", axis: "contexte" },
    ],
  });
  await tick();
  const e = env.store.events[0];
  assert.strictEqual(e.dialogue.length, 2, "le raisonnement est gardé en local");
  assert.strictEqual(e.dialogue[0].a, "2x+3=7");

  const vide = makeEnv({ filNeuf: true });
  vide.adapter.handlers.shouldIntercept(faible);
  vide.adapter.handlers.onIntercept(faible);
  vide.captured.modal.onSend("texte final", { rounds: 1, answersCount: 0, rerolls: 0, answers: [] });
  await tick();
  assert.strictEqual(vide.store.events[0].dialogue, null, "aucune réponse : pas de dialogue vide en base");
  console.log("  ✓ dialogue socratique enregistré (et null quand il est vide)");
}

// ---------------------------------------------------------------------------
// 6. Plusieurs prompts s'accumulent, sans écrasement
// ---------------------------------------------------------------------------

async function testAccumulation() {
  const env = makeEnv();
  for (const t of [
    "Explique la photosynthèse pour un cours de SVT de seconde",
    "Résume ce chapitre sur la guerre froide pour mes révisions",
    "Analyse les causes de la crise de 1929 pour ma dissertation",
  ]) {
    env.adapter.handlers.onSubmit(t);
    await tick();
  }
  assert.strictEqual(env.store.events.length, 3, "trois prompts, trois événements");
  const ids = new Set(env.store.events.map((e) => e.id));
  assert.strictEqual(ids.size, 3, "les identifiants sont distincts");
  assert.ok(env.store.events.every((e) => e.synced === false), "tous restent à pousser");
  console.log("  ✓ accumulation : trois prompts, trois événements distincts");
}

// ---------------------------------------------------------------------------
// 7. Cadence « unité de tâche » : la modale coache les OUVERTURES de fil
// ---------------------------------------------------------------------------

// Règle produit (V3.6) : on intercepte le premier message d'une conversation,
// puis on laisse dérouler. Dans un fil lancé, seul un décrochage RÉPÉTÉ sur
// des tours substantiels ramène la modale. Ce test l'a découvert en échouant :
// autant le verrouiller.
async function testCadence() {
  const faible = "fais mes devoirs de maths";

  const neuf = makeEnv({ filNeuf: true });
  assert.strictEqual(neuf.adapter.handlers.shouldIntercept(faible), true, "ouverture de fil : intercepté");

  const lance = makeEnv();
  assert.strictEqual(lance.adapter.handlers.shouldIntercept(faible), false, "fil lancé, tour court : on laisse dérouler");

  // Trois tours substantiels bien en dessous du seuil : ré-entrée honnête.
  const decroche = makeEnv();
  const tour = "donne moi juste la réponse complète sans explication tout de suite maintenant";
  const verdicts = [1, 2, 3].map(() => decroche.adapter.handlers.shouldIntercept(tour));
  assert.deepStrictEqual(verdicts, [false, false, true], "trois décrochages consécutifs ramènent la modale");

  // Et l'événement de ce tour-là est bien enregistré comme une interception.
  decroche.adapter.handlers.onIntercept(tour);
  decroche.captured.modal.onSendAnyway({ rounds: 1, answersCount: 0, rerolls: 0, answers: [] });
  await tick();
  assert.strictEqual(decroche.store.events[0].intercepted, true);
  console.log("  ✓ cadence : ouverture coachée, fil lancé laissé libre, décrochage rattrapé");
}

(async () => {
  await testPromptFort();
  await testCadence();
  await testQuatreIssues();
  await testTexteDuPrompt();
  await testVeille();
  await testDialogue();
  await testAccumulation();
  console.log("capture.test.js : le chemin d'enregistrement est intact ✓");
  process.exit(0);
})();
