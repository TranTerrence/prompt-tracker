import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { averageFirstDraft, averageScore, fmt, fmtDate } from "@/lib/stats";
import {
  OUTCOME_LABELS,
  POST_KEYS,
  POST_KEY_LABELS,
  type PostEvent,
  type Profile,
  type PromptEvent,
} from "@/lib/types";

type PostRow = Pick<
  PostEvent,
  "id" | "ts" | "site" | "post_key" | "answered" | "answer_words" | "answer"
>;

type EventRow = Pick<
  PromptEvent,
  | "id"
  | "ts"
  | "site"
  | "scores"
  | "intercepted"
  | "outcome"
  | "score_before"
  | "score_after"
  | "text"
  | "dialogue"
> & { rounds: number | null };

// Fiche étudiant côté professeur. La RLS garantit qu'un prof ne peut ouvrir
// que les étudiants de SES groupes (sinon : profil introuvable → 404).
// Le contenu (texte, raisonnement) n'existe en base QUE si l'étudiant a
// consenti : ce qui s'affiche ici a été partagé avec son accord.
export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, disabled")
    .eq("id", id)
    .maybeSingle<Pick<Profile, "id" | "email" | "display_name" | "role" | "disabled">>();
  if (!student) notFound();

  const [{ data }, { data: postData }] = await Promise.all([
    supabase
      .from("prompt_events")
      .select("id, ts, site, scores, intercepted, outcome, score_before, score_after, text, dialogue, rounds")
      .eq("user_id", id)
      .order("ts", { ascending: false })
      .limit(500),
    supabase
      .from("post_events")
      .select("id, ts, site, post_key, answered, answer_words, answer")
      .eq("user_id", id)
      .order("ts", { ascending: false })
      .limit(500),
  ]);
  const events = (data ?? []) as EventRow[];
  const postEvents = (postData ?? []) as PostRow[];
  const postAnswered = postEvents.filter((p) => p.answered).length;
  const postByKey = POST_KEYS.map((key) => ({
    key,
    label: POST_KEY_LABELS[key],
    count: postEvents.filter((p) => p.post_key === key).length,
  }));

  const shared = events.filter((e) => e.text || (e.dialogue && e.dialogue.length));
  const interceptions = events.filter((e) => e.intercepted).slice(0, 25);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/teacher" className="text-sm text-muted hover:text-foreground">
          ← Mes classes
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {student.display_name || student.email || student.id}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Premiers jets</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {fmt(averageFirstDraft(events))}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            score avant tout coaching : sa progression réelle
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Score après coaching</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {fmt(averageScore(events))}
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
          <p className="text-[13px] text-muted">Prompts analysés</p>
          <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
            {events.length}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <h2 className="border-b border-card-border px-5 py-4 font-display text-lg font-semibold tracking-tight">
          Dernières interceptions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Site</th>
                <th className="px-5 py-3 font-medium">Issue</th>
                <th className="px-5 py-3 font-medium">Tours</th>
                <th className="px-5 py-3 font-medium">Avant → après</th>
              </tr>
            </thead>
            <tbody>
              {interceptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Aucune interception pour le moment.
                  </td>
                </tr>
              )}
              {interceptions.map((e) => (
                <tr key={e.id} className="border-t border-card-border">
                  <td className="px-5 py-3 tabular-nums">{fmtDate(e.ts)}</td>
                  <td className="px-5 py-3 text-muted">{e.site ?? ":"}</td>
                  <td className="px-5 py-3">
                    {e.outcome ? OUTCOME_LABELS[e.outcome] ?? e.outcome : ":"}
                  </td>
                  <td className="px-5 py-3 text-muted tabular-nums">{e.rounds ?? ":"}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {typeof e.score_before === "number" ? e.score_before : ":"}
                    {" → "}
                    {typeof e.score_after === "number" ? e.score_after : ":"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-card">
        <div className="border-b border-card-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Miroir d&apos;après
          </h2>
          <p className="mt-1 text-sm text-muted">
            Les réflexions posées après les réponses de l&apos;IA : reformuler,
            vérifier, oser le désaccord. Le texte n&apos;apparaît que si
            l&apos;étudiant a consenti à le partager.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-b border-card-border px-5 py-4 sm:grid-cols-4">
          <div>
            <p className="text-[13px] text-muted">Réflexions</p>
            <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">
              {postEvents.length}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              dont {postAnswered} répondue{postAnswered > 1 ? "s" : ""}
            </p>
          </div>
          {postByKey.map((k) => (
            <div key={k.key}>
              <p className="text-[13px] text-muted">{k.label}</p>
              <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">
                {k.count}
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Réponse</th>
              </tr>
            </thead>
            <tbody>
              {postEvents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-muted">
                    Aucune réflexion pour le moment.
                  </td>
                </tr>
              )}
              {postEvents.slice(0, 20).map((p) => (
                <tr key={p.id} className="border-t border-card-border">
                  <td className="px-5 py-3 tabular-nums">{fmtDate(p.ts)}</td>
                  <td className="px-5 py-3">{POST_KEY_LABELS[p.post_key] ?? p.post_key}</td>
                  <td className="px-5 py-3">
                    {p.answered ? (
                      p.answer ? (
                        <span className="whitespace-pre-wrap">{p.answer}</span>
                      ) : (
                        <span className="text-muted">
                          répondue · contenu non partagé
                        </span>
                      )
                    ) : (
                      <span className="text-muted">passée</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Contenus partagés
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Ce que l&apos;étudiant a explicitement consenti à partager (prompts,
          raisonnement socratique). Il peut restreindre ou effacer à tout moment.
        </p>
        {shared.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Aucun contenu partagé : soit l&apos;étudiant n&apos;a pas donné son
            accord, soit l&apos;organisation ne le demande pas. Ses indicateurs
            ci-dessus restent la mesure de sa progression.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {shared.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-card-border bg-background p-4 text-sm"
              >
                <p className="text-xs text-muted">
                  {fmtDate(e.ts)} · {e.site ?? ""}
                </p>
                {e.text && <p className="mt-2 whitespace-pre-wrap">{e.text}</p>}
                {e.dialogue && e.dialogue.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-card-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      Raisonnement socratique
                    </p>
                    {e.dialogue.map((turn, i) => (
                      <div key={i}>
                        <p className="text-xs text-muted">{turn.q}</p>
                        <p className="text-sm">{turn.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
