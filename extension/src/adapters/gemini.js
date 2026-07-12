// Adaptateur Gemini : uniquement les sélecteurs propres au site.
// Quand Google change son UI, seul ce fichier est à mettre à jour.
// Gemini utilise un éditeur Quill (div.ql-editor contenteditable) : la
// mécanique d'injection/vérification de la factory s'applique telle quelle.

const CoachAdapter = createCoachAdapter({
  site: "gemini",
  composerSelectors: [
    "div.ql-editor[contenteditable='true']",
    "rich-textarea div[contenteditable='true']",
    "div[aria-label*='prompt' i][contenteditable='true']",
  ],
  sendButtonSelectors: [
    "button[aria-label*='send message' i]",
    "button[aria-label*='envoyer' i]",
    "button[aria-label*='send' i]",
    "button.send-button",
  ],
});
