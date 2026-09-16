// Sélecteur de prompts dans la page (1.0.3) : une palette de recherche qui
// s'ouvre sur « // » dans un composeur vide, sur le raccourci clavier, ou sur
// le bouton « Prompts » de la pastille. Groupes Favoris / Récents / Programme
// / Promotion, flèches pour choisir, Entrée pour INSÉRER dans le composeur,
// Maj+Entrée pour copier, Échap pour fermer. Zéro clic entre l'envie et le
// gabarit dans la zone de saisie.
//
// Il n'ENVOIE jamais. Il écrit dans le composeur (par l'adaptateur, injection
// vérifiée) et rend la main : c'est l'étudiant qui adapte le gabarit, puis
// décide d'envoyer, et le dialogue socratique garde son mot à dire à ce
// moment-là comme pour n'importe quel prompt.
//
// Centré plutôt qu'ancré au composeur : la géométrie de la zone de saisie
// diffère sur les cinq sites et bouge quand la page se redessine ; un panneau
// centré sous la barre du haut est le seul emplacement qui tient partout.
//
// Shadow DOM, thème CoachTheme, textes CoachI18n, logique CoachLibrary. Un
// seul appel chrome.* : la lecture de libraryRecent / libraryStarred à
// l'ouverture (écrits par le worker, jamais d'ici). Le presse-papiers n'est
// touché que dans le geste de l'utilisateur (Entrée, Maj+Entrée, clic).

