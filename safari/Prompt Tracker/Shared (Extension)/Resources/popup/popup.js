// Popup : login, stats rapides, réglages (dont thème), export CSV.
// Les stats détaillées vivent dans le dashboard web ; ici, l'essentiel.

const DASHBOARD_URL = "https://track-prompt.vercel.app";

// Garde-fou : une erreur d'init ne doit jamais laisser un popup vide et muet
// (retour terrain). i18n peut être la cause : message bilingue en dur.
window.addEventListener("error", (event) => {
  const el = document.getElementById("fatal");
  if (!el || !el.hidden) return;
  el.textContent =
    "Le popup a rencontré une erreur : " + event.message +
    ". Recharge l'extension via chrome://extensions. / The popup hit an error, reload the extension from chrome://extensions.";
  el.hidden = false;
});

const t = (...a) => CoachI18n.t(...a);

/* ---------- Affichage du score : réglage d'organisation ---------- */

// Une organisation peut masquer TOUT ce qui est chiffré (demande I-BE³ : ce
// que l'étudiant doit lire est un comportement — « ai-je réfléchi avant de
// demander » — et non une note sur cent, qui se transforme immédiatement en
// objectif à optimiser). Le score continue d'être calculé, stocké et
// synchronisé : seul l'AFFICHAGE disparaît. Masquer le total en laissant
// quatre rubriques sur 25 déplacerait le problème au lieu de le régler, d'où
// la tendance hebdomadaire (un delta de score) et le seuil dans le lot.
let showScore = true;

function applyScoreVisibility() {
  document.getElementById("stat-score-tile").hidden = !showScore;
  document.getElementById("stat-trend-tile").hidden = !showScore;
  document.getElementById("rubrics-section").hidden = !showScore;
  document.getElementById("threshold-row").hidden = !showScore;
  if (!showScore) document.getElementById("eff-threshold").hidden = true;
}

// Derniers arguments de render : la config d'organisation arrive de façon
// asynchrone et doit pouvoir redessiner sans relire le stockage.
let lastRenderedEvents = [];
let lastRenderedThreshold = 40;


/* ---------- i18n ---------- */

for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
document.getElementById("auth-email").placeholder = t("authEmail");
document.getElementById("auth-password").placeholder = t("authPassword");
document.getElementById("auth-login").textContent = t("authLogin");
document.getElementById("auth-signup").textContent = t("authSignup");
document.getElementById("pair-intro").textContent = t("pairIntro");
document.getElementById("pair-start").textContent = t("pairStart");
document.getElementById("pair-reopen").textContent = t("pairReopen");
document.getElementById("pair-cancel").textContent = t("pairCancel");
document.getElementById("auth-fallback-summary").textContent = t("authFallback");
document.getElementById("open-dashboard").textContent = t("authDashboard");
document.getElementById("auth-logout").textContent = t("authLogout");
document.getElementById("export").textContent = t("popupExport");
document.getElementById("reset").textContent = t("popupReset");
document.getElementById("privacy-link").textContent = t("popupPrivacyLink");
document.getElementById("method-link").textContent = t("popupMethodLink");
document.getElementById("inert-text").textContent = t("popupInertBanner");
document.getElementById("inert-cta").textContent = t("popupInertCta");

/* ---------- Veille avant acceptation de la divulgation ---------- */

// Tant que la divulgation (onboarding) n'a pas été acceptée, l'extension est
// inerte : bandeau explicite, compte et réglages masqués, rien n'est capturé.
// Version courante du texte de divulgation. À incrémenter dès que la liste
// de ce qui est enregistré change (miroir de onboarding/onboarding.js).
const DISCLOSURE_VERSION = 2;

chrome.storage.local.get("disclosure", (data) => {
  const accepted = Boolean(data.disclosure && data.disclosure.accepted);
  document.getElementById("inert-banner").hidden = accepted;
  document.getElementById("auth").hidden = !accepted;
  document.querySelector(".settings").hidden = !accepted;

  // Divulgation acceptée sur une version antérieure du texte : on INFORME.
  // Pas de retour en veille — même finalité, mêmes catégories de données
  // (des indicateurs, aucun contenu). Couper une classe en cours d'année
  // pour un ajout d'indicateurs serait disproportionné.
  const seen = (data.disclosure && data.disclosure.version) || 0;
  if (accepted && seen < DISCLOSURE_VERSION) {
    const box = document.getElementById("disclosure-update");
    document.getElementById("disclosure-update-text").textContent = t("disclosureUpdate");
    document.getElementById("disclosure-update-ok").textContent = t("disclosureUpdateOk");
    box.hidden = false;
    document.getElementById("disclosure-update-ok").addEventListener("click", () => {
      chrome.storage.local.set(
        { disclosure: { ...data.disclosure, version: DISCLOSURE_VERSION } },
        () => (box.hidden = true)
      );
    });
  }
});

