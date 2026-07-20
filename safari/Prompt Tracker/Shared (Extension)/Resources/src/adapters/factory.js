// Fabrique d'adaptateurs de site. Toute la mécanique générique vit ici :
// interception en phase capture, injection vérifiée, envoi conditionné.
// Chaque site (ChatGPT, Claude, …) ne déclare que ses sélecteurs : quand une
// UI change, seul le fichier de config du site est à retoucher.

function createCoachAdapter(config) {
  const { site, composerSelectors, sendButtonSelectors, rootPaths = ["/"] } = config;

  let hooks = { shouldIntercept: () => false, onIntercept: null, onSubmit: null };
  let bypassUntil = 0; // fenêtre pendant laquelle send() programmatique n'est pas ré-intercepté
  let lastCapture = { text: "", at: 0 };

  function getComposer() {
    for (const sel of composerSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getSendButton() {
    for (const sel of sendButtonSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function readComposerText() {
    const el = getComposer();
    if (!el) return "";
    return (el.value !== undefined ? el.value : el.innerText || "").trim();
  }

  // Comparaison tolérante : ProseMirror rend les sauts de ligne différemment
  // (paragraphes, <br>), on ne compare donc que le contenu, pas les blancs.
  function normalized(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  function selectAllIn(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Remplace le contenu du composeur, avec VÉRIFICATION. Trois stratégies dans
  // l'ordre : collage synthétique (ProseMirror gère très bien le multi-lignes),
  // execCommand('insertText'), puis écriture DOM directe en paragraphes.
  function setComposerText(text) {
    const el = getComposer();
    if (!el) return false;
    el.focus();

    if (el.value !== undefined) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return normalized(el.value) === normalized(text);
    }

    try {
      selectAllIn(el);
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch {
      /* stratégie suivante */
    }
    if (normalized(el.innerText) === normalized(text)) return true;

    selectAllIn(el);
    document.execCommand("insertText", false, text);
    if (normalized(el.innerText) === normalized(text)) return true;

    el.textContent = "";
    for (const line of text.split("\n")) {
      const p = document.createElement("p");
      if (line) p.textContent = line;
      else p.appendChild(document.createElement("br"));
      el.appendChild(p);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    return normalized(el.innerText) === normalized(text);
  }

  // Envoi programmatique, exempté d'interception pendant 1,5 s.
  function send() {
    bypassUntil = Date.now() + 1500;
    const btn = getSendButton();
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    const composer = getComposer();
    if (composer) {
      composer.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true })
      );
      return true;
    }
    return false;
  }

  // Injecte `text` puis n'envoie QUE lorsque le composeur contient réellement
  // ce texte et que le bouton d'envoi est prêt. Aucun clic aveugle : sans
  // vérification réussie, rien ne part (le texte reste visible).
  function submitText(text, timeoutMs = 2000) {
    return new Promise((resolve) => {
      let injected = setComposerText(text);
      const started = Date.now();
      const tick = () => {
        const el = getComposer();
        const ready = el && normalized(el.value !== undefined ? el.value : el.innerText) === normalized(text);
        if (ready) {
          const btn = getSendButton();
          if (!btn || !btn.disabled) return resolve(send());
        } else if (!injected) {
          injected = setComposerText(text); // nouvelle tentative (React a pu re-render)
        }
        if (Date.now() - started > timeoutMs) {
          return resolve(ready ? send() : false);
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  function dedupe(text) {
    const now = Date.now();
    if (text === lastCapture.text && now - lastCapture.at < 2000) return true;
    lastCapture = { text, at: now };
    return false;
  }

  function handleSendAttempt(e, source) {
    const text = readComposerText();
    if (!text) return;

    if (Date.now() < bypassUntil || !hooks.shouldIntercept(text)) {
      if (!dedupe(text) && hooks.onSubmit) hooks.onSubmit(text, { source, intercepted: false });
      return;
    }

    // Interception : l'envoi est stoppé ici, en phase capture : rien ne part.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!dedupe(text) && hooks.onIntercept) hooks.onIntercept(text, { source });
  }

  function init(callbacks) {
    hooks = { ...hooks, ...callbacks };

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
        const composer = getComposer();
        if (composer && composer.contains(e.target)) handleSendAttempt(e, "enter");
      },
      true
    );

    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest && e.target.closest("button");
        if (!btn) return;
        if (sendButtonSelectors.some((sel) => btn.matches(sel))) handleSendAttempt(e, "click");
      },
      true
    );
  }

  // Sonde de santé : signale si le composeur est introuvable (UI du site modifiée).
  function healthy() {
    return Boolean(getComposer());
  }

  /* ---------- Fin de réponse IA (miroir d'après) ---------- */

  // Clé de la conversation courante : le chemin identifie la conversation sur
  // les trois sites (/c/<id>, /chat/<id>, /app/<id>).
  function conversationKey() {
    return `${site}:${location.pathname}`;
  }

  // Fil NEUF : au moment d'envoyer le premier message, l'URL est encore une
  // racine (l'id de conversation n'arrive que pendant la génération). C'est
  // le détecteur synchrone de « début de tâche » utilisé par la cadence.
  function isNewConversation() {
    const path = location.pathname;
    return rootPaths.some((root) => path === root || (root !== "/" && path.endsWith(root)));
  }

  let responseWatch = null;

  // Détection générique de fin de réponse : après un envoi, le document mute
  // en continu pendant le streaming ; une phase d'activité soutenue suivie
  // d'un long silence signifie que la réponse est complète. Aucun sélecteur
  // par site (robuste aux refontes d'UI), au prix de quelques secondes de
  // latence. Les mutations de nos propres surfaces (coach-ia) sont ignorées.
  // Les seuils écartent le faux positif du simple affichage du message envoyé
  // suivi du temps de réflexion du modèle (peu de mutations, puis silence).
  function watchResponse({ onComplete, quietMs = 3000, minActivity = 12, minElapsedMs = 4000, maxWaitMs = 120000 }) {
    cancelResponseWatch();
    let activity = 0;
    let quietTimer = null;
    const startedAt = Date.now();

    const ours = (node) => {
      for (let n = node; n; n = n.parentNode) {
        if (n.id && String(n.id).startsWith("coach-ia")) return true;
      }
      return false;
    };

    const finish = () => {
      cancelResponseWatch();
      onComplete();
    };

    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => !ours(m.target))) return;
      activity++;
      if (activity < minActivity || Date.now() - startedAt < minElapsedMs) return;
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
    const deadline = setTimeout(cancelResponseWatch, maxWaitMs);
    responseWatch = {
      observer,
      clear() {
        clearTimeout(quietTimer);
        clearTimeout(deadline);
      },
    };
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function cancelResponseWatch() {
    if (!responseWatch) return;
    responseWatch.observer.disconnect();
    responseWatch.clear();
    responseWatch = null;
  }

  return { init, healthy, setComposerText, send, submitText, readComposerText, watchResponse, cancelResponseWatch, conversationKey, isNewConversation, site };
}
