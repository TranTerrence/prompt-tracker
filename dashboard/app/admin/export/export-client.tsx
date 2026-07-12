"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PromptEvent } from "@/lib/types";

const HEADERS = [
  "id",
  "client_event_id",
  "user_id",
  "ts",
  "site",
  "category",
  "words",
  "score_clarte",
  "score_contexte",
  "score_iteration",
  "score_critique",
  "score_total",
  "intercepted",
  "outcome",
  "score_before",
  "score_after",
  "mirror_shown",
  "mirror_feedback",
  "text",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ExportClient({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    setCount(null);
    const supabase = createClient();

    try {
      // Pagination par lots de 1000 lignes
      const events: PromptEvent[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("prompt_events")
          .select("*")
          .eq("org_id", orgId)
          .order("ts", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) {
          setError(error.message);
          return;
        }
        events.push(...((data ?? []) as PromptEvent[]));
        if (!data || data.length < pageSize) break;
      }

      const lines = [HEADERS.join(";")];
      for (const e of events) {
        lines.push(
          [
            e.id,
            e.client_event_id,
            e.user_id,
            e.ts,
            e.site,
            e.category,
            e.words,
            e.scores?.clarte,
            e.scores?.contexte,
            e.scores?.iteration,
            e.scores?.critique,
            e.scores?.total,
            e.intercepted,
            e.outcome,
            e.score_before,
            e.score_after,
            e.mirror_shown,
            e.mirror_feedback,
            e.text,
          ]
            .map(csvCell)
            .join(";")
        );
      }

      // BOM UTF-8 pour une ouverture propre dans Excel
      const blob = new Blob(["﻿" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prompt-tracker-events-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setCount(events.length);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card">
      <p className="text-sm leading-relaxed text-muted">
        Télécharge tous les événements de prompts de ton organisation au format
        CSV (séparateur « ; », colonnes de scores aplaties). La génération se
        fait dans ton navigateur.
      </p>
      <button
        onClick={handleExport}
        disabled={loading}
        className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Génération en cours…" : "Exporter en CSV"}
      </button>
      {count !== null && (
        <p className="mt-3 text-sm text-success">
          Export terminé : {count} événement{count > 1 ? "s" : ""}.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
