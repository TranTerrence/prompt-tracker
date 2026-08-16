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
