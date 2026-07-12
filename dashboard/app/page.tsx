import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "role" | "org_id">>();

  if (!profile || !profile.org_id) redirect("/pending");
  if (profile.role === "admin") redirect("/admin");
  redirect("/me");
}
