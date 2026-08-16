// Repère visuel dans l'UI du chat : pastille éditoriale en bas à droite qui
// montre que Prompt Tracker est actif (aux couleurs white-label de l'org).
// Cliquable pour se replier ; ambre si la sonde de santé détecte un changement
// d'UI du site (capture peut-être cassée). Thème light/dark via CoachTheme.
// Porte aussi l'interrupteur d'interception : on coupe/rallume là où l'état est
// déjà lu, sans passer par le popup (même contrat de stockage que lui).

const CoachBadge = (() => {
  let host = null;
  let collapsed = false;
  // État affiché par l'interrupteur : mis à jour de façon optimiste au clic,
  // reconfirmé par le storage.onChanged du content script.
  let switchOn = true;

  // Même écriture que le popup (popup.js) : read-modify-write de `settings`.
  function persistIntercept(next) {
    chrome.storage.local.get("settings", (data) => {
      chrome.storage.local.set({ settings: { ...(data.settings || {}), interceptEnabled: next } });
    });
  }

  function render(state) {
    // state: { branding: {name, color, logoUrl}, healthy: bool|null, threshold, interceptEnabled, lockedByOrg }
    const accent = (state.branding && state.branding.color) || CoachTheme.DEFAULT_ACCENT;

    if (!host || !document.contains(host)) {
      host = document.createElement("div");
      host.id = "coach-ia-badge";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          .badge { position: fixed; bottom: 18px; right: 18px; z-index: 2147483646;
            display: flex; align-items: center; gap: 8px; padding: 7px 14px 7px 10px;
            border-radius: 999px; background: var(--surface); color: var(--ink);
            border: 1px solid var(--border); box-shadow: var(--shadow-soft);
            font: 12px/1 var(--font-text); cursor: pointer; user-select: none;
            transition: transform .2s, box-shadow .2s; -webkit-font-smoothing: antialiased; }
          .badge:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
          .badge.warn { border-color: #C97B2D; }
          .badge.warn .dot { background: #C97B2D; animation: none; }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
            animation: pulse 2.4s ease-in-out infinite; }
          @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
          .logo { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; }
          .name { font-weight: 600; letter-spacing: .01em; font-family: var(--font-display); font-size: 12.5px; }
          .off { color: var(--muted); font-weight: 400; }
          .badge.collapsed { padding: 7px; gap: 0; }
          .badge.collapsed .name, .badge.collapsed .logo, .badge.collapsed .off,
          .badge.collapsed .sw { display: none; }
          /* Interrupteur : cible d'action distincte du corps repliable, séparée
             par un filet pour que les deux intentions se lisent d'un coup d'œil. */
          .sw { display: flex; align-items: center; padding: 5px 0 5px 9px; margin-left: 2px;
            border-left: 1px solid var(--border); cursor: pointer; }
          .sw:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
          .track { position: relative; width: 28px; height: 16px; border-radius: 999px;
            background: var(--border); transition: background .18s ease; }
          .sw.on .track { background: var(--accent); }
          .knob { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px;
            border-radius: 50%; background: var(--surface); box-shadow: var(--shadow-soft);
            transition: transform .18s ease; }
          .sw.on .knob { transform: translateX(12px); }
          .sw.locked { cursor: not-allowed; opacity: .45; }
          .sw.locked .track { pointer-events: none; }
          @media (prefers-reduced-motion: reduce) {
            .badge, .dot, .track, .knob { transition: none; animation: none; }
          }
        </style>
        <div class="root"><div class="badge" role="status"></div></div>`;
      document.documentElement.appendChild(host);
      shadow.querySelector(".badge").addEventListener("click", () => {
        collapsed = !collapsed;
        shadow.querySelector(".badge").classList.toggle("collapsed", collapsed);
      });
    }

    const shadow = host.shadowRoot;
    shadow.querySelector(".root").style.cssText = CoachTheme.vars(accent);
    const badge = shadow.querySelector(".badge");
    badge.classList.toggle("warn", state.healthy === false);
    badge.classList.toggle("collapsed", collapsed);

    const name = (state.branding && state.branding.name) || CoachI18n.t("brandDefault");
    badge.title =
      state.healthy === false
        ? CoachI18n.t("badgeBroken", name)
        : state.interceptEnabled === false
          ? CoachI18n.t("badgeWatch", name)
          : CoachI18n.t("badgeActive", name, state.threshold ?? 40);

    badge.textContent = "";
    const dot = document.createElement("span");
    dot.className = "dot";
    badge.appendChild(dot);
    if (state.branding && state.branding.logoUrl) {
      const img = document.createElement("img");
      img.className = "logo";
      img.src = state.branding.logoUrl;
      img.alt = "";
      badge.appendChild(img);
    }
    const label = document.createElement("span");
    label.className = "name";
    label.textContent = state.healthy === false ? `${name} ⚠️` : name;
    badge.appendChild(label);
    if (state.interceptEnabled === false) {
      const off = document.createElement("span");
      off.className = "off";
      off.textContent = CoachI18n.t("badgeStandby");
      badge.appendChild(off);
    }

    switchOn = state.interceptEnabled !== false;
    badge.appendChild(buildSwitch(Boolean(state.lockedByOrg)));
  }

  // Interrupteur d'interception (role=switch, clavier + tooltip explicite).
  // Verrouillé quand l'organisation impose le réglage : visible mais inerte,
  // avec le pourquoi en tooltip — jamais un clic sans effet.
  function buildSwitch(locked) {
    const sw = document.createElement("span");
    sw.className = "sw";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", CoachI18n.t("badgeToggleLabel"));
    const track = document.createElement("span");
    track.className = "track";
    const knob = document.createElement("span");
    knob.className = "knob";
    track.appendChild(knob);
    sw.appendChild(track);

    function paint() {
      sw.classList.toggle("on", switchOn);
      sw.setAttribute("aria-checked", String(switchOn));
      sw.title = locked
        ? CoachI18n.t("badgeToggleLocked")
        : switchOn
          ? CoachI18n.t("badgeToggleOn")
          : CoachI18n.t("badgeToggleOff");
    }

    if (locked) {
      sw.classList.add("locked");
      sw.setAttribute("aria-disabled", "true");
    } else {
      sw.tabIndex = 0;
      const toggle = (e) => {
        // Le corps de la pastille se replie au clic : ne pas déclencher les deux.
        e.stopPropagation();
        switchOn = !switchOn;
        paint(); // retour immédiat, avant l'aller-retour storage
        persistIntercept(switchOn);
      };
      sw.addEventListener("click", toggle);
      sw.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle(e);
        }
      });
    }

    paint();
    return sw;
  }

  // Retire la pastille de la page (extension inerte tant que la divulgation
  // des données n'a pas été acceptée dans l'onboarding).
  function remove() {
    if (host && document.contains(host)) host.remove();
    host = null;
  }

  return { render, remove };
})();
