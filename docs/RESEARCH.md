# Recherche fondatrice de Prompt Tracker

Deux synthèses documentaires réalisées en juillet 2026. Elles fondent la feuille de route [V3-ROADMAP.md](V3-ROADMAP.md).

---

# A. Pédagogie et neurosciences

## A1. Impact cognitif de l'IA générative

- **Bastani et al. 2024/2025, PNAS** (RCT, ~1 000 lycéens) : l'accès à GPT-4 améliore la performance immédiate (+48 %) mais dégrade de 17 % la performance à l'examen sans assistance. L'IA sert de béquille. Point décisif pour nous : un GPT bridé façon tuteur (indices, jamais la réponse) annule presque entièrement le dommage. https://www.pnas.org/doi/10.1073/pnas.2422633122
- **Lee, Sarkar et al. 2025, CHI** (319 knowledge workers, 936 usages réels) : plus la confiance dans l'IA est haute, moins la pensée critique s'exerce ; plus la confiance en soi est haute, plus elle s'exerce. Le travail critique se déplace vers la vérification et l'intégration des sorties IA. https://dl.acm.org/doi/full/10.1145/3706598.3713778
- **Kosmyna et al. 2025, MIT Media Lab** (EEG, 54 participants, préprint) : le groupe LLM montre la plus faible connectivité neuronale et échoue à citer son propre texte ; l'ordre « réfléchir d'abord, IA ensuite » préserve l'engagement (dette cognitive dans l'autre sens). Méthodologie discutée, mais converge avec Bastani. https://arxiv.org/abs/2506.08872
- **Fan et al. 2024, BJET** (RCT, 117 étudiants) : « paresse métacognitive », l'apprenant délègue le monitoring à l'outil ; meilleurs scores immédiats sans gain de connaissance ni de transfert. https://bera-journals.onlinelibrary.wiley.com/doi/abs/10.1111/bjet.13544
- Mécanismes de fond : cognitive offloading (Risko et Gilbert 2016, TiCS), Google effect (Sparrow et al. 2011, Science) : on encode où trouver l'information plutôt que l'information.

## A2. Ce qui rend le questionnement socratique efficace

- **Auto-explication** : le simple fait d'inciter à s'expliquer améliore compréhension profonde et transfert, sans feedback (Chi et al. 1994, Cognitive Science).
- **Interrogation élaborative** : « pourquoi est-ce vrai ? » double presque le rappel (Pressley et al. 1987) ; réserve : exige des connaissances préalables, sinon explications erronées (Dunlosky et al. 2013).
- **Question stems guidés** : des amorces génériques imprimées sur papier (« En quoi X ressemble-t-il à Y ? », « Que se passerait-il si... ? ») battent la discussion libre (King 1990, 1994, AERJ). Validation directe d'une banque statique bien conçue.
- **Qualité avant quantité** : la profondeur des questions (causales, hypothétiques) prédit l'apprentissage, pas leur fréquence (Graesser et Person 1994).
- **ICAP** (Chi et Wylie 2014) : Interactif > Constructif > Actif > Passif. Une question n'est utile que si elle exige une production générative. Notre dialogue itératif est de niveau Interactif.
- **Génération et récupération** : ce qu'on génère soi-même est mieux retenu (Slamecka et Graf 1978) ; se tester bat relire (Roediger et Karpicke 2006) ; les difficultés désirables ralentissent la performance immédiate mais renforcent rétention et transfert, et la fluidité subjective est un mauvais indicateur d'apprentissage (Bjork).
- **Étayage** : contingent au niveau (Wood, Bruner et Ross 1976 ; Vygotsky) ; les 6 familles de Paul et Elder 2006 (clarification, hypothèses, preuves, points de vue, implications, question sur la question) se superposent presque terme à terme à nos 6 axes.

## A3. Friction bénéfique (cognitive forcing functions)

