"use client";

import { useActionState, useState } from "react";
import { purgeContent, saveConsents, type ConsentState, type PurgeState } from "./actions";
import { CONSENT_LABELS, type ConsentCategory, type OrgDataRequest } from "@/lib/types";

// Mêmes descriptions que l'écran de consentement de l'extension : une seule
// promesse, formulée une seule fois. Si ce texte change, il change des deux
// côtés (extension/src/i18n.js, clés cat*Desc).
const CATEGORY_DESCRIPTIONS: Record<ConsentCategory, string> = {
  prompt_text: "Ce que tu écris à l'IA, mot pour mot.",
  socratic_dialogue:
    "Tes réponses aux questions du dialogue : ta réflexion avant l'envoi.",
  post_reflection:
    "Tes reformulations et vérifications après les réponses de l'IA.",
  conversation_history:
    "Le regroupement de tes prompts par conversation (jamais le contenu des réponses de l'IA).",
};

export default function ConsentForm({
  orgName,
  requests,
  granted,
}: {
  orgName: string;
  requests: OrgDataRequest[];
  granted: Record<string, boolean>;
}) {
  const [state, formAction, saving] = useActionState<ConsentState, FormData>(
    saveConsents,
    { error: null, saved: false }
  );
  const [purge, setPurge] = useState<PurgeState | null>(null);
  const [purging, setPurging] = useState(false);

  const asked = requests.filter((r) => r.requested);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Toujours partagé
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Scores de qualité, catégories de prompts, nombres de mots, sites
          utilisés, issues (envoyé, amélioré, annulé) et dates,{" "}
          <strong className="text-foreground">jamais aucun contenu</strong>.
          C&apos;est ce qui alimente ta courbe de progression.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Conservation : les contenus partagés sont effacés au bout de 90 jours,
          les indicateurs au bout de 12 mois. Tu peux tout effacer avant, à tout
          moment.
        </p>
      </section>

      {asked.length === 0 ? (
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Contenu
          </h2>
          <p className="mt-2 text-sm text-muted">
            {orgName} ne demande aucun contenu. Rien d&apos;autre que les
            indicateurs ne quitte ton navigateur.
          </p>
        </section>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="space-y-3">
            {asked.map((r) => (
              <label
                key={r.category}
                className="flex cursor-pointer items-start gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-card transition-colors hover:bg-soft/40"
              >
                <input
                  type="checkbox"
                  name={r.category}
                  defaultChecked={Boolean(granted[r.category])}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="space-y-1">
                  <span className="block font-medium">
                    {CONSENT_LABELS[r.category]}
                  </span>
                  <span className="block text-sm text-muted">
                    {CATEGORY_DESCRIPTIONS[r.category]}
                  </span>
                  {r.purpose && (
                    <span className="block text-sm text-muted">
                      <strong className="text-foreground">
                        Pourquoi {orgName} le demande :
                      </strong>{" "}
                      {r.purpose}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Patiente…" : "Enregistrer mes choix"}
            </button>
            {state.saved && <span className="text-sm text-success">Choix enregistrés ✓</span>}
            {state.error && <span className="text-sm text-danger">{state.error}</span>}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Décocher révoque : le contenu correspondant cesse d&apos;être
            accessible, y compris l&apos;historique déjà envoyé.
          </p>
        </form>
      )}

      <section className="rounded-2xl border border-danger/30 bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Droit à l&apos;effacement
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Efface définitivement le contenu déjà partagé (textes, raisonnements,
          fils de conversation, réflexions). Tes indicateurs et tes scores
          restent : ta courbe de progression n&apos;est pas affectée.
        </p>
        <button
          type="button"
          disabled={purging}
          onClick={async () => {
            if (
              !confirm(
                "Effacer définitivement le contenu déjà partagé ? Tes indicateurs et scores restent."
              )
            )
              return;
            setPurging(true);
            setPurge(await purgeContent());
            setPurging(false);
          }}
          className="mt-4 rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          {purging ? "Effacement…" : "Effacer le contenu déjà partagé"}
        </button>
        {purge?.purged !== null && purge?.purged !== undefined && (
          <p className="mt-2 text-sm text-success">
            Contenu effacé ({purge.purged} élément(s)). Tes indicateurs sont
            conservés.
          </p>
        )}
        {purge?.error && <p className="mt-2 text-sm text-danger">{purge.error}</p>}
      </section>
    </div>
  );
}
