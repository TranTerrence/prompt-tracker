# Captures Web Store (1280×800, thème clair)

> **À REFAIRE POUR LA 1.0.0 — bloquant.** L'interface a changé de nom
> (« I-BE³ Companion »), le formulaire mot de passe et le code de classe ont
> disparu du popup, la modale socratique montre désormais le prompt en train
> de se construire (deux colonnes, un bloc par réponse) et tous les liens
> pointent sur `ibe3.vercel.app`. Les fichiers présents dans ce dossier
> montrent l'ancienne extension : les envoyer, c'est une fiche qui ne
> correspond pas au paquet, motif de rejet n°1. Le dossier contient aussi
> 8 fichiers alors que la fiche n'en accepte que 5 — ne garder que les cinq
> ci-dessous, supprimer le reste.
>
> Ces captures ne peuvent pas être produites depuis un harnais de
> développement : ce serait une maquette, pas l'extension à l'œuvre. Elles
> demandent une installation réelle sur un profil Chrome vierge, contre la
> production (après la bascule, lot C).

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
1. `bash scripts/package.sh` depuis un worktree propre, puis charger `extension/` non empaquetée sur un profil Chrome vierge.
2. Capture 1 : l'onboarding s'ouvre seul à l'installation — capturer AVANT de cliquer sur le bouton.
3. Cliquer « J'accepte et j'active I-BE³ Companion ».
4. Se connecter sur https://ibe3.vercel.app avec le compte de test, puis dans le popup « Lier mon compte » → autoriser sur `/extension/pair` → le popup passe en « Tout est synchronisé » → capture 2 (après quelques prompts au compteur, étape 5).
5. Ouvrir chatgpt.com, taper « fais mes devoirs de maths », répondre à deux questions → capture 3.
6. Si l'organisation a publié une bibliothèque : « Activer la bibliothèque » dans le popup, déplier → capture 4.
7. « 🔒 Mes données partagées » → capture 5.

Anciennes captures à supprimer avant l'envoi : `shot-01-interception.png`, `shot-02-dialogue.png`, `shot-02-interception.png`, `shot-03-miroir-apres.png`, `shot-04-miroir-apres.png`, `shot-04-popup.png`, `shot-05-onboarding.png`, `shot-05-popup.png`, `shot-06-consentement.png` (toutes celles qui ne portent pas un des cinq noms du tableau).
