// Onboarding post-installation : divulgation bien visible des données
// (Chrome Web Store, User Data Privacy) + réglages (thème, friction, profil).
// L'extension reste inerte tant que « J'accepte et j'active » n'a pas été
// cliqué : le flag `disclosure` est la seule chose qui arme la capture.

const t = (...a) => CoachI18n.t(...a);

const STRINGS = {
  "ob-title": "obTitle",
  "ob-subtitle": "obSubtitle",
  "ob-pitch": "obPitch",
  "ob-how": "obHow",
  "ob-step1": "obStep1",
  "ob-step2": "obStep2",
  "ob-step3": "obStep3",
  "ob-disc-title": "obDiscTitle",
  "ob-disc-collect-title": "obDiscCollectTitle",
  "ob-disc-collect": "obDiscCollect",
  "ob-disc-purpose-title": "obDiscPurposeTitle",
  "ob-disc-purpose": "obDiscPurpose",
  "ob-disc-where-title": "obDiscWhereTitle",
  "ob-disc-where": "obDiscWhere",
  "ob-disc-retention-title": "obDiscRetentionTitle",
  "ob-disc-retention": "obDiscRetention",
  "ob-disc-policy": "obDiscPolicyLink",
  "ob-profile-title": "obProfileTitle",
  "ob-profile-hint": "obProfileHint",
  "ob-intention-title": "obIntentionTitle",
  "ob-intention-hint": "obIntentionHint",
  "profile-student": "profileStudent",
  "profile-consultant": "profileConsultant",
  "profile-employee": "profileEmployee",
  "profile-other": "profileOther",
  "ob-theme-title": "obThemeTitle",
  "ob-threshold-title": "obThresholdTitle",
  "ob-threshold-hint": "obThresholdHint",
  "ob-sites": "obSites",
  "ob-try": "obTry",
  accept: "obAccept",
  later: "obLater",
  "theme-light": "themeLight",
  "theme-dark": "themeDark",
  "theme-system": "themeSystem",
};
for (const [id, key] of Object.entries(STRINGS)) document.getElementById(id).textContent = t(key);
document.documentElement.lang = CoachI18n.lang;

function applyTheme(setting) {
  const dark =
    setting === "dark" ||
    (setting === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  for (const btn of document.querySelectorAll("[data-theme-choice]")) {
    btn.classList.toggle("active", btn.dataset.themeChoice === setting);
  }
}

function saveSettings(patch) {
  chrome.storage.local.get("settings", (data) => {
    chrome.storage.local.set({ settings: { ...(data.settings || {}), ...patch } });
  });
}

function applyProfile(profile) {
  for (const btn of document.querySelectorAll("[data-profile-choice]")) {
    btn.classList.toggle("active", btn.dataset.profileChoice === profile);
  }
}

function showAccepted() {
  const accept = document.getElementById("accept");
  accept.textContent = t("obAccepted");
  accept.disabled = true;
  document.getElementById("later").hidden = true;
  document.getElementById("ob-try").hidden = false;
}

chrome.storage.local.get(["settings", "disclosure"], (data) => {
  const settings = { theme: "light", threshold: 40, profile: null, ...(data.settings || {}) };
  applyTheme(settings.theme);
  applyProfile(settings.profile);
  document.getElementById("setting-threshold").value = settings.threshold;
  document.getElementById("threshold-value").textContent = settings.threshold;
  document.getElementById("setting-intention").value = settings.intentionPlan || t("obIntentionDefault");
  // Ré-ouverture après acceptation (ex. depuis le popup) : état déjà actif.
  if (data.disclosure && data.disclosure.accepted) showAccepted();
});

for (const btn of document.querySelectorAll("[data-theme-choice]")) {
  btn.addEventListener("click", () => {
    applyTheme(btn.dataset.themeChoice);
    saveSettings({ theme: btn.dataset.themeChoice });
  });
}

// Profil d'usage : ne change pas la mécanique, seulement le vocabulaire des
// questions (« ton devoir » vs « ton livrable client »).
for (const btn of document.querySelectorAll("[data-profile-choice]")) {
  btn.addEventListener("click", () => {
    applyProfile(btn.dataset.profileChoice);
    saveSettings({ profile: btn.dataset.profileChoice });
  });
}

document.getElementById("setting-threshold").addEventListener("input", (e) => {
  const threshold = Number(e.target.value);
  document.getElementById("threshold-value").textContent = threshold;
  saveSettings({ threshold });
});

// Intention d'implémentation (Gollwitzer) : le plan est rappelé tel quel dans
// la modale les 6 premières semaines (intentionSetAt fait foi), puis s'efface.
document.getElementById("setting-intention").addEventListener("change", (e) => {
  const plan = e.target.value.trim();
  saveSettings(plan ? { intentionPlan: plan, intentionSetAt: new Date().toISOString() } : { intentionPlan: null, intentionSetAt: null });
});

// Acte affirmatif : seule cette écriture arme la capture (content.js et
// background.js vérifient `disclosure.accepted` avant toute action).
document.getElementById("accept").addEventListener("click", () => {
  // Firefox n'accorde pas les permissions d'hôte à l'installation : on les
  // demande ici, dans le geste utilisateur de l'accord (Chrome les a déjà,
  // l'appel est alors silencieux). Refus partiel possible : l'extension
  // fonctionnera sur les sites accordés.
  const origins = (chrome.runtime.getManifest().content_scripts || []).flatMap((cs) => cs.matches || []);
  if (chrome.permissions && chrome.permissions.request && origins.length) {
    try {
      chrome.permissions.request({ origins }, () => void chrome.runtime.lastError);
    } catch (_) {
      /* environnement sans support : rien à demander */
    }
  }
  const plan = document.getElementById("setting-intention").value.trim();
  if (plan) saveSettings({ intentionPlan: plan, intentionSetAt: new Date().toISOString() });
  chrome.storage.local.set(
    { disclosure: { accepted: true, version: 1, acceptedAt: new Date().toISOString() } },
    showAccepted
  );
});

// Refus implicite : l'onglet se ferme, rien n'est capturé, le popup propose
// de revenir sur cet écran à tout moment.
document.getElementById("later").addEventListener("click", (e) => {
  e.preventDefault();
  window.close();
});
