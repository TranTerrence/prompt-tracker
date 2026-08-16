"use client";

import { useActionState } from "react";
import Link from "next/link";
import { approvePairing, type PairState } from "./actions";

export default function PairForm({
  code,
  email,
}: {
  code: string;
  email: string | null;
}) {
  const [state, formAction, pending] = useActionState<PairState, FormData>(
    approvePairing,
    { error: null, approved: false }
  );

  if (state.approved) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-2xl text-success">
          ✓
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Navigateur autorisé
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Tu peux fermer cet onglet. L&apos;extension se connecte toute seule
          dans quelques secondes — son icône affichera ta classe.
        </p>
        <Link
          href="/me"
          className="inline-block text-sm font-medium text-accent hover:underline"
        >
          Voir ma progression
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5 text-center">
      <input type="hidden" name="code" value={code} />
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Autoriser l&apos;extension sur ce navigateur ?
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        L&apos;extension pourra envoyer ta progression sous le compte
        {email ? ` ${email}` : ""}. Tu peux te déconnecter depuis le popup à
        tout moment.
      </p>
      <p className="font-mono text-2xl font-semibold tracking-[0.3em]">{code}</p>
      <p className="text-xs text-muted">
        Ce code doit être celui affiché dans ton extension. S&apos;il ne
        correspond pas, n&apos;autorise pas et ferme cet onglet.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Patiente…" : "Autoriser"}
      </button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
