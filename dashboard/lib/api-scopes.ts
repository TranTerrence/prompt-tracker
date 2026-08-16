/**
 * Permissions attribuables à une clé API d'organisation.
 *
 * Vit ici et non dans le module d'actions : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones, et cette liste est lue par le
 * formulaire client autant que par l'action qui valide.
 */
export const AVAILABLE_SCOPES = [
  {
    value: "events:read",
    label: "Lire les événements",
    description: "/groups, /students, /events, /post-events",
  },
  {
    value: "progress:read",
    label: "Lire les agrégats",
    description: "/progress (progression hebdomadaire)",
  },
  {
    value: "embed:mint",
    label: "Frapper des jetons d'affichage",
    description: "POST /embed-tokens, pour intégrer les widgets en iframe",
  },
] as const;

export const SCOPE_VALUES: readonly string[] = AVAILABLE_SCOPES.map((s) => s.value);

/**
 * Permissions cochées d'office à la création.
 *
 * `embed:mint` en est volontairement absent : une clé d'ingestion n'a aucune
 * raison de pouvoir frapper des jetons d'affichage, et les clés déjà émises
 * ne doivent en aucun cas l'acquérir rétroactivement.
 */
export const DEFAULT_SCOPES: readonly string[] = ["events:read", "progress:read"];
