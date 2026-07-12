"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SOCRATIC_KEYS,
  SOCRATIC_LABELS,
  type Organization,
  type SocraticTemplate,
} from "@/lib/types";

type TemplateState = { question: string; active: boolean };

export default function SettingsForm({
  org,
  templates,
}: {
  org: Organization;
  templates: SocraticTemplate[];
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(org.brand_name ?? "");
  const [brandColor, setBrandColor] = useState(org.brand_color ?? "#3E5C50");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(org.threshold ?? 50);
  const [captureMode, setCaptureMode] = useState<"metadata" | "full">(
    org.capture_mode ?? "metadata"
  );
  const [llmEnabled, setLlmEnabled] = useState(org.llm_enabled);
  const [interceptEnabled, setInterceptEnabled] = useState(org.intercept_enabled);
  const [tpl, setTpl] = useState<Record<string, TemplateState>>(() => {
    const state: Record<string, TemplateState> = {};
    for (const key of SOCRATIC_KEYS) {
      const existing = templates.find((t) => t.key === key);
      state[key] = {
        question: existing?.question ?? "",
        active: existing?.active ?? true,
      };
    }
    return state;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    try {
      let logoUrl = org.logo_url;

      // 1. Upload du logo si un fichier a été choisi
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${org.id}/logo-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) {
          setMessage({ ok: false, text: `Échec de l'upload du logo : ${uploadError.message}` });
          return;
        }
        logoUrl = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
      }

      // 2. Mise à jour de l'organisation
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          brand_name: brandName || null,
          brand_color: brandColor,
          logo_url: logoUrl,
          threshold,
          capture_mode: captureMode,
          llm_enabled: llmEnabled,
          intercept_enabled: interceptEnabled,
        })
        .eq("id", org.id);
      if (orgError) {
        setMessage({ ok: false, text: `Échec de la mise à jour : ${orgError.message}` });
        return;
      }

      // 3. Upsert des questions socratiques (une par clé)
      const rows = SOCRATIC_KEYS.map((key) => ({
        org_id: org.id,
        key,
        question: tpl[key].question,
        active: tpl[key].active,
      }));
      const { error: tplError } = await supabase
        .from("socratic_templates")
        .upsert(rows, { onConflict: "org_id,key" });
      if (tplError) {
        setMessage({
          ok: false,
          text: `Organisation enregistrée, mais échec des questions : ${tplError.message}`,
        });
        return;
      }

      setMessage({ ok: true, text: "Paramètres enregistrés." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <p
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            message.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Marque */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Marque (white-label)
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brand-name" className="mb-1.5 block text-sm text-muted">
              Nom de marque
            </label>
            <input
              id="brand-name"
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Prompt Tracker"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="brand-color" className="mb-1.5 block text-sm text-muted">
              Couleur d&apos;accent
            </label>
            <div className="flex items-center gap-3">
              <input
                id="brand-color"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-lg border border-card-border bg-background"
              />
              <span className="font-mono text-sm text-muted">{brandColor}</span>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="logo" className="mb-1.5 block text-sm text-muted">
              Logo (bucket public « logos »)
            </label>
            <div className="flex items-center gap-4">
              {org.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo_url}
                  alt="Logo actuel"
                  className="h-10 w-10 rounded-lg object-contain"
                />
              )}
              <input
                id="logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Comportement */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Comportement de l&apos;extension
        </h2>
        <div className="mt-4 space-y-5">
          <div>
            <label htmlFor="threshold" className="mb-1.5 block text-sm text-muted">
              Seuil d&apos;interception :{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {threshold}
              </span>{" "}
              / 100
            </label>
            <input
              id="threshold"
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <p className="mt-1 text-xs text-muted">
              Les prompts dont le score est inférieur à ce seuil sont interceptés.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm text-muted">Mode de capture</span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="capture_mode"
                  checked={captureMode === "metadata"}
                  onChange={() => setCaptureMode("metadata")}
                  className="accent-accent"
                />
                Métadonnées seulement
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="capture_mode"
                  checked={captureMode === "full"}
                  onChange={() => setCaptureMode("full")}
                  className="accent-accent"
                />
                Texte complet
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={llmEnabled}
              onChange={(e) => setLlmEnabled(e.target.checked)}
              className="accent-accent"
            />
            Analyse LLM activée
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={interceptEnabled}
              onChange={(e) => setInterceptEnabled(e.target.checked)}
              className="accent-accent"
            />
            Interception activée
          </label>
        </div>
      </section>

      {/* Questions socratiques */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Questions socratiques
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Personnalise la question posée pour chaque rubrique.
        </p>
        <div className="mt-4 space-y-4">
          {SOCRATIC_KEYS.map((key) => (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={`tpl-${key}`} className="text-sm text-muted">
                  {SOCRATIC_LABELS[key]}
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={tpl[key].active}
                    onChange={(e) =>
                      setTpl((s) => ({
                        ...s,
                        [key]: { ...s[key], active: e.target.checked },
                      }))
                    }
                    className="accent-accent"
                  />
                  active
                </label>
              </div>
              <textarea
                id={`tpl-${key}`}
                rows={2}
                value={tpl[key].question}
                onChange={(e) =>
                  setTpl((s) => ({
                    ...s,
                    [key]: { ...s[key], question: e.target.value },
                  }))
                }
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                placeholder={`Question pour la rubrique « ${SOCRATIC_LABELS[key]} »…`}
              />
            </div>
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
      </button>
    </form>
  );
}
