import { QUESTION_AXES } from "@/lib/types";

/**
 * Le fil question/réponse d'une interception, tel qu'il a été mené.
 *
 * Partagé entre la page enseignant et le journal de l'étudiant : c'est la seule
 * partie rigoureusement identique des deux écrans (le reste diffère de voix et
 * de chaque libellé), et donc la seule qui dériverait en silence si elle était
 * écrite deux fois.
 *
 * L'axe est affiché en surtitre. La page enseignant le jetait ; « Ma tentative »
 * ou « Comment je vérifierai » est pourtant ce qui rend relisible un dialogue de
 * trois mois, quand la question exacte ne dit plus rien à personne.
 */

const AXIS_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_AXES.map((a) => [a.key, a.label]),
);

export type DialogueTurn = { q: string; a: string; axis?: string };

export function DialogueTurns({
  turns,
  title = "Raisonnement socratique",
}: {
  turns: DialogueTurn[];
  title?: string;
}) {
  if (!turns.length) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-card-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      {turns.map((turn, i) => (
        <div key={i}>
          {turn.axis && AXIS_LABELS[turn.axis] && (
            <p className="text-xs font-medium text-muted">{AXIS_LABELS[turn.axis]}</p>
          )}
          <p className="text-xs text-muted">{turn.q}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{turn.a}</p>
        </div>
      ))}
    </div>
  );
}
