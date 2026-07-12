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
  role: "admin" | "member";
  email: string | null;
  display_name: string | null;
  disabled: boolean;
};

export type Group = {
  id: string;
  org_id: string;
  name: string;
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
  text: string | null;
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
