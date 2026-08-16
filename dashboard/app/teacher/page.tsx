import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  averageFirstDraft,
  firstDraftOf,
  fmt,
  fmtAgo,
  fmtPct,
  linkStateOf,
  progression7d,
  LINK_STATE_LABELS,
  type LinkState,
} from "@/lib/stats";
import type { Group, GroupMember, Profile, PromptEvent } from "@/lib/types";

type EventRow = Pick<
  PromptEvent,
  "user_id" | "ts" | "scores" | "intercepted" | "outcome" | "score_before" | "score_after"
>;

const LINK_BADGE_STYLES: Record<LinkState, string> = {
  no_consent: "border-danger/30 bg-danger/10 text-danger",
  no_data: "border-card-border bg-soft text-muted",
  stale: "border-card-border bg-soft text-muted",
  active: "border-success/30 bg-success/10 text-success",
};

/**
 * État de la remontée, par étudiant. « 0 prompt » ne veut pas dire « n'a rien
 * fait » : il peut manquer l'accord de partage ou la liaison de l'extension.
 * Distinguer les trois est ce qui rend l'enseignant capable d'agir.
 */
function LinkBadge({ state, lastTs }: { state: LinkState; lastTs: string | null }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs ${LINK_BADGE_STYLES[state]}`}
      title={
        state === "no_consent"
          ? "L'étudiant n'a pas encore accepté de partager ses indicateurs : rien ne remonte, même s'il utilise l'extension."
          : state === "no_data"
            ? "Accord donné, mais aucun événement reçu : extension pas encore installée ou pas encore liée au compte."
            : `Dernier événement ${fmtAgo(lastTs)}.`
      }
    >
      {LINK_STATE_LABELS[state]}
      {state === "stale" && ` · ${fmtAgo(lastTs)}`}
    </span>
  );
}

// Vue professeur : uniquement SES groupes et leurs étudiants (la RLS scope
// la lecture, aucune donnée d'un autre groupe ne peut apparaître ici).
export default async function TeacherPage() {
  const { userId } = await requireTeacher();
  const supabase = await createClient();

  const [groupsRes, membersRes, profilesRes, eventsRes] = await Promise.all([
    supabase.from("groups").select("id, org_id, name").order("name"),
    supabase.from("group_members").select("group_id, user_id"),
    supabase
      .from("profiles")
      .select("id, org_id, role, email, display_name, disabled, baseline_consent_at"),
    supabase
      .from("prompt_events")
      .select("user_id, ts, scores, intercepted, outcome, score_before, score_after")
      .order("ts", { ascending: false })
      .limit(10000),
  ]);

  const groups = (groupsRes.data ?? []) as Pick<Group, "id" | "org_id" | "name">[];
  const members = (membersRes.data ?? []) as GroupMember[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const events = (eventsRes.data ?? []) as EventRow[];

  const students = profiles.filter((p) => p.id !== userId);
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? p.display_name || p.email || p.id : id;
  };

  const groupCards = groups.map((g) => {
    const memberIds = new Set(
      members.filter((m) => m.group_id === g.id && m.user_id !== userId).map((m) => m.user_id)
    );
    const evs = events.filter((e) => memberIds.has(e.user_id));
    return {
      group: g,
      count: memberIds.size,
      avgFirst: averageFirstDraft(evs),
      progression: progression7d(evs),
    };
  });

  const studentRows = students
    .map((p) => {
      const evs = events.filter((e) => e.user_id === p.id);
      const improved = evs.filter((e) => e.outcome === "improved").length;
      // events est trié par ts décroissant : le premier est le plus récent.
      const lastTs = evs.length > 0 ? evs[0].ts : null;
      return {
        profile: p,
        count: evs.length,
        avgFirst: averageFirstDraft(evs),
        improvedRate: evs.length > 0 ? improved / evs.length : null,
        lastFirstDraft: evs.length > 0 ? firstDraftOf(evs[0]) : null,
        lastTs,
        linkState: linkStateOf(p, lastTs),
      };
    })
    .sort((a, b) => b.count - a.count);

  // Ce qui appelle une action de l'enseignant : relancer ces élèves-là.
  const notReporting = studentRows.filter(
    (r) => r.linkState === "no_consent" || r.linkState === "no_data"
  );

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Mes classes
      </h1>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-card-border bg-card p-8 text-center text-sm text-muted shadow-card">
          Tu n&apos;es rattaché à aucun groupe pour l&apos;instant. Demande à
          l&apos;administrateur de t&apos;ajouter aux groupes de tes classes.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupCards.map(({ group, count, avgFirst, progression }) => (
            <Link
              key={group.id}
              href={`/teacher/classe/${group.id}`}
              className="rounded-2xl border border-card-border bg-card p-5 shadow-card transition-colors hover:border-accent"
            >
              <p className="font-display text-lg font-semibold tracking-tight">
                {group.name}
              </p>
              <p className="mt-1 text-xs text-muted">{count} étudiant(s)</p>
              <p className="mt-3 font-display text-3xl font-medium tracking-tight tabular-nums">
                {fmt(avgFirst)}
              </p>
              <p className="text-xs text-muted">
                premiers jets
                {progression !== null && (
                  <span className={progression >= 0 ? "text-success" : "text-danger"}>
                    {" "}
                    ({progression >= 0 ? "+" : ""}
                    {fmt(progression)} sur 7 j)
                  </span>
                )}
              </p>
              <p className="mt-3 text-xs text-accent">Gérer la classe →</p>
            </Link>
          ))}
        </div>
      )}

      {notReporting.length > 0 && (
        <section className="rounded-2xl border border-card-border bg-soft p-5">
          <p className="text-sm">
            <span className="font-medium">
              {notReporting.length} étudiant(s) ne remontent rien.
            </span>{" "}
            {notReporting.filter((r) => r.linkState === "no_consent").length > 0 && (
              <>
                {notReporting.filter((r) => r.linkState === "no_consent").length} n&apos;ont
                pas encore accepté de partager leurs indicateurs (un bouton le leur
                propose dans l&apos;extension et sur leur page de progression).{" "}
              </>
            )}
            {notReporting.filter((r) => r.linkState === "no_data").length > 0 && (
              <>
                {notReporting.filter((r) => r.linkState === "no_data").length} ont
                accepté mais n&apos;ont encore rien envoyé : extension pas installée,
                ou pas liée à leur compte.
              </>
            )}
          </p>
        </section>
      )}

      {students.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
          <h2 className="border-b border-card-border px-5 py-4 font-display text-lg font-semibold tracking-tight">
            Mes étudiants
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Étudiant</th>
                  <th className="px-5 py-3 font-medium">Prompts</th>
                  <th className="px-5 py-3 font-medium">Premiers jets</th>
                  <th className="px-5 py-3 font-medium">% améliorés</th>
                  <th className="px-5 py-3 font-medium">État</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((row) => (
                  <tr
                    key={row.profile.id}
                    className="border-t border-card-border transition-colors hover:bg-soft/50"
                  >
                    <td className="px-5 py-3">{nameOf(row.profile.id)}</td>
                    <td className="px-5 py-3 tabular-nums">{row.count}</td>
                    <td className="px-5 py-3 tabular-nums">{fmt(row.avgFirst)}</td>
                    <td className="px-5 py-3 tabular-nums">{fmtPct(row.improvedRate)}</td>
                    <td className="px-5 py-3">
                      <LinkBadge state={row.linkState} lastTs={row.lastTs} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/teacher/students/${row.profile.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
