"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CONSENT_CATEGORIES,
  CONSENT_LABELS,
  QUESTION_AXES,
  QUESTION_BANK,
  QUESTION_BANK_KEYS,
  bankByAxis,
  type ConsentCategory,
  type Organization,
  type OrgDataRequest,
  type SocraticTemplate,
} from "@/lib/types";

type TemplateState = { question: string; active: boolean };
type RequestState = { requested: boolean; purpose: string };

const CONSENT_HINTS: Record<ConsentCategory, string> = {
  prompt_text: "Ce que l'utilisateur écrit à l'IA, mot pour mot.",
  socratic_dialogue: "Ses réponses aux questions du dialogue : son raisonnement.",
  post_reflection: "Ses reformulations et vérifications après les réponses de l'IA.",
  conversation_history: "Le regroupement de ses prompts par conversation.",
};

export default function SettingsForm({
  org,
  templates,
  dataRequests,
}: {
  org: Organization;
  templates: SocraticTemplate[];
  dataRequests: OrgDataRequest[];
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(org.brand_name ?? "");
  const [brandColor, setBrandColor] = useState(org.brand_color ?? "#0060A0");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(org.threshold ?? 50);
  const [llmEnabled, setLlmEnabled] = useState(org.llm_enabled);
  const [interceptEnabled, setInterceptEnabled] = useState(org.intercept_enabled);
  const [showScore, setShowScore] = useState(org.show_score !== false);
  const [libraryUrl, setLibraryUrl] = useState(org.library_url ?? "");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [requests, setRequests] = useState<Record<ConsentCategory, RequestState>>(() => {
    const state = {} as Record<ConsentCategory, RequestState>;
    for (const cat of CONSENT_CATEGORIES) {
      const existing = dataRequests.find((r) => r.category === cat);
      state[cat] = {
        requested: existing?.requested ?? false,
        purpose: existing?.purpose ?? "",
      };
    }
    return state;
  });
  // Toute la banque est adressable, pas seulement les cinq clés historiques.
  // Un champ vide = on garde la formulation du produit ; c'est déjà le
  // comportement de l'extension (`templates[key] || formulation par défaut`).
  const [tpl, setTpl] = useState<Record<string, TemplateState>>(() => {
    const state: Record<string, TemplateState> = {};
    for (const key of QUESTION_BANK_KEYS) {
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
    // La base porte la même contrainte (0024) : la dire ici évite un message
    // d'erreur Postgres brut à quelqu'un qui a simplement oublié le « s ».
    const url = libraryUrl.trim();
    if (url && !url.startsWith("https://")) {
      setLibraryError("L'URL de la bibliothèque doit commencer par https://");
      return;
    }
    setLibraryError(null);
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

      // 2. Mise à jour de l'organisation (capture_mode est déprécié : les
      // demandes de données ci-dessous le remplacent, il n'est plus modifié)
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          brand_name: brandName || null,
          brand_color: brandColor,
          logo_url: logoUrl,
          threshold,
          llm_enabled: llmEnabled,
          intercept_enabled: interceptEnabled,
          show_score: showScore,
          library_url: libraryUrl.trim() || null,
        })
        .eq("id", org.id);
      if (orgError) {
        setMessage({ ok: false, text: `Échec de la mise à jour : ${orgError.message}` });
        return;
      }

      // 2 bis. Demandes de données (le maximum demandé ; chaque utilisateur
      // reste libre de consentir en dessous)
      const requestRows = CONSENT_CATEGORIES.map((cat) => ({
        org_id: org.id,
        category: cat,
        requested: requests[cat].requested,
        purpose: requests[cat].purpose || null,
        updated_at: new Date().toISOString(),
      }));
      const { error: reqError } = await supabase
        .from("org_data_requests")
        .upsert(requestRows, { onConflict: "org_id,category" });
      if (reqError) {
        setMessage({ ok: false, text: `Échec des demandes de données : ${reqError.message}` });
        return;
      }

      // 3. Upsert des questions socratiques.
      // On n'écrit QUE les clés réellement personnalisées, plus celles qui
      // l'étaient et ne le sont plus (désactivées pour que la formulation du
      // produit reprenne la main). Sans ce filtre, chaque enregistrement
      // sèmerait une soixantaine de lignes vides par organisation.
      const rows = QUESTION_BANK_KEYS.filter(
        (key) => tpl[key].question.trim() || templates.some((t) => t.key === key)
      ).map((key) => {
        const question = tpl[key].question.trim();
        return {
          org_id: org.id,
          key,
          question,
          active: tpl[key].active && Boolean(question),
        };
      });
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

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showScore}
                onChange={(e) => setShowScore(e.target.checked)}
                className="accent-accent"
              />
              Afficher le score aux utilisateurs
            </label>
            <p className="mt-1 text-xs text-muted">
              Décoché : l&apos;extension n&apos;affiche plus aucun chiffre — ni le
              total sur 100, ni les rubriques sur 25, ni le seuil, ni la
              tendance. Le score reste calculé, synchronisé et disponible dans
              votre API et vos exports : c&apos;est l&apos;écran de
              l&apos;étudiant qui se tait, pas la mesure.
            </p>
          </div>

          <div>
            <label htmlFor="library-url" className="mb-1.5 block text-sm text-muted">
              Bibliothèque de prompts (URL)
            </label>
            <input
              id="library-url"
              type="url"
              value={libraryUrl}
              onChange={(e) => setLibraryUrl(e.target.value)}
              placeholder="https://exemple.edu/api/prompt-library.json"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
            {libraryError && (
              <p className="mt-1 text-xs text-danger">{libraryError}</p>
            )}
            <p className="mt-1 text-xs text-muted">
              Renseignée, l&apos;extension propose vos prompts à
              l&apos;ouverture du dialogue. Elle lit cette URL{" "}
              <strong>sans aucune identité</strong> (aucun compte, aucun
              jeton, aucun cookie) et seulement après que l&apos;utilisateur a
              accordé la permission, qu&apos;il peut refuser. Format attendu :
              voir <code>docs/INTEGRATION.md</code>.
            </p>
          </div>
        </div>
      </section>

      {/* Données demandées (consentement hybride) */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Données demandées aux utilisateurs
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Vous définissez ici le maximum que votre organisation demande. Chaque
          utilisateur voit ces demandes (avec votre justification) et reste
          libre de refuser, catégorie par catégorie. Les indicateurs et scores
          sont toujours collectés ; seul le contenu est soumis à consentement.
        </p>
        <div className="mt-4 space-y-4">
          {CONSENT_CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="rounded-xl border border-card-border bg-background p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{CONSENT_LABELS[cat]}</p>
                  <p className="text-xs text-muted">{CONSENT_HINTS[cat]}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requests[cat].requested}
                    onChange={(e) =>
                      setRequests((s) => ({
                        ...s,
                        [cat]: { ...s[cat], requested: e.target.checked },
                      }))
                    }
                    className="accent-accent"
                  />
                  demander
                </label>
              </div>
              {requests[cat].requested && (
                <input
                  type="text"
                  value={requests[cat].purpose}
                  onChange={(e) =>
                    setRequests((s) => ({
                      ...s,
                      [cat]: { ...s[cat], purpose: e.target.value },
                    }))
                  }
                  placeholder="Pourquoi le demandez-vous ? (affiché à l'utilisateur)"
                  className="mt-3 w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Questions socratiques */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Questions socratiques
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Les {QUESTION_BANK.length} questions de la banque, groupées par axe de
          raisonnement. Laissez un champ vide pour garder la formulation du
          produit ; votre texte la remplace dès qu&apos;il est enregistré, dans
          les deux langues. Les questions marquées d&apos;une catégorie ne sont
          posées que sur les prompts de cette catégorie ; le niveau indique
          l&apos;exigence croissante (1 clarifier, 2 approfondir, 3 challenger).
        </p>
        <div className="mt-4 space-y-3">
          {QUESTION_AXES.map((axis) => {
            const questions = bankByAxis(axis.key);
            const custom = questions.filter((q) => tpl[q.key].question.trim()).length;
            return (
              <details
                key={axis.key}
                className="rounded-xl border border-card-border bg-background/40 px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {axis.label}{" "}
                  <span className="text-xs font-normal text-muted">
                    — {questions.length} question{questions.length > 1 ? "s" : ""}
                    {custom > 0 && `, ${custom} personnalisée${custom > 1 ? "s" : ""}`}
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  {questions.map((q) => (
                    <div key={q.key}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor={`tpl-${q.key}`} className="text-xs text-muted">
                          <code className="text-foreground">{q.key}</code> · niveau{" "}
                          {q.level}
                          {q.cats && ` · ${q.cats.join(", ")}`}
                          {q.profiles && ` · ${q.profiles.join(", ")}`}
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={tpl[q.key].active}
                            onChange={(e) =>
                              setTpl((st) => ({
                                ...st,
                                [q.key]: { ...st[q.key], active: e.target.checked },
                              }))
                            }
                            className="accent-accent"
                            disabled={!tpl[q.key].question.trim()}
                          />
                          utiliser ma version
                        </label>
                      </div>
                      <textarea
                        id={`tpl-${q.key}`}
                        rows={2}
                        value={tpl[q.key].question}
                        onChange={(e) =>
                          setTpl((st) => ({
                            ...st,
                            [q.key]: { ...st[q.key], question: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                        placeholder={q.question_fr}
                      />
                      <p className="mt-1 text-xs text-muted">EN : {q.question_en}</p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
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
