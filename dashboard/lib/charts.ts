/**
 * Tracés SVG partagés, en chaînes pures.
 *
 * Les mêmes courbes sont rendues sur /me, /teacher et dans les iframes
 * embarquées. Sans une source commune, elles auraient divergé en quelques
 * mois. Les fonctions ne dépendent ni de React ni du DOM : la route /embed
 * renvoie du HTML sans JavaScript (CSP `default-src 'none'`), elle ne peut
 * pas monter de composant.
 *
 * Les couleurs sont passées en paramètre, jamais lues dans un thème global :
 * un widget porte la marque de l'organisation qui l'affiche.
 */

export type WeeklyPoint = { week: string; value: number | null };

export type LineChartOptions = {
  width?: number;
  height?: number;
  stroke: string;
  grid: string;
  muted: string;
  /** Étiquette lue par les lecteurs d'écran. */
  label: string;
};

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!
  );

/** Courbe des premiers jets par semaine, sur 100. */
export function weeklyLineChart(
  points: WeeklyPoint[],
  opts: LineChartOptions
): string {
  const w = opts.width ?? 640;
  const h = opts.height ?? 200;
  const pad = { top: 12, right: 12, bottom: 28, left: 34 };

  if (points.length === 0) {
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(opts.label)}">
      <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="${opts.muted}">Pas encore de données</text>
    </svg>`;
  }

  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + (1 - v / 100) * innerH;

  // `pen` gère les trous : une semaine sans donnée coupe le trait au lieu de
  // le faire passer tout droit par-dessus, ce qui inventerait une continuité.
  let d = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    pen = true;
  });

  const gridLines = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<line x1="${pad.left}" x2="${w - pad.right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${opts.grid}" stroke-width="1"/>` +
        `<text x="${pad.left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${opts.muted}">${v}</text>`
    )
    .join("");

  const dots = points
    .map((p, i) =>
      p.value === null
        ? ""
        : `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="${opts.stroke}"/>`
    )
    .join("");

  // Une étiquette sur cinq au plus : au-delà, elles se chevauchent.
  const step = Math.max(1, Math.ceil(points.length / 6));
  const labels = points
    .map((p, i) => {
      if (i % step !== 0) return "";
      const [, m, day] = p.week.split("-");
      return `<text x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="${opts.muted}">${day}/${m}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(opts.label)}">
    ${gridLines}
    <path d="${d}" fill="none" stroke="${opts.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${labels}
  </svg>`;
}

export type Bar = { label: string; value: number | null; max: number };

/** Barres horizontales : rubriques sur 25, répartitions d'issues. */
export function barList(bars: Bar[], opts: { fill: string; track: string; muted: string }): string {
  const rowH = 42;
  const w = 640;
  const h = Math.max(rowH, bars.length * rowH);
  const barW = 420;
  const left = w - barW;

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Répartition">
    ${bars
      .map((b, i) => {
        const yTop = i * rowH + 10;
        const ratio = b.value === null || b.max === 0 ? 0 : Math.max(0, Math.min(1, b.value / b.max));
        const shown = b.value === null ? "–" : String(Math.round(b.value * 10) / 10).replace(".", ",");
        return (
          `<text x="0" y="${yTop + 12}" font-size="13" fill="${opts.muted}">${escapeXml(b.label)}</text>` +
          `<text x="${left - 12}" y="${yTop + 12}" text-anchor="end" font-size="13" fill="${opts.muted}">${shown}</text>` +
          `<rect x="${left}" y="${yTop + 3}" width="${barW}" height="9" rx="4.5" fill="${opts.track}"/>` +
          `<rect x="${left}" y="${yTop + 3}" width="${(barW * ratio).toFixed(1)}" height="9" rx="4.5" fill="${opts.fill}"/>`
        );
      })
      .join("")}
  </svg>`;
}
