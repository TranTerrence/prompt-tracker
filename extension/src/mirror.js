// Surfaces du miroir socratique, en Shadow DOM (styles isolés du site hôte) :
//   show(message)  : toast non bloquant (suggestions légères).
//   showModal(...) : dialogue socratique ITÉRATIF : le prompt a été RETENU avant
//                    l'envoi ; une question à la fois, une par axe faible,
//                    puis la modale rend la main (état de clôture). Rien n'est
//                    fermé de force : « une question de plus » relance la
//                    boucle, et l'utilisateur décide seul quand envoyer.
// Design « éditorial calme » : tokens light/dark de CoachTheme, textes CoachI18n.

const CoachMirror = (() => {
  let toastHost = null;
  let modalHost = null;
  let hideTimer = null;

  const t = (...a) => CoachI18n.t(...a);

  /* ---------- Toast non bloquant ---------- */

  function ensureToast(accent) {
    if (toastHost && document.contains(toastHost)) return toastHost.shadowRoot;
    toastHost = document.createElement("div");
    toastHost.id = "coach-ia-toast";
    const shadow = toastHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .root { ${CoachTheme.vars(accent)} }
        .panel { position: fixed; bottom: 96px; right: 24px; z-index: 2147483647;
          max-width: 340px; padding: 16px 18px; border-radius: 14px;
          background: var(--surface); color: var(--ink); border: 1px solid var(--border);
          font: 14px/1.5 var(--font-text); box-shadow: var(--shadow);
          opacity: 0; transform: translateY(8px); transition: opacity .25s, transform .25s; }
        .panel.visible { opacity: 1; transform: translateY(0); }
        .title { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px;
          font: 600 13px/1.3 var(--font-display); color: var(--accent); letter-spacing: .01em; }
        .close { margin-left: auto; cursor: pointer; border: 0; background: none; color: var(--muted); font-size: 15px; padding: 2px; }
        .close:hover { color: var(--ink); }
        .message { color: var(--ink); }
        .useful { margin-top: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--soft);
          color: var(--ink); border-radius: 999px; padding: 5px 12px; font: 12px var(--font-text); }
        .useful:hover { border-color: var(--accent); color: var(--accent); }
        .pause { margin: 12px 0 0 8px; cursor: pointer; border: 0; background: none; color: var(--muted);
          font: 11.5px var(--font-text); text-decoration: underline; text-underline-offset: 2px; padding: 5px 2px; }
        .pause:hover { color: var(--ink); }
      </style>
      <div class="root">
        <div class="panel" role="status">
          <div class="title"><span class="brand">🪞 ${t("toastTitle")}</span> <button class="close">✕</button></div>
          <div class="message"></div>
          <button class="useful">${t("toastUseful")}</button><button class="pause">${t("toastPause")}</button>
        </div>
      </div>`;
    document.documentElement.appendChild(toastHost);
    shadow.querySelector(".close").addEventListener("click", () => hideToast("dismissed"));
    shadow.querySelector(".useful").addEventListener("click", () => {
      if (typeof CoachMirror.onFeedback === "function") CoachMirror.onFeedback("useful");
      hideToast("useful");
    });
    shadow.querySelector(".pause").addEventListener("click", () => {
      if (typeof CoachMirror.onPause === "function") CoachMirror.onPause();
      // Peak-end : la pause se clôt sur un choix respecté, pas sur un rejet.
      shadow.querySelector(".message").textContent = t("pauseConfirmed");
      shadow.querySelector(".useful").hidden = true;
      shadow.querySelector(".pause").hidden = true;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hideToast("paused"), 1800);
    });
    return shadow;
  }

  function show(message, accent) {
    const shadow = ensureToast(accent);
    shadow.querySelector(".message").textContent = message;
    shadow.querySelector(".useful").hidden = false;
    shadow.querySelector(".pause").hidden = false;
    const panel = shadow.querySelector(".panel");
    requestAnimationFrame(() => panel.classList.add("visible"));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hideToast("timeout"), 15000);
  }

  function hideToast(reason) {
    clearTimeout(hideTimer);
    if (!toastHost) return;
    toastHost.shadowRoot.querySelector(".panel").classList.remove("visible");
    if (typeof CoachMirror.onClose === "function") CoachMirror.onClose(reason);
  }

  /* ---------- Flash : confirmation éphémère du mode d'envoi ---------- */

  // Petit encart auto-dissipé (retour terrain, axe lisibilité : dire in situ
  // comment l'envoi sera compté). Aucun bouton : informer, pas interrompre.
  let flashHost = null;
  let flashTimer = null;

  function flash(message, accentColor) {
    clearTimeout(flashTimer);
    if (flashHost) flashHost.remove();
    const accent = accentColor || CoachTheme.DEFAULT_ACCENT;
    flashHost = document.createElement("div");
    flashHost.id = "coach-ia-flash";
    const shadow = flashHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .root { ${CoachTheme.vars(accent)} }
        .pill { position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
          max-width: min(340px, 86vw); padding: 10px 14px; border-radius: 12px;
          background: var(--surface); color: var(--ink); border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          font: 12.5px/1.45 var(--font-text); box-shadow: var(--shadow);
          opacity: 0; transform: translateY(6px); transition: opacity .25s, transform .25s; }
        .pill.visible { opacity: 1; transform: translateY(0); }
      </style>
      <div class="root"><div class="pill"></div></div>`;
    shadow.querySelector(".pill").textContent = message;
    document.documentElement.appendChild(flashHost);
    requestAnimationFrame(() => shadow.querySelector(".pill").classList.add("visible"));
    flashTimer = setTimeout(() => {
      if (!flashHost) return;
      flashHost.shadowRoot.querySelector(".pill").classList.remove("visible");
      flashTimer = setTimeout(() => {
        if (flashHost) flashHost.remove();
        flashHost = null;
      }, 300);
    }, 4000);
  }

  /* ---------- Miroir d'après : réflexion post-réponse ---------- */

  let postHost = null;
  let postTimer = null;

  // Toast réflexif affiché quand la réponse IA est complète : une question
  // (explain-back, vérification ou désaccord) et une zone de réponse libre.
  // Jamais bloquant : il se ferme seul, et « pas cette fois » est à un clic.
  // opts: { question, branding: {color}, onReply(text), onSkip() }
  function showPost(opts) {
    closePost();
    hideToast("replaced"); // même emplacement : le miroir d'après a priorité
    const accent = (opts.branding && opts.branding.color) || CoachTheme.DEFAULT_ACCENT;
    postHost = document.createElement("div");
    postHost.id = "coach-ia-post";
    const shadow = postHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .root { ${CoachTheme.vars(accent)} }
        .panel { position: fixed; bottom: 96px; right: 24px; z-index: 2147483647;
          width: min(360px, 90vw); padding: 16px 18px; border-radius: 14px;
          background: var(--surface); color: var(--ink); border: 1px solid var(--border);
          font: 14px/1.5 var(--font-text); box-shadow: var(--shadow);
          opacity: 0; transform: translateY(8px); transition: opacity .25s, transform .25s; }
        .panel.visible { opacity: 1; transform: translateY(0); }
        .title { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px;
          font: 600 13px/1.3 var(--font-display); color: var(--accent); letter-spacing: .01em; }
        .close { margin-left: auto; cursor: pointer; border: 0; background: none; color: var(--muted); font-size: 15px; padding: 2px; }
        .close:hover { color: var(--ink); }
        .question { font-family: var(--font-display); font-size: 14.5px; margin-bottom: 10px; }
        textarea { box-sizing: border-box; width: 100%; min-height: 52px; max-height: 120px;
          background: var(--bg); color: var(--ink); border: 1px solid var(--border); border-radius: 10px;
          padding: 8px 10px; font: 13px/1.5 var(--font-text); resize: vertical; }
        textarea::placeholder { color: var(--muted); }
        textarea:focus { outline: none; border-color: var(--accent); }
        .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
        .reply { padding: 7px 14px; border-radius: 9px; border: 1px solid var(--accent); background: var(--accent);
          color: #FDFCF9; font: 600 12.5px var(--font-text); cursor: pointer; }
        .reply:hover { filter: brightness(1.08); }
        .skip { border: 0; background: none; color: var(--muted); font-size: 11.5px; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; }
        .skip:hover { color: var(--ink); }
        .thanks { color: var(--accent); font-size: 13px; }
      </style>
      <div class="root">
        <div class="panel" role="dialog" aria-label="${t("postTitle")}">
          <div class="title"><span>🪞 ${t("postTitle")}</span> <button class="close">✕</button></div>
          <div class="question"></div>
          <textarea class="answer"></textarea>
          <div class="row">
            <button class="reply">${t("postReply")}</button>
            <button class="skip">${t("postSkip")}</button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(postHost);

    const panel = shadow.querySelector(".panel");
    const answer = shadow.querySelector(".answer");
    shadow.querySelector(".question").textContent = opts.question;
    answer.placeholder = t("postPlaceholder");

    const skip = () => {
      closePost();
      if (opts.onSkip) opts.onSkip();
    };
    const reply = () => {
      const text = answer.value.trim();
      if (!text) return skip();
      clearTimeout(postTimer);
      panel.innerHTML = `<div class="thanks">${t("postThanks")}</div>`;
      postTimer = setTimeout(closePost, 2500);
      opts.onReply(text);
    };

    shadow.querySelector(".close").addEventListener("click", skip);
    shadow.querySelector(".skip").addEventListener("click", skip);
    shadow.querySelector(".reply").addEventListener("click", reply);
    answer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        reply();
      }
      e.stopPropagation();
    });

    requestAnimationFrame(() => panel.classList.add("visible"));
    clearTimeout(postTimer);
    postTimer = setTimeout(() => {
      // Fermeture silencieuse : l'inaction n'est pas un refus, on ne trace rien.
      closePost();
    }, 45000);
  }

  function closePost() {
    clearTimeout(postTimer);
    if (postHost) {
      postHost.remove();
      postHost = null;
    }
  }

  /* ---------- Modale : dialogue socratique itératif ---------- */

  // opts: { promptText, scoreBefore, showScore (défaut true), branding: {name, color},
  //   library (tableau de prompts publiés par l'organisation, ou null),
  //   lang (langue du PROMPT, pour filtrer la bibliothèque),
  //   subtitle (remplace le sous-titre : ré-entrée honnête),
  //   promise (bool : afficher la promesse « je ne t'interromprai plus »),
  //   methodUrl (page publique qui explique le barème ; l'appelant la dérive
  //     de CoachConfig.APP_URL — sans elle, le « ? » n'est pas affiché),
  //   rescore(text) -> scores, compile(originalPrompt, answers) -> string,
  //   compileParts(originalPrompt, answers) -> {original, header, lines:[{key, axis, label, text}]}
  //     (même source que compile : la vue construite en dessine un bloc par
  //      ligne, sans reparser le texte compilé ; un repli existe si absent),
  //   ask(state) -> Promise<{key, axis, label, question}>,
  //   onSend(finalText, meta), onSendAnyway(meta), onCancel(meta), onPause(meta) }
  function showModal(opts) {
    closeModal();
    const accent = (opts.branding && opts.branding.color) || CoachTheme.DEFAULT_ACCENT;
    const brand = (opts.branding && opts.branding.name) || t("brandDefault");
    // Réglage d'organisation : aucun chiffre à l'écran. On continue de scorer
    // et de synchroniser — c'est l'affichage qui disparaît, pas la mesure.
    const showScore = opts.showScore !== false;

    const state = {
      answers: [], // {key, axis, label, question, answer}
      asked: [],
      current: null,
      previewFrozen: false, // édition manuelle de l'aperçu → on arrête de recompiler
      // editing dit QUELLE FACE de la colonne droite est montrée ; previewFrozen
      // dit QUI POSSÈDE le texte. Les confondre casserait deux choses : l'écouteur
      // « input » ne peut pas se déclencher sur un textarea en display:none (il
      // n'y aurait plus d'entrée en édition), et ouvrir le texte brut pour le
      // LIRE gèlerait la recompilation, donc tuerait « voir le prompt se
      // construire » pour qui revient ensuite répondre. Invariant : gelé ⇒ en
      // édition (un texte gelé ne se décompose pas en blocs honnêtes).
      editing: false,
      rerolls: 0, // relances « autre question » sur toute la session
      rerollsForCurrent: 0, // plafond par question (2) : borne le coût LLM
      closed: false, // état de clôture atteint (axes faibles couverts)
      bankExhausted: false, // toutes les questions adaptées ont été posées
    };

    modalHost = document.createElement("div");
    modalHost.id = "coach-ia-modal";
    const shadow = modalHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        /* GARDE-FOU, ne pas retirer. L'attribut « hidden » n'est qu'une règle
           d'agent utilisateur, à très faible spécificité : la moindre règle
           « display: » écrite ici la bat. C'est ce qui laissait la pastille
           d'accent de la notice LLM (.llm-note, en display:flex) visible dans
           TOUTES les modales, y compris quand aucune question n'était générée
           par IA. Toute la mécanique d'affichage conditionnel de cette modale
           repose sur « hidden » : elle a besoin qu'il gagne.
           NB : ce bloc de style vit dans un littéral de gabarit JavaScript —
           pas d'accent grave dans les commentaires, il fermerait la chaîne. */
        [hidden] { display: none !important; }
        .root { ${CoachTheme.vars(accent)} }
        .overlay { position: fixed; inset: 0; z-index: 2147483647; background: var(--overlay);
          display: flex; align-items: center; justify-content: center; padding: 12px;
          font: 14px/1.55 var(--font-text); -webkit-font-smoothing: antialiased; }
        /* Écrans peu hauts : la modale elle-même devient défilante plutôt que
           de couper ses boutons (les sections internes gardent leur propre
           défilement quand tout tient). */
        .modal { width: min(660px, 94vw); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px);
          display: flex; flex-direction: column;
          background: var(--bg); color: var(--ink); border: 1px solid var(--border); border-radius: 18px;
          box-shadow: var(--shadow); overflow-y: auto; overflow-x: hidden; }
        @media (max-height: 700px) {
          .thread { max-height: 22vh; }
          .preview { min-height: 48px; }
          .answer { min-height: 36px; }
          .head { padding-top: 12px; }
          .preview-zone { padding-bottom: 12px; }
        }
        /* Les deux colonnes n'existent qu'a partir de 900px (voir plus bas).
           En dessous, « display: contents » les efface de l'arbre de boites :
           .thread reste un enfant flex DIRECT de .modal et garde son flex:1,
           donc l'enveloppe n'a rigoureusement aucun effet de mise en page. */
        .col { display: contents; }
        .head { display: flex; align-items: center; padding: 18px 22px 8px; }
        h1 { font: 600 17px/1.3 var(--font-display); margin: 0; color: var(--ink); letter-spacing: .005em; }
        h1 .tick { color: var(--accent); }
        .closex { margin-left: auto; border: 0; background: none; color: var(--muted); font-size: 16px; cursor: pointer; padding: 4px; }
        .closex:hover { color: var(--ink); }
        .sub { padding: 0 22px 12px; color: var(--muted); font-size: 12.5px; }
        .promise { padding: 0 22px 12px; color: var(--accent); font-size: 12px; font-style: italic; }
        .intention { padding: 0 22px 12px; color: var(--muted); font-size: 12px; font-style: italic;
          font-family: var(--font-display); }
        .pause-link { border: 0; background: none; color: var(--muted); font-size: 11.5px; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; padding: 8px 0 0; align-self: center; }
        .pause-link:hover { color: var(--ink); }
        .score { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent); }

        /* Bibliothèque de l'organisation : REPLIÉE par défaut. L'école
           suppose que le bon moment est celui de l'interception, mais le dit
           elle-même non vérifié : repliée, elle ne peut pas dégrader le
           dialogue si l'hypothèse est fausse, et son taux d'ouverture est
           mesurable. */
        .library { margin: 0 22px 10px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--soft); }
        .library summary { cursor: pointer; padding: 8px 12px; font-size: 12.5px; color: var(--ink);
          list-style: none; }
        .library summary::-webkit-details-marker { display: none; }
        .library summary::before { content: "📚 "; }
        .library summary:hover { color: var(--accent); }
        .library-list { max-height: 30vh; overflow-y: auto; padding: 0 8px 8px; }
        .lib-item { width: 100%; text-align: left; display: block; cursor: pointer; margin-top: 6px;
          background: var(--bg); border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px;
          font: inherit; color: var(--ink); }
        .lib-item:hover { border-color: var(--accent); }
        .lib-title { display: block; font-size: 13px; font-family: var(--font-display); }
        .lib-meta { display: block; margin-top: 3px; font-size: 11px; color: var(--muted); }
        .lib-body { display: block; margin-top: 4px; font-size: 11.5px; color: var(--muted);
          overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .library-note { padding: 6px 12px 0; font-size: 11px; color: var(--muted); font-style: italic; }

        .thread { flex: 1; min-height: 60px; max-height: 32vh; overflow-y: auto; padding: 6px 22px; }
        .bubble { max-width: 86%; margin-bottom: 10px; padding: 10px 14px; border-radius: 14px; white-space: pre-wrap; }
        .bubble.coach { background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 5px;
          font-family: var(--font-display); font-size: 14.5px; }
        .bubble.replaced { opacity: .45; }
        .llm-badge { display: block; font: 10px var(--font-text); color: var(--muted); margin-bottom: 3px;
          text-transform: uppercase; letter-spacing: .06em; }
        .llm-note { padding: 0 22px 10px; color: var(--muted); font-size: 11px;
          display: flex; gap: 6px; align-items: baseline; }
        .llm-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: none;
          position: relative; top: -1px; }
        .bubble.user { background: var(--accent); color: #FDFCF9; margin-left: auto; border-bottom-right-radius: 5px; }
        .bubble.skip { background: none; border: 1px dashed var(--border); color: var(--muted); font-style: italic; }
        .thinking { color: var(--muted); font-size: 12px; padding: 0 22px 6px; }

        .answer-zone { padding: 8px 22px 12px; border-top: 1px solid var(--border); background: var(--bg); }
        .answer-row { display: flex; gap: 10px; align-items: flex-end; }
        textarea { box-sizing: border-box; background: var(--surface); color: var(--ink); border: 1px solid var(--border);
          border-radius: 12px; padding: 10px 12px; font: 13.5px/1.55 var(--font-text); resize: vertical; }
        textarea::placeholder { color: var(--muted); }
        textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
        .answer { flex: 1; min-height: 44px; max-height: 110px; }
        .reply { padding: 10px 16px; border-radius: 11px; border: 1px solid var(--accent); background: var(--accent);
          color: #FDFCF9; font: 600 13px var(--font-text); cursor: pointer; }
        .reply:hover { filter: brightness(1.08); }
        .skip-link { border: 0; background: none; color: var(--muted); font-size: 11.5px; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; padding: 6px 0 0; }
        .skip-link:hover { color: var(--ink); }
        .reroll-link { border: 0; background: none; color: var(--muted); font-size: 11.5px; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; padding: 6px 0 0; margin-left: 14px; }
        .reroll-link:hover { color: var(--ink); }
        .exhausted { padding: 6px 0 0; color: var(--muted); font-size: 11px; font-style: italic; }

        /* État de clôture : chaque axe faible a reçu une vraie réponse, on
           rend la main. Rien n'est fermé de force — « une question de plus »
           relance la boucle. */
        .closing { padding: 2px 0 0; }
        .closing-text { margin: 0; font-family: var(--font-display); font-size: 14px; color: var(--ink); }
        .closing-more { margin-top: 8px; border: 0; background: none; color: var(--muted); font-size: 11.5px;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 4px 0; }
        .closing-more:hover { color: var(--ink); }
        /* L'envoi devient le geste évident, sans que rien d'autre disparaisse. */
        .modal.ready .send { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }

        .preview-zone { padding: 12px 22px 18px; border-top: 1px solid var(--border); background: var(--soft); }
        .preview-head { display: flex; align-items: center; gap: 10px; font-size: 10.5px; color: var(--muted);
          text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; flex-wrap: wrap; }
        .score-detail { color: var(--muted); text-transform: none; letter-spacing: normal;
          font-variant-numeric: tabular-nums; }
        .recompile { display: none; border: 0; background: none; color: var(--accent); font-size: 11px;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .preview-zone.frozen .recompile { display: inline; }
        .method-link { margin-left: auto; color: var(--muted); text-decoration: none;
          border: 1px solid var(--border); border-radius: 50%; width: 15px; height: 15px;
          display: inline-flex; align-items: center; justify-content: center; font-size: 10px; }
        .method-link:hover { color: var(--accent); border-color: var(--accent); }
        .preview { width: 100%; min-height: 72px; max-height: 150px; }

        /* Deux faces d'une meme chose. Le basculement se fait PAR CLASSE
           D'ANCETRE et jamais par l'attribut hidden : la regle [hidden] plus
           haut est en !important et gagnerait sur tout, c'est le bug que son
           commentaire raconte. Et display:none (pas visibility ni opacity) est
           ce qui sort correctement le textarea cache de l'ordre de tabulation. */
        .preview-render { display: block; overflow-y: auto; max-height: 240px; cursor: text; }
        .preview { display: none; }
        .preview-zone.editing .preview { display: block; }
        .preview-zone.editing .preview-render { display: none; }
        .edit-link, .done-link { border: 0; background: none; color: var(--accent); font-size: 11px;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
        .edit-link { display: inline; }
        .preview-zone.editing .edit-link { display: none; }
        .done-link { display: none; }
        .preview-zone.editing .done-link { display: inline; }
        .preview-zone.frozen .done-link { display: none; }

        /* La demande d'origine, puis un bloc par reponse. Les prefixes
           « - Label : » deviennent des legendes : c'est le prix a payer pour
           pouvoir montrer QUELLE ligne vient d'arriver, et « modifier le
           texte » rend les octets bruts en un clic. */
        .pv-original { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 12px;
          border-radius: 12px; background: var(--surface); border: 1px solid var(--border);
          font: 13.5px/1.6 var(--font-text); color: var(--ink); }
        .pv-cap { display: block; margin-bottom: 4px; font: 10.5px var(--font-text); color: var(--muted);
          text-transform: uppercase; letter-spacing: .08em; }
        .pv-header { margin: 14px 0 8px; font: 10.5px var(--font-text); color: var(--muted);
          text-transform: uppercase; letter-spacing: .08em; }
        .pv-line { position: relative; margin-bottom: 8px; padding: 9px 12px; border-radius: 12px;
          background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); }
        .pv-line .pv-cap { text-transform: none; letter-spacing: normal; font-size: 11px; }
        .pv-text { white-space: pre-wrap; overflow-wrap: anywhere; font: 13.5px/1.6 var(--font-text); }
        .pv-empty { margin-top: 12px; color: var(--muted); font-size: 12px; font-style: italic;
          font-family: var(--font-display); }

        /* Le lien reponse <-> bloc. La pastille numerotee est le mecanisme
           DURABLE : un lien au survol est invisible en premiere lecture,
           invisible au tactile et invisible au clavier. Le survol n'est qu'un
           renfort. Une question passee n'a pas de pastille : rien n'a atterri. */
        .pv-line[data-n]::before, .bubble.user[data-n]::before {
          content: attr(data-n); position: absolute; top: -7px; left: -7px;
          width: 17px; height: 17px; border-radius: 50%; background: var(--accent); color: #FDFCF9;
          font: 600 10px/17px var(--font-text); text-align: center; }
        .bubble.user { position: relative; }
        .pv-line.linked, .bubble.linked { background: color-mix(in srgb, var(--accent) 8%, var(--surface));
          border-color: var(--accent); }
        .pv-line.fresh { animation: pv-in .32s ease-out; }
        @keyframes pv-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .pv-line.fresh { animation: none; } }

        .sr-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
          white-space: nowrap; margin: 0; }
        .buttons { display: flex; gap: 10px; margin-top: 12px; }
        .send { flex: 1; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--accent); background: var(--accent);
          color: #FDFCF9; font: 600 13.5px var(--font-text); cursor: pointer; }
        .send:hover { filter: brightness(1.08); }
        .anyway { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: none;
          color: var(--muted); cursor: pointer; font: 12px var(--font-text); }
        .anyway:hover { color: var(--ink); border-color: var(--muted); }

        /* ---------- Deux colonnes : le dialogue a gauche, le prompt a droite ----------
           Ecrit en surcouche, pas en remplacement : tout ce qui precede reste la
           mise en page de repli. Une requete mal cadree degrade donc vers la
           modale d'aujourd'hui, qui fonctionne, et non vers un ecran casse.
           Le garde min-height evite le pire cas : sous ~520px de haut, les deux
           colonnes ne tiennent pas leur chrome fixe et overflow:hidden couperait
           les boutons au lieu de les rendre atteignables. */
        @media (min-width: 900px) and (min-height: 520px) {
          .modal { width: min(1040px, 94vw);
            height: min(760px, calc(100vh - 24px)); height: min(760px, calc(100dvh - 24px));
            display: grid;
            /* minmax(0, …) est obligatoire : un element de grille vaut
               min-width:auto par defaut, et un seul jeton insecable du prompt
               (une URL collee) ferait deborder la colonne. */
            grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            overflow: hidden; position: relative; }
          /* min-height:0 pour la meme raison cote flex : sans lui, .thread
             refuse de retrecir et fait deborder la colonne entiere. */
          .col { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
          .col.right { background: var(--soft); border-left: 1px solid var(--border); }

          .thread { flex: 1; min-height: 0; max-height: none; }

          /* La croix ferme le dialogue entier, pas la colonne gauche : elle
             reste dans .head en source (l'ordre du DOM porte le repli) et se
             pose en absolu au coin de la modale. */
          .closex { position: absolute; top: 10px; right: 12px; margin-left: 0; z-index: 1; }

          .preview-zone { flex: 1; min-height: 0; display: flex; flex-direction: column;
            border-top: 0; background: none; padding: 16px 22px 18px; }
          /* Le titre absorbe la place, ce qui pousse les liens a droite sans
             margin-left:auto ; la ventilation par rubrique passe sur sa propre
             ligne plutot que de faire deborder le bandeau sur deux niveaux. */
          .preview-head { flex-wrap: nowrap; align-items: flex-start; padding-right: 26px; }
          .preview-title { flex: 1 1 auto; min-width: 0; }
          .score-detail { display: block; margin-top: 3px; }
          .preview-render, .preview { flex: 1; min-height: 0; max-height: none; }
          .buttons, .pause-link { flex: none; }
          /* La colonne est trop etroite pour deux boutons cote a cote : l'un
             sous l'autre, l'envoi d'abord. « Tel quel » reste inamovible. */
          .buttons { flex-direction: column; gap: 8px; }
          .send { flex: none; }

          /* Une longue reponse en blanc sur accent, alignee a droite, est le
             texte le moins lisible de la modale. En deux colonnes le fil est
             une surface de RELECTURE : la reponse redevient un bloc de lecture,
             la distinction question/reponse passant par la famille typographique
             et le filet d'accent. */
          .bubble.user { max-width: 100%; margin-left: 0; background: var(--surface); color: var(--ink);
            border: 1px solid var(--border); border-left: 3px solid var(--accent);
            border-bottom-right-radius: 14px; }
        }

        /* Ecran bas ET deux colonnes : on resserre les marges, mais on ne
           plafonne plus .thread ni l'apercu — ils sont en flex:1 et la hauteur
           suit deja dvh. Les regles du bloc compact ci-dessus seraient fausses. */
        @media (min-width: 900px) and (max-height: 700px) and (min-height: 520px) {
          .thread { max-height: none; }
          .preview { min-height: 0; max-height: none; }
          .head { padding: 12px 22px 6px; }
          .sub { padding-bottom: 8px; }
          .preview-zone { padding: 12px 22px 12px; }
        }
      </style>
      <div class="root">
        <div class="overlay">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="coach-title">
            <div class="col left">
            <div class="head"><h1 id="coach-title"><span class="tick">🪞</span> </h1><button class="closex"></button></div>
            <div class="sub"></div>
            <div class="llm-note" hidden><span class="llm-dot"></span><span class="llm-note-text"></span></div>
            <div class="intention" hidden></div>
            <div class="promise" hidden></div>
            <details class="library" hidden>
              <summary class="library-head"></summary>
              <div class="library-note"></div>
              <div class="library-list"></div>
            </details>
            <div class="thread"></div>
            <div class="thinking" hidden>…</div>
            <div class="answer-zone">
              <div class="answer-row">
                <textarea class="answer"></textarea>
                <button class="reply"></button>
              </div>
              <button class="skip-link"></button><button class="reroll-link"></button>
              <div class="exhausted" hidden></div>
              <div class="closing" hidden>
                <p class="closing-text"></p>
                <button class="closing-more"></button>
              </div>
            </div>
            </div>
            <div class="col right">
            <div class="preview-zone">
              <div class="preview-head">
                <span class="preview-title"></span>
                <button class="edit-link"></button>
                <button class="done-link"></button>
                <button class="recompile"></button>
                <a class="method-link" target="_blank" rel="noreferrer">?</a>
              </div>
              <div class="preview-render"></div>
              <textarea class="preview" spellcheck="false"></textarea>
              <p class="sr-status" aria-live="polite"></p>
              <div class="buttons">
                <button class="send"></button>
                <button class="anyway"></button>
              </div>
              <button class="pause-link"></button>
            </div>
            </div>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(modalHost);

    const el = (sel) => shadow.querySelector(sel);
    el("h1").append(t("modalTitle", brand));
    el(".closex").textContent = "✕";
    el(".closex").title = t("modalCancelTitle");
    // Sous-titre : ré-entrée honnête si fournie, sinon standard + promesse.
    el(".sub").textContent =
      opts.subtitle || (showScore ? t("modalSub", opts.scoreBefore) : t("modalSubNoScore"));
    // Intention d'implémentation : le plan de l'utilisateur, tel quel,
    // les premières semaines seulement (content.js décide de le fournir).
    if (opts.intention) {
      el(".intention").textContent = t("modalIntention", opts.intention);
      el(".intention").hidden = false;
    }
    if (opts.promise) {
      el(".promise").textContent = t("modalPromise");
      el(".promise").hidden = false;
    }
    el(".pause-link").textContent = t("modalPause");
    el(".answer").placeholder = t("modalAnswerPlaceholder");
    el(".reply").textContent = t("modalReply");
    el(".skip-link").textContent = t("modalSkip");
    el(".reroll-link").textContent = `↻ ${t("modalOtherQuestion")}`;
    el(".closing-more").textContent = t("modalOneMore");
    el(".reroll-link").title = t("modalOtherQuestionTitle");
    // Transparence LLM : quand l'org a activé les questions IA (et que les
    // consentements le permettent), on l'affiche, on ne le devine pas.
    if (opts.llmActive) {
      el(".llm-note-text").textContent = t("modalLlmNotice");
      el(".llm-note").hidden = false;
    }
    el(".recompile").textContent = t("modalRecompile");
    el(".edit-link").textContent = t("modalPreviewEdit");
    el(".edit-link").title = t("modalPreviewEditTitle");
    el(".done-link").textContent = t("modalPreviewDone");
    el(".send").textContent = t("modalSend");
    el(".anyway").textContent = t("modalSendAnyway");
    // Transparence : le « ? » ouvre la page publique qui explique le barème
    // (/help#method de l'app). La cible n'est pas codée ici : content.js la
    // dérive de CoachConfig.APP_URL, un seul endroit à changer si le domaine bouge.
    if (opts.methodUrl) el(".method-link").href = opts.methodUrl;
    el(".method-link").title = t("modalMethodTitle");
    el(".method-link").hidden = !showScore || !opts.methodUrl;

    const thread = el(".thread");
    const answerBox = el(".answer");
    const preview = el(".preview");
    const previewTitle = el(".preview-title");

    // Transparence : le total ET sa ventilation, mise à jour en direct :
    // l'utilisateur voit quelle réponse fait bouger quelle rubrique.
    function setPreviewScore(scores) {
      previewTitle.textContent = "";
      if (!showScore) {
        // Sans le chiffre, l'en-tête doit quand même dire CE QU'ON REGARDE :
        // l'aperçu reste le texte qui partira, éditable et vérifiable.
        previewTitle.append(t("modalPreviewHeadNoScore"));
        return;
      }
      previewTitle.append(`${t("modalPreviewHead")} `);
      // La fleche n'apparait QUE si les deux chiffres different : a l'ouverture
      // ils sont egaux par construction, et « 7 → 7 » se lirait comme un echec.
      const before = opts.scoreBefore;
      if (before !== null && before !== undefined && before !== scores.total) {
        const b = document.createElement("span");
        b.className = "score-before";
        b.textContent = before;
        previewTitle.append(b, " → ");
        previewTitle.title = t("modalScoreProgress", before, scores.total);
      } else {
        previewTitle.title = "";
      }
      const s = document.createElement("span");
      s.className = "score";
      s.textContent = scores.total;
      previewTitle.append(s, "/100");
      const detail = document.createElement("span");
      detail.className = "score-detail";
      detail.textContent = ` · ${t("rubClarte")} ${scores.clarte} · ${t("rubContexte")} ${scores.contexte} · ${t("rubCritique")} ${scores.critique}`;
      previewTitle.append(detail);
    }

    function bubble(kind, text, badge, key) {
      const b = document.createElement("div");
      b.className = `bubble ${kind}`;
      // La cle est ce qui apparie une bulle et le bloc qu'elle a produit.
      if (key) b.dataset.key = key;
      if (badge) {
        const tag = document.createElement("span");
        tag.className = "llm-badge";
        tag.textContent = badge;
        b.appendChild(tag);
      }
      b.appendChild(document.createTextNode(text));
      thread.appendChild(b);
      thread.scrollTop = thread.scrollHeight;
      return b;
    }

    const renderBox = el(".preview-render");

    // Seul propriétaire de state.editing / state.previewFrozen et des deux
    // classes qui les reflètent. Passer par ici partout est ce qui garantit
    // l'invariant « gelé ⇒ en édition ».
    function setPreviewMode(next = {}) {
      if (next.frozen !== undefined) state.previewFrozen = next.frozen;
      if (next.editing !== undefined) state.editing = next.editing;
      if (state.previewFrozen) state.editing = true;
      const zone = el(".preview-zone");
      zone.classList.toggle("editing", state.editing);
      zone.classList.toggle("frozen", state.previewFrozen);
      // Le focus après un changement de display doit attendre le prochain
      // rendu, sinon il porte sur un élément encore invisible.
      if (next.focus) requestAnimationFrame(() => preview.focus());
    }

    // La colonne droite en vue construite. Reconstruite en entier à chaque
    // appel (donc surtout PAS d'aria-live ici : l'annonce passe par .sr-status,
    // sinon le lecteur d'écran relirait le prompt entier à chaque réponse).
    function renderPreview(highlightKey) {
      renderBox.textContent = "";
      const filled = state.answers.filter((a) => a.answer && a.answer.trim());
      const parts =
        typeof opts.compileParts === "function"
          ? opts.compileParts(opts.promptText, state.answers)
          : // Repli défensif si l'appelant n'a pas fourni compileParts : l'ordre
            // sera celui des réponses, donc potentiellement différent du texte.
            { original: (opts.promptText || "").trim(), header: "",
              lines: filled.map((a) => ({ key: a.key, axis: a.axis, label: a.label, text: a.answer.trim() })) };

      // Numérotation CHRONOLOGIQUE (elle doit correspondre au fil), alors que
      // l'ORDRE des blocs suit parts.lines (il doit correspondre au textarea).
      const rank = new Map();
      filled.forEach((a, i) => rank.set(a.key, i + 1));

      const cap = document.createElement("span");
      cap.className = "pv-cap";
      cap.textContent = t("modalPreviewOriginal");
      const orig = document.createElement("div");
      orig.className = "pv-original";
      orig.textContent = parts.original;
      renderBox.append(cap, orig);

      if (!parts.lines.length) {
        const empty = document.createElement("p");
        empty.className = "pv-empty";
        empty.textContent = t("modalPreviewEmpty");
        renderBox.appendChild(empty);
        return;
      }

      if (parts.header) {
        const h = document.createElement("div");
        h.className = "pv-header";
        h.textContent = parts.header;
        renderBox.appendChild(h);
      }
      for (const line of parts.lines) {
        const block = document.createElement("div");
        block.className = line.key === highlightKey ? "pv-line fresh" : "pv-line";
        if (line.key) block.dataset.key = line.key;
        const n = rank.get(line.key);
        if (n) block.dataset.n = n;
        const label = document.createElement("span");
        label.className = "pv-cap";
        label.textContent = line.label;
        const text = document.createElement("div");
        text.className = "pv-text";
        text.textContent = line.text;
        block.append(label, text);
        renderBox.appendChild(block);
      }
    }

    // Met en évidence la bulle ET le bloc qui portent la même clé.
    function setLinked(key) {
      for (const n of shadow.querySelectorAll(".linked")) n.classList.remove("linked");
      if (!key) return;
      for (const n of shadow.querySelectorAll(`[data-key="${CSS.escape(key)}"]`)) n.classList.add("linked");
    }

    function updatePreview(highlightKey) {
      if (state.previewFrozen) return;
      preview.value = opts.compile(opts.promptText, state.answers);
      setPreviewScore(opts.rescore(preview.value));
      renderPreview(highlightKey);
    }

    // Bibliothèque publiée par l'organisation. On ne garde que les entrées
    // sans langue déclarée ou dans la langue du prompt : proposer un modèle
    // français à quelqu'un qui écrit en anglais est pire que ne rien proposer.
    // Les pré-prompts officiels passent devant, puis les prompts partagés
    // entre étudiants, les plus repris d'abord.
    function renderLibrary() {
      const all = Array.isArray(opts.library) ? opts.library : [];
      const lang = opts.lang || "fr";
      const items = all
        .filter((p) => !p.lang || p.lang === lang)
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "official" ? -1 : 1;
          return (b.copies || 0) - (a.copies || 0);
        });
      if (!items.length) return;

      el(".library-head").textContent = t("libraryHead", items.length);
      el(".library-note").textContent = t("libraryNote");
      const list = el(".library-list");
      for (const p of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lib-item";

        const title = document.createElement("span");
        title.className = "lib-title";
        title.textContent = p.title;

        const meta = document.createElement("span");
        meta.className = "lib-meta";
        const kindLabel = p.kind === "peer" ? t("libraryPeer") : t("libraryOfficial");
        const bits = [kindLabel];
        // Une organisation qui nomme son auteur « Équipe pédagogique » écrirait
        // deux fois la même chose : on ne répète pas le libellé de nature.
        if (p.author && p.author !== kindLabel) bits.push(p.author);
        if (p.category) bits.push(p.category);
        if (p.copies) bits.push(t("libraryCopies", p.copies));
        if (p.helpful) bits.push(t("libraryHelpful", p.helpful));
        meta.textContent = bits.join(" · ");

        const body = document.createElement("span");
        body.className = "lib-body";
        body.textContent = p.body;

        btn.append(title, meta, body);
        // Charger un prompt GÈLE la recompilation, exactement comme une
        // édition manuelle de l'aperçu : le dialogue ne doit pas écraser le
        // choix de l'utilisateur au tour suivant. Le lien « recompiler depuis
        // le dialogue », déjà présent, est l'annulation en un clic.
        btn.addEventListener("click", () => {
          preview.value = p.body;
          setPreviewMode({ editing: true, frozen: true, focus: true });
          setPreviewScore(opts.rescore(preview.value));
          el(".library").open = false;
        });
        list.appendChild(btn);
      }
      el(".library").hidden = false;
    }

    function meta() {
      const filled = state.answers.filter((a) => a.answer && a.answer.trim());
      return {
        rounds: state.asked.length,
        answersCount: filled.length,
        rerolls: state.rerolls,
        // Le raisonnement lui-même (paires question/réponse) : capturé en
        // local, transmis à l'org uniquement si l'utilisateur y a consenti.
        answers: filled.map((a) => ({ q: a.question, a: a.answer.trim(), axis: a.axis })),
      };
    }

    // Rendre la main : chaque axe faible a reçu une vraie réponse. On NE pose
    // pas de question de plus, parce que la suivante serait de l'occupation —
    // c'est le « recyclage qui se lit comme du remplissage » remonté par
    // I-BE³. L'utilisateur garde la main dans les deux sens : envoyer, ou
    // demander explicitement une question supplémentaire.
    function showClosing(cov) {
      state.closed = true;
      el(".answer-row").hidden = true;
      el(".skip-link").hidden = true;
      el(".reroll-link").hidden = true;
      el(".exhausted").hidden = true;
      el(".closing-text").textContent =
        cov.labels && cov.labels.length
          ? t("modalCoverageDone", cov.labels.join(", "))
          : t("modalCoverageDoneShort");
      el(".closing").hidden = false;
      el(".modal").classList.add("ready");
      el(".send").focus();
    }

    function reopenDialogue() {
      state.closed = false;
      el(".closing").hidden = true;
      el(".answer-row").hidden = false;
      el(".skip-link").hidden = false;
      // La relance ne redevient offerte que si la banque n'était pas épuisée.
      if (!state.bankExhausted) el(".reroll-link").hidden = false;
      el(".modal").classList.remove("ready");
      askNext({ forced: true });
    }

    // Boucle : demander la question suivante. `forced` court-circuite la
    // clôture (l'utilisateur a réclamé une question de plus).
    // extra transporte la relance ({ reroll, lastAxis, lastLevel, lastQuestion }).
    async function askNext(extra = {}) {
      if (!extra.reroll && !extra.forced && typeof opts.coverage === "function") {
        const cov = opts.coverage({ answers: state.answers, asked: state.asked });
        if (cov && cov.complete) return showClosing(cov);
      }
      el(".thinking").hidden = false;
      let q;
      try {
        q = await opts.ask({ answers: state.answers, asked: state.asked, ...extra });
      } finally {
        el(".thinking").hidden = true;
      }
      state.current = q;
      state.asked.push(q.key);
      if (!extra.reroll) state.rerollsForCurrent = 0;
      // Le badge ne marque QUE les questions effectivement générées par le
      // LLM : un repli local dans une session LLM reste sans badge.
      bubble("coach", q.question, q.source === "llm" ? t("modalLlmBadge") : null, q.key);
      // Banque locale épuisée (questions adaptées toutes posées) : la relance
      // n'a plus de matière, sauf si le LLM peut toujours générer.
      if (q.recycled && !opts.llmActive) {
        state.bankExhausted = true;
        el(".reroll-link").hidden = true;
        const ex = el(".exhausted");
        if (ex.hidden) {
          ex.textContent = t("modalBankExhausted");
          ex.hidden = false;
        }
      }
      answerBox.focus();
    }

    // « Autre question » (retour terrain) : la question écartée reste dans le
    // fil, grisée (honnêteté), et sa clé reste brûlée. La suivante vise le
    // même axe, un cran d'exigence au-dessus. Plafond : 2 relances par question.
    function rerollQuestion() {
      if (!state.current || state.rerollsForCurrent >= 2) return;
      state.rerollsForCurrent++;
      state.rerolls++;
      const coaches = thread.querySelectorAll(".bubble.coach");
      const last = coaches[coaches.length - 1];
      if (last) last.classList.add("replaced");
      askNext({
        reroll: true,
        lastAxis: state.current.axis,
        lastLevel: state.current.level,
        lastQuestion: state.current.question,
      });
    }

    function submitAnswer(text) {
      if (!state.current) return;
      const answer = text.trim();
      const key = state.current.key;
      const label = state.current.label;
      state.answers.push({ ...state.current, answer });
      const b = bubble(answer ? "user" : "skip", answer || t("modalSkipped"), null, key);
      // Une question passée ne reçoit PAS de pastille : c'est le signal honnête
      // que rien n'a atterri dans la colonne de droite.
      if (answer) {
        b.dataset.n = state.answers.filter((a) => a.answer && a.answer.trim()).length;
        el(".sr-status").textContent = t("modalPreviewAdded", label);
      }
      answerBox.value = "";
      updatePreview(answer ? key : null);
      askNext();
    }

    el(".reply").addEventListener("click", () => submitAnswer(answerBox.value));
    el(".skip-link").addEventListener("click", () => submitAnswer(""));
    el(".reroll-link").addEventListener("click", rerollQuestion);
    el(".closing-more").addEventListener("click", reopenDialogue);
    answerBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitAnswer(answerBox.value);
      }
    });

    // Édition manuelle de l'aperçu → gel de la recompilation automatique.
    // Ouvrir le texte brut NE GÈLE PAS : on peut le lire puis revenir répondre.
    // Seule la frappe gèle. C'est cette distinction que les deux booléens
    // préservent, et la confondre est la régression à ne pas réintroduire.
    el(".edit-link").addEventListener("click", () => setPreviewMode({ editing: true, focus: true }));
    el(".done-link").addEventListener("click", () => setPreviewMode({ editing: false }));
    renderBox.addEventListener("click", () => setPreviewMode({ editing: true, focus: true }));

    // Survol et focus clavier : la bulle et son bloc s'allument ensemble.
    const linkFrom = (e) => {
      const holder = e.target && e.target.closest ? e.target.closest("[data-key]") : null;
      setLinked(holder ? holder.dataset.key : null);
    };
    el(".modal").addEventListener("mouseover", linkFrom);
    el(".modal").addEventListener("focusin", linkFrom);
    el(".modal").addEventListener("mouseout", () => setLinked(null));

    preview.addEventListener("input", () => {
      setPreviewMode({ editing: true, frozen: true });
      setPreviewScore(opts.rescore(preview.value));
    });
    el(".recompile").addEventListener("click", () => {
      // Rendre la main au dialogue : on dégèle ET on repasse en vue construite.
      setPreviewMode({ editing: false, frozen: false });
      updatePreview();
    });

    el(".send").addEventListener("click", () => {
      const finalText = preview.value.trim();
      if (!finalText) return;
      const m = meta();
      closeModal();
      opts.onSend(finalText, m);
    });
    el(".anyway").addEventListener("click", () => {
      const m = meta();
      closeModal();
      opts.onSendAnyway(m);
    });
    el(".closex").addEventListener("click", () => {
      const m = meta();
      closeModal();
      if (opts.onCancel) opts.onCancel(m);
    });
    el(".pause-link").addEventListener("click", () => {
      const m = meta();
      closeModal();
      if (opts.onPause) opts.onPause(m);
    });
    // aria-modal="true" etait affirme sans etre tenu : rien ne retenait le
    // focus, qui partait donc dans la page derriere. La refonte double le
    // nombre de controles, ce qui rend l'omission plus couteuse. On filtre sur
    // getClientRects() : le textarea cache par le mode courant ne doit pas
    // capturer la tabulation.
    el(".modal").addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusables = [...shadow.querySelectorAll("button, textarea, a[href], summary, [tabindex]:not([tabindex='-1'])")]
        .filter((n) => !n.disabled && n.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = shadow.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });

    el(".overlay").addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = meta();
        closeModal();
        if (opts.onCancel) opts.onCancel(m);
      }
      e.stopPropagation(); // la frappe dans la modale ne doit pas fuir vers la page
    });

    updatePreview();
    renderLibrary();
    askNext();
  }

  function closeModal() {
    if (modalHost) {
      modalHost.remove();
      modalHost = null;
    }
  }

  return { show, hide: hideToast, flash, showPost, closePost, showModal, closeModal, onFeedback: null, onClose: null };
})();
