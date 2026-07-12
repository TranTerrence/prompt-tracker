// Adaptateur ChatGPT : uniquement les sélecteurs propres au site.
// Quand OpenAI change son UI, seul ce fichier est à mettre à jour.

const CoachAdapter = createCoachAdapter({
  site: "chatgpt",
  composerSelectors: [
    "#prompt-textarea",
    "div[contenteditable='true'].ProseMirror",
    "textarea[data-testid='prompt-textarea']",
  ],
  sendButtonSelectors: [
    "button[data-testid='send-button']",
    "button[aria-label*='envoyer' i]",
    "button[aria-label*='send' i]",
  ],
});
