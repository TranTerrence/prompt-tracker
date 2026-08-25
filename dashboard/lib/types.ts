import questionBank from "./question-bank.json";

export type Scores = {
  clarte?: number;
  contexte?: number;
  iteration?: number;
  critique?: number;
  total?: number;
};

export type Organization = {
  id: string;
  name: string;
  brand_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  threshold: number;
  capture_mode: "metadata" | "full";
  llm_enabled: boolean;
  intercept_enabled: boolean;
  /**
   * false : l'extension n'affiche AUCUN chiffre (total sur 100, rubriques sur
   * 25, seuil, tendance hebdomadaire). La mesure, le stockage et l'API sont
   * inchangés — seul l'écran se tait. Demande I-BE³ : l'étudiant doit lire un
   * comportement, pas une note qui devient un objectif à optimiser.
   */
  show_score: boolean;
  /**
   * URL https d'une bibliothèque de prompts publiée par l'organisation, ou
   * null. L'extension la lit sans aucune identité et derrière une permission
   * d'hôte facultative. Format : docs/INTEGRATION.md.
   */
  library_url: string | null;
};

export type Profile = {
  id: string;
  org_id: string | null;
  role: "admin" | "teacher" | "member";
  email: string | null;
  display_name: string | null;
  disabled: boolean;
  /**
   * Accord de partage du socle d'indicateurs avec l'organisation. Écrit
   * uniquement par les RPC de jonction (migration 0017). NULL = l'extension
   * ne pousse rien, quel que soit le reste de la configuration.
   */
  baseline_consent_at: string | null;
};

export type Group = {
  id: string;
  org_id: string;
  name: string;
  join_code: string | null;
  join_code_active: boolean;
  join_code_expires_at: string | null;
};

export type ConsentCategory =
  | "prompt_text"
  | "socratic_dialogue"
  | "post_reflection"
  | "conversation_history";

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  "prompt_text",
  "socratic_dialogue",
  "post_reflection",
  "conversation_history",
];

export const CONSENT_LABELS: Record<ConsentCategory, string> = {
  prompt_text: "Texte des prompts",
  socratic_dialogue: "Raisonnement socratique",
  post_reflection: "Réflexions d'après",
  conversation_history: "Fil des conversations",
};

export type OrgDataRequest = {
  org_id: string;
  category: ConsentCategory;
  requested: boolean;
  purpose: string | null;
};

export type Consent = {
  user_id: string;
  category: ConsentCategory;
  granted: boolean;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
};

export type SocraticTemplate = {
  id: string;
  org_id: string;
  key: "delegation" | "clarte" | "contexte" | "iteration" | "critique";
  question: string;
  active: boolean;
};

export type PromptEvent = {
  id: string;
  client_event_id: string | null;
  user_id: string;
  org_id: string;
  ts: string;
  site: string | null;
  category: string | null;
  words: number | null;
  scores: Scores | null;
  intercepted: boolean | null;
  outcome: "sent" | "improved" | "sent_anyway" | "cancelled" | null;
  score_before: number | null;
  score_after: number | null;
  mirror_shown: boolean | null;
  mirror_feedback: string | null;
  rounds: number | null;
  answers_count: number | null;
  text: string | null;
  dialogue: { q: string; a: string; axis?: string }[] | null;
  conv_key: string | null;
  // Mesures post-réponse (extension ≥ 0.7.0). Ce sont des INDICATEURS : le
  // texte de la réponse de l'IA n'est jamais stocké, seulement compté.
  // Tout est nullable — un site sans sélecteur vérifié ne mesure rien, et un
  // onglet passé en arrière-plan invalide les durées (mais pas les tailles).
  prompt_chars: number | null;
  // Identifiant normalisé contre une liste blanche, "autre" si hors
  // catalogue, null si non mesurable. Jamais un libellé lu dans la page.
  model: string | null;
  model_catalog_version: number | null;
  response_chars: number | null;
  response_words: number | null;
  latency_ms: number | null;
  response_ms: number | null;
  turn_index: number | null;
  read_ms: number | null;
  response_outcome: "complete" | "timeout" | "hidden" | "abandoned" | "not_sent" | null;
};

export type PostEvent = {
  id: string;
  client_event_id: string | null;
  user_id: string;
  org_id: string;
  ts: string;
  site: string | null;
  conv_key: string | null;
  post_key: "explain" | "verify" | "disagree" | string;
  category: string | null;
  answered: boolean;
  answer_words: number | null;
  answer: string | null;
  created_at: string;
};

export const POST_KEYS = ["explain", "verify", "disagree"] as const;

export const POST_KEY_LABELS: Record<string, string> = {
  explain: "Reformulation",
  verify: "Vérification",
  disagree: "Désaccord",
};

/**
 * Banque de questions socratiques, GÉNÉRÉE depuis `extension/src/scoring.js`
 * par `scripts/export-question-bank.mjs`. La source de vérité reste
 * l'extension : c'est elle qui sert les questions, hors ligne et sans réseau.
 *
 * Historiquement, seules cinq clés étaient proposées à la surcharge
 * (SOCRATIC_KEYS ci-dessous) alors que `nextQuestion` accepte une surcharge
 * sur N'IMPORTE QUELLE clé. Une équipe pédagogique qui voulait retravailler
 * les questions ne pouvait donc pas le faire, même en le demandant. Toute la
 * banque est désormais adressable.
 */
export type BankQuestion = {
  axis: string;
  axis_label: string;
  axis_label_en: string;
  key: string;
  level: number;
  cats: string[] | null;
  profiles: string[] | null;
  question_fr: string;
  question_en: string;
};

export type BankAxis = { key: string; label: string };

export const QUESTION_BANK = questionBank.questions as BankQuestion[];
export const QUESTION_AXES = questionBank.axes as BankAxis[];
export const QUESTION_BANK_KEYS = QUESTION_BANK.map((q) => q.key);

/** Les questions d'un axe, dans l'ordre d'escalade de la banque. */
export function bankByAxis(axis: string): BankQuestion[] {
  return QUESTION_BANK.filter((q) => q.axis === axis);
}

/**
 * Les cinq clés historiques. Conservées telles quelles : ce sont aussi les
 * noms des rubriques de score affichées côté étudiant (`app/me`), et des
 * lignes existent déjà en base sous ces clés.
 */
export const SOCRATIC_KEYS = [
  "delegation",
  "clarte",
  "contexte",
  "iteration",
  "critique",
] as const;

export const SOCRATIC_LABELS: Record<(typeof SOCRATIC_KEYS)[number], string> = {
  delegation: "Délégation",
  clarte: "Clarté",
  contexte: "Contexte",
  iteration: "Itération",
  critique: "Critique",
};

export const OUTCOME_LABELS: Record<string, string> = {
  sent: "Envoyé",
  improved: "Amélioré",
  sent_anyway: "Envoyé quand même",
  cancelled: "Annulé",
};
