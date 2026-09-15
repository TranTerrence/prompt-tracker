"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * « Télécharger mon journal ».
 *
 * Comble un trou réel : un étudiant pouvait EFFACER son raisonnement (bouton de
 * purge sur /me/donnees) mais jamais l'emporter. Le CSV de la popup de
 * l'extension exporte `text` et pas `dialogue` ; le dashboard n'avait aucun
 * export côté élève. Portabilité au sens du RGPD, et accessoirement la seule
 * façon de garder une trace au-delà des 90 jours de rétention.
 *
 * Même format que l'export admin (séparateur « ; », BOM UTF-8) pour qu'Excel en
 * français l'ouvre sans manipulation. Le dialogue part en JSON dans sa colonne :
 * c'est une liste de paires, l'aplatir en texte perdrait l'appariement.
 *
 * La lecture passe par le client navigateur, donc sous RLS et au nom de
 * l'étudiant : cet export ne peut rendre que ses propres lignes.
 */

const COLUMNS = [
  "ts",
  "site",
  "category",
  "words",
  "outcome",
  "intercepted",
  "score_before",
  "score_after",
  "score_total",
  "rounds",
  "answers_count",
  "text",
  "dialogue",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function JournalExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const rows: Record<string, unknown>[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("prompt_events")
          .select(
            "ts, site, category, words, scores, intercepted, outcome, score_before, score_after, rounds, answers_count, text, dialogue",
          )
          .order("ts", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        rows.push(...((data ?? []) as Record<string, unknown>[]));
        if (!data || data.length < pageSize) break;
      }

      const lines = [COLUMNS.join(";")];
      for (const r of rows) {
        const scores = r.scores as { total?: number } | null;
        lines.push(
          [
            r.ts,
            r.site,
            r.category,
            r.words,
            r.outcome,
            r.intercepted,
            r.score_before,
            r.score_after,
            scores?.total ?? null,
            r.rounds,
            r.answers_count,
            r.text,
            r.dialogue ? JSON.stringify(r.dialogue) : null,
          ]
            .map(csvCell)
            .join(";"),
        );
      }

      const blob = new Blob(["﻿" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mon-journal-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="text-sm text-accent hover:underline disabled:opacity-50"
      >
        {busy ? "Préparation…" : "Télécharger mon journal (CSV)"}
      </button>
      <p className="mt-0.5 text-xs text-muted">
        Tes prompts et ton raisonnement, dialogue compris.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