document.getElementById("inert-cta").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
});

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
    // Sans organisation : proposer le rattachement par code de classe.
    // Avec : l'accès permanent aux choix de partage (consentement).
    document.getElementById("join-org").hidden = Boolean(orgConfig);
    document.getElementById("open-consent").hidden = !orgConfig;
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

/* ---------- Rejoindre une classe par code ---------- */

document.getElementById("join-code").placeholder = t("joinCodePlaceholder");
document.getElementById("join-submit").textContent = t("joinCta");
document.getElementById("open-consent").textContent = t("popupConsentLink");
document.getElementById("join-disc-title").textContent = t("joinDiscTitle");
document.getElementById("join-disc-body").textContent = t("joinDiscBody");
document.getElementById("join-disc-accept").textContent = t("joinDiscAccept");
document.getElementById("join-disc-cancel").textContent = t("joinDiscCancel");

const CONSENT_URL = chrome.runtime.getURL("consent/consent.html");
document.getElementById("open-consent").addEventListener("click", () => {
  chrome.tabs.create({ url: CONSENT_URL });
});

function joinError(message) {
  const el = document.getElementById("join-error");
  el.textContent = message;
  el.hidden = !message;
}

// Jonction en deux temps (divulgation bien visible) : le premier clic déplie
// ce que « rejoindre » partage avec l'organisation ; seul le bouton d'accord
// déclenche réellement la jonction, et donc la synchronisation.
document.getElementById("join-submit").addEventListener("click", () => {
  joinError("");
  if (!document.getElementById("join-code").value.trim()) return;
  document.getElementById("join-disclosure").hidden = false;
  document.getElementById("join-submit").disabled = true;
});

document.getElementById("join-disc-cancel").addEventListener("click", () => {
  document.getElementById("join-disclosure").hidden = true;
  document.getElementById("join-submit").disabled = false;
});

document.getElementById("join-disc-accept").addEventListener("click", async () => {
  joinError("");
  const code = document.getElementById("join-code").value.trim();
  if (!code) return;
  try {
    // L'accord donné ici couvre le socle d'indicateurs. Il part avec la
    // jonction (p_baseline_ack) et s'enregistre en base dans la même
    // transaction : joinGroup enchaîne refreshOrgConfig, qui redescend
    // baselineConsent depuis le serveur. Rien n'est écrit localement ici —
    // c'était la cause du blocage silencieux des jonctions faites sur le web.
    await CoachApi.joinGroup(code);
    document.getElementById("join-disclosure").hidden = true;
    document.getElementById("join-submit").disabled = false;
    chrome.runtime.sendMessage({ type: "sync-now" }, () => refreshAuthUi());
    // Le consentement se présente immédiatement après l'adhésion : c'est
    // l'utilisateur qui décide ce que l'organisation recevra en plus du socle.
    chrome.tabs.create({ url: CONSENT_URL });
  } catch (e) {
    if (String(e.message).includes("invalid_code")) joinError(t("joinInvalid"));
    else if (String(e.message).includes("already_in_other_org")) joinError(t("joinOtherOrg"));
    else joinError(e.message);
  }
});

/* ---------- Appairage avec le web ---------- */

// Le popup fabrique une demande, ouvre le dashboard pour l'approbation, puis
// interroge l'état. Aucun mot de passe ne transite ici.
const PAIR_POLL_MS = 3000;
let pairTimer = null;

function pairError(message) {
  const el = document.getElementById("pair-error");
  el.textContent = message;
  el.hidden = !message;
}

function pairUrl(userCode) {
  return `${DASHBOARD_URL}/extension/pair?c=${encodeURIComponent(userCode)}`;
}

