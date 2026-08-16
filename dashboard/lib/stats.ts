import type { Profile, PromptEvent } from "@/lib/types";

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

/** Médiane : les temps de lecture ont une queue lourde, la moyenne ment. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function fmtDuration(ms: number | null): string {
  if (ms === null) return ":";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  return `${Math.round(ms / 60000)} min`;
}

/* ---------- Mesures post-réponse (extension ≥ 0.7.0) ---------- */

// Une réponse « longue » : en deçà, un enchaînement rapide peut être une
// lecture honnête. Au-delà, non.
const LONG_RESPONSE_CHARS = 600;
// Enchaîner en moins de ça sur une réponse longue, ce n'est pas de la lecture.
const QUICK_READ_MS = 10000;

export type ResponseKpis = {
  /** Envois (hors annulations) : le dénominateur honnête. */
  sent: number;
  /** Part des envois ayant réellement produit une mesure de taille. */
  coverage: number | null;
  avgResponseChars: number | null;
  /** Caractères de réponse par caractère de prompt. */
  expansion: number | null;
  medianReadMs: number | null;
  /** Nombre de temps de lecture mesurés : en dessous d'une dizaine, la
   *  médiane est du bruit et ne doit pas être présentée comme un constat. */
  readCount: number;
  /** Part des réponses longues enchaînées en moins de 10 s : sur-dépendance. */
  quickReadRate: number | null;
  /** Répartition des modèles, du plus utilisé au moins utilisé. */
  models: { model: string; n: number }[];
};

/**
 * KPI des mesures post-réponse. Tout est nullable par construction : un site
 * dont les sélecteurs ne sont pas vérifiés ne mesure rien, et un onglet passé
 * en arrière-plan invalide les durées. `coverage` est le garde-fou : elle
 * chute quand un éditeur change son UI, bien avant qu'on s'en aperçoive
 * autrement.
 */
