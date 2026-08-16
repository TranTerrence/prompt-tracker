import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PairForm from "./pair-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lier mon extension : Prompt Tracker",
  robots: { index: false, follow: false },
};

/**
 * Écran d'approbation de l'appairage.
 *
 * Volontairement HORS de PUBLIC_PATHS : un visiteur non connecté est renvoyé
 * vers /login?next=… et revient ici après authentification. C'est tout le
 * principe — l'approbation n'a de valeur que faite par une session vérifiée.
 */
export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const code = (c ?? "").trim().toUpperCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 shadow-card">
        {code ? (
          <PairForm code={code} email={user?.email ?? null} />
        ) : (
          <div className="space-y-3 text-center">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Aucune demande à autoriser
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              Ouvre le popup de l&apos;extension et clique « Lier mon compte » :
              cette page se rouvrira avec le code de la demande.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