function stopPairPolling() {
  if (pairTimer) clearInterval(pairTimer);
  pairTimer = null;
}

function showPairWaiting(userCode) {
  document.getElementById("pair-code").textContent = userCode;
  document.getElementById("pair-waiting-text").textContent = t("pairWaiting");
  document.getElementById("pair-waiting").hidden = false;
  document.getElementById("pair-start").disabled = true;
}

function hidePairWaiting() {
  stopPairPolling();
  document.getElementById("pair-waiting").hidden = true;
  document.getElementById("pair-start").disabled = false;
}

async function pollPairingOnce() {
  try {
    const status = await CoachApi.pollPairing();
    if (status === "approved") {
      hidePairWaiting();
      pairError("");
      chrome.runtime.sendMessage({ type: "sync-now" }, () => refreshAuthUi());
    } else if (status === "expired" || status === "used") {
      hidePairWaiting();
      pairError(t("pairExpired"));
    } else {
      pairError("");
    }
  } catch (e) {
    // Un échec de sondage est le plus souvent transitoire (réseau coupé, 5xx).
    // La demande reste valable dix minutes : on garde l'attente affichée et on
    // retentera au prochain tick, au lieu de forcer l'utilisateur à tout
    // recommencer. Seul `pairing_failed` (échange refusé côté serveur) est
    // définitif. Le message serveur brut ne remonte jamais à l'écran : il
    // n'apprend rien à l'utilisateur et expose la tuyauterie.
    if (e.message === "pairing_failed") {
      hidePairWaiting();
      pairError(t("pairFailed"));
    } else {
      pairError(t("pairRetrying"));
      console.debug("[coach-ia] sondage d'appairage différé:", e.message);
    }
  }
}

document.getElementById("pair-start").addEventListener("click", async () => {
  pairError("");
  try {
    const { user_code: userCode } = await CoachApi.startPairing();
    showPairWaiting(userCode);
    chrome.tabs.create({ url: pairUrl(userCode) });
    stopPairPolling();
    pairTimer = setInterval(pollPairingOnce, PAIR_POLL_MS);
  } catch (e) {
    pairError(e.message);
  }
});

document.getElementById("pair-reopen").addEventListener("click", () => {
  chrome.storage.local.get("pairing", (data) => {
    if (data.pairing) chrome.tabs.create({ url: pairUrl(data.pairing.userCode) });
  });
});

document.getElementById("pair-cancel").addEventListener("click", async () => {
  await CoachApi.cancelPairing();
  hidePairWaiting();
});

// Réouverture du popup pendant une demande en cours : on reprend l'attente au
// lieu de repartir de zéro (le popup se ferme dès que l'onglet prend le focus,
// c'est le cas NOMINAL, pas un cas limite).
chrome.storage.local.get("pairing", (data) => {
  if (!data.pairing) return;
  if (Date.parse(data.pairing.expiresAt) < Date.now()) {
    CoachApi.cancelPairing();
    return;
  }
  showPairWaiting(data.pairing.userCode);
  pollPairingOnce();
  pairTimer = setInterval(pollPairingOnce, PAIR_POLL_MS);
});

function authError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.hidden = !message;
}

// Impasse corrigée : une inscription avec confirmation d'e-mail renvoyait
// « vérifie ta boîte mail » et s'arrêtait là, sans aucun chemin de retour.
// On mémorise l'adresse et on affiche la reprise à la réouverture du popup.
function renderPendingSignup() {
  chrome.storage.local.get("pendingSignup", (data) => {
    const el = document.getElementById("pending-signup");
    if (!data.pendingSignup) {
      el.hidden = true;
      return;
    }
    el.textContent = t("authPendingSignup", data.pendingSignup.email);
    el.hidden = false;
    document.getElementById("auth-email").value = data.pendingSignup.email;
    document.getElementById("auth-fallback").open = true;
  });
}

async function handleAuth(kind) {
  authError("");
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) return authError(t("authRequired"));
  try {
    const session = kind === "login" ? await CoachApi.login(email, password) : await CoachApi.signup(email, password);
    if (!session) {
      await new Promise((r) =>
        chrome.storage.local.set({ pendingSignup: { email, at: Date.now() } }, r)
      );
      renderPendingSignup();
      return authError(t("authConfirm"));
    }
    await new Promise((r) => chrome.storage.local.remove("pendingSignup", r));
    renderPendingSignup();
    chrome.runtime.sendMessage({ type: "sync-now" }, () => refreshAuthUi());
  } catch (e) {
    authError(e.message === "Invalid login credentials" ? t("authInvalid") : e.message);
  }
}
renderPendingSignup();

