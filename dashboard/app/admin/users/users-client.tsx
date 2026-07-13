"use client";

import { useState, useTransition } from "react";
import {
  CONSENT_LABELS,
  type Consent,
  type Group,
  type GroupMember,
  type OrgDataRequest,
  type Profile,
} from "@/lib/types";
import {
  addToGroup,
  attachUserByEmail,
  createGroup,
  regenerateGroupCode,
  removeFromGroup,
  setDisabled,
  setGroupCodeActive,
  setRole,
} from "./actions";

type Message = { ok: boolean; message: string } | null;

const ROLE_LABELS = { admin: "admin", teacher: "professeur", member: "membre" } as const;

export default function UsersClient({
  profiles,
  groups,
  members,
  consents,
  dataRequests,
  currentUserId,
}: {
  profiles: Profile[];
  groups: Group[];
  members: GroupMember[];
  consents: Consent[];
  dataRequests: OrgDataRequest[];
  currentUserId: string;
}) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.id ?? "");

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      setMessage(await fn());
    });
  }

  const groupMemberIds = new Set(
    members.filter((m) => m.group_id === selectedGroup).map((m) => m.user_id)
  );
  const nameOf = (p: Profile) => p.display_name || p.email || p.id;
  const group = groups.find((g) => g.id === selectedGroup);

  // Consentements par utilisateur, limités aux catégories que l'org demande.
  const requestedCategories = dataRequests.map((r) => r.category);
  const consentOf = (userId: string, category: string) =>
    consents.some((c) => c.user_id === userId && c.category === category && c.granted);

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Utilisateurs
      </h1>

      {message && (
        <p
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            message.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.message}
        </p>
      )}

      {/* Rattacher un utilisateur */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Rattacher un utilisateur
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          L&apos;utilisateur doit déjà avoir créé son compte (il apparaît alors
          « en attente »). Saisis son adresse e-mail pour le rattacher à ton
          organisation.
        </p>
        <form
          className="mt-4 flex flex-wrap gap-2"
          action={(fd) => run(() => attachUserByEmail(fd))}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="collegue@entreprise.com"
            className="w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Rattacher
          </button>
        </form>
      </section>

      {/* Liste des profils */}
      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <h2 className="border-b border-card-border px-5 py-4 font-display text-lg font-semibold tracking-tight">
          Membres de l&apos;organisation ({profiles.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-5 py-3 font-medium">Rôle</th>
                {requestedCategories.length > 0 && (
                  <th className="px-5 py-3 font-medium">Partage consenti</th>
                )}
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-card-border transition-colors hover:bg-soft/50"
                >
                  <td className="px-5 py-3">
                    <div className={p.disabled ? "opacity-50" : ""}>
                      <p>{nameOf(p)}</p>
                      {p.display_name && (
                        <p className="text-xs text-muted">{p.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {p.role === "admin" ? (
                      <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                        admin
                      </span>
                    ) : p.role === "teacher" ? (
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        professeur
                      </span>
                    ) : (
                      <span className="text-muted">membre</span>
                    )}
                  </td>
                  {requestedCategories.length > 0 && (
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {requestedCategories.map((cat) => {
                          const granted = consentOf(p.id, cat);
                          return (
                            <span
                              key={cat}
                              title={`${CONSENT_LABELS[cat]} : ${granted ? "consenti" : "refusé ou sans réponse"}`}
                              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                granted
                                  ? "bg-success/15 text-success"
                                  : "bg-soft text-muted line-through"
                              }`}
                            >
                              {CONSENT_LABELS[cat]}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3">
                    {p.disabled ? (
                      <span className="text-danger">désactivé</span>
                    ) : (
                      <span className="text-success">actif</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {p.id === currentUserId ? (
                      <span className="text-xs text-muted">(toi)</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={p.role}
                          disabled={pending}
                          onChange={(e) =>
                            run(() =>
                              setRole(p.id, e.target.value as "admin" | "teacher" | "member")
                            )
                          }
                          className="rounded-lg border border-card-border bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-accent disabled:opacity-50"
                        >
                          {(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map(
                            (role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          disabled={pending}
                          onClick={() => run(() => setDisabled(p.id, !p.disabled))}
                          className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
                        >
                          {p.disabled ? "Réactiver" : "Désactiver"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Groupes */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Groupes
        </h2>

        <form
          className="mt-4 flex flex-wrap gap-2"
          action={(fd) => run(() => createGroup(fd))}
        >
          <input
            type="text"
            name="name"
            required
            placeholder="Nom du nouveau groupe"
            className="w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-card-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Créer le groupe
          </button>
        </form>

        {groups.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="group-select" className="text-muted">
                Groupe :
              </label>
              <select
                id="group-select"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="rounded-lg border border-card-border bg-background px-3 py-1.5 outline-none transition-colors focus:border-accent"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {group && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-background p-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">
                    Code de classe
                  </p>
                  <p
                    className={`font-mono text-2xl font-semibold tracking-[0.2em] ${
                      group.join_code_active ? "" : "text-muted line-through"
                    }`}
                  >
                    {group.join_code ?? "—"}
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    disabled={pending || !group.join_code}
                    onClick={() => {
                      navigator.clipboard.writeText(group.join_code ?? "");
                      setMessage({ ok: true, message: "Code copié." });
                    }}
                    className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
                  >
                    Copier
                  </button>
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(() => setGroupCodeActive(group.id, !group.join_code_active))
                    }
                    className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
                  >
                    {group.join_code_active ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Régénérer le code ? L'ancien cessera de fonctionner."))
                        run(() => regenerateGroupCode(group.id));
                    }}
                    className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
                  >
                    Régénérer
                  </button>
                </div>
                <p className="w-full text-xs text-muted">
                  Les utilisateurs saisissent ce code dans l&apos;extension ou sur
                  la page d&apos;attente pour rejoindre l&apos;organisation et ce
                  groupe.
                </p>
              </div>
            )}

            <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border">
              {profiles.map((p) => {
                const inGroup = groupMemberIds.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-soft/50"
                  >
                    <span className={p.disabled ? "opacity-50" : ""}>
                      {nameOf(p)}
                      {inGroup && (
                        <span className="ml-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                          membre du groupe
                        </span>
                      )}
                    </span>
                    <button
                      disabled={pending || !selectedGroup}
                      onClick={() =>
                        run(() =>
                          inGroup
                            ? removeFromGroup(selectedGroup, p.id)
                            : addToGroup(selectedGroup, p.id)
                        )
                      }
                      className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-soft hover:text-foreground disabled:opacity-50"
                    >
                      {inGroup ? "Retirer" : "Ajouter"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Aucun groupe pour le moment.</p>
        )}
      </section>
    </div>
  );
}
