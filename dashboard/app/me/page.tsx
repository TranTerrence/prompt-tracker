import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { average, averageScore, fmt, fmtDate, scoreOf, weekKey } from "@/lib/stats";
import {
  OUTCOME_LABELS,
  SOCRATIC_LABELS,
  type PromptEvent,
  type Scores,
} from "@/lib/types";

type EventRow = Pick<
  PromptEvent,
  "id" | "ts" | "scores" | "intercepted" | "outcome" | "score_before" | "score_after" | "site"
> & { rounds: number | null };

const RUBRIQUES = ["clarte", "contexte", "iteration", "critique"] as const;

/** Petit graphique en ligne SVG : score moyen par semaine. */
function WeeklyChart({ points }: { points: { week: string; avg: number }[] }) {
  const w = 640;
  const h = 180;
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Pas encore de données.</p>;
  }
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + (1 - v / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.avg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Score moyen par semaine">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--card-border)"
            strokeWidth={1}
          />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.week}>
          <circle cx={x(i)} cy={y(p.avg)} r={3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth={1.5} />
          <text
            x={x(i)}
            y={h - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {new Date(p.week).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Barres horizontales : moyenne par rubrique. */
function RubriqueBars({ values }: { values: { key: string; label: string; avg: number | null }[] }) {
  return (
    <div className="space-y-4">
      {values.map((v) => (
        <div key={v.key}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">{v.label}</span>
            <span className="font-medium tabular-nums">{fmt(v.avg)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, v.avg ?? 0))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function MePage() {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("prompt_events")
    .select("id, ts, scores, intercepted, outcome, score_before, score_after, site, rounds")
    .eq("user_id", userId)
    .order("ts", { ascending: false })
    .limit(5000);

  const events = (data ?? []) as EventRow[];
  const avg = averageScore(events);

  // Score moyen par semaine (ordre chronologique)
  const byWeek = new Map<string, number[]>();
  for (const e of events) {
    const s = scoreOf(e);
    if (s === null) continue;
    const key = weekKey(e.ts);
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }
  const weekly = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, scores]) => ({ week, avg: average(scores) ?? 0 }));

  // Moyennes par rubrique
  const rubriques = RUBRIQUES.map((key) => ({
    key,
    label: SOCRATIC_LABELS[key],
    avg: average(
      events
        .map((e) => e.scores?.[key as keyof Scores])
        .filter((v): v is number => typeof v === "number")
    ),
  }));

  // Historique des interceptions
  const interceptions = events.filter((e) => e.intercepted).slice(0, 50);

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Ma progression
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Prompts analysés</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {events.length}
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Score moyen</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {fmt(avg)}
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Interceptions</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {interceptions.length}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="mb-5 font-display text-lg font-semibold tracking-tight">
          Score moyen par semaine
        </h2>
        <WeeklyChart points={weekly} />
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="mb-5 font-display text-lg font-semibold tracking-tight">
          Moyennes par rubrique
        </h2>
        <RubriqueBars values={rubriques} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <h2 className="border-b border-card-border px-5 py-4 font-display text-lg font-semibold tracking-tight">
          Historique des interceptions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Site</th>
                <th className="px-5 py-3 font-medium">Issue</th>
                <th className="px-5 py-3 font-medium">Tours de réflexion</th>
                <th className="px-5 py-3 font-medium">Score avant → après</th>
              </tr>
            </thead>
            <tbody>
              {interceptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Aucune interception pour le moment. Continue comme ça !
                  </td>
                </tr>
              )}
              {interceptions.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-card-border transition-colors hover:bg-soft/50"
                >
                  <td className="px-5 py-3 tabular-nums">{fmtDate(e.ts)}</td>
                  <td className="px-5 py-3 text-muted">{e.site ?? "—"}</td>
                  <td className="px-5 py-3">
                    {e.outcome ? OUTCOME_LABELS[e.outcome] ?? e.outcome : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted tabular-nums">{e.rounds ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {typeof e.score_before === "number" ? e.score_before : "—"}
                    {" → "}
                    {typeof e.score_after === "number" ? e.score_after : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
