// Surfaces du miroir socratique, en Shadow DOM (styles isolés du site hôte) :
//   show(message)  : toast non bloquant (suggestions légères).
//   showModal(...) : dialogue socratique ITÉRATIF : le prompt a été RETENU avant
//                    l'envoi ; une question à la fois, sans fin, jusqu'à ce que
//                    l'utilisateur décide lui-même d'envoyer.
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

  // opts: { promptText, scoreBefore, branding: {name, color},
  //   subtitle (remplace le sous-titre : ré-entrée honnête),
  //   promise (bool : afficher la promesse « je ne t'interromprai plus »),
  //   rescore(text) -> scores, compile(originalPrompt, answers) -> string,
  //   ask(state) -> Promise<{key, axis, label, question}>,
  //   onSend(finalText, meta), onSendAnyway(meta), onCancel(meta), onPause(meta) }
  function showModal(opts) {
    closeModal();
    const accent = (opts.branding && opts.branding.color) || CoachTheme.DEFAULT_ACCENT;
    const brand = (opts.branding && opts.branding.name) || t("brandDefault");

    const state = {
      answers: [], // {key, axis, label, question, answer}
      asked: [],
      current: null,
      previewFrozen: false, // édition manuelle de l'aperçu → on arrête de recompiler
    };

    modalHost = document.createElement("div");
    modalHost.id = "coach-ia-modal";
    const shadow = modalHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
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
        .head { display: flex; align-items: center; padding: 18px 22px 8px; }
        h1 { font: 600 17px/1.3 var(--font-display); margin: 0; color: var(--ink); letter-spacing: .005em; }
        h1 .tick { color: var(--accent); }
        .closex { margin-left: auto; border: 0; background: none; color: var(--muted); font-size: 16px; cursor: pointer; padding: 4px; }
        .closex:hover { color: var(--ink); }
        .sub { padding: 0 22px 12px; color: var(--muted); font-size: 12.5px; }
        .promise { padding: 0 22px 12px; color: var(--accent); font-size: 12px; font-style: italic; }
        .pause-link { border: 0; background: none; color: var(--muted); font-size: 11.5px; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; padding: 8px 0 0; align-self: center; }
        .pause-link:hover { color: var(--ink); }
        .score { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent); }

        .thread { flex: 1; min-height: 60px; max-height: 32vh; overflow-y: auto; padding: 6px 22px; }
        .bubble { max-width: 86%; margin-bottom: 10px; padding: 10px 14px; border-radius: 14px; white-space: pre-wrap; }
        .bubble.coach { background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 5px;
          font-family: var(--font-display); font-size: 14.5px; }
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

        .preview-zone { padding: 12px 22px 18px; border-top: 1px solid var(--border); background: var(--soft); }
        .preview-head { display: flex; align-items: center; gap: 10px; font-size: 10.5px; color: var(--muted);
          text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; flex-wrap: wrap; }
        .score-detail { color: var(--muted); text-transform: none; letter-spacing: normal;
          font-variant-numeric: tabular-nums; }
        .recompile { display: none; border: 0; background: none; color: var(--accent); font-size: 11px;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .preview-zone.frozen .recompile { display: inline; }
        .preview { width: 100%; min-height: 72px; max-height: 150px; }
        .buttons { display: flex; gap: 10px; margin-top: 12px; }
        .send { flex: 1; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--accent); background: var(--accent);
          color: #FDFCF9; font: 600 13.5px var(--font-text); cursor: pointer; }
        .send:hover { filter: brightness(1.08); }
        .anyway { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: none;
          color: var(--muted); cursor: pointer; font: 12px var(--font-text); }
        .anyway:hover { color: var(--ink); border-color: var(--muted); }
      </style>
      <div class="root">
        <div class="overlay">
          <div class="modal" role="dialog" aria-modal="true">
            <div class="head"><h1><span class="tick">🪞</span> </h1><button class="closex"></button></div>
            <div class="sub"></div>
            <div class="promise" hidden></div>
            <div class="thread"></div>
            <div class="thinking" hidden>…</div>
            <div class="answer-zone">
              <div class="answer-row">
                <textarea class="answer"></textarea>
                <button class="reply"></button>
              </div>
              <button class="skip-link"></button>
            </div>
            <div class="preview-zone">
              <div class="preview-head">
                <span class="preview-title"></span>
                <button class="recompile"></button>
              </div>
              <textarea class="preview" spellcheck="false"></textarea>
              <div class="buttons">
                <button class="send"></button>
                <button class="anyway"></button>
              </div>
              <button class="pause-link"></button>
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
    el(".sub").textContent = opts.subtitle || t("modalSub", opts.scoreBefore);
    if (opts.promise) {
      el(".promise").textContent = t("modalPromise");
      el(".promise").hidden = false;
    }
    el(".pause-link").textContent = t("modalPause");
    el(".answer").placeholder = t("modalAnswerPlaceholder");
    el(".reply").textContent = t("modalReply");
    el(".skip-link").textContent = t("modalSkip");
    el(".recompile").textContent = t("modalRecompile");
    el(".send").textContent = t("modalSend");
    el(".anyway").textContent = t("modalSendAnyway");

    const thread = el(".thread");
    const answerBox = el(".answer");
    const preview = el(".preview");
    const previewTitle = el(".preview-title");

    // Transparence : le total ET sa ventilation, mise à jour en direct :
    // l'utilisateur voit quelle réponse fait bouger quelle rubrique.
    function setPreviewScore(scores) {
      previewTitle.textContent = "";
      previewTitle.append(`${t("modalPreviewHead")} `);
      const s = document.createElement("span");
      s.className = "score";
      s.textContent = scores.total;
      previewTitle.append(s, "/100");
      const detail = document.createElement("span");
      detail.className = "score-detail";
      detail.textContent = ` · ${t("rubClarte")} ${scores.clarte} · ${t("rubContexte")} ${scores.contexte} · ${t("rubCritique")} ${scores.critique}`;
      previewTitle.append(detail);
    }

    function bubble(kind, text) {
      const b = document.createElement("div");
      b.className = `bubble ${kind}`;
      b.textContent = text;
      thread.appendChild(b);
      thread.scrollTop = thread.scrollHeight;
    }

    function updatePreview() {
      if (state.previewFrozen) return;
      preview.value = opts.compile(opts.promptText, state.answers);
      setPreviewScore(opts.rescore(preview.value));
    }

    function meta() {
      const filled = state.answers.filter((a) => a.answer && a.answer.trim());
      return {
        rounds: state.asked.length,
        answersCount: filled.length,
        // Le raisonnement lui-même (paires question/réponse) : capturé en
        // local, transmis à l'org uniquement si l'utilisateur y a consenti.
        answers: filled.map((a) => ({ q: a.question, a: a.answer.trim(), axis: a.axis })),
      };
    }

    // Boucle infinie : demander la question suivante (jamais de fin imposée).
    async function askNext() {
      el(".thinking").hidden = false;
      let q;
      try {
        q = await opts.ask({ answers: state.answers, asked: state.asked });
      } finally {
        el(".thinking").hidden = true;
      }
      state.current = q;
      state.asked.push(q.key);
      bubble("coach", q.question);
      answerBox.focus();
    }

    function submitAnswer(text) {
      if (!state.current) return;
      const answer = text.trim();
      state.answers.push({ ...state.current, answer });
      bubble(answer ? "user" : "skip", answer || t("modalSkipped"));
      answerBox.value = "";
      updatePreview();
      askNext();
    }

    el(".reply").addEventListener("click", () => submitAnswer(answerBox.value));
    el(".skip-link").addEventListener("click", () => submitAnswer(""));
    answerBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitAnswer(answerBox.value);
      }
    });

    // Édition manuelle de l'aperçu → gel de la recompilation automatique.
    preview.addEventListener("input", () => {
      state.previewFrozen = true;
      el(".preview-zone").classList.add("frozen");
      setPreviewScore(opts.rescore(preview.value));
    });
    el(".recompile").addEventListener("click", () => {
      state.previewFrozen = false;
      el(".preview-zone").classList.remove("frozen");
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
    el(".overlay").addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = meta();
        closeModal();
        if (opts.onCancel) opts.onCancel(m);
      }
      e.stopPropagation(); // la frappe dans la modale ne doit pas fuir vers la page
    });

    updatePreview();
    askNext();
  }

  function closeModal() {
    if (modalHost) {
      modalHost.remove();
      modalHost = null;
    }
  }

  return { show, hide: hideToast, showPost, closePost, showModal, closeModal, onFeedback: null, onClose: null };
})();
