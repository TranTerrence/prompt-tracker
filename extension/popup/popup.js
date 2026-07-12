// Popup : login, stats rapides, réglages (dont thème), export CSV.
// Les stats détaillées vivent dans le dashboard web ; ici, l'essentiel.

const DASHBOARD_URL = "http://localhost:3000"; // URL Vercel en production
const t = (...a) => CoachI18n.t(...a);

/* ---------- i18n ---------- */

for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
document.getElementById("auth-email").placeholder = t("authEmail");
document.getElementById("auth-password").placeholder = t("authPassword");
document.getElementById("auth-login").textContent = t("authLogin");
document.getElementById("auth-signup").textContent = t("authSignup");
document.getElementById("open-dashboard").textContent = t("authDashboard");
document.getElementById("auth-logout").textContent = t("authLogout");
document.getElementById("export").textContent = t("popupExport");
document.getElementById("reset").textContent = t("popupReset");

/* ---------- Thème ---------- */

function applyTheme(setting) {
  const dark =
    setting === "dark" ||
    (setting === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  for (const btn of document.querySelectorAll("[data-theme-choice]")) {
    btn.classList.toggle("active", btn.dataset.themeChoice === setting);
  }
}

for (const btn of document.querySelectorAll("[data-theme-choice]")) {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.themeChoice;
    applyTheme(theme);
    chrome.storage.local.get("settings", (data) => {
      chrome.storage.local.set({ settings: { ...(data.settings || {}), theme } });
    });
  });
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  chrome.storage.local.get("settings", (data) => applyTheme((data.settings || {}).theme || "light"));
});

/* ---------- Authentification & sync ---------- */

function showAuthState(session, profile, orgConfig, pendingCount) {
  const form = document.getElementById("auth-form");
  const connected = document.getElementById("auth-connected");
  if (session) {
    form.hidden = true;
    connected.hidden = false;
    document.getElementById("auth-user").textContent = session.email || t("authConnected");
    document.getElementById("auth-org").textContent =
      orgConfig && orgConfig.branding ? orgConfig.branding.name : t("authNoOrg");
    document.getElementById("sync-status").textContent = pendingCount ? t("authPending", pendingCount) : t("authSynced");
    if (orgConfig && orgConfig.branding) {
      document.getElementById("brand-title").textContent = orgConfig.branding.name;
      if (orgConfig.branding.color) {
        document.documentElement.style.setProperty("--accent", orgConfig.branding.color);
      }
    }
  } else {
    form.hidden = false;
    connected.hidden = true;
  }
}

function authError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.hidden = !message;
}

async function handleAuth(kind) {
  authError("");
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) return authError(t("authRequired"));
  try {
    const session = kind === "login" ? await CoachApi.login(email, password) : await CoachApi.signup(email, password);
    if (!session) return authError(t("authConfirm"));
    chrome.runtime.sendMessage({ type: "sync-now" }, () => refreshAuthUi());
  } catch (e) {
    authError(e.message === "Invalid login credentials" ? t("authInvalid") : e.message);
  }
}

function refreshAuthUi() {
  chrome.storage.local.get(["session", "profile", "orgConfig", "events"], (data) => {
    const pending = (data.events || []).filter((e) => !e.synced).length;
    showAuthState(data.session, data.profile, data.orgConfig, pending);
  });
}

document.getElementById("auth-login").addEventListener("click", () => handleAuth("login"));
document.getElementById("auth-signup").addEventListener("click", () => handleAuth("signup"));
document.getElementById("auth-logout").addEventListener("click", async () => {
  await CoachApi.logout();
  refreshAuthUi();
});
document.getElementById("open-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});
refreshAuthUi();

/* ---------- Stats locales ---------- */

const RUBRICS = [
  ["clarte", { fr: "Clarté", en: "Clarity" }],
  ["contexte", { fr: "Contexte", en: "Context" }],
  ["iteration", { fr: "Itération", en: "Iteration" }],
  ["critique", { fr: "Esprit critique", en: "Critical thinking" }],
];

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function render(events, threshold) {
  document.getElementById("stat-count").textContent = events.length;

  // La métrique principale est le PREMIER JET : ce que l'utilisateur écrit
  // seul, avant tout coaching. C'est la seule mesure honnête de l'apprentissage.
  const firstDrafts = events.map((e) => CoachScoring.firstDraftScore(e)).filter((s) => s !== null);
  document.getElementById("stat-score").textContent = firstDrafts.length ? `${Math.round(avg(firstDrafts))}/100` : "–";

  const now = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  const draft = (e) => CoachScoring.firstDraftScore(e);
  const recent = events.filter((e) => now - Date.parse(e.ts) < week).map(draft).filter((s) => s !== null);
  const before = events.filter((e) => now - Date.parse(e.ts) >= week && now - Date.parse(e.ts) < 2 * week).map(draft).filter((s) => s !== null);
  const trendEl = document.getElementById("stat-trend");
  if (recent.length && before.length) {
    const delta = Math.round(avg(recent) - avg(before));
    trendEl.textContent = `${delta >= 0 ? "+" : ""}${delta}`;
  } else {
    trendEl.textContent = "–";
  }

  // Série de jours où les premiers jets tiennent le seuil : on célèbre
  // l'autonomie, pas la dépendance au coaching.
  const streak = CoachScoring.dayStreak(events, threshold);
  const streakEl = document.getElementById("stat-mirror");
  streakEl.textContent = streak ? `${streak} 🔥` : "–";
  streakEl.parentElement.title = t("popupStreakTitle", streak);

  const rubricsEl = document.getElementById("rubrics");
  rubricsEl.textContent = "";
  if (!events.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = t("popupEmpty");
    rubricsEl.appendChild(p);
  } else {
    for (const [key, labels] of RUBRICS) {
      const value = avg(events.map((e) => e.scores[key]));
      const rubric = document.createElement("div");
      rubric.className = "rubric";
      const row = document.createElement("div");
      row.className = "row";
      const name = document.createElement("span");
      name.textContent = labels[CoachI18n.lang] || labels.fr;
      const val = document.createElement("span");
      val.textContent = `${value.toFixed(1)}/25`;
      row.append(name, val);
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.className = "fill";
      fill.style.width = `${(value / 25) * 100}%`;
      bar.appendChild(fill);
      rubric.append(row, bar);
      rubricsEl.appendChild(rubric);
    }
  }

  const byCategory = {};
  for (const e of events) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  const catEl = document.getElementById("categories");
  catEl.textContent = "";
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = count;
    li.append(`${cat} `, b);
    catEl.appendChild(li);
  }
}

