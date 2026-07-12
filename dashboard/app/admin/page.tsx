import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { averageScore, computeAdminKpis, fmt, fmtPct } from "@/lib/stats";
import type { Group, Profile, PromptEvent } from "@/lib/types";

type EventRow = Pick<
  PromptEvent,
  "user_id" | "ts" | "scores" | "intercepted" | "outcome" | "score_before" | "score_after"
> & { rounds: number | null };

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ groupe?: string }>;
}) {
  const { org } = await requireAdmin();
  const { groupe } = await searchParams;
  const supabase = await createClient();

  const [profilesRes, groupsRes, eventsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, role, disabled")
      .eq("org_id", org.id),
    supabase.from("groups").select("id, name").eq("org_id", org.id).order("name"),
    supabase
      .from("prompt_events")
      .select("user_id, ts, scores, intercepted, outcome, score_before, score_after, rounds")
      .eq("org_id", org.id)
      .order("ts", { ascending: false })
      .limit(10000),
  ]);

  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "email" | "display_name" | "role" | "disabled"
  >[];
  const groups = (groupsRes.data ?? []) as Pick<Group, "id" | "name">[];
  let events = (eventsRes.data ?? []) as EventRow[];

  // Filtre par groupe
  let memberIds: Set<string> | null = null;
  if (groupe) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupe);
    memberIds = new Set((members ?? []).map((m) => m.user_id as string));
    events = events.filter((e) => memberIds!.has(e.user_id));
  }

  // KPIs
  const { total, avg, last7, prev7, progression, interceptRate, outcomes, avgGain, avgRounds } =
    computeAdminKpis(events);
  const outcomeTotal = outcomes.improved + outcomes.sent_anyway + outcomes.cancelled;

  // Tableau par utilisateur
  const shownProfiles = memberIds
    ? profiles.filter((p) => memberIds!.has(p.id))
    : profiles;
  const userRows = shownProfiles
    .map((p) => {
      const evs = events.filter((e) => e.user_id === p.id);
      const improved = evs.filter((e) => e.outcome === "improved").length;
      return {
        profile: p,
        count: evs.length,
        avg: averageScore(evs),
        improvedRate: evs.length > 0 ? improved / evs.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Vue d&apos;ensemble
        </h1>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label htmlFor="groupe" className="text-muted">
            Groupe :
          </label>
          <select
            id="groupe"
            name="groupe"
            defaultValue={groupe ?? ""}
            className="rounded-lg border border-card-border bg-card px-3 py-1.5 outline-none transition-colors focus:border-accent"
          >
            <option value="">Tous</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white transition hover:opacity-90"
          >
            Filtrer
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Prompts analysés" value={String(total)} />
        <Kpi label="Score moyen" value={fmt(avg)} sub="sur 100" />
        <Kpi
          label="Progression (7 derniers jours)"
          value={
            progression === null
              ? "—"
              : `${progression >= 0 ? "+" : ""}${fmt(progression)}`
          }
          sub={`vs 7 jours précédents (${fmt(prev7)} → ${fmt(last7)})`}
        />
        <Kpi label="Taux d'interception" value={fmtPct(interceptRate)} />
        <Kpi
          label="Issues des interceptions"
          value={
            outcomeTotal === 0
              ? "—"
              : `${outcomes.improved} / ${outcomes.sent_anyway} / ${outcomes.cancelled}`
          }
          sub="améliorés / envoyés quand même / annulés"
        />
        <Kpi
          label="Gain moyen après amélioration"
          value={avgGain === null ? "—" : `+${fmt(avgGain)}`}
          sub="score après − score avant (prompts améliorés)"
        />
        <Kpi
          label="Tours de réflexion moyens"
          value={fmt(avgRounds)}
          sub="questions socratiques par prompt intercepté"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Par utilisateur
          </h2>
          <Link
            href="/admin/users"
            className="text-sm font-medium text-accent hover:underline"
          >
            Gérer les utilisateurs →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-5 py-3 font-medium">Prompts</th>
                <th className="px-5 py-3 font-medium">Score moyen</th>
                <th className="px-5 py-3 font-medium">% améliorés</th>
              </tr>
            </thead>
            <tbody>
              {userRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
                    Aucun utilisateur dans cette sélection.
                  </td>
                </tr>
              )}
              {userRows.map((row) => (
                <tr
                  key={row.profile.id}
                  className="border-t border-card-border transition-colors hover:bg-soft/50"
                >
                  <td className="px-5 py-3">
                    <span className={row.profile.disabled ? "line-through opacity-50" : ""}>
                      {row.profile.display_name || row.profile.email || row.profile.id}
                    </span>
                    {row.profile.role === "admin" && (
                      <span className="ml-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{row.count}</td>
                  <td className="px-5 py-3 tabular-nums">{fmt(row.avg)}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtPct(row.improvedRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
