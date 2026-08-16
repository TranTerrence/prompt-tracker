"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "./actions";

export default function AcceptCard({
  token,
  orgName,
  groupName,
}: {
  token: string;
  orgName: string;
  groupName: string;
}) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(
    acceptInvitation,
    { error: null }
  );

  return (
    <form action={formAction} className="space-y-4 text-left">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-xl border border-card-border bg-soft p-4">
        <h2 className="font-display text-sm font-semibold">
          Ce que tu partages en rejoignant
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {orgName} recevra, pour {groupName} : tes scores de qualité, les
          catégories de tes demandes, le nombre de prompts, les sites utilisés
          et l&apos;issue de chaque interception.{" "}
          <strong className="text-foreground">
            Aucun texte de prompt n&apos;est concerné
          </strong>{" "}
          : le contenu se demande séparément, catégorie par catégorie, et se
          refuse. Tu peux tout révoquer et tout effacer à tout moment.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Patiente…" : "Rejoindre et partager ces indicateurs"}
      </button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