export function computeResponseKpis(
  events: Pick<
    PromptEvent,
    "outcome" | "model" | "prompt_chars" | "response_chars" | "read_ms"
  >[]
): ResponseKpis {
  const sentEvents = events.filter((e) => e.outcome !== "cancelled");
  const sent = sentEvents.length;

  const sizes = sentEvents
    .map((e) => e.response_chars)
    .filter((v): v is number => typeof v === "number");

  const expansions = sentEvents
    .filter(
      (e) =>
        typeof e.response_chars === "number" &&
        typeof e.prompt_chars === "number" &&
        e.prompt_chars > 0
    )
    .map((e) => (e.response_chars as number) / (e.prompt_chars as number));

  const reads = sentEvents
    .map((e) => e.read_ms)
    .filter((v): v is number => typeof v === "number");

  // Le signal de sur-dépendance ne se mesure que sur les réponses longues
  // DONT on connaît le temps de lecture : les deux conditions au dénominateur.
  const longWithRead = sentEvents.filter(
    (e) =>
      typeof e.read_ms === "number" &&
      typeof e.response_chars === "number" &&
      e.response_chars >= LONG_RESPONSE_CHARS
  );
  const quick = longWithRead.filter((e) => (e.read_ms as number) < QUICK_READ_MS);

  const counts = new Map<string, number>();
  for (const e of sentEvents) {
    if (!e.model) continue;
    counts.set(e.model, (counts.get(e.model) ?? 0) + 1);
  }

  return {
    sent,
    coverage: sent > 0 ? sizes.length / sent : null,
    avgResponseChars: average(sizes),
    expansion: average(expansions),
    medianReadMs: median(reads),
    readCount: reads.length,
    quickReadRate: longWithRead.length > 0 ? quick.length / longWithRead.length : null,
    models: [...counts.entries()]
      .map(([model, n]) => ({ model, n }))
      .sort((a, b) => b.n - a.n),
  };
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

/**
 * Progression des premiers jets sur 7 jours glissants (7 derniers jours contre
 * les 7 précédents). Null si l'une des deux fenêtres est vide.
 *
 * Vit ici et pas dans les pages : `Date.now()` appelé pendant le rendu d'un
 * composant est une impureté que la règle react-hooks/purity refuse, et la
 * même fenêtre était calculée à trois endroits.
 */
export function progression7d(
  events: Pick<PromptEvent, "ts" | "scores" | "score_before">[]
): number | null {
  const now = Date.now();
  const week = 7 * 86400_000;
  const last7 = averageFirstDraft(events.filter((e) => now - Date.parse(e.ts) < week));
  const prev7 = averageFirstDraft(
    events.filter((e) => {
      const age = now - Date.parse(e.ts);
      return age >= week && age < 2 * week;
    })
  );
  return last7 !== null && prev7 !== null ? last7 - prev7 : null;
}

/**
 * Série de jours où les premiers jets tiennent le seuil.
 *
 * Portage de `CoachScoring.dayStreakInfo` (extension/src/scoring.js) — la
 * série était visible dans le popup mais absente du web, alors que c'est
 * l'indicateur d'autonomie que l'élève regarde en premier. Les deux
 * implémentations doivent rester d'accord : mêmes règles, même résultat.
 *
 * Trois règles, dans cet ordre :
 * - un jour SANS prompt n'est ni gagné ni perdu (on ne punit pas l'absence) ;
 * - on prend la MÉDIANE du jour, pas la moyenne : un prompt raté ne casse pas
 *   une bonne journée ;
 * - une semaine pleine de réussites donne un « gel » (2 max) qui absorbe un
 *   jour manqué sans remettre la série à zéro.
 */
export function dayStreakInfo(
  events: Pick<PromptEvent, "ts" | "scores" | "score_before">[],
  threshold: number,
  now: number = Date.now()
): { streak: number; freezes: number } {
  const dayKeyOf = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const byDay = new Map<string, number[]>();
  for (const e of events) {
    const s = firstDraftOf(e);
    if (s === null || !e.ts) continue;
    const key = dayKeyOf(Date.parse(e.ts));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(s);
    else byDay.set(key, [s]);
  }

  const day = 86400_000;
  let streak = 0;
  let freezes = 0;
  let successes = 0;
  for (let i = 89; i >= 0; i--) {
    const scores = byDay.get(dayKeyOf(now - i * day));
    if (!scores) continue;
    const m = median(scores);
    if (m !== null && m >= threshold) {
      streak++;
      successes++;
      if (successes % 7 === 0 && freezes < 2) freezes++;
    } else if (freezes > 0) {
      freezes--;
      successes = 0;
    } else {
      streak = 0;
      successes = 0;
    }
  }
  return { streak, freezes };
}

export type LinkState = "no_consent" | "no_data" | "stale" | "active";

export const LINK_STATE_LABELS: Record<LinkState, string> = {
  no_consent: "En attente d'accord",
  no_data: "Aucune donnée reçue",
  stale: "Silencieux",
  active: "Actif",
};

/**
 * État de la chaîne extension → serveur pour un étudiant.
 *
 * Sans ça, un élève à zéro événement est indistinguable de trois situations
 * très différentes : il n'a pas donné son accord de partage, il n'a pas
 * installé ou lié l'extension, ou il n'a simplement rien fait cette semaine.
 * C'est cette confusion qui a rendu le blocage de synchronisation invisible
 * côté enseignant pendant tout son cycle de vie.
 */
export function linkStateOf(
  profile: Pick<Profile, "baseline_consent_at">,
  lastEventTs: string | null,
  staleAfterDays = 14
): LinkState {
  if (!profile.baseline_consent_at) return "no_consent";
  if (!lastEventTs) return "no_data";
  const age = Date.now() - Date.parse(lastEventTs);
  return age > staleAfterDays * 86400_000 ? "stale" : "active";
}

/**
 * L'échéance est-elle passée ? Vit ici et pas dans les pages : lire l'heure
 * courante pendant un rendu est une impureté que react-hooks/purity refuse,
 * y compris dans un composant serveur.
 */
export function isPast(ts: string | null): boolean {
  return ts ? Date.parse(ts) < Date.now() : false;
}

/** « il y a 3 jours », « il y a 2 mois ». Null si aucune date. */
export function fmtAgo(ts: string | null): string {
  if (!ts) return ":";
  const days = Math.floor((Date.now() - Date.parse(ts)) / 86400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
}

/** Clé de semaine ISO (lundi) au format YYYY-MM-DD. */
export function weekKey(ts: string): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
