import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { bucketOf } from "@/lib/join";
import AcceptCard from "./accept-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon invitation : Prompt Tracker",
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

type Invitation = { org_name: string; group_name: string; email_masked: string };

/**
 * Acceptation d'une invitation nominative. Jumelle de /join/[code], à deux
 * différences près : le jeton est à usage unique, et l'adresse du compte
 * connecté doit correspondre à celle invitée — un lien transféré n'ouvre rien.
 *
 * Le jeton est dans le CHEMIN, pas en query, et la route pose
 * `Referrer-Policy: no-referrer` (voir next.config.ts) : un chemin part aussi
 * dans l'en-tête Referer, c'est lui qu'il faut couper.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw).trim();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_invitation", {
    p_token: token,
    p_bucket: await bucketOf(),
  });

  if (error) {
    const limited = error.message.includes("rate_limited");
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {limited ? "Trop de tentatives" : "Cette invitation n'est plus valide"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {limited
            ? "Réessaie dans une minute."
            : "Elle a expiré, a été révoquée, ou a déjà été utilisée. Demande à ton enseignant de te la renvoyer."}
        </p>
      </Shell>
    );
  }

  const invitation = data as Invitation;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const header = (
    <>
      <p className="text-sm text-muted">Tu es invité à rejoindre</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
        {invitation.group_name}
      </h1>
      <p className="mt-1 text-sm text-muted">{invitation.org_name}</p>
    </>
  );

  if (!user) {
    return (
      <Shell>
        {header}
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Cette invitation est nominative, pour{" "}
          <strong className="text-foreground">{invitation.email_masked}</strong>.
          Connecte-toi ou crée ton compte avec cette adresse, puis reviens sur ce
          lien.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/invitation/${token}`)}&mode=signup`}
          className="mt-6 inline-block w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Créer mon compte
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(`/invitation/${token}`)}`}
          className="mt-3 inline-block text-sm text-muted hover:text-accent"
        >
          J&apos;ai déjà un compte
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <div className="mt-6">
        <AcceptCard
          token={token}
          orgName={invitation.org_name}
          groupName={invitation.group_name}
        />
      </div>
      <p className="mt-4 text-xs text-muted">
        Connecté en tant que {user.email}. L&apos;invitation vise{" "}
        {invitation.email_masked}.
      </p>
    </Shell>
  );
}
