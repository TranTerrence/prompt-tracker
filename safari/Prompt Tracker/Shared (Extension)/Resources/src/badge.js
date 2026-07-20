// Repère visuel dans l'UI du chat : pastille éditoriale en bas à droite qui
// montre que Prompt Tracker est actif (aux couleurs white-label de l'org).
// Cliquable pour se replier ; ambre si la sonde de santé détecte un changement
// d'UI du site (capture peut-être cassée). Thème light/dark via CoachTheme.

const CoachBadge = (() => {
  let host = null;
  let collapsed = false;

  function render(state) {
    // state: { branding: {name, color, logoUrl}, healthy: bool|null, threshold, interceptEnabled }
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
          .badge.collapsed .name, .badge.collapsed .logo, .badge.collapsed .off { display: none; }
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
  }

  // Retire la pastille de la page (extension inerte tant que la divulgation
  // des données n'a pas été acceptée dans l'onboarding).
  function remove() {
    if (host && document.contains(host)) host.remove();
    host = null;
  }

  return { render, remove };
})();