- **Buçinca et al. 2021, CSCW** : trois CFF testées (on demand, update, wait). Elles réduisent l'overreliance mieux que les explications XAI, MAIS les designs les plus efficaces sont les moins aimés, et elles profitent surtout aux hauts « Need for Cognition ». Le pattern « décide d'abord, vois l'IA ensuite » est le meilleur compromis. https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf
- **Gajos et Mamykina 2022, IUI** : apprentissage seulement quand l'IA donne l'explication sans la réponse.
- **Drosos, Sarkar et al. 2025** : de brèves provocations textuelles restaurent la pensée critique ; leur accueil dépend de l'urgence, l'importance, l'expertise, l'actionnabilité, la responsabilité perçue.
- **Positive friction / microboundaries** (Cox et al. 2016 ; Chen et Schmidt 2024) : petites frictions aux transitions naturelles plutôt que blocages.

## A4. Nudges et comportement

- **Grüning et al. 2023, PNAS** (one sec, n = 280, 6 semaines) : l'interception à l'ouverture fait renoncer dans 36 % des cas et les tentatives baissent de 37 % en 6 semaines (internalisation). Décomposition : l'option de renoncer est le mécanisme le plus fort, le délai a un effet réel, le message de délibération seul est inefficace. https://www.pnas.org/doi/10.1073/pnas.2213114120
- EAST (Easy, Attractive, Social, Timely) ; self-determination theory (Deci et Ryan 2000) : un outil vécu comme contrôlant bascule la motivation en régulation externe fragile ; implementation intentions (Gollwitzer et Sheeran 2006, d = 0.65) ; habitudes : automaticité médiane à 66 jours (Lally et al. 2010).

## A5. Adapter sans IA

- Taxonomies exploitables en règles : Bloom révisé (processus x connaissances), échelle de profondeur de Graesser, amorces de King, familles de Paul et Elder, taxonomie récente pour la décision assistée par machine (Fischer et al. 2025, AIES).
- **Expertise reversal effect** (Kalyuga et al. 2003) : l'étayage qui aide les novices nuit aux experts. Corollaire : fading progressif, étayage contingent à la réussite.
- King a obtenu ses effets avec du papier : la personnalisation rule-based (tâche x niveau apparent x axe) est scientifiquement suffisante.

## A6. Quand intervenir (cycle de Zimmerman)

Forethought (avant), performance (pendant), self-reflection (après). Prompt Tracker n'instrumente aujourd'hui que l'avant. Convergence forte pour intervenir aussi APRÈS la réponse IA : c'est là que se joue l'overreliance (Lee 2025), l'auto-explication s'applique naturellement au matériel reçu (Chi 1994), l'apprentissage survient quand l'utilisateur produit la conclusion (Gajos 2022), le jugement de crédibilité s'exerce en lecture latérale (Wineburg et McGrew 2019). Les prompts métacognitifs ne marchent que s'ils sont réellement traités (Bannert et Reimann 2012) : le format dialogue à réponse libre est le bon.

## A7. Les 12 implications de design (priorisées)

