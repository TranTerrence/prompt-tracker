// Service worker : synchronisation en arrière-plan.
// - toutes les minutes : pousse les événements non synchronisés (file offline)
// - toutes les 15 minutes : rafraîchit la config de l'organisation (branding, seuil...)
// Les alarmes réveillent le worker même s'il a été déchargé par Chrome.

// Chrome/Safari : service worker → importScripts. Firefox : event page (le
// manifest Firefox charge src/supabase.js via background.scripts, cf. package.sh).
if (typeof importScripts === "function") importScripts("/src/supabase.js");

chrome.runtime.onInstalled.addListener((details) => {
  setupAlarms();
  // Première installation : onboarding = divulgation des données + accord
  // explicite. Tant qu'il n'est pas donné, l'extension est inerte.
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
  }
});
chrome.runtime.onStartup.addListener(setupAlarms);

// Les alarmes ne s'arment qu'après l'acceptation de la divulgation :
// « inerte avant accord » vaut aussi pour le worker.
function setupAlarms() {
  chrome.storage.local.get("disclosure", (data) => {
    if (!data.disclosure || !data.disclosure.accepted) return;
    chrome.alarms.create("sync-events", { periodInMinutes: 1 });
    chrome.alarms.create("refresh-config", { periodInMinutes: 15 });
  });
}

// L'acceptation dans l'onboarding arme les alarmes sans attendre un redémarrage.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.disclosure && changes.disclosure.newValue && changes.disclosure.newValue.accepted) {
    setupAlarms();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === "sync-events") {
      await CoachApi.syncEvents();
      await CoachApi.syncPostEvents();
    }
    if (alarm.name === "refresh-config") await CoachApi.refreshOrgConfig();
  } catch (e) {
    // Hors-ligne ou non connecté : on réessaiera à la prochaine alarme.
    // L'échec est déjà consigné dans syncStatus par CoachApi (mode visible).
    console.debug("[coach-ia] sync différée:", e.message);
  } finally {
    await refreshActionBadge();
  }
});

// Une file qui grossit sans repartir doit se voir sans ouvrir le popup. Le
// seuil évite d'alarmer sur un simple passage hors-ligne : c'est la STAGNATION
// qu'on signale, pas un retard. `action` est déjà déclaré, aucune permission
// nouvelle n'est requise.
const BADGE_PENDING_THRESHOLD = 20;

async function refreshActionBadge() {
  const { syncStatus } = await new Promise((r) => chrome.storage.local.get("syncStatus", r));
  const stuck =
    syncStatus &&
    (syncStatus.reason || syncStatus.error) &&
    syncStatus.pending > BADGE_PENDING_THRESHOLD;
  await chrome.action.setBadgeText({ text: stuck ? "!" : "" });
  if (stuck) await chrome.action.setBadgeBackgroundColor({ color: "#c97b2d" });
}

/* ---------- Bibliothèque de prompts de l'organisation ---------- */

// L'organisation publie un JSON ; l'extension le LIT, sans rien envoyer.
// Aucune identité ne quitte la machine vers cet hôte : `credentials: "omit"`,
// aucun en-tête d'authentification, aucun paramètre dérivé du compte. C'est un
// contenu publié par l'école, jamais un canal de remontée — c'est la seule
// forme défendable au regard de notre propre politique de consentement.
//
// La permission d'hôte est FACULTATIVE (optional_host_permissions) et demandée
// depuis le popup, sur la seule origine de l'organisation. Tant qu'elle n'est
// pas accordée, on ne tente même pas la requête, et tout le reste de
// l'extension fonctionne à l'identique.
const LIBRARY_TTL_MS = 6 * 3600 * 1000;
const LIBRARY_MAX_BYTES = 256 * 1024;
const LIBRARY_MAX_PROMPTS = 200;
const LIBRARY_TIMEOUT_MS = 4000;

const store = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
  remove: (keys) => new Promise((r) => chrome.storage.local.remove(keys, r)),
};

// Motif d'origine pour chrome.permissions : on ne demande JAMAIS plus que
// l'origine exacte configurée par l'organisation.
function libraryOrigin(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? `${u.origin}/*` : null;
  } catch {
    return null;
  }
}

