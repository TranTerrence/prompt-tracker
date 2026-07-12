import type { PromptEvent } from "@/lib/types";

export function scoreOf(e: Pick<PromptEvent, "scores">): number | null {
  const t = e.scores?.total;
  return typeof t === "number" ? t : null;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function averageScore(events: Pick<PromptEvent, "scores">[]) {
  return average(
    events.map(scoreOf).filter((v): v is number => v !== null)
  );
}

/**
 * Score du PREMIER JET : ce que l'utilisateur a écrit seul, avant tout
 * coaching (score_before sur les prompts interceptés, score direct sinon).
 * C'est la North Star du produit : mesurer l'apprentissage, pas la
 * performance assistée.
 */
export function firstDraftOf(
  e: Pick<PromptEvent, "scores" | "score_before">
): number | null {
  if (typeof e.score_before === "number") return e.score_before;
  return scoreOf(e);
}

export function averageFirstDraft(
  events: Pick<PromptEvent, "scores" | "score_before">[]
) {
  return average(
    events.map(firstDraftOf).filter((v): v is number => v !== null)
  );
}

export function fmt(n: number | null, digits = 1): string {
  return n === null ? ":" : n.toFixed(digits).replace(".", ",");
}

export function fmtPct(n: number | null): string {
  return n === null ? ":" : `${(n * 100).toFixed(0)} %`;
}

export function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type AdminKpis = {
  total: number;
  avg: number | null;
  avgFirstDraft: number | null;
  last7: number | null;
  prev7: number | null;
  progression: number | null;
  interceptRate: number | null;
  outcomes: { improved: number; sent_anyway: number; cancelled: number };
  avgGain: number | null;
  avgRounds: number | null;
};

/** Calcule les KPI de la vue d'ensemble admin. */
export function computeAdminKpis(
  events: (Pick<
    PromptEvent,
    "ts" | "scores" | "intercepted" | "outcome" | "score_before" | "score_after"
  > & { rounds?: number | null })[]
): AdminKpis {
  const total = events.length;
  const avg = averageScore(events);
  const avgFirstDraft = averageFirstDraft(events);

  // La progression se mesure sur les PREMIERS JETS : c'est l'apprentissage
  // qui compte, pas l'amélioration assistée par le coaching.
  const now = Date.now();
  const d7 = now - 7 * 86400_000;
  const d14 = now - 14 * 86400_000;
  const last7 = averageFirstDraft(
    events.filter((e) => new Date(e.ts).getTime() >= d7)
  );
  const prev7 = averageFirstDraft(
    events.filter((e) => {
      const t = new Date(e.ts).getTime();
      return t >= d14 && t < d7;
    })
  );
  const progression = last7 !== null && prev7 !== null ? last7 - prev7 : null;

  const interceptedCount = events.filter((e) => e.intercepted).length;
  const interceptRate = total > 0 ? interceptedCount / total : null;

  const outcomes = {
    improved: events.filter((e) => e.outcome === "improved").length,
    sent_anyway: events.filter((e) => e.outcome === "sent_anyway").length,
    cancelled: events.filter((e) => e.outcome === "cancelled").length,
  };

  const gains = events
    .filter(
      (e) =>
        e.outcome === "improved" &&
        typeof e.score_before === "number" &&
        typeof e.score_after === "number"
    )
    .map((e) => (e.score_after as number) - (e.score_before as number));

  // Tours de réflexion moyens sur les prompts interceptés : la mesure de
  // l'engagement cognitif dans le dialogue socratique.
  const rounds = events
    .filter((e) => e.intercepted && typeof e.rounds === "number")
    .map((e) => e.rounds as number);

  return {
    total,
    avg,
    avgFirstDraft,
    last7,
    prev7,
    progression,
    interceptRate,
    outcomes,
    avgGain: average(gains),
    avgRounds: average(rounds),
  };
}

/** Clé de semaine ISO (lundi) au format YYYY-MM-DD. */
export function weekKey(ts: string): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
