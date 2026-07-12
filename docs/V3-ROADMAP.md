# Prompt Tracker V3 : feuille de route fondée sur la recherche

Document de conception. Chaque choix est relié à ses sources (papiers académiques, docs officielles, données produit). Rédigé en juillet 2026.

## 1. Pourquoi ce produit est le bon combat

La recherche récente documente précisément le problème que Prompt Tracker attaque, et valide son mécanisme (sources détaillées dans [RESEARCH.md](RESEARCH.md)) :

- **Le dommage est réel et mesuré.** L'accès brut à GPT-4 améliore la performance immédiate mais la dégrade de 17 % une fois l'IA retirée (Bastani et al., PNAS, RCT sur ~1 000 lycéens). Chez les knowledge workers, plus la confiance dans l'IA est haute, moins la pensée critique s'exerce (Lee et al., CHI 2025). L'EEG montre une moindre connectivité neuronale et une non-appropriation de ses propres textes chez les utilisateurs LLM-first (Kosmyna et al., MIT).
- **Le remède est identifié.** Chez Bastani, un tuteur bridé qui donne des indices au lieu des réponses annule presque entièrement le dommage. L'ordre « réfléchir d'abord, IA ensuite » préserve l'engagement neuronal. C'est exactement ce que fait notre dialogue.
- **Le mécanisme de friction est validé ailleurs.** L'interception réfléchie de one sec fait renoncer dans 36 % des cas et les tentatives baissent de 37 % en 6 semaines : la friction s'internalise (Grüning et al., PNAS 2023). Détail contre-intuitif : c'est l'option de renoncer qui porte l'effet ; un simple message de délibération est inefficace. Notre « envoyer quand même » n'est pas une faiblesse commerciale, c'est le principe actif.

## 2. Moteur de questions sans IA (le socle, toujours présent)

La science dit qu'une banque statique bien conçue suffit : King (1990, 1994) a obtenu ses effets avec des amorces imprimées sur papier, et c'est la profondeur des questions qui prédit l'apprentissage, pas leur sophistication technique (Graesser et Person 1994). Le moteur V3 reste rule-based et 100 % local :

1. **Matrice à trois dimensions** : type de tâche détecté (rédaction, code, recherche factuelle, analyse, décision) x niveau apparent (richesse du prompt, historique local de scores) x axe socratique (nos 6 axes, calqués sur les 6 familles de Paul et Elder).
2. **Amorces instanciées** : les questions cessent d'être entièrement génériques ; les gabarits de King sont remplis avec les mots du prompt (« Que sais-tu déjà sur [les dérivées] ? » plutôt que « sur ce sujet »). Extraction par règles : mots pleins les plus longs du prompt, pas d'IA nécessaire.
3. **Échelle de profondeur contingente** (anti expertise reversal, Kalyuga 2003) : prompts pauvres → questions de clarification et de contexte (bas de Bloom) ; prompts déjà riches ou utilisateur à bon historique → hypothèses, implications, contre-arguments. Jamais de « pourquoi » ouvert pour un novice sur un sujet inconnu (Dunlosky 2013 : il générerait des explications fausses).
4. **Fading** : la friction décroît avec la compétence démontrée. Le seuil d'interception s'ajuste à l'historique local (série de premiers jets au-dessus du seuil → seuil qui monte, dialogues plus courts). L'objectif affiché du produit est de se rendre inutile.
5. **Profil d'usage déclaré à l'onboarding** (étudiant, consultant, salarié) : il ne change pas la mécanique, il change le vocabulaire des questions et les exemples (« ton devoir » vs « ton livrable client »).

## 3. IA locale d'abord, cloud ensuite : l'architecture retenue

Ordre de priorité pour générer une question sur mesure :

