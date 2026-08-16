import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bienvenue : Prompt Tracker",
  robots: { index: false, follow: false },
};

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold ${
          done ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <div className="text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

/**
 * Après la jonction. Le compte existe et l'accord est donné, mais rien ne
 * remontera tant que l'extension n'est pas installée ET liée : cette page est
 * là pour que ces deux étapes ne se perdent pas.
 *
 * L'étape 3 est vérifiable, pas déclarative : elle lit les événements
 * réellement reçus. C'est la seule façon honnête de dire « ça marche ».
 */
export default async function JoinDonePage() {
  const { userId, org } = await requireSession();
  const supabase = await createClient();

  const { count } = await supabase
    .from("prompt_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const received = count ?? 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="space-y-3">
        <p className="text-sm text-muted">Compte rattaché</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Bienvenue chez {org.brand_name || org.name}
        </h1>
        <p className="text-muted">
          Encore deux étapes, et ta progression commencera à se construire.
        </p>
      </div>

      <ol className="mt-10 space-y-7">
        <Step n={1} title="Installer l'extension">
          <p>
            Elle ajoute une pause réfléchie avant tes prompts sur ChatGPT,
            Claude, Gemini, Mistral et Grok. L&apos;analyse est locale.
          </p>
          <Link
            href="/install"
            className="mt-2 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90"
          >
            Installer l&apos;extension
          </Link>
        </Step>

        <Step n={2} title="Lier ton compte">
          <p>
            Une fois installée, clique l&apos;icône de l&apos;extension puis{" "}
            <strong className="text-foreground">« Lier mon compte »</strong>.
            Une page s&apos;ouvre ici pour que tu autorises ce navigateur — pas
            de mot de passe à ressaisir.
          </p>
        </Step>

        <Step n={3} title="Vérifier" done={received > 0}>
          {received > 0 ? (
            <p>
              {received} événement(s) déjà reçus. Tout fonctionne :{" "}
              <Link href="/me" className="font-medium text-accent hover:underline">
                voir ma progression
              </Link>
              .
            </p>
          ) : (
            <p>
              Aucun événement reçu pour l&apos;instant. Écris un prompt sur l&apos;un
              des sites d&apos;IA, puis recharge cette page. Si rien n&apos;arrive,
              le popup de l&apos;extension affiche la raison exacte.
            </p>
          )}
        </Step>
      </ol>

      <p className="mt-10 text-sm text-muted">
        Tu peux revoir ou révoquer ce que tu partages à tout moment depuis{" "}
        <Link href="/me/donnees" className="font-medium text-accent hover:underline">
          tes données partagées
        </Link>
        .
      </p>
    </main>
  );
}
