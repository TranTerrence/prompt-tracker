"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ackBaseline, type AckState } from "./actions";
import { fmtAgo, type LinkState } from "@/lib/stats";

/**
 * « Ton extension » : l'état réel de la chaîne extension → serveur, vu par
 * l'étudiant. Sans ce bloc, quelqu'un dont la synchronisation est bloquée n'a
 * aucun moyen de le savoir — il voit une page de progression vide et en
 * conclut que le produit ne sert à rien.
 */
export default function ExtensionPanel({
  state,
  lastTs,
}: {
  state: LinkState;
  lastTs: string | null;
}) {
  const [ack, ackAction, acking] = useActionState<AckState, FormData>(ackBaseline, {
    error: null,
  });

  if (state === "active") {
    return (
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Ton extension
          </h2>
          <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs text-success">
            Connectée · dernier envoi {fmtAgo(lastTs)}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Tes indicateurs remontent bien. Tu peux à tout moment revoir ce que tu
          partages, ou tout effacer, depuis{" "}
          <Link href="/me/donnees" className="font-medium text-accent hover:underline">
            tes données partagées
          </Link>
          .
        </p>
      </section>
    );
  }

  if (state === "no_consent") {
    return (
      <section className="rounded-2xl border border-accent bg-soft p-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Il manque ton accord
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Rien n&apos;est partagé avec ton établissement pour l&apos;instant. En
          acceptant, tu partages <strong>uniquement des indicateurs</strong> :
          tes scores, les catégories de tes demandes, le nombre de prompts et
          l&apos;issue de chaque interception.{" "}
          <strong>Aucun texte de prompt n&apos;est concerné ici</strong> — ça se
          demande séparément, catégorie par catégorie, et ça se refuse.
        </p>
        <form action={ackAction} className="mt-4">
          <button
            type="submit"
            disabled={acking}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {acking ? "Patiente…" : "Accepter et activer le partage"}
          </button>
        </form>
        {ack.error && <p className="mt-2 text-sm text-danger">{ack.error}</p>}
        <p className="mt-3 text-xs text-muted">
          Révocable à tout moment depuis{" "}
          <Link href="/me/donnees" className="text-accent hover:underline">
            tes données partagées
          </Link>
          , avec effacement de ce qui a déjà été envoyé.
        </p>
      </section>
    );
  }

  // no_data / stale : l'accord est là, la donnée non.
  return (
    <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Ton extension
        </h2>
        <span className="rounded-full border border-card-border bg-soft px-2.5 py-0.5 text-xs text-muted">
          {state === "no_data" ? "Aucune donnée reçue" : `Silencieuse depuis ${fmtAgo(lastTs)}`}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {state === "no_data"
          ? "Ton accord est enregistré, mais rien n'est encore arrivé ici. Dans l'ordre : l'extension est-elle installée ? est-elle liée à ce compte (clique son icône, puis « Lier mon compte ») ?"
          : "Rien n'est arrivé depuis un moment. Si tu as continué à utiliser l'IA, ouvre le popup de l'extension : il affiche la raison exacte du blocage et le bouton qui le lève."}
      </p>
      <Link
        href="/install"
        className="mt-4 inline-block rounded-lg border border-card-border px-4 py-2 text-sm transition-colors hover:bg-soft"
      >
        Installer ou réinstaller l&apos;extension
      </Link>
    </section>
  );
}
