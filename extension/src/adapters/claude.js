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
});
