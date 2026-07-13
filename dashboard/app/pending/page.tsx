import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinForm from "./join-form";

function HourglassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden
    >
      <path d="M6 3h12M6 21h12M7 3v3.5a5 5 0 0 0 2.2 4.15L12 12l-2.8 1.35A5 5 0 0 0 7 17.5V21M17 3v3.5a5 5 0 0 1-2.2 4.15L12 12l2.8 1.35A5 5 0 0 1 17 17.5V21" />
    </svg>
  );
}

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  // Si le compte a été rattaché entre-temps, on renvoie vers l'accueil.
  if (profile?.org_id) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-soft text-accent">
          <HourglassIcon />
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Rejoins ton organisation
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ton compte n&apos;est rattaché à aucune organisation pour le moment.
        </p>
        <JoinForm />
        <p className="mt-5 text-xs leading-relaxed text-muted">
          Pas de code ? Demande à ton administrateur de rattacher ton compte
          (avec l&apos;adresse{" "}
          <span className="font-medium text-foreground">{user.email}</span>),
          puis reconnecte-toi.
        </p>
        <form action="/auth/signout" method="post" className="mt-7">
          <button
            type="submit"
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition-colors hover:bg-soft hover:text-foreground"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