P1. Toujours une porte de sortie visible, jamais de blocage (c'est le mécanisme actif, pas une concession).
P2. Réponse générative en texte libre à chaque question, pas de QCM.
P3. Faire écrire la tentative de l'utilisateur AVANT toute aide.
P4. Mode post-réponse : explain-back, point à vérifier ailleurs, désaccord éventuel.
P5. Profondeur adaptée au niveau apparent (clarification pour les novices, hypothèses/implications pour les prompts riches).
P6. Friction décroissante avec la compétence démontrée (fading, seuil qui monte).
P7. Amorces génériques instanciées avec les mots du prompt.
P8. Profondeur causale et hypothétique, une question à la fois, 1 à 3 itérations pour maîtriser le coût perçu.
P9. Bénéfice immédiatement visible (avant/après côte à côte).
P10. Déclenchement modulé par le contexte (pas d'interception des tâches triviales ou urgentes).
P11. Construire l'habitude : implementation intention à l'onboarding, horizon 8 à 10 semaines.
P12. Mesurer l'apprentissage, pas la performance assistée : la qualité des PREMIERS JETS au fil des semaines est la North Star.

## A8. Les 3 erreurs à éviter

1. La friction uniforme pour tous (expertise reversal, inégalités d'usage).
2. Le blocage ou le ton moralisateur (réactance, effet boomerang, destruction de l'autonomie).
3. Le message passif et l'optimisation sur la satisfaction court terme (un A/B test sur la rétention à 7 jours sélectionne mécaniquement la version la moins utile cognitivement).

---

# B. Produit, pricing, IA locale, navigateurs

## B1. IA locale dans le navigateur

- **Chrome / Gemini Nano : production-ready pour les extensions** (Prompt API stable depuis Chrome 138, paramètres temperature/topK pour les extensions). Matériel : 22 Go de disque libre, GPU > 4 Go VRAM ou 16 Go RAM ; environ 40 à 50 % des machines éligibles ; latence médiane ~7,7 s, ~9 tokens/s. `LanguageModel.availability()` pour détecter, `responseConstraint` (JSON Schema) pour contraindre la sortie. Viable pour UNE question courte. Pas disponible dans les content scripts : appeler depuis le service worker/popup. https://developer.chrome.com/docs/extensions/ai/prompt-api
- **Edge (Phi-4-mini)** : developer preview derrière flag, canaux Canary/Dev seulement. À re-tester en 2027.
- **Firefox** : `browser.trial.ml` limité (GPT-2 pour la génération) ou wllama en WASM à notre charge. Pas viable grand public en 2026.

## B2. BYOK

- `chrome.storage` n'est pas chiffré : stocker en `storage.local` (jamais sync), appels uniquement depuis le service worker, bouton « tester la clé », recommander une clé à budget plafonné.
- Politiques Chrome Web Store : BYOK autorisé ; attention à Limited Use (enforcement renforcé août 2026) et à la nouvelle politique 2026 sur les extensions qui contournent les garde-fous IA (nous faisons l'inverse).
- Références UX : TypingMind (licence one-time + BYOK intégral) ; contre-exemple Cursor (BYOK bridé = frustration). Règle : le BYOK débloque tout.

## B3. Coûts et pricing

- Coût réel d'une question Haiku 4.5 (1 $/M input, 5 $/M output) : 0,0012 à 0,0018 $ par question. 1 000 questions ≈ 1,50 $. Utilisateur intensif ≈ 1,30 $/mois de COGS.
- Benchmarks : one sec 3,99 $/mois ; Opal 99 $/an ; Khanmigo 4 $/mois ; Grammarly Business 12 à 15 $/siège ; Island ~5 $/siège ; MagicSchool ~8 $/mois.
- Conversion freemium réaliste pour une extension : 0,5 à 2 % des actifs (dimensionner sur 1 %).
- Recommandation 3 paliers : Free (local + Nano) / Pro 4 €/mois ou 35 €/an (400 questions gérées + BYOK illimité) / Org 3 €/siège/mois éducation, 6 €/siège/mois entreprise (quotas par siège + org-BYOK côté serveur).

## B4. Navigateurs

1. Edge immédiatement (même code, Partner Center, cible DSI).
2. Firefox ensuite (1 à 3 jours : double clé background, gecko.id, host_permissions à demander à l'exécution, AMO en 24 h).
3. Safari sur signal de demande (99 $/an, wrapper app ; flux « upload ZIP sans Xcode » disponible depuis 2025).

## B5. Mécaniques inspirantes et concurrence

- one sec (respiration avant ouverture, validé PNAS), Opal (sessions, Focus Score), Forest (aversion à la perte, progression cumulée), Duolingo (streaks : +48 % de durée avec streak freeze ; répétition espacée).
- Pas de concurrent direct identifié sur « interception + coaching socratique local ». Les optimiseurs de prompts (AIPRM, PromptPerfect) font le travail à la place de l'utilisateur : l'opposé pédagogique. Face à LayerX/Island (surveillance), notre angle est la formation plutôt que le flicage.
- Donnée de vente B2B : 4 à 6 h de formation donnent plus de 60 % d'adoption d'un outil, contre 15 % après une démo de 30 minutes. Prompt Tracker se vend comme outil d'ancrage post-formation.
