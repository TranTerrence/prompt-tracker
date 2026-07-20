"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostEvent, PromptEvent } from "@/lib/types";

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
  "rounds",
  "answers_count",
  "conv_key",
  "text",
  "dialogue",
];

const POST_HEADERS = [
  "id",
  "client_event_id",
  "user_id",
  "ts",
  "site",
  "conv_key",
  "post_key",
  "category",
  "answered",
  "answer_words",
  "answer",
  "created_at",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Pagination par lots de 1000 lignes sur une table filtrée par org. */
async function fetchAll<T>(table: string, orgId: string): Promise<T[]> {
  const supabase = createClient();
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("org_id", orgId)
      .order("ts", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** Téléchargement d'un CSV (séparateur « ; », BOM UTF-8 pour Excel). */
function downloadCsv(lines: string[], basename: string) {
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${basename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportClient({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState<"events" | "post" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<{ kind: "events" | "post"; n: number } | null>(null);

  async function handleExport() {
    setLoading("events");
    setError(null);
    setCount(null);
    try {
      const events = await fetchAll<PromptEvent>("prompt_events", orgId);
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
            e.rounds,
            e.answers_count,
            e.conv_key,
            e.text,
            // Le dialogue n'existe en base que si l'utilisateur a consenti.
            e.dialogue ? JSON.stringify(e.dialogue) : "",
          ]
            .map(csvCell)
            .join(";")
        );
      }
      downloadCsv(lines, "prompt-tracker-events");
      setCount({ kind: "events", n: events.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function handlePostExport() {
    setLoading("post");
    setError(null);
    setCount(null);
    try {
      const posts = await fetchAll<PostEvent>("post_events", orgId);
      const lines = [POST_HEADERS.join(";")];
      for (const p of posts) {
        lines.push(
          [
            p.id,
            p.client_event_id,
            p.user_id,
            p.ts,
            p.site,
            p.conv_key,
            p.post_key,
            p.category,
            p.answered,
            p.answer_words,
            // La réponse n'existe en base que si l'utilisateur a consenti
            // (catégorie post_reflection) : les non-consentis sortent vides.
            p.answer,
            p.created_at,
          ]
            .map(csvCell)
            .join(";")
        );
      }
      downloadCsv(lines, "prompt-tracker-post-events");
      setCount({ kind: "post", n: posts.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Événements de prompts
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Télécharge tous les événements de prompts de ton organisation au format
          CSV (séparateur « ; », colonnes de scores aplaties). La génération se
          fait dans ton navigateur.
        </p>
        <button
          onClick={handleExport}
          disabled={loading !== null}
          className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading === "events" ? "Génération en cours…" : "Exporter en CSV"}
        </button>
        {count?.kind === "events" && (
          <p className="mt-3 text-sm text-success">
            Export terminé : {count.n} événement{count.n > 1 ? "s" : ""}.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Réflexions d&apos;après
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Les réflexions du miroir d&apos;après (reformulation, vérification,
          désaccord). Le texte des réponses n&apos;est présent que pour les
          étudiants qui ont consenti à le partager ; les autres lignes gardent
          leurs indicateurs, colonne « answer » vide.
        </p>
        <button
          onClick={handlePostExport}
          disabled={loading !== null}
          className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading === "post" ? "Génération en cours…" : "Exporter en CSV"}
        </button>
        {count?.kind === "post" && (
          <p className="mt-3 text-sm text-success">
            Export terminé : {count.n} réflexion{count.n > 1 ? "s" : ""}.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
