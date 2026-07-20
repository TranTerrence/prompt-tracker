// Adaptateur Mistral (Le Chat) : uniquement les sélecteurs propres au site.
// Sondé le 13/07/2026 : composeur ProseMirror (contenteditable), un seul
// bouton type=submit (sans aria-label) dans le formulaire d'envoi.
// Conversations : chat.mistral.ai/chat/<id> ; racines : / et /chat.

const CoachAdapter = createCoachAdapter({
  site: "mistral",
  composerSelectors: [
    "div[contenteditable='true'].ProseMirror",
    "div[contenteditable='true']",
    "textarea",
  ],
  sendButtonSelectors: [
    "button[type='submit'][aria-label*='envoyer' i]",
    "button[type='submit'][aria-label*='send' i]",
    "button[type='submit']",
  ],
  rootPaths: ["/", "/chat"],
});
