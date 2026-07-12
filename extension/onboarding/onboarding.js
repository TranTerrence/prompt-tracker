// Onboarding post-installation : promesse, fonctionnement local-first,
// choix du thème et du niveau de friction. Tout est persisté dans settings.

const t = (...a) => CoachI18n.t(...a);

const STRINGS = {
  "ob-title": "obTitle",
  "ob-subtitle": "obSubtitle",
  "ob-pitch": "obPitch",
  "ob-how": "obHow",
  "ob-step1": "obStep1",
  "ob-step2": "obStep2",
  "ob-step3": "obStep3",
  "ob-privacy-title": "obPrivacyTitle",
  "ob-privacy": "obPrivacy",
  "ob-profile-title": "obProfileTitle",
  "ob-profile-hint": "obProfileHint",
  "profile-student": "profileStudent",
  "profile-consultant": "profileConsultant",
  "profile-employee": "profileEmployee",
  "profile-other": "profileOther",
  "ob-theme-title": "obThemeTitle",
  "ob-threshold-title": "obThresholdTitle",
  "ob-threshold-hint": "obThresholdHint",
  "ob-sites": "obSites",
  "ob-try": "obTry",
  cta: "obCta",
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

chrome.storage.local.get("settings", (data) => {
  const settings = { theme: "light", threshold: 40, profile: null, ...(data.settings || {}) };
  applyTheme(settings.theme);
  applyProfile(settings.profile);
  document.getElementById("setting-threshold").value = settings.threshold;
  document.getElementById("threshold-value").textContent = settings.threshold;
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

document.getElementById("cta").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://chatgpt.com" });
  window.close();
});
