// Service worker : synchronisation en arrière-plan.
// - toutes les minutes : pousse les événements non synchronisés (file offline)
// - toutes les 15 minutes : rafraîchit la config de l'organisation (branding, seuil...)
// Les alarmes réveillent le worker même s'il a été déchargé par Chrome.

importScripts("/src/supabase.js");

chrome.runtime.onInstalled.addListener((details) => {
  setupAlarms();
  // Première installation : onboarding (promesse, thème, niveau de friction).
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
  }
});
chrome.runtime.onStartup.addListener(setupAlarms);

function setupAlarms() {
  chrome.alarms.create("sync-events", { periodInMinutes: 1 });
  chrome.alarms.create("refresh-config", { periodInMinutes: 15 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === "sync-events") await CoachApi.syncEvents();
    if (alarm.name === "refresh-config") await CoachApi.refreshOrgConfig();
  } catch (e) {
    // Hors-ligne ou non connecté : on réessaiera à la prochaine alarme.
    console.debug("[coach-ia] sync différée:", e.message);
  }
});

// Le popup (après login) ou le content script peuvent demander une action immédiate.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "sync-now") {
    Promise.all([CoachApi.refreshOrgConfig(), CoachApi.syncEvents()])
      .then(([config, sync]) => sendResponse({ ok: true, config, sync }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // réponse asynchrone
  }
  if (msg && msg.type === "llm-question") {
    // Prochaine question du dialogue itératif, générée à partir de tout l'échange.
    CoachApi.llmNextQuestion(msg.prompt, msg.dialogue || [])
      .then((question) => sendResponse({ question }))
      .catch(() => sendResponse({ question: null }));
    return true;
  }
});
