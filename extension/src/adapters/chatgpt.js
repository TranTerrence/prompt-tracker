// Adaptateur ChatGPT : uniquement les sélecteurs propres au site.
// Quand OpenAI change son UI, seul ce fichier est à mettre à jour.

const CoachAdapter = createCoachAdapter({
  site: "chatgpt",
  composerSelectors: [
    "#prompt-textarea",
    "div[contenteditable='true'].ProseMirror",
    "textarea[data-testid='prompt-textarea']",
    // Coquille servie aux visiteurs NON connectés (constaté le 16/09/2026) :
    // un <textarea> nu, sans ProseMirror ni data-testid. Sans lui, l'extension
    // se croit cassée (badge ⚠) et laisse tout passer sur cette page.
    "textarea#mobile-composer-prompt",
  ],
  sendButtonSelectors: [
    "button[data-testid='send-button']",
    "button[aria-label*='envoyer' i]",
    "button[aria-label*='send' i]",
  ],
  rootPaths: ["/"],
  // Mesures post-réponse. data-message-author-role est stable de longue date.
  assistantSelectors: [
    "[data-message-author-role='assistant']",
    "article[data-testid^='conversation-turn']",
  ],
  assistantTextSelectors: [".markdown", ".prose"],
  // data-message-model-slug porté par le message lui-même est la VÉRITÉ PAR
  // TOUR : il ne bouge pas si l'utilisateur change de modèle après coup, alors
  // que le sélecteur du bandeau, lui, ne dit que l'état courant.
  modelSelectors: [
    "[data-message-author-role='assistant'][data-message-model-slug]",
    "[data-testid='model-switcher-dropdown-button']",
  ],
});
