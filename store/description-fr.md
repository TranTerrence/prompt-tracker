# Prompt Tracker : fiche Chrome Web Store (FR)

## Résumé (132 caractères max)
Une pause réfléchie avant tes prompts IA : dialogue socratique local sur ChatGPT, Claude, Gemini, Mistral et Grok.

## Description
Comme les applications qui t'aident à décrocher de ton téléphone, **Prompt Tracker** ajoute un peu de friction, et beaucoup de réflexion, avant tes prompts IA.

🪞 **Le miroir socratique**
Quand ta demande est trop vague (« fais mes devoirs »), l'envoi est retenu AVANT d'atteindre l'IA. Un dialogue s'ouvre, une question à la fois : qu'as-tu déjà tenté ? quelle est ton hypothèse ? comment vérifieras-tu ? Tu itères aussi longtemps que tu veux, puis c'est TOUJOURS toi qui décides : envoyer ta version enrichie de ta réflexion, ou ta demande initiale telle quelle.

🪞 **Le miroir d'après**
Une fois la réponse de l'IA reçue, une invitation discrète (jamais bloquante, une fois par conversation au maximum) : reformule l'essentiel avec tes mots, choisis ce que tu vérifieras ailleurs. C'est là que l'esprit critique se construit.

📈 **Ta progression, mesurée honnêtement**
Chaque prompt est scoré localement, ventilation affichée en direct (clarté, contexte, esprit critique). La métrique qui compte : tes PREMIERS JETS, ce que tu écris seul avant tout coaching. Série de jours réussis, seuil qui monte avec tes progrès, export CSV en un clic. Et le coach connaît sa place : il intervient à l'ouverture d'un sujet, puis te laisse dérouler ta conversation (« Laisse-moi sur ce fil » est toujours à un clic).

🔒 **Données et confidentialité**
Rien n'est enregistré tant que tu n'as pas accepté l'écran de divulgation affiché au premier lancement : l'extension reste inactive avant ton accord explicite.
• **En local, après ton accord** : scores de qualité, catégorie, nombre de mots, site, date, issue (envoyé, amélioré, annulé), tes réponses au dialogue et tes réflexions d'après-réponse. Le texte complet de tes prompts n'est enregistré que si tu actives l'option dédiée. Tout reste sur ton ordinateur : pas de compte requis.
• **Si tu rejoins une classe** (code fourni par ton école ou ton entreprise) : un second écran te dit exactement ce qui sera partagé (les indicateurs ci-dessus, jamais aucun texte) et tu confirmes d'un bouton. Ton email de compte t'identifie auprès de l'enseignant.
• **Les contenus** (texte des prompts, dialogues, réflexions, fils de conversation) ne sont partagés que si ton organisation les demande avec un motif ET que tu consens, catégorie par catégorie. Interrupteurs désactivés par défaut, révocables à tout moment ; le serveur efface tout contenu non consenti dès réception.
• **Questions IA sur mesure (option)** : si ton organisation l'active et que tu as consenti au partage de ton texte et de ton raisonnement, ton prompt transite par Anthropic pour générer la question suivante, sans être stocké.
• **Conservation** : contenus effacés au bout de 90 jours, indicateurs supprimés au bout de 12 mois. Effacement et export possibles à tout moment. Aucune vente, aucune publicité, aucun entraînement d'IA.
Politique complète : https://track-prompt.vercel.app/privacy

Pour qui ?
• Étudiants : apprendre AVEC l'IA sans qu'elle pense à ta place
• Consultants : des prompts qui montrent ton raisonnement
• Entreprises : bonnes pratiques, esprit critique et alternative au shadow IT

Fonctionne sur ChatGPT, Claude, Gemini, Mistral (Le Chat) et Grok, avec Chrome et les navigateurs Chromium sur ordinateur. Pas de version iPhone/iPad ou Android à ce stade (les navigateurs mobiles n'acceptent pas les extensions).

## Single purpose (déclaration Google)
Prompt Tracker analyse localement la qualité des prompts saisis sur les sites d'IA (ChatGPT, Claude, Gemini, Mistral, Grok), propose un dialogue de réflexion optionnel avant l'envoi et mesure la progression de l'utilisateur.

## Justification des permissions
- `storage` : conserver localement les réglages (thème, seuil, profil), l'accord de divulgation et les indicateurs de prompts (scores, catégories), uniquement après acceptation de l'écran de divulgation.
- `alarms` : synchronisation périodique des indicateurs pour les utilisateurs ayant rejoint un espace organisation (optionnel) ; les alarmes ne s'arment qu'après l'accord de divulgation.
- Hôte `https://chatgpt.com/*` : lire le champ de saisie pour le scoring local avant envoi et afficher le dialogue de réflexion sur ChatGPT.
- Hôte `https://chat.openai.com/*` : domaine historique de ChatGPT, même usage.
- Hôte `https://claude.ai/*` : même usage sur Claude.
- Hôte `https://gemini.google.com/*` : même usage sur Gemini.
- Hôte `https://chat.mistral.ai/*` : même usage sur Mistral (Le Chat).
- Hôte `https://grok.com/*` : même usage sur Grok.
Le contenu du champ de saisie est analysé localement, avant envoi ; il n'est transmis à aucun serveur sans les consentements décrits ci-dessus.

## Onglet « Pratiques de confidentialité » (Console développeur) : checklist
Types de données à déclarer :
- [x] **Informations permettant d'identifier personnellement** : adresse email (création de compte optionnelle).
- [x] **Informations d'authentification** : mot de passe (authentification du compte optionnel).
- [x] **Activité de l'utilisateur** : indicateurs d'interaction avec les sites d'IA (scores de qualité, catégories, nombres de mots, issues, horodatages).
- [x] **Contenu de sites web** : texte des prompts, dialogues socratiques, réflexions, collectés uniquement avec le consentement opt-in, catégorie par catégorie (à déclarer malgré tout).

Certifications à cocher :
- [x] Les données ne sont ni vendues ni transférées à des tiers en dehors des cas d'utilisation approuvés.
- [x] Les données ne sont ni utilisées ni transférées à des fins sans rapport avec la finalité unique de l'élément.
- [x] Les données ne sont ni utilisées ni transférées pour déterminer la solvabilité ou à des fins de prêt.

URL de la politique de confidentialité : https://track-prompt.vercel.app/privacy

## Note au reviewer (champ « notes » de la soumission)
Cette version met en place une divulgation bien visible à deux niveaux, conformément à la politique User Data Privacy :
1. **Au premier lancement** (capture d'écran 1) : un écran de divulgation détaille les données enregistrées, leur finalité, leur destination et leur conservation, avec un lien vers la politique de confidentialité. L'extension reste totalement inactive (aucune collecte, même locale) jusqu'au clic sur « J'accepte et j'active Prompt Tracker ».
2. **Au moment de rejoindre une organisation** (capture d'écran 6) : un second écran énumère les indicateurs qui seront partagés et exige un accord explicite (« Rejoindre et partager ces indicateurs »). Les contenus (texte, dialogues, réflexions) restent soumis à un consentement séparé, catégorie par catégorie, désactivé par défaut, avec application côté serveur (tout contenu non consenti est effacé à la réception).
Conservation : contenus 90 jours, indicateurs 12 mois (purge automatique côté serveur). L'utilisateur peut effacer et exporter ses données à tout moment.

## Privacy policy
https://track-prompt.vercel.app/privacy
