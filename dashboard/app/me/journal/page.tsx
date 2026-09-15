import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contentExpired, fmtDateTime, linkStateOf } from "@/lib/stats";
import { splitCompiledPrompt } from "@/lib/prompt-split";
import { DialogueTurns } from "@/components/DialogueTurns";
import ExtensionPanel from "../extension-panel";
import JournalExport from "./export";
import {
  OUTCOME_LABELS,
  POST_KEY_LABELS,
  RETENTION_CONTENT_DAYS,
  RETENTION_EVENTS_MONTHS,
  type Consent,
  type OrgDataRequest,
  type PostEvent,
  type PromptEvent,
} from "@/lib/types";

export const metadata = { title: "Journal des échanges" };

const PAGE = 25;

type EventRow = Pick<
  PromptEvent,
  | "id"
  | "ts"
  | "site"
  | "category"
  | "words"
  | "scores"
  | "intercepted"
  | "outcome"
  | "score_before"
  | "score_after"
  | "rounds"
  | "answers_count"
  | "text"
  | "dialogue"
  | "conv_key"
>;

type PostRow = Pick<
  PostEvent,
  "id" | "ts" | "conv_key" | "post_key" | "answered" | "answer_words" | "answer"
>;

/**
 * Une clé de conversation REGROUPABLE.
 *
 * `conversationKey()` vaut `${site}:${location.pathname}`
 * (extension/src/adapters/factory.js) et `isNewConversation()` documente qu'au
 * moment où part le PREMIER message d'un fil, l'URL est encore une racine.
 * Tous les premiers prompts d'un étudiant portent donc la même clé
 * « chatgpt:/ » : les regrouper fabriquerait un fil géant qui n'existe pas.
 *
 * On ne garde donc que les clés dont le chemin porte un identifiant, c'est-à-dire
 * au moins deux segments non vides — ce qui écarte d'un coup toutes les
 * `rootPaths` des cinq adaptateurs (« / », « /new », « /chats », « /chat », « /app »).
 */
function groupableConvKey(key: string | null): string | null {
  if (!key) return null;
  const path = key.slice(key.indexOf(":") + 1);
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2 ? key : null;
}