/* ---------- Bannière de synchronisation ---------- */

// Une raison de blocage → un texte et UNE action qui la lève. Sans ce bloc,
// une sync qui ne part pas est invisible : c'est ce qui a laissé vivre le
// blocage `no_baseline_consent` pendant tout le parcours web.
const SYNC_ACTIONS = {
  // La session a expiré alors que le compte ÉTAIT lié. Distinct de
  // `not_authenticated`, qui est le mode nominal d'un usage 100 % local et
  // n'affiche volontairement rien : ici l'utilisateur perd quelque chose
  // qu'il avait, il doit l'apprendre.
  session_expired: {
    text: "syncBlockedExpired",
    cta: "syncCtaExpired",
    run: async () => document.getElementById("pair-start").click(),
  },
  no_baseline_consent: {
    text: "syncBlockedBaseline",
    cta: "syncCtaBaseline",
    run: async () => {
      await CoachApi.ackBaselineConsent();
      chrome.runtime.sendMessage({ type: "sync-now" }, () => renderSyncBanner());
    },
  },
  no_org: {
    text: "syncBlockedNoOrg",
    cta: "syncCtaNoOrg",
    run: async () => document.getElementById("join-code").focus(),
  },
  not_authenticated: {
    text: "syncBlockedNoAuth",
    cta: "syncCtaNoAuth",
    run: async () => document.getElementById("pair-start").click(),
  },
};

function renderSyncBanner() {
  chrome.storage.local.get(["syncStatus", "session"], (data) => {
    const status = data.syncStatus;
    const banner = document.getElementById("sync-banner");
    // Sans compte, l'usage 100 % local est le mode nominal : ne pas alarmer.
    const action = status && status.reason && !(status.reason === "not_authenticated" && !data.session)
      ? SYNC_ACTIONS[status.reason]
      : null;
    if (!action && !(status && status.error)) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    document.getElementById("sync-banner-text").textContent = action
      ? t(action.text)
      : t("syncBlockedError", status.error);
    const pendingEl = document.getElementById("sync-banner-pending");
    if (status.pending) {
      const since = status.oldestPendingTs
        ? new Date(status.oldestPendingTs).toLocaleDateString(CoachI18n.lang === "en" ? "en-GB" : "fr-FR")
        : null;
      pendingEl.textContent = since
        ? t("syncPendingSince", status.pending, since)
        : t("syncPending", status.pending);
      pendingEl.hidden = false;
    } else {
      pendingEl.hidden = true;
    }
    const cta = document.getElementById("sync-banner-cta");
    cta.hidden = !action;
    if (action) {
      cta.textContent = t(action.cta);
      cta.onclick = () => action.run().catch((e) => {
        document.getElementById("sync-banner-text").textContent = String(e.message);
      });
    }
  });
}

function refreshAuthUi() {
  chrome.storage.local.get(["session", "profile", "orgConfig", "events"], (data) => {
    const pending = (data.events || []).filter((e) => !e.synced).length;
    showAuthState(data.session, data.profile, data.orgConfig, pending);
    // La config d'org peut arriver APRÈS le premier rendu (sync-now au
    // chargement du popup) : on réapplique, sinon le score reste visible
    // jusqu'à la réouverture suivante.
    showScore = !(data.orgConfig && data.orgConfig.showScore === false);
    applyScoreVisibility();
    renderLibraryOffer(data.orgConfig);
    renderLibraryPanel(data.orgConfig);
    render(lastRenderedEvents, lastRenderedThreshold);
  });
  renderSyncBanner();
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

// À l'ouverture du popup, on rafraîchit config + sync : c'est le moment où
// l'utilisateur regarde. Sans ça, quelqu'un qui vient de rejoindre sa classe
// sur le web verrait encore l'ancien état pendant un quart d'heure.
chrome.storage.local.get("session", (data) => {
  if (data.session) chrome.runtime.sendMessage({ type: "sync-now" }, () => refreshAuthUi());
});

/* ---------- Bibliothèque de prompts de l'organisation ---------- */

// La permission d'hôte est facultative et se demande ICI, sur la seule origine
// publiée par l'organisation, et seulement sur un clic — `permissions.request`
// exige de toute façon un geste utilisateur. Rien n'est envoyé à cet hôte :
// l'extension le LIT, sans compte, sans jeton, sans cookie.
function libraryOrigin(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? `${u.origin}/*` : null;
  } catch {
    return null;
  }
}

