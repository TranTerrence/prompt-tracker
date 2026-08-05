import { ApiReference } from "@scalar/nextjs-api-reference";

// Référence API interactive rendue par Scalar (MIT) depuis public/openapi.yaml,
// qui est la source de vérité du contrat v1. Ajouter un endpoint ou un champ se
// fait dans la spec, jamais ici.
//
// hideClientButton : l'API v1 ne renvoie aucun en-tête CORS (server-to-server
// par conception). Un « try it » depuis le navigateur échouerait toujours et
// pousserait l'intégrateur à coller sa clé dans un onglet : on le masque.
export const GET = ApiReference({
  url: "/openapi.yaml",
  pageTitle: "API Prompt Tracker — Référence v1",
  theme: "default",
  hideClientButton: true,
  hideDownloadButton: false,
  // Page publique : pas de devtools Scalar, même en local (le défaut les
  // affiche sur localhost, ce qui donne un rendu différent de la prod).
  showDeveloperTools: "never",
  metaData: {
    title: "API Prompt Tracker — Référence v1",
    description:
      "Documentation de l'API REST d'organisation Prompt Tracker : groupes, étudiants, événements de prompts, miroir d'après et agrégats de progression.",
  },
});
