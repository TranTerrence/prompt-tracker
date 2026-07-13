"use client";

import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey } from "./api-keys-actions";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

// Clés API machine-to-machine : /api/v1/* (events, students, groups, progress).
// La clé complète n'est visible qu'à la création.
export default function ApiKeysPanel({ keys }: { keys: ApiKeyRow[] }) {
  const [pending, startTransition] = useTransition();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Clés API (accès machine)
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Pour brancher votre SI sur <code className="rounded bg-soft px-1 py-0.5 text-xs">/api/v1</code>{" "}
        (événements, étudiants, groupes, progression). L&apos;API ne renvoie que
        le contenu que chaque utilisateur consent à partager, au moment de
        l&apos;appel. 60 requêtes/minute par clé.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            setFreshKey(null);
            const res = await createApiKey(fd);
            if (res.ok) setFreshKey(res.key);
            else setError(res.message);
          })
        }
      >
        <input
          type="text"
          name="name"
          required
          placeholder="Nom de la clé (ex. SI pédagogique)"
          className="w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Créer une clé
        </button>
      </form>

      {freshKey && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-sm font-medium text-success">
            Clé créée. Copie-la maintenant : elle ne sera plus jamais affichée.
          </p>
          <code className="mt-2 block break-all rounded-lg bg-background px-3 py-2 font-mono text-sm">
            {freshKey}
          </code>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {keys.length > 0 && (
        <ul className="mt-5 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className={k.revoked_at ? "text-muted line-through" : "font-medium"}>
                  {k.name}
                </p>
                <p className="font-mono text-xs text-muted">
                  {k.key_prefix}… · {k.scopes.join(", ")}
                  {k.last_used_at &&
                    ` · dernier appel ${new Date(k.last_used_at).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              <div className="ml-auto">
                {k.revoked_at ? (
                  <span className="text-xs text-muted">révoquée</span>
                ) : (
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (confirm(`Révoquer « ${k.name} » ? Effet immédiat.`)) {
                          const res = await revokeApiKey(k.id);
                          if (!res.ok) setError(res.message);
                        }
                      })
                    }
                    className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
