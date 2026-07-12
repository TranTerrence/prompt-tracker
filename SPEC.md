# Spec POC — Coach IA / Miroir Socratique (extension Chrome)

## Promesse utilisateur
« Ton copilote pour mieux prompter et garder ton esprit critique. » L'utilisateur installe volontairement l'extension ; elle observe ses prompts sur ChatGPT, lui montre sa progression et lui glisse des questions socratiques **sans jamais bloquer** son envoi.

## Périmètre du POC (1 semaine)
- **Site couvert** : ChatGPT uniquement (chatgpt.com). Claude et Gemini en V2.
- **Sans backend** : tout est stocké localement (`chrome.storage.local`), export CSV manuel depuis le popup.
- **Capture configurable** : mode `metadata` par défaut (catégorie, scores, longueur — jamais le texte), mode `full` en opt-in explicite dans les réglages.

## Parcours utilisateur
1. L'utilisateur tape un prompt dans ChatGPT et l'envoie normalement (rien n'est intercepté ni retardé).
2. Au moment de l'envoi, l'extension analyse le texte **localement** : catégorie d'usage + score qualité sur 4 dimensions.
3. Si le prompt présente une opportunité pédagogique (trop court, sans contexte, délégation totale, aucune demande critique), le **panneau miroir** apparaît discrètement en bas à droite avec 1 question socratique, refermable, non bloquant.
4. Le popup de l'extension affiche : nombre de prompts, score moyen, progression sur 7 jours, répartition par catégorie, et un bouton **Exporter CSV**.

## Scoring qualité (0–100, moyenne de 4 rubriques sur 25)
| Rubrique | Ce qu'on mesure (heuristiques locales) |
|---|---|
| Clarté | Longueur suffisante, verbe d'action, une intention identifiable |
| Contexte | Rôle/audience/objectif/contraintes fournis |
| Itération | Reformulation, référence à un échange précédent, affinage |
| Esprit critique | Demande de sources, d'alternatives, de limites, de vérification |

## Déclencheurs du miroir (règles locales, jamais bloquant)
- Prompt < 8 mots → « Quel résultat précis attends-tu ? Ajoute le contexte et le format souhaité. »
- Délégation totale (« fais/écris/rédige-moi… » sans contexte) → « Qu'as-tu déjà essayé ? Décris ta piste, l'IA la renforcera au lieu de penser à ta place. »
- Aucune dimension critique sur un sujet factuel → « Demande-lui ses sources et ses limites avant de réutiliser la réponse. »
- 3 prompts consécutifs sans itération → « Creuse : demande une critique de la dernière réponse plutôt qu'un nouveau sujet. »

## Critères de validation du POC
- ≥95 % des prompts captés sur ChatGPT pendant 2 semaines sans casse d'adaptateur.
- Panneau miroir affiché sans latence perceptible (analyse < 10 ms, hors chemin d'envoi).
- ≥30 % des testeurs interagissent avec au moins une suggestion socratique.

## Hors périmètre POC (V2+)
Backend multi-tenant, dashboard web white-label, API/webhooks, adaptateurs Claude/Gemini, suggestions LLM enrichies, thèmes par client.
