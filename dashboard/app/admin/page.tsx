import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  averageFirstDraft,
  computeAdminKpis,
  computeResponseKpis,
  fmt,
  fmtDuration,
  fmtPct,
} from "@/lib/stats";
import type { Group, Profile, PromptEvent } from "@/lib/types";

type EventRow = Pick<
  PromptEvent,
  | "user_id"
  | "ts"
  | "scores"
  | "intercepted"
  | "outcome"
  | "score_before"
  | "score_after"
  | "site"
  | "model"
  | "prompt_chars"
  | "response_chars"
  | "read_ms"
> & { rounds: number | null };

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ groupe?: string }>;
}) {
  const { org } = await requireAdmin();
  const { groupe } = await searchParams;
  const supabase = await createClient();

  const [profilesRes, groupsRes, eventsRes, postEventsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, role, disabled")
      .eq("org_id", org.id),
    supabase.from("groups").select("id, name").eq("org_id", org.id).order("name"),
    supabase
      .from("prompt_events")
      .select(
        "user_id, ts, scores, intercepted, outcome, score_before, score_after, rounds, site, model, prompt_chars, response_chars, read_ms"
      )
      .eq("org_id", org.id)
      .order("ts", { ascending: false })
      .limit(10000),
    supabase
      .from("post_events")
      .select("user_id, answered")
      .eq("org_id", org.id)
      .limit(10000),
  ]);

  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "email" | "display_name" | "role" | "disabled"
  >[];
  const groups = (groupsRes.data ?? []) as Pick<Group, "id" | "name">[];
  let events = (eventsRes.data ?? []) as EventRow[];
  let postEvents = (postEventsRes.data ?? []) as { user_id: string; answered: boolean }[];

  // Filtre par groupe
  let memberIds: Set<string> | null = null;
  if (groupe) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupe);
    memberIds = new Set((members ?? []).map((m) => m.user_id as string));
    events = events.filter((e) => memberIds!.has(e.user_id));
    postEvents = postEvents.filter((p) => memberIds!.has(p.user_id));
  }

  // KPIs
  const { total, avg, avgFirstDraft, last7, prev7, progression, interceptRate, outcomes, avgGain, avgRounds } =
    computeAdminKpis(events);
  const outcomeTotal = outcomes.improved + outcomes.sent_anyway + outcomes.cancelled;

  // Mesures post-réponse. Tout y est nullable : un site dont les sélecteurs
  // ne sont pas vérifiés ne mesure rien. `coverage` est le garde-fou — elle
  // chute quand un éditeur change son UI, bien avant qu'on s'en aperçoive.
  const resp = computeResponseKpis(events);

  // Miroir d'après : chaque ligne est une question réflexive montrée après
  // une réponse IA ; « answered » dit si l'étudiant y a effectivement répondu.
  const postTotal = postEvents.length;
  const postAnsweredRate =
    postTotal > 0 ? postEvents.filter((p) => p.answered).length / postTotal : null;

  // Tableau par utilisateur
  const shownProfiles = memberIds
    ? profiles.filter((p) => memberIds!.has(p.id))
    : profiles;
  const userRows = shownProfiles
    .map((p) => {
      const evs = events.filter((e) => e.user_id === p.id);
      const improved = evs.filter((e) => e.outcome === "improved").length;
      return {
        profile: p,
        count: evs.length,
        avg: averageFirstDraft(evs),
        improvedRate: evs.length > 0 ? improved / evs.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Vue d&apos;ensemble
        </h1>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label htmlFor="groupe" className="text-muted">
            Groupe :
          </label>
          <select
            id="groupe"
            name="groupe"
            defaultValue={groupe ?? ""}
            className="rounded-lg border border-card-border bg-card px-3 py-1.5 outline-none transition-colors focus:border-accent"
          >
            <option value="">Tous</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white transition hover:opacity-90"
          >
            Filtrer
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Premiers jets"
          value={fmt(avgFirstDraft)}
          sub="score avant tout coaching : la mesure de l'apprentissage"
        />
        <Kpi
          label="Progression des premiers jets (7 j)"
          value={
            progression === null
              ? ":"
              : `${progression >= 0 ? "+" : ""}${fmt(progression)}`
          }
          sub={`vs 7 jours précédents (${fmt(prev7)} → ${fmt(last7)})`}
        />
        <Kpi label="Prompts analysés" value={String(total)} />
        <Kpi label="Score après coaching" value={fmt(avg)} sub="sur 100, prompts envoyés" />
        <Kpi label="Taux d'interception" value={fmtPct(interceptRate)} />
        <Kpi
          label="Issues des interceptions"
          value={
            outcomeTotal === 0
              ? ":"
              : `${outcomes.improved} / ${outcomes.sent_anyway} / ${outcomes.cancelled}`
          }
          sub="améliorés / envoyés quand même / annulés"
        />
        <Kpi
          label="Gain moyen après amélioration"
          value={avgGain === null ? ":" : `+${fmt(avgGain)}`}
          sub="score après − score avant (prompts améliorés)"
        />
        <Kpi
          label="Tours de réflexion moyens"
          value={fmt(avgRounds)}
          sub="questions socratiques par prompt intercepté"
        />
        <Kpi
          label="Réflexions d'après"
          value={String(postTotal)}
          sub={
            postAnsweredRate === null
              ? "miroir d'après : reformuler, vérifier, oser le désaccord"
              : `${fmtPct(postAnsweredRate)} de réponses au miroir d'après`
          }
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Usage des réponses
          </h2>
          <p className="text-xs text-muted">
            {resp.coverage === null
              ? "aucun envoi mesuré"
              : `mesuré sur ${fmtPct(resp.coverage)} des ${resp.sent} envois`}
          </p>
        </div>

        {resp.coverage !== null && resp.coverage < 0.5 && (
          <p className="rounded-xl border border-card-border bg-card px-4 py-3 text-xs leading-relaxed text-muted">
            Moins de la moitié des envois produisent une mesure. C&apos;est
            normal sur les sites dont les repères d&apos;interface ne sont pas
            encore validés (Mistral, Grok) ; ailleurs, cela signale
            généralement qu&apos;un éditeur a modifié son interface.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Temps de lecture médian"
            value={fmtDuration(resp.medianReadMs)}
            sub="entre la fin d'une réponse et le prompt suivant du même fil"
          />
          <Kpi
            label="Réponses longues enchaînées"
            value={fmtPct(resp.quickReadRate)}
            sub="réponses de 600+ signes relancées en moins de 10 s : le signal de sur-dépendance"
          />
          <Kpi
            label="Longueur moyenne des réponses"
            value={resp.avgResponseChars === null ? ":" : `${Math.round(resp.avgResponseChars)}`}
            sub="signes. Sous-estimé quand la sortie part dans un panneau latéral (Canvas, Artifacts)"
          />
          <Kpi
            label="Facteur d'expansion"
            value={resp.expansion === null ? ":" : `× ${fmt(resp.expansion, 0)}`}
            sub="signes de réponse par signe de prompt"
          />
          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card sm:col-span-2">
            <p className="text-[13px] text-muted">Modèles utilisés</p>
            {resp.models.length === 0 ? (
              <p className="mt-2 font-display text-3xl font-medium tracking-tight">:</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {resp.models.slice(0, 6).map(({ model, n }) => (
                  <li key={model} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className={model === "autre" ? "text-muted" : ""}>
                      {model === "autre" ? "autre / non reconnu" : model}
                    </span>
                    <span className="tabular-nums text-muted">
                      {n} · {fmtPct(n / resp.models.reduce((s, m) => s + m.n, 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Le nom du modèle est normalisé contre une liste connue :
              « autre » regroupe les modèles trop récents et les agents
              personnalisés. Aucun libellé écrit par un utilisateur n&apos;est
              conservé.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Par utilisateur
          </h2>
          <Link
            href="/admin/users"
            className="text-sm font-medium text-accent hover:underline"
          >
            Gérer les utilisateurs →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-5 py-3 font-medium">Prompts</th>
                <th className="px-5 py-3 font-medium">Premiers jets</th>
                <th className="px-5 py-3 font-medium">% améliorés</th>
              </tr>
            </thead>
            <tbody>
              {userRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
                    Aucun utilisateur dans cette sélection.
                  </td>
                </tr>
              )}
              {userRows.map((row) => (
                <tr
                  key={row.profile.id}
                  className="border-t border-card-border transition-colors hover:bg-soft/50"
                >
                  <td className="px-5 py-3">
                    <span className={row.profile.disabled ? "line-through opacity-50" : ""}>
                      {row.profile.display_name || row.profile.email || row.profile.id}
                    </span>
                    {row.profile.role === "admin" && (
                      <span className="ml-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{row.count}</td>
                  <td className="px-5 py-3 tabular-nums">{fmt(row.avg)}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtPct(row.improvedRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