// Tout ce qui vient du réseau est hostile jusqu'à preuve du contraire : on ne
// garde que des champs connus, bornés en taille et en nombre. Les champs
// inconnus sont ignorés (le format peut grandir sans casser les vieux clients).
function normalizeLibrary(data) {
  if (!data || !Array.isArray(data.prompts)) return null;
  const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
  const out = [];
  for (const p of data.prompts) {
    const body = p && str(p.body, 4000);
    if (!body) continue;
    out.push({
      id: str(p.id, 64) || `p${out.length}`,
      title: str(p.title, 120) || body.slice(0, 60),
      body,
      kind: p.kind === "peer" ? "peer" : "official",
      category: str(p.category, 40),
      lang: p.lang === "en" ? "en" : p.lang === "fr" ? "fr" : null,
      copies: count(p.copies),
      helpful: count(p.helpful),
      author: str(p.author, 80),
    });
    if (out.length >= LIBRARY_MAX_PROMPTS) break;
  }
  return out.length ? out : null;
}

// Firefox expose `chrome.permissions` en style RAPPEL — les promesses vivent
// sur `browser.*`. Un `await chrome.permissions.contains(...)` y renverrait
// undefined, donc « pas accordée », et la bibliothèque ne se chargerait jamais
// sur le paquet Gecko. Le rappel est le dénominateur commun : Chrome
// l'accepte aussi.
function hasOriginPermission(origin) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ origins: [origin] }, (granted) => resolve(Boolean(granted)));
    } catch {
      resolve(false);
    }
  });
}

async function loadLibrary(force = false) {
  const { orgConfig, promptLibrary } = await store.get(["orgConfig", "promptLibrary"]);
  const url = (orgConfig && orgConfig.libraryUrl) || null;
  if (!url) {
    // L'organisation a retiré sa bibliothèque : on ne garde pas un cache
    // orphelin qui continuerait de s'afficher.
    if (promptLibrary) await store.remove("promptLibrary");
    return null;
  }
  const cached = promptLibrary && promptLibrary.url === url ? promptLibrary : null;
  if (!force && cached && Date.now() - cached.fetchedAt < LIBRARY_TTL_MS) return cached.prompts;

  const origin = libraryOrigin(url);
  if (!origin) return cached ? cached.prompts : null;
  const granted = await hasOriginPermission(origin);
  if (!granted) return cached ? cached.prompts : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIBRARY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const text = await res.text();
    if (text.length > LIBRARY_MAX_BYTES) throw new Error("too_large");
    const prompts = normalizeLibrary(JSON.parse(text));
    if (!prompts) throw new Error("empty");
    await store.set({ promptLibrary: { url, fetchedAt: Date.now(), prompts } });
    return prompts;
  } catch (e) {
    // Hôte injoignable, JSON cassé, permission révoquée entre-temps : on sert
    // le cache s'il existe et on se tait. Une bibliothèque indisponible ne
    // doit jamais dégrader le dialogue socratique.
    console.debug("[coach-ia] bibliothèque indisponible:", e.message);
    return cached ? cached.prompts : null;
  } finally {
    clearTimeout(timer);
  }
}

// Le popup (après login) ou le content script peuvent demander une action immédiate.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "sync-now") {
    // refreshOrgConfig d'abord, en séquence : c'est lui qui redescend
    // baseline_consent_at du serveur, et syncEvents le lit juste après. En
    // parallèle, une jonction faite sur le web ne serait prise en compte qu'au
    // cycle suivant.
    CoachApi.refreshOrgConfig()
      .then((config) =>
        CoachApi.syncEvents().then((sync) =>
          CoachApi.syncPostEvents().then((postSync) => ({ ok: true, config, sync, postSync }))
        )
      )
      .catch((e) => ({ ok: false, error: e.message }))
      .then((res) => refreshActionBadge().then(() => sendResponse(res)));
    return true; // réponse asynchrone
  }
  if (msg && msg.type === "library-fetch") {
    loadLibrary(Boolean(msg.force))
      .then((prompts) => sendResponse({ prompts }))
      .catch(() => sendResponse({ prompts: null }));
    return true;
  }
  if (msg && msg.type === "llm-question") {
    // Prochaine question du dialogue itératif, générée à partir de tout
    // l'échange. Les options pilotent la langue, l'exigence (depth) et la
    // relance (intent/rejected) côté edge function.
    CoachApi.llmNextQuestion(msg.prompt, msg.dialogue || [], {
      lang: msg.lang,
      intent: msg.intent,
      rejected: msg.rejected,
      askedQuestions: msg.askedQuestions,
      depth: msg.depth,
    })
      .then((question) => sendResponse({ question }))
      .catch(() => sendResponse({ question: null }));
    return true;
  }
});
