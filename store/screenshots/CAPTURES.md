# Captures Web Store (1280×800, thème clair, interface en anglais depuis la 1.0.1)

> **État au 16/09/2026 (1.0.1).** Trois captures réelles sont dans ce
> dossier, prises sur un profil Chromium vierge avec l'extension 1.0.1
> chargée non empaquetée (Playwright pilote le navigateur, l'extension fait
> le reste — ce n'est pas une maquette) :
>
> - `shot-01-disclosure.png` — la carte « Tes données » de l'onboarding (4
>   blocs). La carte fait 620 px et les réglages (plan, thème, friction) la séparent du bouton
>   « J'accepte et j'active » : les deux ne tiennent pas dans un cadre de
>   800 px, la capture montre la carte, que le relecteur cherche en premier.
> - `shot-02-popup.png` — le popup **non appairé** (« Lier mon compte »,
>   compteurs à zéro, lien « Politique de confidentialité »), rendu à sa
>   largeur réelle de 360 px sur fond neutre. **Provisoire** : la fiche
>   voudrait l'état appairé (« Tout est synchronisé ✓ »), qui demande le
>   compte de test — à refaire après l'étape 4 de la procédure.
> - `shot-03-dialogue.png` — la modale sur chatgpt.com, « do my maths
>   homework » retenu (7/100), deux réponses, vue construite à droite, score
>   7 → 45. Prise **sans compte ChatGPT** grâce au sélecteur ajouté en 1.0.1.
>
> Manquent, parce qu'elles demandent un compte lié : la 4 (bibliothèque) et
> la 5 (consentement avec ses interrupteurs — sans compte, la page dit
> « Connecte-toi d'abord »). La fiche accepte de 1 à 5 captures : on peut
> soumettre avec ces trois-là, et compléter à la mise à jour suivante.

Les captures 1 et 5 sont celles que le relecteur cherche en priorité : la
divulgation au premier lancement et le consentement granulaire.

| # | Fichier | Contenu à montrer |
|---|---------|-------------------|
| 1 | `shot-01-disclosure.png` | **Onboarding : la carte « Tes données »** (4 blocs : enregistré / pourquoi / où ça va / conservation) AVEC le bouton « J'accepte et j'active I-BE³ Companion » et le lien « Plus tard » visibles dans le cadre. Le titre « Bienvenue dans I-BE³ Companion » doit apparaître. |
| 2 | `shot-02-popup.png` | Popup **appairé** (« Tout est synchronisé ✓ », bouton « Ouvrir l'app I-BE³ Companion »), quelques prompts au compteur, **et le lien « Politique de confidentialité » visible en bas**. Aucun champ de code de classe, aucun formulaire mot de passe. |
| 3 | `shot-03-dialogue.png` | Modale socratique sur ChatGPT retenant un prompt vague (« fais mes devoirs de maths ») après deux réponses : à gauche le fil question/réponse, à droite **la vue construite** (demande d'origine + un bloc numéroté par réponse) et le score qui monte. |
| 4 | `shot-04-bibliotheque.png` | Bibliothèque de prompts de l'organisation, dépliée dans le popup (ou dans la modale, « Partir d'un prompt qui a fonctionné »). Nécessite qu'une adresse de bibliothèque soit configurée pour l'organisation. |
| 5 | `shot-05-consentement.png` | Écran « Mes données partagées » : ligne socle énumérant les indicateurs, **ligne de conservation (90 j / 12 mois)**, les interrupteurs de contenu **désactivés**, zone « Droit à l'effacement ». |

## Procédure
1. `bash scripts/package.sh` depuis un worktree propre, puis charger `extension/` non empaquetée sur un profil Chrome vierge (ou : Playwright `launchPersistentContext` avec `--load-extension`, viewport 1280×800, `colorScheme: 'light'` — c'est ainsi que les captures 1 à 3 de la 1.0.1 ont été faites).
2. Capture 1 : l'onboarding s'ouvre seul à l'installation — capturer AVANT de cliquer sur le bouton.
3. Cliquer « J'accepte et j'active I-BE³ Companion ».
4. Se connecter sur https://companion.mines.paris avec le compte de test, puis dans le popup « Lier mon compte » → autoriser sur `/extension/pair` → le popup passe en « Tout est synchronisé » → capture 2 (après quelques prompts au compteur, étape 5).
5. Ouvrir chatgpt.com, taper « fais mes devoirs de maths », répondre à deux questions → capture 3.
6. Si l'organisation a publié une bibliothèque : « Activer la bibliothèque » dans le popup, déplier → capture 4.
7. « 🔒 Mes données partagées » → capture 5.