/** En-têtes de fiche : ils dépendent de l'ISSUE, pas d'un gabarit unique. */
function headingsFor(outcome: EventRow["outcome"], compiled: boolean) {
  switch (outcome) {
    case "improved":
      return { draft: "Ton premier jet", dialogue: "Ta réflexion", sent: compiled ? "Ce que tu as envoyé" : null };
    case "sent_anyway":
      // Ni éloge ni reproche : l'étudiant a réfléchi, puis il a choisi.
      // Les deux faits appartiennent à la fiche.
      return {
        draft: "Ce que tu as écrit, et envoyé tel quel",
        dialogue: "Ta réflexion, posée mais pas intégrée à l'envoi",
        sent: null,
      };
    case "cancelled":
      return { draft: "Ce que tu allais envoyer", dialogue: "Ta réflexion", sent: null };
    default:
      return { draft: "Ton prompt", dialogue: "Ta réflexion", sent: null };
  }
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { userId, org } = await requireSession();
  const supabase = await createClient();

  const raw = Number.parseInt((await searchParams).p ?? "1", 10);
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  const from = (page - 1) * PAGE;

  // On tire PAGE + 1 lignes : la ligne surnuméraire dit s'il existe une page
  // suivante, ce qui évite un count exact (second parcours complet sous RLS).
  const [{ data: eventData }, { data: requestData }, { data: consentData }, { data: profileData }] =
    await Promise.all([
      supabase
        .from("prompt_events")
        .select(
          "id, ts, site, category, words, scores, intercepted, outcome, score_before, score_after, rounds, answers_count, text, dialogue, conv_key",
        )
        .eq("user_id", userId)
        .order("ts", { ascending: false })
        .range(from, from + PAGE),
      supabase.from("org_data_requests").select("category, requested").eq("org_id", org.id),
      supabase.from("consents").select("category, granted").eq("user_id", userId),
      supabase.from("profiles").select("baseline_consent_at").eq("id", userId).maybeSingle(),
    ]);

  const fetched = (eventData ?? []) as EventRow[];
  const hasNext = fetched.length > PAGE;
  const events = fetched.slice(0, PAGE);

  // Les réflexions d'après, bornées à la FENÊTRE de la page. Une limite aveugle
  // ramènerait, en page 7, les réflexions du mauvais mois : c'est pourquoi
  // cette lecture est séquentielle et non parallèle.
  let posts: PostRow[] = [];
  if (events.length) {
    const { data } = await supabase
      .from("post_events")
      .select("id, ts, conv_key, post_key, answered, answer_words, answer")
      .eq("user_id", userId)
      .lte("ts", events[0].ts)
      .gte("ts", events[events.length - 1].ts)
      .order("ts", { ascending: false });
    posts = (data ?? []) as PostRow[];
  }

  const requests = (requestData ?? []) as Pick<OrgDataRequest, "category" | "requested">[];
  const consents = (consentData ?? []) as Pick<Consent, "category" | "granted">[];
  const asks = (c: string) => requests.some((r) => r.category === c && r.requested);
  const grants = (c: string) => consents.some((k) => k.category === c && k.granted);

  // `enforce_consent` est un trigger BEFORE INSERT : révoquer n'efface PAS les
  // lignes déjà écrites. L'API v1 s'en protège en filtrant à la lecture
  // (0011_api_rpcs.sql) ; on fait pareil ici. C'est sur sa propre page qu'un
  // étudiant serait le plus choqué de relire ce qu'il vient de révoquer.
  const showText = asks("prompt_text") && grants("prompt_text");
  const showDialogue = asks("socratic_dialogue") && grants("socratic_dialogue");
  const showAnswer = asks("post_reflection") && grants("post_reflection");

  const linkState = linkStateOf(
    { baseline_consent_at: profileData?.baseline_consent_at ?? null },
    events.length > 0 ? events[0].ts : null,
  );

  // Combien de fois une clé regroupable apparaît sur la page : au-delà de une,
  // la fiche porte une puce « n-ième échange de ce fil ». Rien de plus — pas
  // de repli, pas d'imbrication, et jamais entre deux pages.
  const convRank = new Map<string, number>();
  const convSeen = new Map<string, number>();
  for (const e of [...events].reverse()) {
    const k = groupableConvKey(e.conv_key);
    if (!k) continue;
    convSeen.set(k, (convSeen.get(k) ?? 0) + 1);
    convRank.set(e.id, convSeen.get(k)!);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/me" className="text-sm text-accent hover:underline">
          ← Ma progression
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Journal des échanges</h1>
          <JournalExport />
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Tes prompts, et le raisonnement que tu as posé avant de les envoyer. Ton
          contenu est conservé {RETENTION_CONTENT_DAYS} jours, tes indicateurs{" "}
          {RETENTION_EVENTS_MONTHS} mois : passé ce délai il reste la ligne, la date et le
          score, plus le texte. Tu peux aussi tout effacer immédiatement depuis{" "}
          <Link href="/me/donnees" className="text-accent hover:underline">
            tes données partagées
          </Link>
          .
        </p>
      </div>

      {events.length === 0 && page === 1 && (
        <>
          <ExtensionPanel state={linkState} lastTs={null} />
          <p className="rounded-2xl border border-card-border bg-card p-5 text-sm text-muted shadow-card">
            Rien à relire pour l&apos;instant. Ton journal se remplit à mesure que tu écris
            des prompts.
          </p>
        </>
      )}

      {events.length > 0 && !showText && !showDialogue && (
        <div className="rounded-2xl border border-card-border bg-soft p-5 text-sm shadow-card">
          {!asks("prompt_text") && !asks("socratic_dialogue") ? (
            <p>
              {org.brand_name || org.name} ne demande ni le texte de tes prompts ni ton
              raisonnement. Ce journal liste donc tes échanges — date, site, score, issue —
              sans leur contenu. Ce contenu n&apos;a jamais quitté ton ordinateur : il est
              dans l&apos;extension, où tu peux le consulter et l&apos;exporter.
            </p>
          ) : (
            <p>
              Tu n&apos;as pas accepté de partager le texte de tes prompts avec{" "}
              {org.brand_name || org.name}. C&apos;est ton droit, et ta courbe de progression
              n&apos;en dépend pas : ce journal reste lisible, sans le contenu. Si tu changes
              d&apos;avis depuis{" "}
              <Link href="/me/donnees" className="text-accent hover:underline">
                tes données partagées
              </Link>
              , le partage vaudra <strong>pour la suite</strong> — les échanges déjà envoyés
              resteront sans texte.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {events.map((e) => {
          const text = showText ? e.text : null;
          const dialogue = showDialogue ? e.dialogue : null;
          const split = text ? splitCompiledPrompt(text) : null;
          const headings = headingsFor(e.outcome, Boolean(split?.compiled));
          const rank = convRank.get(e.id);
          const convKey = groupableConvKey(e.conv_key);
          const mine = convKey
            ? posts.filter((p) => p.conv_key === convKey)
            : [];
          const score =
            e.intercepted && e.score_before !== null && e.score_after !== null
              ? `${e.score_before} → ${e.score_after}`
              : e.scores
                ? String(e.scores.total)
                : null;
          const tooOld = contentExpired(e.ts);

          return (
            <details
              key={e.id}
              className="group overflow-hidden rounded-2xl border border-card-border bg-card shadow-card"
            >
              <summary className="cursor-pointer list-none px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="tabular-nums">{fmtDateTime(e.ts)}</span>
                  {e.site && <span>{e.site}</span>}
                  {e.category && <span>{e.category}</span>}
                  {rank && rank > 1 && <span>{rank}ᵉ échange de ce fil</span>}
                  {e.outcome && (
                    <span className="font-medium text-ink">{OUTCOME_LABELS[e.outcome]}</span>
                  )}
                  {score && <span className="tabular-nums font-medium text-ink">{score}</span>}
                  {e.rounds ? <span>{e.rounds} tours</span> : null}
                </div>
                <p className="mt-1.5 truncate text-sm">
                  {split ? (
                    split.draft
                  ) : (
                    <span className="text-muted italic">
                      {e.words
                        ? `${e.words} mots, texte non conservé`
                        : "texte non conservé"}
                    </span>
                  )}
                </p>
              </summary>

              <div className="border-t border-card-border px-5 pb-5 pt-4 text-sm">
                {split ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      {headings.draft}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl border border-card-border bg-background p-4">
                      {split.draft}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    {tooOld
                      ? `Contenu effacé après ${RETENTION_CONTENT_DAYS} jours (conservation).`
                      : "Contenu non conservé : soit il n'était pas partagé au moment de l'envoi, soit tu l'as effacé depuis."}
                  </p>
                )}

                {dialogue && dialogue.length > 0 && (
                  <DialogueTurns turns={dialogue} title={headings.dialogue} />
                )}

                {split?.compiled && headings.sent && (
                  <details className="mt-3 border-t border-card-border pt-3">
                    <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted">
                      {headings.sent}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl border border-card-border bg-background p-4 text-sm">
                      {text}
                    </p>
                  </details>
                )}

                {mine.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-card-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      Miroir d&apos;après
                    </p>
                    {mine.map((p) => (
                      <div key={p.id}>
                        <p className="text-xs text-muted">{POST_KEY_LABELS[p.post_key] ?? p.post_key}</p>
                        {showAnswer && p.answer ? (
                          <p className="whitespace-pre-wrap text-sm">{p.answer}</p>
                        ) : (
                          <p className="text-sm text-muted italic">
                            {p.answered
                              ? `répondue (${p.answer_words ?? 0} mots, texte non conservé)`
                              : "non répondue"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {e.scores && (
                  <p className="mt-3 border-t border-card-border pt-3 text-xs tabular-nums text-muted">
                    Clarté {e.scores.clarte} · Contexte {e.scores.contexte} · Itération{" "}
                    {e.scores.iteration} · Esprit critique {e.scores.critique}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/me/journal?p=${page - 1}`} className="text-accent hover:underline">
              ← Plus récents
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted tabular-nums">Page {page}</span>
          {hasNext ? (
            <Link href={`/me/journal?p=${page + 1}`} className="text-accent hover:underline">
              Plus anciens →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
