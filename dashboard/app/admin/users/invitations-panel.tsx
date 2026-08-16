"use client";

import { useState, useTransition } from "react";
import {
  inviteToGroup,
  resendInvitation,
  revokeInvitation,
  type InviteResult,
} from "./invitation-actions";
import type { InviteOutcome } from "@/lib/invitations";

export type InvitationRow = {
  id: string;
  email: string;
  display_name: string | null;
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

const STATUS_LABELS: Record<InviteOutcome["status"], string> = {
  invited: "Invité",
  already_member: "Déjà dans la classe",
  invalid: "Adresse invalide",
};

function stateOf(row: InvitationRow): { label: string; tone: string } {
  if (row.accepted_at) return { label: "Acceptée", tone: "text-success" };
  if (row.revoked_at) return { label: "Révoquée", tone: "text-muted" };
  if (Date.parse(row.expires_at) < Date.now())
    return { label: "Expirée", tone: "text-muted" };
  return { label: "En attente", tone: "text-foreground" };
}

/**
 * Invitations nominatives d'une classe.
 *
 * Le mode par défaut est « copier les liens », pas l'envoi d'e-mails : le SMTP
 * Supabase par défaut plafonne à quelques mails par heure, une classe de 30
 * échouerait silencieusement le jour de la rentrée. Les liens copiés-collés
 * dans un ENT n'ont aucune dépendance de délivrabilité.
 */
export default function InvitationsPanel({
  groupId,
  groupName,
  invitations,
}: {
  groupId: string;
  groupName: string;
  invitations: InvitationRow[];
}) {
  const [roster, setRoster] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invitedLinks = (result?.outcomes ?? []).filter((o) => o.url);

  function copy(text: string, message: string) {
    navigator.clipboard.writeText(text);
    setNotice(message);
  }

  return (
    <section className="space-y-5 rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Inviter dans {groupName}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Une adresse par ligne. Tu peux coller directement une liste de classe,
          au format <code className="rounded bg-soft px-1 py-0.5 text-xs">adresse</code> ou{" "}
          <code className="rounded bg-soft px-1 py-0.5 text-xs">adresse;Prénom Nom</code>.
        </p>
      </div>

      <textarea
        value={roster}
        onChange={(e) => setRoster(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={"lea.martin@lycee.fr;Léa Martin\nnoah.dubois@lycee.fr"}
        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !roster.trim()}
          onClick={() =>
            startTransition(async () => {
              setNotice(null);
              setResult(await inviteToGroup(groupId, roster));
            })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Patiente…" : "Créer les invitations"}
        </button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-muted" : "text-danger"}`}>
            {result.message}
          </span>
        )}
      </div>

      {result?.outcomes && result.outcomes.length > 0 && (
        <div className="space-y-3 rounded-xl border border-card-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Liens d&apos;invitation ({invitedLinks.length})
            </p>
            {invitedLinks.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copy(
                      invitedLinks.map((o) => `${o.email}\t${o.url}`).join("\n"),
                      "Liens copiés (adresse puis lien, une ligne par élève)."
                    )
                  }
                  className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
                >
                  Copier tous les liens
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copy(
                      ["email;lien", ...invitedLinks.map((o) => `${o.email};${o.url}`)].join("\n"),
                      "CSV copié."
                    )
                  }
                  className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground"
                >
                  Copier en CSV
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            Ces liens ne s&apos;afficheront plus : la base n&apos;en garde que
            l&apos;empreinte. Copie-les maintenant, ou relance l&apos;invitation
            plus tard pour en obtenir un nouveau.
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {result.outcomes.map((o) => (
              <li key={o.email} className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{o.email}</span>
                <span
                  className={
                    o.status === "invited" ? "text-success" : "text-muted"
                  }
                >
                  {STATUS_LABELS[o.status]}
                </span>
                {o.url && (
                  <button
                    type="button"
                    onClick={() => copy(o.url!, `Lien copié pour ${o.email}.`)}
                    className="text-accent hover:underline"
                  >
                    copier
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notice && <p className="text-sm text-success">{notice}</p>}

      {invitations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-card-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">Adresse</th>
                <th className="px-4 py-2.5 font-medium">État</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((row) => {
                const state = stateOf(row);
                const closed = Boolean(row.accepted_at);
                return (
                  <tr key={row.id} className="border-t border-card-border">
                    <td className="px-4 py-2.5">
                      {row.email}
                      {row.display_name && (
                        <span className="text-muted"> · {row.display_name}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 ${state.tone}`}>{state.label}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!closed && (
                        <span className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const res = await resendInvitation(row.id, groupId);
                                if (res.url) copy(res.url, `${res.message} Lien copié.`);
                                else setNotice(res.message);
                              })
                            }
                            className="text-xs text-accent hover:underline disabled:opacity-50"
                          >
                            Relancer
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const res = await revokeInvitation(row.id, groupId);
                                setNotice(res.message);
                              })
                            }
                            className="text-xs text-muted hover:text-danger disabled:opacity-50"
                          >
                            Révoquer
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
