import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Group, GroupMember, Profile } from "@/lib/types";
import UsersClient from "./users-client";

export default async function AdminUsersPage() {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();

  const [profilesRes, groupsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, org_id, role, email, display_name, disabled")
      .eq("org_id", org.id)
      .order("email"),
    supabase.from("groups").select("id, org_id, name").eq("org_id", org.id).order("name"),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const groups = (groupsRes.data ?? []) as Group[];

  let members: GroupMember[] = [];
  if (groups.length > 0) {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in(
        "group_id",
        groups.map((g) => g.id)
      );
    members = (data ?? []) as GroupMember[];
  }

  return (
    <UsersClient
      profiles={profiles}
      groups={groups}
      members={members}
      currentUserId={userId}
    />
  );
}
