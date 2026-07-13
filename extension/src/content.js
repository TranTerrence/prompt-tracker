// Orchestrateur : score chaque prompt AVANT l'envoi. Sous le seuil, l'envoi est
// retenu (aucun crédit consommé) et la modale socratique s'affiche ; l'utilisateur
// choisit « améliorer » ou « envoyer quand même » : les deux choix sont tracés.
// Au-dessus du seuil, le prompt part normalement, sans latence ajoutée.

(() => {
  const DEFAULT_SETTINGS = { captureMode: "metadata", interceptEnabled: true, threshold: 40, theme: "light", postMirrorEnabled: true, profile: null };
  let settings = { ...DEFAULT_SETTINGS };
  // Config de l'organisation (branding, templates, seuil...) synchronisée par le
  // popup après login (étape 3). Prioritaire sur les réglages locaux.
  let orgConfig = null;
  let recentPromptTexts = []; // 3 derniers textes, en mémoire seulement
  let pendingToastEventId = null;
  // Fading : seuil effectif relevé par les séries de premiers jets réussis,
  // recalculé à chaque événement. La friction suit la compétence démontrée.
  let effectiveThreshold = null;
  // Dernier prompt parti (pour choisir la question du miroir d'après).
  let lastPrompt = null;

  let adapterHealthy = null;

  // Repère visible dans l'UI du chat : l'extension est active (couleurs de l'org).
  function refreshBadge() {
    CoachBadge.render({
      branding: orgConfig && orgConfig.branding,
      healthy: adapterHealthy,
      threshold: currentThreshold(),
      interceptEnabled: effective("interceptEnabled"),
    });
  }

  function currentThreshold() {
    return effectiveThreshold !== null ? effectiveThreshold : effective("threshold");
  }

  function recomputeThreshold(events) {
    effectiveThreshold = CoachScoring.adaptiveThreshold(events || [], effective("threshold"));
  }

  // Consentements de l'utilisateur (catégorie → bool), gérés par consent.html.
  let consents = {};

  chrome.storage.local.get(["settings", "orgConfig", "consents", "events"], (data) => {
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    orgConfig = data.orgConfig || null;
    consents = data.consents || {};
    recomputeThreshold(data.events);
    CoachTheme.set(settings.theme);
    refreshBadge();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    if (changes.orgConfig) orgConfig = changes.orgConfig.newValue || null;
    if (changes.consents) consents = changes.consents.newValue || {};
    if (changes.settings || changes.orgConfig) {
      chrome.storage.local.get("events", (data) => recomputeThreshold(data.events));
      CoachTheme.set(settings.theme);
      refreshBadge();
    }
  });

  function effective(key) {
    if (orgConfig && orgConfig[key] !== undefined && orgConfig[key] !== null) return orgConfig[key];
    return settings[key];
  }

  // La catégorie est demandée par l'org ET consentie par l'utilisateur.
  function consented(cat) {
    const req = orgConfig && orgConfig.dataRequests && orgConfig.dataRequests[cat];
    return Boolean(req && req.requested && consents[cat]);
  }

  function appendEvent(event, callback) {
    chrome.storage.local.get("events", (data) => {
      const events = data.events || [];
      events.push(event);
      if (events.length > 5000) events.splice(0, events.length - 5000);
      recomputeThreshold(events);
      refreshBadge();
      chrome.storage.local.set({ events }, callback);
    });
  }

  /* ---------- Miroir d'après ---------- */

  // Trace de la réflexion post-réponse, dans un magasin séparé (les events de
  // prompts gardent leur schéma) : indicateurs seuls, texte si captureMode full.
  function appendPostEvent(postKey, answer, answered) {
    const event = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      ts: new Date().toISOString(),
      site: CoachAdapter.site,
      conv: CoachAdapter.conversationKey(),
      postKey,
      category: (lastPrompt && lastPrompt.category) || "autre",
      answered,
      answerWords: CoachScoring.wordCount(answer || ""),
      // Texte gardé en local (c'est la réflexion de l'utilisateur, chez lui) ;
      // il ne part en sync que si post_reflection est demandé ET consenti.
      answer: answer || null,
      synced: false,
    };
    chrome.storage.local.get("postEvents", (data) => {
      const postEvents = data.postEvents || [];
      postEvents.push(event);
      if (postEvents.length > 1000) postEvents.splice(0, postEvents.length - 1000);
      chrome.storage.local.set({ postEvents });
    });
  }

  // Arme la détection de fin de réponse après chaque envoi. À la fin de la
  // génération : une question réflexive (explain-back, vérification, désaccord),
  // au maximum UNE par conversation, jamais bloquante (P4, P10).
  function armPostMirror() {
    if (!effective("postMirrorEnabled")) return;
    CoachAdapter.watchResponse({
      onComplete() {
        // La clé se lit à la FIN : une conversation neuve reçoit son id d'URL
        // pendant la génération (chatgpt.com/ devient chatgpt.com/c/<id>).
        const conv = CoachAdapter.conversationKey();
        chrome.storage.local.get(["postConvs", "postCount"], (data) => {
          const convs = data.postConvs || [];
          if (convs.includes(conv)) return;
          const count = data.postCount || 0;
          const q = CoachScoring.postQuestion({
            category: lastPrompt && lastPrompt.category,
            scores: lastPrompt && lastPrompt.scores,
            lang: CoachI18n.lang,
            count,
          });
          chrome.storage.local.set({ postConvs: [...convs.slice(-199), conv], postCount: count + 1 });
          CoachMirror.showPost({
            question: q.question,
            branding: orgConfig && orgConfig.branding,
            onReply: (text) => appendPostEvent(q.key, text, true),
            onSkip: () => appendPostEvent(q.key, "", false),
          });
        });
      },
    });
  }

  function markFeedback(eventId, feedback) {
    chrome.storage.local.get("events", (data) => {
      const events = data.events || [];
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        ev.mirrorFeedback = feedback;
        chrome.storage.local.set({ events });
      }
    });
  }

  CoachMirror.onFeedback = () => pendingToastEventId && markFeedback(pendingToastEventId, "useful");
  CoachMirror.onClose = (reason) => {
    if (pendingToastEventId && reason === "dismissed") markFeedback(pendingToastEventId, "dismissed");
    pendingToastEventId = null;
  };

  function buildEvent(text, scores, extra = {}) {
    const event = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      ts: new Date().toISOString(),
      site: CoachAdapter.site,
      category: CoachScoring.categorize(text),
      words: CoachScoring.wordCount(text),
      scores,
      intercepted: false,
      outcome: null,
      scoreBefore: null,
      scoreAfter: null,
      mirrorShown: false,
      mirrorFeedback: null,
      rounds: 0,
      answersCount: 0,
      // Clé de conversation : locale toujours (c'est la machine de
      // l'utilisateur) ; elle ne part en sync que si consentie.
      conv: CoachAdapter.conversationKey(),
      synced: false,
      ...extra,
    };
    // Texte capturé localement si l'utilisateur le veut (réglage local) ou
    // s'il a consenti à le partager avec son org (il faut bien le capturer
    // pour pouvoir l'envoyer). La sync ne le transmet que si consenti.
    if (effective("captureMode") === "full" || consented("prompt_text")) event.text = text;
    return event;
  }

  function rememberText(text) {
    recentPromptTexts = [...recentPromptTexts.slice(-2), text];
  }

  CoachAdapter.init({
    // Décision synchrone, prise pendant l'événement d'envoi : sous le seuil → retenue.
    shouldIntercept(text) {
      if (!effective("interceptEnabled")) return false;
      return CoachScoring.score(text, recentPromptTexts).total < currentThreshold();
    },

    // Prompt retenu : rien n'est parti vers ChatGPT. Dialogue socratique
    // itératif : une question à la fois, sans fin, jusqu'à ce que l'utilisateur
    // décide lui-même d'envoyer.
    onIntercept(text) {
      const scores = CoachScoring.score(text, recentPromptTexts);
      const templates = (orgConfig && orgConfig.templates) || {};

      // Question suivante : LLM sur mesure si l'org l'active (repli silencieux
      // sur la banque locale : l'itération n'attend jamais le réseau plus de 2 s).
      function ask(dialogueState) {
        const local = () =>
          CoachScoring.nextQuestion(
            { originalPrompt: text, scores, asked: dialogueState.asked, lang: CoachI18n.lang, profile: effective("profile") },
            templates
          );
        if (!effective("llmEnabled")) return Promise.resolve(local());
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "llm-question", prompt: text, dialogue: dialogueState.answers.map((a) => ({ question: a.question, answer: a.answer })) },
            (res) => {
              if (!chrome.runtime.lastError && res && res.question) {
                resolve({ key: `llm-${dialogueState.asked.length}`, axis: "llm", label: "Ma réflexion", question: res.question });
              } else {
                resolve(local());
              }
            }
          );
        });
      }

      CoachMirror.showModal({
        promptText: text,
        scoreBefore: scores.total,
        branding: orgConfig && orgConfig.branding,
        rescore: (t) => CoachScoring.score(t, recentPromptTexts),
        compile: (original, answers) => CoachScoring.compilePrompt(original, answers, CoachI18n.lang),
        ask,
        onSend(finalText, m) {
          rememberText(finalText);
          const after = CoachScoring.score(finalText, recentPromptTexts);
          lastPrompt = { category: CoachScoring.categorize(finalText), scores: after };
          appendEvent(
            buildEvent(finalText, after, {
              intercepted: true,
              outcome: "improved",
              scoreBefore: scores.total,
              scoreAfter: after.total,
              mirrorShown: true,
              rounds: m.rounds,
              answersCount: m.answersCount,
              dialogue: m.answers && m.answers.length ? m.answers : null,
            }),
            () => CoachAdapter.submitText(finalText).then(() => armPostMirror())
          );
        },
        onSendAnyway(m) {
          rememberText(text);
          lastPrompt = { category: CoachScoring.categorize(text), scores };
          appendEvent(
            buildEvent(text, scores, {
              intercepted: true,
              outcome: "sent_anyway",
              scoreBefore: scores.total,
              scoreAfter: scores.total,
              mirrorShown: true,
              rounds: m.rounds,
              answersCount: m.answersCount,
              dialogue: m.answers && m.answers.length ? m.answers : null,
            }),
            () => CoachAdapter.submitText(text).then(() => armPostMirror())
          );
        },
        onCancel(m) {
          // Le prompt reste dans la zone de saisie, rien n'est envoyé.
          appendEvent(
            buildEvent(text, scores, {
              intercepted: true,
              outcome: "cancelled",
              scoreBefore: scores.total,
              mirrorShown: true,
              rounds: m.rounds,
              answersCount: m.answersCount,
            })
          );
        },
      });
    },

    // Prompt parti normalement (au-dessus du seuil ou interception désactivée).
    onSubmit(text) {
      const scores = CoachScoring.score(text, recentPromptTexts);
      chrome.storage.local.get("events", (data) => {
        const suggestion = effective("interceptEnabled")
          ? CoachScoring.socraticSuggestion(
              text,
              scores,
              (data.events || []).filter((e) => e.site === CoachAdapter.site),
              CoachI18n.lang
            )
          : null;
        const event = buildEvent(text, scores, { outcome: "sent", mirrorShown: Boolean(suggestion) });
        rememberText(text);
        lastPrompt = { category: event.category, scores };
        appendEvent(event, () => {
          armPostMirror();
          if (suggestion) {
            pendingToastEventId = event.id;
            CoachMirror.show(suggestion, orgConfig && orgConfig.branding && orgConfig.branding.color);
          }
        });
      });
    },
  });

  // Sonde de santé : si l'adaptateur ne trouve plus le composeur, le popup
  // alerte et le badge passe en avertissement dans l'UI du chat.
  setTimeout(() => {
    adapterHealthy = CoachAdapter.healthy();
    chrome.storage.local.set({ [`health_${CoachAdapter.site}`]: { healthy: adapterHealthy, checkedAt: new Date().toISOString() } });
    refreshBadge();
  }, 5000);
})();
