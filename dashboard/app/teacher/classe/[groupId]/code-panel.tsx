"use client";

import { useState, useTransition } from "react";
import { regenerateCode, setCodeActive, setCodeExpiry } from "./actions";

/**
 * Code et lien d'invitation de la classe, côté professeur.
 *
 * `join_code_expires_at` est câblé ici pour la première fois : la colonne
 * existait depuis 0004 mais aucune interface ne l'écrivait. Des liens partagés
 * dans un ENT en font une nécessité — un code de rentrée n'a pas de raison de
 * rester ouvert jusqu'en juin.
 */
export default function CodePanel({
  groupId,
  code,
  active,
  expiresAt,
  // Évalué côté serveur : « la date est-elle passée » dépend de l'instant, et
  // le lire pendant le rendu d'un composant est une impureté (react-hooks/purity).
  expired,
}: {
  groupId: string;
  code: string | null;
  active: boolean;
  expiresAt: string | null;
  expired: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expiry, setExpiry] = useState(expiresAt ? expiresAt.slice(0, 10) : "");

  const usable = Boolean(code) && active && !expired;

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const res = await fn();
      setNotice(res.message);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Lien d&apos;invitation
          </h2>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tracking-[0.2em] ${
              usable ? "" : "text-muted line-through"
            }`}
          >
            {code ?? "—"}
          </p>
          {!usable && code && (
            <p className="mt-1 text-xs text-danger">
              {expired ? "Ce code a expiré." : "Ce code est désactivé."} Personne
              ne peut rejoindre la classe.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !usable}
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
              setNotice("Lien d'invitation copié.");
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Copier le lien
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setCodeActive(groupId, !active))}
            className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
          >
            {active ? "Désactiver" : "Activer"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Régénérer le code ? Les liens déjà partagés cesseront de fonctionner."))
                run(() => regenerateCode(groupId));
            }}
            className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
          >
            Régénérer
          </button>
        </div>
      </div>

      {usable && (
        <p className="break-all rounded-lg bg-soft px-3 py-2 font-mono text-xs">
          /join/{code}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-card-border pt-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-muted">Valable jusqu&apos;au</span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="rounded-lg border border-card-border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setCodeExpiry(groupId, expiry || null))}
          className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
        >
          Enregistrer
        </button>
        {expiry && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setExpiry("");
              run(() => setCodeExpiry(groupId, null));
            }}
            className="text-sm text-muted underline hover:text-foreground disabled:opacity-50"
          >
            Sans limite
          </button>
        )}
      </div>

      {notice && <p className="text-sm text-success">{notice}</p>}
    </section>
  );
}
