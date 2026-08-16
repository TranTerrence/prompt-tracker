import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Consent, Group, GroupMember, OrgDataRequest, Profile } from "@/lib/types";
import UsersClient from "./users-client";
import type { InvitationRow } from "./invitations-panel";

export default async function AdminUsersPage() {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();

  const [profilesRes, groupsRes, requestsRes, invitationsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, org_id, role, email, display_name, disabled, baseline_consent_at")
      .eq("org_id", org.id)
      .order("email"),
    supabase
      .from("groups")
      .select("id, org_id, name, join_code, join_code_active, join_code_expires_at")
      .eq("org_id", org.id)
      .order("name"),
    supabase
      .from("org_data_requests")
      .select("org_id, category, requested, purpose")
      .eq("org_id", org.id)
      .eq("requested", true),
    supabase
      .from("group_invitations")
      .select("id, group_id, email, display_name, expires_at, sent_at, accepted_at, revoked_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const groups = (groupsRes.data ?? []) as Group[];
  const dataRequests = (requestsRes.data ?? []) as OrgDataRequest[];
  const invitations = (invitationsRes.data ?? []) as (InvitationRow & {
    group_id: string;
  })[];

  let members: GroupMember[] = [];
  let consents: Consent[] = [];
  if (profiles.length > 0) {
    const ids = profiles.map((p) => p.id);
    const [membersRes, consentsRes] = await Promise.all([
      groups.length > 0
        ? supabase
            .from("group_members")
            .select("group_id, user_id")
            .in("group_id", groups.map((g) => g.id))
        : Promise.resolve({ data: [] }),
      supabase
        .from("consents")
        .select("user_id, category, granted")
        .in("user_id", ids),
    ]);
    members = (membersRes.data ?? []) as GroupMember[];
    consents = (consentsRes.data ?? []) as Consent[];
  }

  return (
    <UsersClient
      profiles={profiles}
      groups={groups}
      members={members}
      consents={consents}
      dataRequests={dataRequests}
      invitations={invitations}
      currentUserId={userId}
    />
  );
}
