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
};

export type Profile = {
  id: string;
  org_id: string | null;
  role: "admin" | "teacher" | "member";
  email: string | null;
  display_name: string | null;
  disabled: boolean;
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