1. **Gemini Nano on-device (Chrome, gratuit, privé).** La Prompt API est stable pour les extensions depuis Chrome 138. Contraintes matérielles : 22 Go de disque libre, GPU de plus de 4 Go de VRAM ou 16 Go de RAM ; environ 40 à 50 % des machines desktop sont éligibles ; latence médiane observée autour de 7,7 s. Verdict : viable pour UNE question courte contrainte par JSON Schema (`responseConstraint`), à appeler depuis le service worker ou le popup, jamais bloquant : la modale s'ouvre toujours avec la banque locale et la question Nano remplace la question affichée si elle arrive à temps. Détection par `LanguageModel.availability()`. Références : https://developer.chrome.com/docs/extensions/ai/prompt-api et https://developer.chrome.com/docs/ai/prompt-api
2. **Crédits gérés (Edge Function + Claude Haiku).** Pour les abonnés et les organisations. Coût réel mesurable : environ 0,0012 à 0,0018 dollar par question (500 à 800 tokens d'entrée, 100 à 200 de sortie, tarif Haiku 1 $/M input et 5 $/M output), soit 1 000 questions pour environ 1,50 dollar. Un quota de 400 questions par mois coûte au pire 0,60 euro de COGS.
3. **BYOK (clé personnelle de l'utilisateur).** Option power user dans les réglages avancés : clé stockée dans `chrome.storage.local` (jamais `storage.sync`), appels uniquement depuis le service worker, bouton « tester la clé », recommandation d'une clé à budget plafonné. Règle absolue tirée du contre-exemple Cursor : le BYOK débloque 100 % des fonctionnalités IA, aucun bridage.
4. **Org-BYOK (B2B).** La clé API de l'organisation est stockée en secret Supabase et utilisée par l'Edge Function : la clé ne touche jamais le navigateur, le coût IA est transparent pour le client, la marge n'est jamais menacée, et c'est un argument de souveraineté pour les écoles.

Edge (Phi-4-mini) et Firefox (wllama) restent expérimentaux en 2026 : re-tester en 2027, ne rien construire dessus.

## 4. Pricing : trois paliers, simple

| Palier | Prix | Contenu | COGS derrière |
|---|---|---|---|
| Free | 0 € | Interception + dialogue socratique local, stats, thèmes, Gemini Nano si matériel compatible | ~0 € |
| Pro | 4 €/mois ou 35 €/an | 400 questions IA gérées/mois (Haiku), streaks et historique avancés, BYOK illimité | moins de 0,60 €/mois, marge supérieure à 80 % |
| Org | 3 €/siège/mois (éducation), 6 €/siège/mois (entreprise), annuel, minimum ~300 €/an | White-label complet, dashboard, quotas par siège (100 q./mois), org-BYOK, export reporting | ~0,15 $/siège/mois en géré, ~0 en org-BYOK |

Ancrages concurrentiels : one sec à 3,99 $/mois et Khanmigo à 4 $/mois pour le grand public ; Grammarly Business à 12-15 $/siège et Island à ~5 $/siège pour le B2B. Prompt Tracker se place volontairement sous Grammarly et au niveau des apps de bien-être numérique. Plan financier B2C à dimensionner sur 1 % de conversion des actifs (benchmark réaliste des extensions navigateur, pas les 2 à 5 % souvent cités).

Positionnement face à la concurrence : aucun équivalent identifié qui fasse « interception + coaching socratique local ». Les optimiseurs de prompts (AIPRM, PromptPerfect) font le travail à la place de l'utilisateur, l'opposé pédagogique. Face aux outils de surveillance (LayerX, Island), l'angle est inverse : former plutôt que fliquer. Donnée utile pour la vente aux organismes de formation : les organisations qui investissent 4 à 6 h de formation voient plus de 60 % d'adoption d'un outil, contre 15 % après une démo de 30 minutes ; Prompt Tracker se vend comme l'outil d'ancrage post-formation.

## 5. Multi-navigateurs : ordre de portage

1. **Edge, immédiatement** : même code Chromium, soumission du zip Chrome au Partner Center, quelques jours de review. Cible entreprise naturelle (navigateur imposé par beaucoup de DSI).
2. **Firefox, ensuite (1 à 3 jours)** : double clé `background` (service_worker + scripts), `browser_specific_settings.gecko.id`, host_permissions à demander à l'exécution (différence majeure : Firefox ne les accorde pas à l'installation), publication AMO sous 24 h. Public éducation et privacy réceptif au discours local-first.
3. **Safari, sur signal de demande seulement** : compte Apple Developer à 99 $/an, wrapper app, review App Store ; le flux 2025 « upload ZIP sans Xcode » abaisse le ticket d'entrée si la demande iPad en éducation se matérialise.

## 6. Le moteur pédagogique V3 : les nouveautés fondées sur la littérature

Les 12 implications de design et les sources complètes sont dans [RESEARCH.md](RESEARCH.md). Traduction en fonctionnalités :

### 6a. Le miroir d'après (le plus gros levier, nouveau)
La littérature converge : l'overreliance se joue APRÈS la réponse de l'IA (Lee 2025 ; Chi 1994 ; Gajos 2022 ; Wineburg 2019). L'extension observe l'arrivée de la réponse et propose, en toast non bloquant et au maximum une fois par conversation :
- **Explain-back** : « Reformule la réponse en une phrase, avec tes mots. » (auto-explication, le mécanisme le plus solide du champ)
- **Lecture latérale** : « Quel point vérifieras-tu ailleurs avant de réutiliser ça ? »
- **Désaccord** : « Sur quoi n'es-tu pas totalement d'accord avec cette réponse ? »
La réponse de l'utilisateur alimente sa progression (rubrique esprit critique). Jamais bloquant, jamais plus d'une sollicitation par conversation (P10, microboundaries).

### 6b. Écris ta tentative d'abord (renforcement de l'existant)
Le pattern « update » de Buçinca (décider avant de voir l'IA) est la friction au meilleur ratio efficacité/acceptabilité. Quand le prompt est une délégation totale, la première question du dialogue devient systématiquement une demande de tentative (« Si tu devais répondre toi-même, tu dirais quoi ? ») et la réponse est mise en tête du prompt compilé.

### 6c. Habitude et progression (nouveau)
- **Implementation intention à l'onboarding** (Gollwitzer, d = 0.65) : l'utilisateur formule son plan « Si mon prompt est vague, alors je précise intention et contexte avant d'envoyer », affiché tel quel dans la modale les premières semaines.
- **Streak de premiers jets réussis** (mécanique Duolingo, métrique honnête) : la série compte les jours où le PREMIER jet dépasse le seuil, pas les prompts améliorés après coaching. On célèbre l'autonomie, pas la dépendance au produit.
- **Horizon** : ne pas juger la rétention avant 8 à 10 semaines (automaticité médiane à 66 jours, Lally 2010).

### 6d. La North Star honnête (dashboard)
Mesurer l'apprentissage, pas la performance assistée (Bastani ; Bjork) : la courbe qui compte est **le score moyen des premiers jets** (score_before) semaine après semaine. Le champ existe déjà en base ; le dashboard doit l'afficher comme métrique principale, au-dessus du score après amélioration. Un client white-label achète cette courbe-là.

### 6e. Garde-fous de conception (les 3 erreurs à ne jamais commettre)
1. Friction uniforme → fading obligatoire (section 2).
2. Blocage ou moralisation → « envoyer quand même » inamovible, ton des questions strictement non culpabilisant.
3. Optimiser la satisfaction court terme → les A/B tests se jugent sur la courbe des premiers jets à 8 semaines, pas sur la rétention à 7 jours.

## 7. Découpage en jalons

### V3.0 : le cœur pédagogique (~2 semaines)
- Miroir d'après (6a) : détection de fin de réponse dans les 3 adaptateurs + toast explain-back / lecture latérale / désaccord, 1 fois max par conversation.
- Amorces instanciées + échelle de profondeur contingente + « tentative d'abord » (2, 6b).
- Fading du seuil + streak de premiers jets (6c) dans le popup.
- Profil d'usage à l'onboarding (étudiant, consultant, salarié).
- Dashboard : courbe des premiers jets en métrique principale (6d).

### V3.1 : IA locale et portée (~1 semaine)
- Gemini Nano via la Prompt API (Chrome 138+) : question sur mesure on-device, JSON Schema contraint, fallback banque locale. Zéro coût, zéro donnée sortante.
- Portage Edge (soumission du zip existant) puis Firefox (double clé background, gecko.id, host_permissions à l'exécution).

### V3.2 : monétisation (~2 semaines)
- Plans Free / Pro (4 €/mois, 400 questions gérées, BYOK illimité) / Org (3 ou 6 €/siège/mois, org-BYOK côté Supabase). Stripe + quotas dans l'Edge Function.
- BYOK utilisateur : stockage storage.local, appels depuis le service worker uniquement, bouton « tester la clé ».

### V3.3 : préparer la preuve (continu)
- Export anonymisé de la courbe des premiers jets pour les orgs (argument de renouvellement).
- À terme : protocole d'étude terrain avec un organisme de formation partenaire (pré/post à 8 semaines), sur le modèle de l'étude one sec.
