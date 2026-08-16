"use client";

import { useState, useTransition } from "react";
import { addEmbedOrigin, removeEmbedOrigin, rotateEmbedSecret } from "./embed-actions";

const WIDGETS = [
  { id: "class-progress", label: "Progression d'une classe", scope: "group" },
  { id: "student-progress", label: "Progression d'un élève", scope: "student" },
  { id: "outcome-mix", label: "Répartition des issues", scope: "group ou student" },
  { id: "rubric-averages", label: "Moyennes par rubrique", scope: "group ou student" },
];

export default function EmbedPanel({
  origins,
  hasMintKey,
}: {
  origins: string[];
  hasMintKey: boolean;
}) {
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Widgets embarquables
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Quatre graphiques prêts à poser dans un <code className="rounded bg-soft px-1 py-0.5 text-xs">&lt;iframe&gt;</code>,
        à vos couleurs. Votre serveur frappe un jeton court via{" "}
        <code className="rounded bg-soft px-1 py-0.5 text-xs">POST /api/v1/embed-tokens</code>{" "}
        et le passe dans l&apos;URL du widget.{" "}
        <strong className="text-foreground">
          Ces widgets n&apos;affichent que des indicateurs
        </strong>{" "}
        — jamais le texte d&apos;un prompt, d&apos;un dialogue ou d&apos;une
        réflexion, quels que soient les consentements.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {WIDGETS.map((w) => (
          <li key={w.id} className="rounded-xl border border-card-border bg-background p-3 text-sm">
            <p className="font-medium">{w.label}</p>
            <p className="font-mono text-xs text-muted">
              {w.id} · portée {w.scope}
            </p>
          </li>
        ))}
      </ul>

      {!hasMintKey && (
        <p className="mt-4 rounded-xl border border-card-border bg-soft p-3 text-sm text-muted">
          Aucune de vos clés API ne porte la permission{" "}
          <code className="rounded bg-background px-1 py-0.5 text-xs">embed:mint</code>.
          Créez-en une ci-dessus en cochant « Frapper des jetons d&apos;affichage ».
        </p>
      )}

      <div className="mt-6 border-t border-card-border pt-5">
        <h3 className="font-display text-sm font-semibold">Sites autorisés à les afficher</h3>
        <p className="mt-1 text-sm text-muted">
          Un widget ne s&apos;affiche que dans une page servie par l&apos;une de
          ces origines. Tant que la liste est vide, aucun site ne peut les
          encadrer — y compris le vôtre.
        </p>

        <form
          className="mt-3 flex flex-wrap gap-2"
          action={(fd) =>
            startTransition(async () => setMessage(await addEmbedOrigin(fd)))
          }
        >
          <input
            type="text"
            name="origin"
            required
            placeholder="https://ent.mon-lycee.fr"
            className="w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-card-border px-4 py-2 text-sm transition-colors hover:bg-soft disabled:opacity-50"
          >
            Autoriser ce site
          </button>
        </form>

        {origins.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {origins.map((o) => (
              <li
                key={o}
                className="flex items-center gap-2 rounded-full border border-card-border bg-background px-3 py-1 text-xs"
              >
                <span className="font-mono">{o}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => setMessage(await removeEmbedOrigin(o)))
                  }
                  className="text-muted transition-colors hover:text-danger disabled:opacity-50"
                  aria-label={`Retirer ${o}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t border-card-border pt-5">
        <h3 className="font-display text-sm font-semibold">En cas de fuite</h3>
        <p className="mt-1 text-sm text-muted">
          Révoquer la clé qui a frappé un jeton suffit à tuer les widgets
          qu&apos;elle a produits. Pour tout invalider d&apos;un coup, quelle
          que soit la clé, renouvelez le secret de signature.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Renouveler le secret ? Tous les widgets déjà affichés cesseront de fonctionner."))
              startTransition(async () => setMessage(await rotateEmbedSecret()));
          }}
          className="mt-3 rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
        >
          Renouveler le secret de signature
        </button>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.ok ? "text-success" : "text-danger"}`}>
          {message.message}
        </p>
      )}
    </section>
  );
}
