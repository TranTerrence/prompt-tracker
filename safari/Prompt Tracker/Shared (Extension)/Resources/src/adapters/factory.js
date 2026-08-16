// Fabrique d'adaptateurs de site. Toute la mécanique générique vit ici :
// interception en phase capture, injection vérifiée, envoi conditionné.
// Chaque site (ChatGPT, Claude, …) ne déclare que ses sélecteurs : quand une
// UI change, seul le fichier de config du site est à retoucher.

function createCoachAdapter(config) {
  const {
    site,
    composerSelectors,
    sendButtonSelectors,
    rootPaths = ["/"],
    // Mesures post-réponse. Tableaux VIDES tant que les sélecteurs d'un site
    // n'ont pas été vérifiés à la main : des mesures nulles valent mieux que
    // des mesures fausses, et rien d'autre n'en dépend (l'interception, la
    // détection de fin et le miroir d'après n'ont jamais utilisé de sélecteur).
    assistantSelectors = [],
    assistantTextSelectors = [],
    modelSelectors = [],
  } = config;

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

  /* ---------- Lecture des surfaces de réponse ---------- */

  // Premier sélecteur qui donne quelque chose (même règle que getComposer).
  function queryAll(selectors) {
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length) return [...nodes];
    }
    return [];
  }

  function assistantCount() {
    return queryAll(assistantSelectors).length;
  }

  function lastAssistantNode() {
    const nodes = queryAll(assistantSelectors);
    return nodes[nodes.length - 1] || null;
  }

  // Texte de la dernière réponse, pour être COMPTÉ puis oublié : il n'est ni
  // stocké, ni transmis, ni conservé au-delà de l'appelant immédiat.
  // On vise le sous-nœud de prose : le conteneur de tour inclut les libellés
  // des boutons (Copier, Régénérer) et les puces de citation, qui gonfleraient
  // le décompte sans rapport avec la réponse.
  function readResponseText(preferred) {
    const turn = preferred && preferred.isConnected ? preferred : lastAssistantNode();
    if (!turn) return null;
    for (const sel of assistantTextSelectors) {
      const parts = turn.querySelectorAll(sel);
      if (parts.length) return [...parts].map((p) => p.innerText || "").join("\n").trim();
    }
    return (turn.innerText || "").trim();
  }

  // Le libellé brut n'existe que dans cette fonction : il est normalisé à la
  // source et n'est jamais retourné. Un GPT personnalisé porte le nom que son
  // auteur lui a donné — le laisser franchir cette frontière réintroduirait du
  // contenu utilisateur dans un champ censé être en liste blanche.
  function readModelId() {
    if (typeof CoachModels === "undefined") return null;
    const nodes = queryAll(modelSelectors);
    const el = nodes[nodes.length - 1];
    if (!el) return null;
    const raw =
      el.getAttribute("data-message-model-slug") ||
      el.getAttribute("data-model") ||
      el.getAttribute("title") ||
      el.getAttribute("aria-label") ||
      el.innerText ||
      "";
    return CoachModels.normalize(site, raw);
  }

  /* ---------- Fin de réponse IA : un veilleur, plusieurs consommateurs ---------- */

  let responseWatch = null;
  const responseListeners = [];

  // Abonnement PERSISTANT, enregistré une fois au démarrage. Le veilleur reste
  // unique (un seul MutationObserver, invariant historique) ; ce sont ses
  // consommateurs qui sont multiples : les mesures, toujours actives, et le
  // miroir d'après, optionnel. La porte de fonctionnalité vit donc chez le
  // consommateur, plus sur l'armement.
  function onResponse(listener) {
    responseListeners.push(listener);
  }

  function emit(phase, ctx) {
    for (const l of responseListeners) {
      if (typeof l[phase] !== "function") continue;
      // Un consommateur qui casse ne doit pas emporter les autres.
      try {
        l[phase](ctx);
      } catch (err) {
        console.debug("[coach-ia]", phase, err);
      }
    }
  }

  // Détection générique de fin de réponse : après un envoi, le document mute
  // en continu pendant le streaming ; une phase d'activité soutenue suivie
  // d'un long silence signifie que la réponse est complète. L'heuristique de
  // FIN reste sans sélecteur (robuste aux refontes d'UI) ; seules les MESURES
  // sont bornées au nœud de réponse. Les seuils écartent le faux positif du
  // simple affichage du message envoyé suivi du temps de réflexion du modèle.
  function armResponseWatch(meta = {}, opts = {}) {
    const { quietMs = 3000, minActivity = 12, minElapsedMs = 4000, maxWaitMs = 120000 } = opts;
    cancelResponseWatch();

    const ctx = {
      eventId: meta.eventId || null,
      sentAt: meta.sentAt || Date.now(),
      // Rang du tour, lu AVANT que la réponse n'arrive.
      turnIndex: assistantSelectors.length ? assistantCount() : null,
      firstTokenAt: null,
      lastActivityAt: null,
      // Un onglet passé en arrière-plan gèle le rendu : les durées deviennent
      // fausses de façon indétectable. On mémorise le fait pour les jeter.
      hidden: document.visibilityState === "hidden",
      reason: null,
      chars: null,
      words: null,
      model: null,
    };

    let activity = 0;
    let quietTimer = null;
    let cachedAssistant = null;
    let done = false;

    const isOurs = (node) => {
      for (let n = node; n; n = n.parentNode) {
        if (n.id && String(n.id).startsWith("coach-ia")) return true;
      }
      return false;
    };

    // Une mutation est « à nous » seulement si TOUS ses nœuds le sont : quand
    // on insère notre propre toast dans document.body, la cible EST body, donc
    // tester m.target seul ferait compter nos surfaces comme activité de page.
    const ours = (m) => [m.target, ...m.addedNodes, ...m.removedNodes].every(isOurs);

    // Appelé sur chaque mutation, et le streaming en produit des milliers :
    // le nœud de réponse est mis en cache, closest() n'est le repli que la
    // première fois et après un remontage.
    const inAssistant = (m) => {
      if (!assistantSelectors.length) return false;
      const n = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!n) return false;
      if (cachedAssistant && cachedAssistant.isConnected && cachedAssistant.contains(n)) return true;
      if (!n.closest) return false;
      for (const sel of assistantSelectors) {
        const hit = n.closest(sel);
        if (hit) {
          cachedAssistant = hit;
          return true;
        }
      }
      return false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") ctx.hidden = true;
    };

    const finish = (reason) => {
      if (done) return;
      done = true;
      ctx.reason = reason;
      const text = readResponseText(cachedAssistant);
      if (text !== null) {
        ctx.chars = text.length;
        ctx.words = typeof CoachScoring !== "undefined" ? CoachScoring.wordCount(text) : null;
      }
      ctx.model = readModelId();
      cancelResponseWatch();
      emit("onComplete", ctx);
    };

    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.filter((m) => !ours(m));
      if (!relevant.length) return;
      const now = Date.now();

      if (relevant.some(inAssistant)) {
        // Premier signe VISIBLE dans le nœud de réponse. Le squelette vide
        // inséré avant le streaming ne compte pas : on exige du texte.
        // textContent et non innerText : pas de reflow forcé, et on ne cherche
        // ici qu'à savoir si quelque chose est apparu.
        if (ctx.firstTokenAt === null) {
          const node = cachedAssistant && cachedAssistant.isConnected ? cachedAssistant : lastAssistantNode();
          if (node && (node.textContent || "").trim()) {
            ctx.firstTokenAt = now;
            emit("onFirstToken", ctx);
          }
        }
        // Dernière activité RÉELLE : c'est elle qui borne la durée, et non
        // l'instant de onComplete, qui arrive quietMs plus tard.
        if (ctx.firstTokenAt !== null) ctx.lastActivityAt = now;
      }

      activity++;
      if (activity < minActivity) return;
      clearTimeout(quietTimer);
      // minElapsedMs REPORTE la conclusion, il ne l'empêche pas. Le tester ici
      // pour sortir sans rien programmer condamnait les réponses courtes : une
      // réponse terminée avant le seuil ne recevait plus aucune mutation, donc
      // plus jamais de minuteur, et finissait en « timeout » 120 s plus tard
      // alors qu'elle était complète.
      const wait = Math.max(quietMs, minElapsedMs - (now - ctx.sentAt));
      quietTimer = setTimeout(() => finish("complete"), wait);
    });

    // Échéance dure : elle produit désormais un VERDICT ("timeout") au lieu de
    // s'éteindre en silence, pour que la ligne retenue côté sync soit libérée.
    const deadline = setTimeout(() => finish("timeout"), maxWaitMs);

    responseWatch = {
      observer,
      clear() {
        clearTimeout(quietTimer);
        clearTimeout(deadline);
        document.removeEventListener("visibilitychange", onVisibility);
      },
    };
    document.addEventListener("visibilitychange", onVisibility);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    emit("onStart", ctx);
  }

  function cancelResponseWatch() {
    if (!responseWatch) return;
    responseWatch.observer.disconnect();
    responseWatch.clear();
    responseWatch = null;
  }

  // Sonde étendue. healthy() reste booléen (le popup en dépend) : le composeur
  // est VITAL, sans lui l'extension est morte. Les sélecteurs de mesure sont
  // accessoires — sans eux les métriques sont nulles et le coaching continue.
  // Deux niveaux d'alerte, pas un. null = « pas de sélecteur déclaré ».
  function probe() {
    return {
      composer: Boolean(getComposer()),
      assistant: assistantSelectors.length ? assistantCount() > 0 : null,
      model: modelSelectors.length ? Boolean(readModelId()) : null,
    };
  }

  return {
    init,
    healthy,
    probe,
    setComposerText,
    send,
    submitText,
    readComposerText,
    onResponse,
    armResponseWatch,
    cancelResponseWatch,
    conversationKey,
    isNewConversation,
    site,
  };
}
