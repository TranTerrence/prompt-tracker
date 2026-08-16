// Adaptateur Claude.ai : uniquement les sélecteurs propres au site.
// Quand Anthropic change son UI, seul ce fichier est à mettre à jour.
// Claude utilise aussi un composeur ProseMirror (contenteditable) : la
// mécanique d'injection/vérification de la factory s'applique telle quelle.

const CoachAdapter = createCoachAdapter({
  site: "claude",
  composerSelectors: [
    "div[contenteditable='true'].ProseMirror",
    "div[aria-label*='prompt' i][contenteditable='true']",
    "div[contenteditable='true'][translate='no']",
    "fieldset div[contenteditable='true']",
  ],
  sendButtonSelectors: [
    "button[aria-label*='send message' i]",
    "button[aria-label*='envoyer' i]",
    "button[aria-label*='send' i]",
    "button[type='submit']",
  ],
  rootPaths: ["/", "/new", "/chats"],
  // Mesures post-réponse. À VÉRIFIER EN DIRECT : les classes utilitaires
  // Tailwind de Claude changent souvent. Si aucun sélecteur ne correspond, les
  // mesures sont nulles et le reste du coaching est intact.
  assistantSelectors: [
    "[data-testid='assistant-message']",
    "div.font-claude-response",
    "div.font-claude-message",
  ],
  assistantTextSelectors: [".prose", "[class*='prose']"],
  modelSelectors: [
    "[data-testid='model-selector-dropdown']",
    "button[aria-haspopup='menu'][aria-label*='model' i]",
  ],
});