const CoachPicker = (() => {
  let host = null;
  let state = null;

  const t = (...a) => CoachI18n.t(...a);

  function isOpen() {
    return Boolean(host);
  }

  // Favoris et récents : une lecture à l'ouverture, jamais d'écriture. Les
  // deux clés n'ont qu'un écrivain, le worker (message library-used, RPC
  // des favoris) — sans quoi popup, page et worker se seraient marché dessus.
  function readMarks(cb) {
    try {
      chrome.storage.local.get(["libraryRecent", "libraryStarred"], (data) => {
        void chrome.runtime.lastError;
        const recent = data && Array.isArray(data.libraryRecent) ? data.libraryRecent : [];
        const starred =
          data && data.libraryStarred && Array.isArray(data.libraryStarred.ids) ? data.libraryStarred.ids : [];
        cb({ recent, starred });
      });
    } catch {
      cb({ recent: [], starred: [] });
    }
  }

  // Écriture dans le presse-papiers, DANS le geste de l'utilisateur (Chrome
  // refuse writeText hors geste). Le repli execCommand couvre les documents
  // qui ont perdu le focus ; un échec est silencieux, la barre d'état ou le
  // flash ont déjà dit ce qui a été tenté.
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => execCopy(text));
        return;
      }
    } catch {
      /* repli */
    }
    execCopy(text);
  }

  function execCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {
      /* rien de plus à tenter */
    }
  }

  // opts: { prompts (tableau normalisé, ou null si pas encore chargé),
  //   branding: {name, color}, appUrl (lien « Gérer dans la bibliothèque »),
  //   source ("slash" | "shortcut" | "badge"),
  //   onInsert(p) -> bool  (SYNCHRONE : l'appelant écrit dans le composeur et
  //     dit si l'injection a été vérifiée ; sur false, le sélecteur copie —
  //     il tient encore le geste, l'appelant ne l'aurait plus),
  //   onCopy(p), onClose(reason) }
  // Renvoie false sans rien afficher si déjà ouvert ou si la modale
  // socratique est là : deux surfaces modales, c'est deux focus en conflit.
  function open(opts) {
    if (host) return false;
    if (typeof CoachMirror !== "undefined" && typeof CoachMirror.isModalOpen === "function" && CoachMirror.isModalOpen()) {
      return false;
    }
    const o = opts || {};
    const accent = (o.branding && o.branding.color) || CoachTheme.DEFAULT_ACCENT;
    state = {
      opts: o,
      accent,
      prompts: Array.isArray(o.prompts) ? o.prompts : o.prompts === null || o.prompts === undefined ? null : [],
      starred: [],
      recent: [],
      query: "",
      active: 0,
      flat: [],
      busy: false,
      closeTimer: null,
    };

    host = document.createElement("div");
    host.id = "coach-ia-picker";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        /* Meme garde-fou que la modale (mirror.js) : la regle d'agent
           utilisateur pour hidden perd contre la moindre regle display: ;
           tout l'affichage conditionnel ci-dessous repose sur elle.
           NB : bloc dans un litteral de gabarit, pas d'accent grave ici. */
        [hidden] { display: none !important; }
        .root { ${CoachTheme.vars(accent)} }
        /* Fond transparent : la page reste visible, le clic dehors ferme. */
        .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: transparent; }
        .panel { position: fixed; top: 14vh; left: 50%; transform: translateX(-50%);
          width: min(640px, 94vw); max-height: 72vh; z-index: 2147483647;
          display: flex; flex-direction: column; overflow: hidden;
          background: var(--bg); color: var(--ink); border: 1px solid var(--border);
          border-radius: 16px; box-shadow: var(--shadow);
          font: 14px/1.5 var(--font-text); -webkit-font-smoothing: antialiased;
          animation: rise .16s ease-out; }
        @keyframes rise { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
        .head { display: flex; align-items: center; gap: 10px; padding: 12px 16px 8px; }
        .title { font: 600 15px/1.2 var(--font-display); margin-right: auto; }
        .hint { font-size: 11px; color: var(--muted); white-space: nowrap; }
        .close { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--border);
          background: var(--surface); color: var(--muted); cursor: pointer; font: 14px/1 var(--font-text); }
        .close:hover, .close:focus-visible { color: var(--ink); border-color: var(--accent); outline: none; }
        .search { margin: 0 16px 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--surface); color: var(--ink); font: inherit; }
        .search:focus { outline: none; border-color: var(--accent); }
        .list { flex: 1; min-height: 60px; overflow-y: auto; padding: 0 10px 8px; }
        .group { padding: 8px 8px 4px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em;
          color: var(--muted); }
        .opt { position: relative; display: block; margin: 2px 0; padding: 8px 92px 8px 10px; border-radius: 10px;
          border: 1px solid transparent; cursor: pointer; }
        .opt.active { background: var(--soft); border-color: var(--border); }
        .opt-title { display: block; font-size: 13.5px; font-family: var(--font-display); }
        .opt-meta { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); }
        .opt-body { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          margin-top: 3px; font-size: 12px; color: var(--muted); white-space: pre-line; }
        /* Action secondaire : visible sur la ligne active ou survolee seulement,
           le clavier a Maj+Entree. */
        .copy { position: absolute; right: 10px; top: 9px; padding: 4px 10px; border-radius: 999px;
          border: 1px solid var(--border); background: var(--surface); color: var(--ink);
          font: 11.5px/1.3 var(--font-text); cursor: pointer; opacity: 0; transition: opacity .12s; }
        .opt.active .copy, .opt:hover .copy { opacity: 1; }
        .copy:hover { border-color: var(--accent); color: var(--accent); }
        @media (prefers-reduced-motion: reduce) { .copy { transition: none; } }
        .empty { padding: 18px 12px; color: var(--muted); font-size: 13px; text-align: center; }
        .foot { display: flex; align-items: center; gap: 10px; padding: 8px 16px 12px;
          border-top: 1px solid var(--border); font-size: 12px; }
        .status { color: var(--accent); margin-right: auto; min-height: 1.2em; }
        .manage { color: var(--muted); text-decoration: none; white-space: nowrap; }
        .manage:hover, .manage:focus-visible { color: var(--accent); outline: none; text-decoration: underline; }
      </style>
      <div class="root">
        <div class="backdrop"></div>
        <div class="panel" role="dialog" aria-modal="true" aria-labelledby="coach-picker-title">
          <div class="head">
            <span class="title" id="coach-picker-title"></span>
            <span class="hint"></span>
            <button type="button" class="close" aria-label="">×</button>
          </div>
          <input type="text" class="search" role="combobox" aria-expanded="true" aria-autocomplete="list"
            aria-controls="coach-picker-list" autocomplete="off" spellcheck="false" />
          <div class="list" id="coach-picker-list" role="listbox"></div>
          <div class="foot">
            <span class="status" aria-live="polite"></span>
            <a class="manage" target="_blank" rel="noreferrer"></a>
          </div>
        </div>
      </div>`;

    const el = (sel) => shadow.querySelector(sel);
    el(".title").textContent = t("pickerTitle");
    el(".hint").textContent = t("pickerHint");
    el(".close").setAttribute("aria-label", t("pickerClose"));
    el(".close").title = t("pickerClose");
    const input = el(".search");
    input.placeholder = t("pickerSearch");
    const manage = el(".manage");
    manage.textContent = t("pickerManage");
    if (o.appUrl) manage.href = `${o.appUrl}/library`;
    else manage.hidden = true;

    el(".backdrop").addEventListener("click", () => close("backdrop"));
    el(".close").addEventListener("click", () => close("close"));

    input.addEventListener("input", () => {
      if (!state) return;
      state.query = input.value;
      state.active = 0;
      render();
    });

    // Clavier sur le panneau, propagation coupee : la frappe dans la palette
    // ne doit pas atteindre les raccourcis du site ni son composeur (meme
    // regle que la modale, mirror.js). Fleches avec bouclage, Entree insere,
    // Maj+Entree copie, Echap ferme, Tab reste dans le panneau.
    const panel = el(".panel");
    panel.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (!state) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close("escape");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = state.flat.length;
        if (!n) return;
        setActive((state.active + (e.key === "ArrowDown" ? 1 : n - 1)) % n, true);
        return;
      }
      if (e.key === "Enter") {
        if (e.isComposing) return;
        e.preventDefault();
        if (e.shiftKey) copyActive();
        else insertActive();
        return;
      }
      if (e.key === "Tab") {
        const focusables = [...shadow.querySelectorAll("input, button:not([tabindex='-1']), a[href]")].filter(
          (n) => !n.disabled && !n.hidden && n.getClientRects().length > 0
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = shadow.activeElement;
        if (e.shiftKey && (active === first || !active)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    panel.addEventListener("keyup", (e) => e.stopPropagation());
    panel.addEventListener("keypress", (e) => e.stopPropagation());

    // Souris : la ligne survolee devient la ligne active (l'etat ARIA suit),
    // un clic sur la ligne insere, un clic sur « Copier » copie. mousemove et
    // non mouseover : mouseover se declenche aussi quand la liste se redessine
    // sous un pointeur immobile (favoris et recents arrivent apres
    // l'ouverture), et volerait la ligne choisie au clavier.
    const list = el(".list");
    list.addEventListener("mousemove", (e) => {
      const row = e.target.closest && e.target.closest(".opt");
      if (!row || !state) return;
      const i = Number(row.dataset.index);
      if (Number.isInteger(i) && i !== state.active) setActive(i, false);
    });
    list.addEventListener("click", (e) => {
      const row = e.target.closest && e.target.closest(".opt");
      if (!row || !state) return;
      const i = Number(row.dataset.index);
      if (!Number.isInteger(i)) return;
      state.active = i;
      if (e.target.closest(".copy")) {
        e.stopPropagation();
        copyActive();
      } else {
        insertActive();
      }
    });

    document.documentElement.appendChild(host);
    render();
    input.focus();

    readMarks((marks) => {
      if (!state) return; // ferme entre-temps
      state.starred = marks.starred;
      state.recent = marks.recent;
      render();
    });
    return true;
  }

  // Nouvelle liste (le fetch demande a l'ouverture vient de repondre) : on
  // garde la recherche en cours et la position, bornee a la nouvelle taille.
  function update(prompts) {
    if (!state) return;
    state.prompts = Array.isArray(prompts) ? prompts : prompts === null || prompts === undefined ? null : [];
    render();
  }

  function shadowEl(sel) {
    return host ? host.shadowRoot.querySelector(sel) : null;
  }

  function setStatus(text) {
    const s = shadowEl(".status");
    if (s) s.textContent = text || "";
  }

  function setActive(i, scroll) {
    if (!state) return;
    state.active = i;
    const list = shadowEl(".list");
    if (!list) return;
    for (const row of list.querySelectorAll(".opt")) {
      const on = Number(row.dataset.index) === i;
      row.classList.toggle("active", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        shadowEl(".search").setAttribute("aria-activedescendant", row.id);
        if (scroll && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function render() {
    if (!state || !host) return;
    const list = shadowEl(".list");
    list.textContent = "";
    const input = shadowEl(".search");
    input.removeAttribute("aria-activedescendant");

    const empty = (key) => {
      const d = document.createElement("div");
      d.className = "empty";
      d.textContent = t(key);
      list.appendChild(d);
      state.flat = [];
    };

    // Trois etats vides distincts : pas encore charge (le fetch est parti a
    // l'ouverture, update() suivra), rien de publie, ou rien qui corresponde.
    if (state.prompts === null) return empty("pickerNotReady");
    if (!state.prompts.length) return empty("pickerEmpty");
    const groups = CoachLibrary.groupLibrary({
      prompts: state.prompts,
      starred: state.starred,
      recent: state.recent,
      query: state.query,
    });
    if (!groups.length) return empty("pickerNoMatch");

    state.flat = CoachLibrary.flatten(groups);
    if (state.active >= state.flat.length) state.active = 0;
    const starred = new Set(state.starred);
    const groupLabel = { starred: "pickerGroupStarred", recent: "pickerGroupRecent", official: "pickerGroupOfficial", peer: "pickerGroupPeer" };

    let index = 0;
    for (const g of groups) {
      const head = document.createElement("div");
      head.className = "group";
      head.setAttribute("role", "presentation");
      head.textContent = t(groupLabel[g.key]);
      list.appendChild(head);
      for (const p of g.items) {
        list.appendChild(buildRow(p, index++, starred.has(p.id)));
      }
    }
    setActive(state.active, false);
  }

  function buildRow(p, index, isStarred) {
    const row = document.createElement("div");
    row.className = "opt";
    row.id = `coach-picker-opt-${index}`;
    row.dataset.index = String(index);
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");

    const title = document.createElement("span");
    title.className = "opt-title";
    title.textContent = isStarred ? `★ ${p.title}` : p.title;

    // Memes conventions que le popup : etiquette de provenance, auteur s'il
    // dit plus que l'etiquette, categorie, langue si elle differe de celle de
    // l'interface, puis les compteurs.
    const meta = document.createElement("span");
    meta.className = "opt-meta";
    const kindLabel = p.kind === "peer" ? t("libraryPeer") : t("libraryOfficial");
    const bits = [kindLabel];
    if (p.author && p.author !== kindLabel) bits.push(p.author);
    if (p.category) bits.push(p.category);
    if (p.lang && p.lang !== CoachI18n.lang) bits.push(p.lang.toUpperCase());
    if (p.copies) bits.push(t("libraryCopies", p.copies));
    if (p.helpful) bits.push(t("libraryHelpful", p.helpful));
    meta.textContent = bits.join(" · ");

    const body = document.createElement("span");
    body.className = "opt-body";
    body.textContent = p.body;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy";
    copy.tabIndex = -1;
    copy.textContent = t("pickerCopy");
    copy.title = t("pickerCopy");

    row.append(title, meta, body, copy);
    return row;
  }

  // Insertion : fermeture SYNCHRONE d'abord (le drapeau busy et la fermeture
  // empechent un double Entree), puis l'appelant ecrit dans le composeur. Si
  // l'injection n'est pas verifiee, on copie ICI, dans le geste qui a
  // declenche l'insertion, et le flash dit quoi faire. Rien n'est envoye,
  // sur aucun des deux chemins.
  function insertActive() {
    if (!state || state.busy) return;
    const p = state.flat[state.active];
    if (!p) return;
    state.busy = true;
    const { opts, accent } = state;
    close("insert");
    let ok = false;
    try {
      ok = Boolean(typeof opts.onInsert === "function" && opts.onInsert(p));
    } catch (err) {
      console.debug("[coach-ia] insertion:", err);
      ok = false;
    }
    if (!ok) {
      copyText(p.body);
      if (typeof CoachMirror !== "undefined" && typeof CoachMirror.flash === "function") {
        CoachMirror.flash(t("pickerCopiedFallback"), accent);
      }
    }
  }

  // Copie : le panneau reste ouvert le temps de lire « Copie », puis se ferme.
  function copyActive() {
    if (!state || state.busy) return;
    const p = state.flat[state.active];
    if (!p) return;
    state.busy = true;
    copyText(p.body);
    if (typeof state.opts.onCopy === "function") {
      try {
        state.opts.onCopy(p);
      } catch (err) {
        console.debug("[coach-ia] copie:", err);
      }
    }
    setStatus(t("pickerCopied"));
    const input = shadowEl(".search");
    if (input) input.focus();
    state.closeTimer = setTimeout(() => close("copy"), 600);
  }

  function close(reason) {
    if (!host) return;
    const s = state;
    if (s && s.closeTimer) clearTimeout(s.closeTimer);
    host.remove();
    host = null;
    state = null;
    if (s && typeof s.opts.onClose === "function") {
      try {
        s.opts.onClose(reason);
      } catch (err) {
        console.debug("[coach-ia] fermeture du selecteur:", err);
      }
    }
  }

  return { open, update, close, isOpen };
})();

if (typeof self !== "undefined") self.CoachPicker = CoachPicker;
