// Découpe un prompt compilé en son PREMIER JET et l'échafaudage que le dialogue
// socratique y a ajouté. C'est ce qui permet au journal de l'étudiant de montrer
// « voici ce que tu as écrit seul » à côté de « voici ce que tu as envoyé ».
//
// Pourquoi un parseur plutôt qu'une colonne : `content.js` ne stocke qu'un seul
// champ `text`. Pour l'issue `improved` il contient le prompt COMPILÉ, dont le
// premier jet est exactement le préfixe ; pour `sent`, `sent_anyway` et
// `cancelled` il contient le brouillon brut. Ce module doit donc rester
// agnostique à l'issue et se replier proprement sur « c'est le prompt, tel quel ».
//
// Portage de `stripScaffolding` (extension/src/scoring.js), avec la même
// discipline que `dayStreakInfo` dans lib/stats.ts : les deux implémentations
// doivent s'accorder. Ici l'accord est VÉRIFIÉ, pas seulement commenté :
// lib/prompt-split.test.ts charge le vrai scoring.js et compare les deux.

/** Miroir de COMPILE_HEADERS (extension/src/scoring.js). */
const COMPILE_HEADERS = ["Ma réflexion préalable :", "My prior reasoning:"];

/**
 * Miroir exact de la regex de `stripScaffolding` (scoring.js). La borne {1,40}
 * et l'espace AVANT les deux-points sont tous deux porteurs : les recopier à
 * l'identique garantit que les deux modules reconnaissent les mêmes lignes.
 */
const SCAFFOLD_LINE = /^\s*-\s([^:\n]{1,40})\s:\s(.*)$/;

export type PromptSplit = {
  /** Le premier jet : ce que l'étudiant a écrit avant tout coaching. */
  draft: string;
  /**
   * Les réponses injectées par le dialogue, dans l'ordre du prompt compilé.
   * Cet ordre n'est PAS l'ordre chronologique des réponses : compilePrompt
   * remonte l'axe « hypothèse » et regroupe par libellé.
   */
  scaffolding: { label: string; answer: string }[];
  /** L'en-tête reconnu, ou null si le texte n'a pas la forme compilée. */
  header: string | null;
  /** false ⇒ la seule lecture honnête est « c'est le prompt, tel quel ». */
  compiled: boolean;
};

export function splitCompiledPrompt(text: string): PromptSplit {
  const asIs: PromptSplit = { draft: text, scaffolding: [], header: null, compiled: false };
  if (!text) return asIs;

  const lines = text.split("\n");

  // La DERNIÈRE occurrence, pas la première : un étudiant peut légitimement
  // avoir écrit « Ma réflexion préalable : » dans son propre prompt, et
  // compilePrompt ajoute toujours son bloc À LA FIN.
  let at = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (COMPILE_HEADERS.includes(lines[i].trim())) {
      at = i;
      break;
    }
  }
  if (at === -1) return asIs;

  const scaffolding: { label: string; answer: string }[] = [];
  for (const raw of lines.slice(at + 1)) {
    const m = raw.match(SCAFFOLD_LINE);
    if (m) {
      scaffolding.push({ label: m[1], answer: m[2] });
    } else if (scaffolding.length) {
      // DIVERGENCE DÉLIBÉRÉE avec stripScaffolding, à ne pas « aligner ».
      // La zone de réponse de la modale est un textarea : une réponse peut
      // contenir des sauts de ligne, et compilePrompt les joint sans les
      // échapper. stripScaffolding s'en tire parce qu'il ne fait que retirer
      // des préfixes ligne à ligne ; ici on RECONSTRUIT, donc une ligne de
      // continuation doit être rattachée à la réponse précédente sous peine
      // de perdre du texte de l'étudiant.
      scaffolding[scaffolding.length - 1].answer += `\n${raw}`;
    }
  }

  // Un en-tête sans aucune ligne reconnue n'est pas un prompt compilé : c'est
  // l'étudiant qui a écrit cette phrase lui-même. Ne jamais fabriquer un
  // brouillon qui n'existe pas.
  if (!scaffolding.length) return asIs;

  return {
    draft: lines.slice(0, at).join("\n").trimEnd(),
    scaffolding,
    header: lines[at].trim(),
    compiled: true,
  };
}
