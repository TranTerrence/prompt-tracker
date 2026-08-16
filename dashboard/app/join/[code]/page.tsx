import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { normalizeCode, resolveJoinCode } from "@/lib/join";
import { startJoin } from "./actions";
import JoinCard from "./join-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rejoindre ma classe : Prompt Tracker",
  // Un lien d'invitation partagé dans un ENT n'a rien à faire dans un index.
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 text-center shadow-card">
        {children}
      </div>
    </main>
  );
}

/**
 * Le point d'entrée de l'élève : une URL à coller dans un ENT ou un mail de
 * rentrée. Elle remplace « va sur le site, crée un compte, trouve où saisir le
 * code, saisis-le ».
 *
 * La résolution du code est faite ICI, côté serveur, avec un seau de
 * limitation dérivé de l'IP : le navigateur n'atteint jamais la RPC.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = normalizeCode(decodeURIComponent(raw));

  const [{ target, rateLimited }, supabase] = await Promise.all([
    resolveJoinCode(code),
    createClient(),
  ]);

  if (rateLimited) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Trop de tentatives
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Réessaie dans une minute.
        </p>
      </Shell>
    );
  }

  if (!target) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Ce lien n&apos;est pas valide
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Le code n&apos;existe pas, a été désactivé, ou a expiré. Demande le
          lien à jour à ton enseignant.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const header = (
    <>
      <p className="text-sm text-muted">Tu rejoins</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
        {target.group_name}
      </h1>
      <p className="mt-1 text-sm text-muted">{target.org_name}</p>
    </>
  );

  // 1. Pas de compte : on mémorise la classe et on envoie s'inscrire.
  if (!user) {
    return (
      <Shell>
        {header}
        <form
          action={async () => {
            "use server";
            await startJoin(code);
          }}
          className="mt-6 space-y-3"
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Créer mon compte
          </button>
        </form>
        <Link
          href={`/login?join=${encodeURIComponent(code)}`}
          className="mt-3 inline-block text-sm text-muted hover:text-accent"
        >
          J&apos;ai déjà un compte
        </Link>
      </Shell>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Connecté, déjà dans une AUTRE organisation : impasse assumée, on ne
  //    déplace pas quelqu'un d'un établissement à un autre sur un simple lien.
  //    (Même org, autre classe : la RPC ajoute simplement au groupe.)
  if (profile?.org_id && !(await belongsToSameOrg(profile.org_id, code))) {
    return (
      <Shell>
        {header}
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Ton compte ({user.email}) est déjà rattaché à une autre organisation.
          Demande à ton administrateur, ou déconnecte-toi pour utiliser un autre
          compte.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition-colors hover:bg-soft hover:text-foreground"
          >
            Se déconnecter
          </button>
        </form>
      </Shell>
    );
  }

  // 3. Connecté et rattachable : la divulgation, puis l'acte affirmatif.
  return (
    <Shell>
      {header}
      <div className="mt-6">
        <JoinCard code={code} orgName={target.org_name} groupName={target.group_name} />
      </div>
    </Shell>
  );
}

/**
 * Un membre ne peut pas lire `groups` d'une autre organisation (RLS de 0007),
 * donc l'absence de ligne signifie « autre org » — c'est exactement le test
 * qu'on veut, et il ne fuit rien.
 */
async function belongsToSameOrg(orgId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id")
    .eq("org_id", orgId)
    .ilike("join_code", code)
    .maybeSingle();
  return Boolean(data);
}
