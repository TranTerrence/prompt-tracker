import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  averageFirstDraft,
  fmt,
  fmtAgo,
  isPast,
  linkStateOf,
  LINK_STATE_LABELS,
} from "@/lib/stats";
import type { Group, Profile, PromptEvent } from "@/lib/types";
import CodePanel from "./code-panel";
import InvitationsPanel, {
  type InvitationRow,
} from "@/app/admin/users/invitations-panel";

export const dynamic = "force-dynamic";

type EventRow = Pick<PromptEvent, "user_id" | "ts" | "scores" | "score_before">;

/**
 * La classe, vue par son professeur : le lien d'invitation, qui l'a rejointe,
 * et surtout qui ne remonte rien.
 *
 * Cette page n'existait pas : la gestion de classe était entièrement
 * admin-only, alors que la classe est l'unité du professeur. Il devait
 * demander à l'administrateur de l'établissement pour partager un code ou
 * retirer un élève inscrit par erreur.
 */
export default async function ClassePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { userId } = await requireSession();
  const supabase = await createClient();

  // La RLS de 0007 fait le travail : un professeur ne voit que les groupes
  // dont il est membre. Une ligne absente vaut « pas ta classe ».
  const { data: groupData } = await supabase
    .from("groups")
    .select("id, org_id, name, join_code, join_code_active, join_code_expires_at")
    .eq("id", groupId)
    .maybeSingle<Group>();
  if (!groupData) notFound();

  const [membersRes, invitationsRes] = await Promise.all([
    supabase.from("group_members").select("group_id, user_id").eq("group_id", groupId),
    supabase
      .from("group_invitations")
      .select("id, email, display_name, expires_at, sent_at, accepted_at, revoked_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  const memberIds = (membersRes.data ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== userId);

  let profiles: Profile[] = [];
  let events: EventRow[] = [];
  if (memberIds.length > 0) {
    const [profilesRes, eventsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, org_id, role, email, display_name, disabled, baseline_consent_at")
        .in("id", memberIds),
      supabase
        .from("prompt_events")
        .select("user_id, ts, scores, score_before")
        .in("user_id", memberIds)
        .order("ts", { ascending: false })
        .limit(10000),
    ]);
    profiles = (profilesRes.data ?? []) as Profile[];
    events = (eventsRes.data ?? []) as EventRow[];
  }

  const rows = profiles
    .map((p) => {
      const evs = events.filter((e) => e.user_id === p.id);
      const lastTs = evs.length > 0 ? evs[0].ts : null;
      return {
        profile: p,
        count: evs.length,
        avgFirst: averageFirstDraft(evs),
        lastTs,
        linkState: linkStateOf(p, lastTs),
      };
    })
    .sort((a, b) => a.linkState.localeCompare(b.linkState) || b.count - a.count);

  const notReporting = rows.filter(
    (r) => r.linkState === "no_consent" || r.linkState === "no_data"
  ).length;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/teacher" className="text-sm text-muted hover:text-accent">
          ← Mes classes
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {groupData.name}
        </h1>
        <p className="text-muted">
          {rows.length} élève(s)
          {notReporting > 0 && ` · ${notReporting} ne remontent rien`}
        </p>
      </div>

      <CodePanel
        groupId={groupData.id}
        code={groupData.join_code}
        active={groupData.join_code_active}
        expiresAt={groupData.join_code_expires_at}
        expired={isPast(groupData.join_code_expires_at)}
      />

      <InvitationsPanel
        groupId={groupData.id}
        groupName={groupData.name}
        invitations={(invitationsRes.data ?? []) as InvitationRow[]}
      />

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <h2 className="border-b border-card-border px-5 py-4 font-display text-lg font-semibold tracking-tight">
          Élèves
        </h2>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Personne n&apos;a encore rejoint. Partage le lien d&apos;invitation
            ci-dessus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Élève</th>
                  <th className="px-5 py-3 font-medium">Prompts</th>
                  <th className="px-5 py-3 font-medium">Premiers jets</th>
                  <th className="px-5 py-3 font-medium">État</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.profile.id} className="border-t border-card-border">
                    <td className="px-5 py-3">
                      {row.profile.display_name || row.profile.email}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{row.count}</td>
                    <td className="px-5 py-3 tabular-nums">{fmt(row.avgFirst)}</td>
                    <td className="px-5 py-3 text-muted">
                      {LINK_STATE_LABELS[row.linkState]}
                      {row.linkState === "active" && ` · ${fmtAgo(row.lastTs)}`}
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
        )}
      </section>
    </div>
  );
}
