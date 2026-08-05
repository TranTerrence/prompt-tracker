---
name: webstore-review
description: Use when publishing, submitting, updating or packaging the Prompt Tracker browser extension — bumping the version, running package.sh, preparing store assets, answering Developer Dashboard fields, or after any change to manifest.json, permissions, data collection, network calls or the store listing.
---

# Revue de soumission Web Store

## Principe

Un rejet ne coûte pas une correction, il coûte **un cycle de revue entier** (1 à
3 jours, parfois plus) — et un rejet répété sur le même motif attire un examen
manuel plus sévère sur les envois suivants. La revue se fait donc *avant*
l'envoi, sur le paquet exact qui sera soumis.

**Deux étages, dans cet ordre :**

1. `bash scripts/webstore-check.sh` — tout ce qu'une machine peut vérifier.
2. La revue de jugement ci-dessous — ce qu'une machine ne peut pas.

Ne jamais faire le 2 sans le 1 : c'est du temps humain gaspillé sur des choses
qu'un grep attrape.

## Le gate

Un point non vérifié se traite comme un échec, pas comme un « probablement bon ».
Répondre par une **preuve** (sortie de commande, ligne de fichier), jamais par
une impression.

### 1. Objectif unique
- [ ] La phrase de `store/SUBMISSION.md` couvre-t-elle **toutes** les
      fonctionnalités du paquet ? Toute fonction qui déborde = rejet
      « does not have a single purpose ». Retirer la fonction, ou réécrire la
      phrase — et si la phrase devient une liste, c'est la fonction qui part.

### 2. Cohérence fiche ↔ code (motif de rejet n°1)
- [ ] Chaque promesse de `store/description-*.md` est réellement implémentée.
- [ ] Chaque comportement observable du code est décrit dans la fiche.
- [ ] Les cases « usage des données » du Dashboard correspondent à ce que le
      code envoie *vraiment* — relire les appels réseau (`extension/src/supabase.js`,
      `background.js`), pas la doc.
- [ ] Une nouvelle donnée transmise depuis la dernière version ? Alors la
      divulgation ET la politique de confidentialité changent aussi.

### 3. Permissions
- [ ] Aucune permission « au cas où ». Le script vérifie qu'elles sont
      utilisées ; vérifier à la main qu'elles sont *nécessaires*.
- [ ] Aucun match pattern élargi sans nécessité. Ajouter un site = ajouter son
      domaine explicite, jamais `*://*/*`.
- [ ] La justification dans `store/SUBMISSION.md` explique le **bénéfice pour
      l'utilisateur**, pas le détail d'implémentation.

### 4. Le relecteur peut-il voir la fonctionnalité ?
- [ ] Les notes de test de `store/SUBMISSION.md` mènent à la fonction
      principale en moins de 5 étapes.
- [ ] Aucun mur : login, code de classe, compte serveur. S'il y en a un,
      fournir un compte de test **valide et vérifié le jour de l'envoi**.
- [ ] Rappel spécifique à ce projet : l'extension est **inerte** avant
      acceptation de l'écran de divulgation. Non dit, ça se lit comme
      « ne fonctionne pas ».

### 5. Contenu de la fiche
- [ ] Pas de bourrage de mots-clés, pas de superlatifs invérifiables.
- [ ] Marques tierces en usage nominatif seulement (cf. `store/SUBMISSION.md`).
- [ ] Les captures montrent l'extension réellement à l'œuvre, sans maquette
      trompeuse, et correspondent à la version envoyée.

### 6. Le paquet exact
- [ ] `bash scripts/package.sh` relancé **après** le dernier commit de code.
- [ ] Le zip installé en décompressé et testé une dernière fois sur un vrai site.
- [ ] Zéro erreur dans la console du service worker et de la page.

## Après l'envoi

- [ ] Taguer le commit soumis (`git tag store-vX.Y.Z`) : sans ça, on ne sait plus
      quel code correspond à quelle version en revue.
- [ ] En cas de rejet, écrire le motif exact reçu dans la section
      « Historique » ci-dessous **avant** de corriger. Un motif non écrit
      revient.

## Rationalisations

| Excuse | Réalité |
|---|---|
| « Ce n'est qu'un correctif d'UI » | Le formulaire de divulgation est resoumis intégralement à chaque envoi. Une case cochée par réflexe devient une déclaration fausse. |
| « La fiche est déjà validée » | Elle a été validée pour la version précédente. C'est le couple code+fiche qui est revu. |
| « J'ajusterai après publication » | Une divulgation fausse en production, c'est un retrait, pas un rejet. Le retrait touche tous les utilisateurs installés. |
| « Le relecteur comprendra » | Le relecteur dispose de quelques minutes et n'a pas le contexte. Ce qui n'est pas dans les notes de test n'existe pas. |
| « La permission servira bientôt » | Une permission non utilisée aujourd'hui est un rejet aujourd'hui. L'ajouter dans la version qui l'utilise. |
| « J'ai testé en décompressé, c'est pareil » | Le zip peut différer (fichiers exclus, chemins). Tester le zip lui-même. |

## Signaux d'alerte — s'arrêter et refaire le gate

- Le diff touche `manifest.json`, un appel `fetch`, ou ce qui est stocké.
- On s'apprête à cocher une case de divulgation sans avoir relu le code réseau.
- Une phrase de la fiche commence par « bientôt » ou « permet aussi de ».
- Le paquet a été construit avant le dernier commit.
- On envoie sous contrainte de temps : c'est exactement là que le motif de rejet
  passe, et le rejet coûte plus cher que l'heure économisée.

## Historique des rejets

Aucun à ce jour. Chaque rejet reçu s'inscrit ici : date, motif exact cité par
Google, correction apportée. C'est ce qui empêche de repayer deux fois le même
cycle de revue.
