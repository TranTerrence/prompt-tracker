// Adaptateur Grok (grok.com) : uniquement les sélecteurs propres au site.
// Sondé le 13/07/2026 : composeur = textarea (aria-label localisé « Poser
// une question à Grok » / placeholder « Demander à Grok »), bouton
// type=submit avec aria-label localisé (« Envoyer »/« Send »/« Submit »).
// Attention aux boutons submit du bandeau cookies : jamais de fallback large.
// Conversations : grok.com/c/<id> ou /chat/<id> ; racines : / et /chat.

const CoachAdapter = createCoachAdapter({
  site: "grok",
  composerSelectors: [
    "textarea[aria-label*='grok' i]",
    "main textarea",
    "textarea",
  ],
  sendButtonSelectors: [
    "button[type='submit'][aria-label*='envoyer' i]",
    "button[type='submit'][aria-label*='send' i]",
    "button[type='submit'][aria-label*='submit' i]",
  ],
  rootPaths: ["/", "/chat"],
  // Mesures post-réponse : NON SONDÉES. Tableaux vides à dessein — un mauvais
  // sélecteur produirait des nombres plausibles mais faux, que personne ne
  // remarquerait (contrairement à un composeur cassé, qui se voit tout de
  // suite). Sonder la page, puis remplir ; d'ici là les mesures sont nulles.
  assistantSelectors: [],
  assistantTextSelectors: [],
  modelSelectors: [],
});