function renderLibraryOffer(orgConfig) {
  const box = document.getElementById("library-offer");
  const origin = orgConfig && orgConfig.libraryUrl && libraryOrigin(orgConfig.libraryUrl);
  if (!origin) {
    box.hidden = true;
    return;
  }
  chrome.permissions.contains({ origins: [origin] }, (granted) => {
    // Déjà accordée : la carte n'a plus rien à proposer, elle disparaît.
    box.hidden = Boolean(granted);
    if (granted) return;
    const name = (orgConfig.branding && orgConfig.branding.name) || t("brandDefault");
    document.getElementById("library-offer-text").textContent = t("libraryOffer", name);
    document.getElementById("library-offer-hint").textContent = t("libraryOfferHint");
    document.getElementById("library-enable").textContent = t("libraryEnable");
  });
}

document.getElementById("library-enable").addEventListener("click", () => {
  chrome.storage.local.get("orgConfig", (data) => {
    const origin = data.orgConfig && data.orgConfig.libraryUrl && libraryOrigin(data.orgConfig.libraryUrl);
    if (!origin) return;
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      const status = document.getElementById("library-status");
      status.textContent = granted ? t("libraryEnabled") : t("libraryDenied");
      status.hidden = false;
      if (!granted) return;
      document.getElementById("library-enable").hidden = true;
      // Première récupération immédiate : sans elle, la bibliothèque
      // n'apparaîtrait qu'au prochain chargement d'un onglet de chat.
      chrome.runtime.sendMessage({ type: "library-fetch", force: true }, () => {
        if (chrome.runtime.lastError) return;
        // La liste apparaît tout de suite, sans rouvrir le popup.
        renderLibraryPanel(data.orgConfig);
      });
    });
  });
});

/* ---------- Bibliothèque consultable (0.9.0) ---------- */

// Le panneau du dialogue socratique montre ces prompts au moment de
// l'interception ; ici, la même liste est consultable à tout moment. Pur
// nouveau consommateur du canal existant : cache `promptLibrary` + message
// `library-fetch`, le worker applique seul le TTL de 6 h.

function copyPrompt(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    // Repli : vieux Safari ou document qui a perdu le focus.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy_failed");
  });
}

// `var` et non `let`, et un initialiseur qui n'écrase pas : refreshAuthUi()
// tourne plus haut dans le fichier, et quand les rappels storage sont
// synchrones (harnais de test), le panneau se rend et REMPLIT cette variable
// avant que cette ligne s'exécute. Une TDZ ferait tomber le popup ; un `= []`
// sec viderait la liste déjà rendue.
var libraryItems = libraryItems || []; // liste triée, source des rendus filtrés

// Recherche insensible aux accents : « redaction » doit trouver « rédaction ».
function normSearch(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function libraryState(key) {
  const el = document.getElementById("library-state");
  el.textContent = key ? t(key) : "";
  el.hidden = !key;
}

// Même tri que le panneau du dialogue : officiels d'abord, puis reprises.
function sortLibrary(prompts) {
  return (Array.isArray(prompts) ? [...prompts] : []).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "official" ? -1 : 1;
    return (b.copies || 0) - (a.copies || 0);
  });
}

