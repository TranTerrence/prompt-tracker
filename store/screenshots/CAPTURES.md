# Captures Web Store (1280×800, thème clair)

> **À REFAIRE POUR LA 0.8.0 — bloquant.** Le dialogue socratique a changé
> d'aspect : il rend désormais la main par un bloc de clôture (« Tu as couvert
> l'essentiel… ») au lieu d'enchaîner les questions sans fin, et il peut porter
> un bloc « Partir d'un prompt qui a fonctionné ». Les captures 2 et 3
> ci-dessous datent du 13/07 et montrent l'ancienne modale : les envoyer
> telles quelles, c'est une fiche qui ne correspond pas au paquet, motif de
> rejet n°1. Le dossier contient aussi 8 fichiers alors que la fiche n'en
> accepte que 5 — choisir, et supprimer le reste.
>
> Ces captures ne peuvent pas être produites depuis un harnais de
> développement : ce serait une maquette, pas l'extension à l'œuvre. Elles
> demandent une installation réelle sur un profil Chrome vierge.

Les captures 1 et 6 sont celles que le reviewer « Purple Nickel » cherche :
la divulgation au premier lancement et le consentement granulaire.

| # | Fichier | Contenu à montrer |
|---|---------|-------------------|
| 1 | `shot-01-disclosure.png` | **Onboarding : la carte « Tes données »** (4 blocs : enregistré / pourquoi / où ça va / conservation) AVEC le bouton « J'accepte et j'active Prompt Tracker » et le lien « Plus tard » visibles dans le cadre. |
| 2 | `shot-02-interception.png` | Modal socratique retenant un prompt vague sur ChatGPT (« fais mes devoirs de maths »). |
| 3 | `shot-03-dialogue.png` | Itération du dialogue : question + réponse + aperçu du prompt recompilé avec score. |
| 4 | `shot-04-miroir-apres.png` | Toast du miroir d'après (question réflexive post-réponse). |
| 5 | `shot-05-popup.png` | Popup avec stats **et le lien « Politique de confidentialité » visible en bas**. |
| 6 | `shot-06-consentement.png` | Écran « Mes données partagées » : ligne socle énumérant les indicateurs, **ligne de conservation (90 j / 12 mois)**, les 4 interrupteurs **désactivés**, zone « Droit à l'effacement ». |

## Procédure
1. `bash scripts/package.sh` puis charger `extension/` non empaquetée sur un profil Chrome vierge.
2. Capture 1 : l'onboarding s'ouvre seul à l'installation : capturer AVANT de cliquer sur le bouton.
3. Cliquer « J'accepte et j'active », ouvrir chatgpt.com, taper « fais mes devoirs de maths » → captures 2 et 3.
4. Envoyer un prompt correct, attendre la fin de la réponse → capture 4.
5. Ouvrir le popup (avec quelques prompts au compteur) → capture 5.
6. Se connecter, rejoindre une classe de test (la divulgation de jonction s'affiche, capture bonus possible), ouvrir « 🔒 Mes données partagées » → capture 6.

Anciennes captures (0.5.0) à remplacer : `shot-01-interception.png`, `shot-02-dialogue.png`, `shot-03-miroir-apres.png`, `shot-04-popup.png`, `shot-05-onboarding.png`.