function toCsv(events) {
  const header = ["date", "site", "categorie", "mots", "clarte", "contexte", "iteration", "critique", "total", "intercepte", "issue", "score_avant", "score_apres", "tours", "reponses", "miroir_affiche", "miroir_feedback", "texte"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = events.map((e) =>
    [e.ts, e.site, e.category, e.words, e.scores.clarte, e.scores.contexte, e.scores.iteration, e.scores.critique, e.scores.total, e.intercepted ?? false, e.outcome ?? "", e.scoreBefore ?? "", e.scoreAfter ?? "", e.rounds ?? 0, e.answersCount ?? 0, e.mirrorShown, e.mirrorFeedback ?? "", e.text ?? ""].map(escape).join(";")
  );
  return [header.join(";"), ...rows].join("\n");
}

chrome.storage.local.get(["events", "settings", "health_chatgpt", "health_claude", "health_gemini"], (data) => {
  const events = data.events || [];
  const settings = { captureMode: "metadata", interceptEnabled: true, threshold: 40, theme: "light", ...(data.settings || {}) };
  render(events, settings.threshold);

  applyTheme(settings.theme);
  document.getElementById("setting-mirror").checked = settings.interceptEnabled;
  document.getElementById("setting-fulltext").checked = settings.captureMode === "full";
  document.getElementById("setting-threshold").value = settings.threshold;
  document.getElementById("threshold-value").textContent = settings.threshold;

  // Fading : quand les séries réussies ont relevé la barre, on le dit.
  const eff = CoachScoring.adaptiveThreshold(events, settings.threshold);
  const effEl = document.getElementById("eff-threshold");
  const effText = t("popupEffThreshold", settings.threshold, eff);
  effEl.textContent = effText;
  effEl.hidden = !effText;

  const broken = [
    ["ChatGPT", data.health_chatgpt],
    ["Claude", data.health_claude],
    ["Gemini", data.health_gemini],
  ].filter(([, h]) => h && !h.healthy);
  if (broken.length) {
    const el = document.getElementById("health");
    el.textContent = t("popupHealthBroken", broken.map(([site]) => site).join(", "));
    el.hidden = false;
  }
});

document.getElementById("setting-mirror").addEventListener("change", (e) => {
  chrome.storage.local.get("settings", (data) => {
    chrome.storage.local.set({ settings: { ...(data.settings || {}), interceptEnabled: e.target.checked } });
  });
});

document.getElementById("setting-threshold").addEventListener("input", (e) => {
  const threshold = Number(e.target.value);
  document.getElementById("threshold-value").textContent = threshold;
  chrome.storage.local.get("settings", (data) => {
    chrome.storage.local.set({ settings: { ...(data.settings || {}), threshold } });
  });
});

document.getElementById("setting-fulltext").addEventListener("change", (e) => {
  chrome.storage.local.get("settings", (data) => {
    chrome.storage.local.set({ settings: { ...(data.settings || {}), captureMode: e.target.checked ? "full" : "metadata" } });
  });
});

document.getElementById("export").addEventListener("click", () => {
  chrome.storage.local.get("events", (data) => {
    const blob = new Blob(["﻿" + toCsv(data.events || [])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
});

document.getElementById("reset").addEventListener("click", () => {
  if (confirm(t("popupResetConfirm"))) {
    chrome.storage.local.remove(
      ["events", "postEvents", "postConvs", "postCount", "health_chatgpt", "health_claude", "health_gemini"],
      () => render([], 40)
    );
  }
});