function renderLibraryItems() {
  const q = normSearch(document.getElementById("library-search").value.trim());
  const items = libraryItems.filter(
    (p) => !q || normSearch(`${p.title} ${p.body} ${p.category || ""}`).includes(q)
  );
  document.getElementById("library-summary").textContent = t("libraryPanelHead", libraryItems.length);
  document.getElementById("library-note").textContent = t("libraryPanelNote");
  const list = document.getElementById("library-list");
  list.textContent = "";
  libraryState(items.length ? null : libraryItems.length ? "libraryNoMatch" : "libraryEmptyPanel");
  for (const p of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lib-item";
    const title = document.createElement("span");
    title.className = "lib-title";
    title.textContent = p.title;
    const meta = document.createElement("span");
    meta.className = "lib-meta";
    // Mêmes conventions que la modale : étiquette de provenance, auteur
    // seulement s'il dit plus que l'étiquette, puis les compteurs. Pas de
    // filtre de langue ici — il n'y a pas de brouillon dont hériter la
    // langue, et filtrer par navigateur montrerait des catalogues différents
    // à deux étudiants de la même classe. Un tag EN/FR suffit quand l'entrée
    // diffère de la langue de l'interface.
    const kindLabel = p.kind === "peer" ? t("libraryPeer") : t("libraryOfficial");
    const bits = [kindLabel];
    if (p.author && p.author !== kindLabel) bits.push(p.author);
    if (p.category) bits.push(p.category);
    if (p.lang && p.lang !== CoachI18n.lang) bits.push(p.lang.toUpperCase());
    if (p.copies) bits.push(t("libraryCopies", p.copies));
    if (p.helpful) bits.push(t("libraryHelpful", p.helpful));
    const metaText = bits.join(" · ");
    meta.textContent = metaText;
    const body = document.createElement("span");
    body.className = "lib-body";
    body.textContent = p.body;
    btn.append(title, meta, body);
    // Copier, puis le dire À L'ENDROIT du clic : la méta redevient normale
    // après un battement — pas de toast global dans 360 px.
    btn.addEventListener("click", () => {
      copyPrompt(p.body).then(
        () => {
          meta.textContent = t("libraryCopied");
          meta.classList.add("copied");
        },
        () => {
          meta.textContent = t("libraryCopyFailed");
        }
      );
      setTimeout(() => {
        meta.textContent = metaText;
        meta.classList.remove("copied");
      }, 1500);
    });
    list.appendChild(btn);
  }
}

function renderLibraryPanel(orgConfig) {
  const section = document.getElementById("library-section");
  const origin = orgConfig && orgConfig.libraryUrl && libraryOrigin(orgConfig.libraryUrl);
  if (!origin) {
    section.hidden = true;
    return;
  }
  // Forme callback exprès : sur Gecko, la forme promesse n'existe que sur
  // browser.* et un await ici rendrait undefined (même piège que le worker).
  chrome.permissions.contains({ origins: [origin] }, (granted) => {
    section.hidden = !granted;
    if (!granted) return;
    chrome.storage.local.get("promptLibrary", (data) => {
      const cached =
        data.promptLibrary && data.promptLibrary.url === orgConfig.libraryUrl
          ? data.promptLibrary.prompts
          : null;
      if (cached) {
        libraryItems = sortLibrary(cached);
        renderLibraryItems();
      } else {
        libraryState("libraryLoading");
      }
      // Non forcé : le worker sert le cache sans réseau s'il est frais.
      chrome.runtime.sendMessage({ type: "library-fetch" }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        libraryItems = sortLibrary(res.prompts || []);
        renderLibraryItems();
      });
    });
  });
}

document.getElementById("library-search").placeholder = t("librarySearch");
document.getElementById("library-search").addEventListener("input", renderLibraryItems);

