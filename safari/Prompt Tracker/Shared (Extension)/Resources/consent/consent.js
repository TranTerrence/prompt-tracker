// Consentement : l'organisation DEMANDE (avec un pourquoi), l'utilisateur
// DÉCIDE, catégorie par catégorie. Toggles OFF par défaut, révocable à tout
// moment, purge du contenu déjà partagé. Le socle (indicateurs/scores) est
// affiché comme tel : toujours partagé, jamais aucun contenu.

const t = (...a) => CoachI18n.t(...a);

const CATEGORIES = [
  { key: "prompt_text", label: "catPromptText", desc: "catPromptTextDesc" },
  { key: "socratic_dialogue", label: "catDialogue", desc: "catDialogueDesc" },
  { key: "post_reflection", label: "catPostReflection", desc: "catPostReflectionDesc" },
  { key: "conversation_history", label: "catConversation", desc: "catConversationDesc" },
];

function applyTheme(setting) {
  const dark =
    setting === "dark" ||
    (setting === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const el = (id) => document.getElementById(id);

function renderStatic(orgName) {
  document.documentElement.lang = CoachI18n.lang;
  el("c-title").textContent = t("consentTitle", orgName);
  el("c-subtitle").textContent = t("consentSubtitle");
  el("c-baseline").textContent = t("consentBaseline");
  el("c-retention").textContent = t("consentBaselineRetention");
  el("c-save").textContent = t("consentSave");
  el("c-danger-title").textContent = t("consentDangerTitle");
  el("c-purge").textContent = t("consentPurge");
}

function renderCards(orgName, dataRequests, consents) {
  const container = el("c-cards");
  container.textContent = "";
  const requested = CATEGORIES.filter((c) => dataRequests[c.key] && dataRequests[c.key].requested);
  if (!requested.length) {
    el("c-none").textContent = t("consentNoneRequested", orgName);
    el("c-none").hidden = false;
    el("c-save").hidden = true;
    return;
  }
  for (const cat of requested) {
    const card = document.createElement("div");
    card.className = "consent-card";
    const row = document.createElement("div");
    row.className = "consent-row";

    const sw = document.createElement("label");
    sw.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.category = cat.key;
    input.checked = Boolean(consents[cat.key]); // jamais pré-coché par défaut
    const track = document.createElement("span");
    track.className = "track";
    sw.append(input, track);

    const texts = document.createElement("div");
    texts.className = "texts";
    const title = document.createElement("div");
    title.className = "consent-title";
    title.textContent = t(cat.label);
    const desc = document.createElement("div");
    desc.className = "consent-desc";
    desc.textContent = t(cat.desc);
    texts.append(title, desc);

    const purpose = dataRequests[cat.key].purpose;
    if (purpose) {
      const p = document.createElement("div");
      p.className = "purpose";
      const b = document.createElement("b");
      b.textContent = t("consentPurpose", orgName) + " : ";
      p.append(b, purpose);
      texts.append(p);
    }

    row.append(texts, sw);
    card.append(row);
    container.append(card);
  }
}

async function init() {
  chrome.storage.local.get(["settings", "orgConfig", "consents"], async (data) => {
    applyTheme((data.settings || {}).theme || "light");

    let orgConfig = data.orgConfig;
    let consents = data.consents || {};
    if (!orgConfig || !orgConfig.dataRequests) {
      try {
        orgConfig = await CoachApi.refreshOrgConfig();
        consents = (await new Promise((r) => chrome.storage.local.get("consents", r))).consents || {};
      } catch {
        orgConfig = null;
      }
    }

    if (!orgConfig) {
      renderStatic(t("brandDefault"));
      el("c-disconnected").textContent = t("consentNotConnected");
      el("c-disconnected").hidden = false;
      el("c-save").hidden = true;
      el("c-purge").disabled = true;
      return;
    }

    const orgName = orgConfig.branding.name;
    renderStatic(orgName);
    renderCards(orgName, orgConfig.dataRequests || {}, consents);

    // Questions LLM sur mesure : divulgation du transit (serveur + Anthropic),
    // conditionné aux consentements prompt_text ET socratic_dialogue.
    if (orgConfig.llmEnabled) {
      el("c-llm-note").textContent = t("consentLlmNote");
      el("c-llm-note").hidden = false;
    }

    el("c-save").addEventListener("click", async () => {
      const choices = {};
      for (const cat of CATEGORIES) choices[cat.key] = false;
      for (const input of document.querySelectorAll("input[data-category]")) {
        choices[input.dataset.category] = input.checked;
      }
      try {
        await CoachApi.setConsents(choices);
        el("c-saved").textContent = t("consentSaved");
        el("c-saved").hidden = false;
        setTimeout(() => (el("c-saved").hidden = true), 3000);
      } catch (e) {
        el("c-saved").textContent = String(e.message);
        el("c-saved").hidden = false;
      }
    });

    el("c-purge").addEventListener("click", async () => {
      if (!confirm(t("consentPurgeConfirm"))) return;
      try {
        const res = await CoachApi.purgeSharedContent();
        const total = (res.events_purged || 0) + (res.posts_purged || 0);
        el("c-status").textContent = t("consentPurgeDone", total);
        el("c-status").hidden = false;
      } catch (e) {
        el("c-status").textContent = String(e.message);
        el("c-status").hidden = false;
      }
    });
  });
}

init();