// Un fetch déclenché ailleurs (onglet de chat, activation) doit se refléter
// dans un popup déjà ouvert.
chrome.storage.onChanged.addListener((changes) => {
  if (!changes.promptLibrary) return;
  chrome.storage.local.get("orgConfig", (data) => renderLibraryPanel(data.orgConfig));
});

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
  lastRenderedEvents = events;
  lastRenderedThreshold = threshold;
  document.getElementById("stat-count").textContent = events.length;

  if (showScore) {
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
  }

  // Série de jours où les premiers jets tiennent le seuil : on célèbre
  // l'autonomie, pas la dépendance au coaching.
  const { streak, freezes } = CoachScoring.dayStreakInfo(events, threshold);
  const streakEl = document.getElementById("stat-mirror");
  streakEl.textContent = streak ? `${streak} 🔥${freezes ? ` +${freezes}🧊` : ""}` : "–";
  streakEl.parentElement.title =
    t("popupStreakTitle", streak) + (freezes ? ` ${t("popupStreakFreeze", freezes)}` : "");

  const rubricsEl = document.getElementById("rubrics");
  rubricsEl.textContent = "";
  if (!showScore) {
    // Rien à construire : la section entière est masquée par l'organisation.
  } else if (!events.length) {
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

// Colonnes alignées sur le contrat d'intégration (docs/INTEGRATION.md) :
// mêmes noms que l'API et l'export admin, un seul pipeline lit les trois.
function toCsv(events) {
  // ⚠️ Tableaux POSITIONNELS : toute colonne ajoutée à l'en-tête doit l'être
  // au même rang dans la ligne, sinon le CSV se décale en silence.
  const header = ["client_event_id", "ts", "site", "category", "words", "score_clarte", "score_contexte", "score_iteration", "score_critique", "score_total", "intercepted", "outcome", "score_before", "score_after", "rounds", "answers_count", "mirror_shown", "mirror_feedback", "prompt_chars", "model", "model_catalog_version", "response_chars", "response_words", "latency_ms", "response_ms", "turn_index", "read_ms", "response_outcome", "conv_key", "text"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = events.map((e) =>
    [e.id, e.ts, e.site, e.category, e.words, e.scores.clarte, e.scores.contexte, e.scores.iteration, e.scores.critique, e.scores.total, e.intercepted ?? false, e.outcome ?? "", e.scoreBefore ?? "", e.scoreAfter ?? "", e.rounds ?? 0, e.answersCount ?? 0, e.mirrorShown, e.mirrorFeedback ?? "", e.promptChars ?? "", e.model ?? "", e.modelCatalogVersion ?? "", e.responseChars ?? "", e.responseWords ?? "", e.latencyMs ?? "", e.responseMs ?? "", e.turnIndex ?? "", e.readMs ?? "", e.responseOutcome ?? "", e.conv ?? "", e.text ?? ""].map(escape).join(";")
  );
  return [header.join(";"), ...rows].join("\n");
}

chrome.storage.local.get(["events", "settings", "orgConfig", "health_chatgpt", "health_claude", "health_gemini", "health_mistral", "health_grok"], (data) => {
  const events = data.events || [];
  const settings = { captureMode: "metadata", interceptEnabled: true, threshold: 40, theme: "light", ...(data.settings || {}) };
  showScore = !(data.orgConfig && data.orgConfig.showScore === false);
  applyScoreVisibility();
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
  effEl.hidden = !effText || !showScore;

  const healths = [
    ["ChatGPT", data.health_chatgpt],
    ["Claude", data.health_claude],
    ["Gemini", data.health_gemini],
    ["Mistral", data.health_mistral],
    ["Grok", data.health_grok],
  ];

  // Panne DURE : le composeur est introuvable, l'extension ne capture plus rien.
  const broken = healths.filter(([, h]) => h && !h.healthy);
  if (broken.length) {
    const el = document.getElementById("health");
    el.textContent = t("popupHealthBroken", broken.map(([site]) => site).join(", "));
    el.hidden = false;
  }

  // Alerte DOUCE : les sélecteurs de mesure ne correspondent plus. Le coaching
  // est intact, seules les métriques de réponse tombent à null. `assistant` à
  // null signifie « aucun sélecteur déclaré pour ce site » (Mistral, Grok) :
  // ce n'est pas une anomalie, on ne le signale pas.
  const noMetrics = healths.filter(([, h]) => h && h.healthy && h.assistant === false);
  if (noMetrics.length) {
    const el = document.getElementById("health-metrics");
    el.textContent = t("popupHealthMetrics", noMetrics.map(([site]) => site).join(", "));
    el.hidden = false;
  }

  // Couverture réelle en champ. Un sélecteur peut « correspondre » sans jamais
  // se déclencher pendant le streaming : seule la série d'événements le dit.
  // C'est le système d'alerte précoce sur un changement d'UI côté éditeur.
  const recent = events.filter((e) => e.outcome !== "cancelled").slice(-50);
  const measured = recent.filter((e) => e.responseChars !== null && e.responseChars !== undefined);
  const covEl = document.getElementById("coverage");
  if (covEl && recent.length >= 10) {
    covEl.textContent = t("popupCoverage", Math.round((measured.length / recent.length) * 100));
    covEl.hidden = false;
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
      ["events", "postEvents", "postConvs", "postCount", "health_chatgpt", "health_claude", "health_gemini", "health_mistral", "health_grok"],
      () => render([], 40)
    );
  }
});
