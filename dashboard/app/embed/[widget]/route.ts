import { callApiRpc } from "@/lib/api/rpc";
import { barList, weeklyLineChart } from "@/lib/charts";

export const dynamic = "force-dynamic";

/**
 * Rendu d'un widget embarquable.
 *
 * Route Handler et non `page.tsx` : les en-têtes doivent être DYNAMIQUES par
 * organisation (`frame-ancestors` dépend du jeton), or `next.config.ts`
 * headers() est statique et un composant de page ne contrôle pas ses en-têtes
 * de réponse.
 *
 * Le HTML est du SVG et du CSS en ligne, sans une ligne de JavaScript : rapide,
 * immunisé au XSS, et compatible avec un CSP `default-src 'none'`.
 */

type EmbedPayload = {
  widget: string;
  org: { name: string; brand_color: string | null; logo_url: string | null };
  theme: "auto" | "light" | "dark";
  lang: "fr" | "en";
  frame_ancestors: string[];
  generated_at: string;
  data: unknown;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

/** Une couleur de marque est écrite par un admin : ne jamais l'injecter brute. */
function safeColor(value: string | null, fallback: string): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

const TITLES: Record<string, Record<"fr" | "en", string>> = {
  "class-progress": { fr: "Premiers jets de la classe", en: "Class first drafts" },
  "student-progress": { fr: "Premiers jets", en: "First drafts" },
  "outcome-mix": { fr: "Issues des prompts", en: "Prompt outcomes" },
  "rubric-averages": { fr: "Moyennes par rubrique", en: "Rubric averages" },
};

const OUTCOMES: Record<string, Record<"fr" | "en", string>> = {
  sent: { fr: "Bon premier jet", en: "Good first draft" },
  improved: { fr: "Amélioré après dialogue", en: "Improved after dialogue" },
  sent_anyway: { fr: "Envoyé malgré l'alerte", en: "Sent despite the prompt" },
  cancelled: { fr: "Annulé", en: "Cancelled" },
};

const RUBRICS: Record<string, Record<"fr" | "en", string>> = {
  clarte: { fr: "Clarté", en: "Clarity" },
  contexte: { fr: "Contexte", en: "Context" },
  iteration: { fr: "Itération", en: "Iteration" },
  critique: { fr: "Esprit critique", en: "Critical thinking" },
};

// Le SVG référence les variables CSS plutôt que des couleurs littérales : le
// thème « auto » doit suivre prefers-color-scheme du site hôte, ce qu'une
// couleur figée au rendu serveur ne saurait pas faire.
const COLORS = {
  accent: "var(--accent)",
  border: "var(--border)",
  muted: "var(--muted)",
  soft: "var(--soft)",
};

function renderBody(payload: EmbedPayload): string {
  const colors = COLORS;
  const lang = payload.lang;
  const d = payload.data;

  if (payload.widget === "class-progress" || payload.widget === "student-progress") {
    const rows = (d ?? []) as { week: string; first_draft: number | null }[];
    return weeklyLineChart(
      rows.map((r) => ({ week: r.week, value: r.first_draft === null ? null : Number(r.first_draft) })),
      {
        stroke: colors.accent,
        grid: colors.border,
        muted: colors.muted,
        label: TITLES[payload.widget][lang],
      }
    );
  }

  if (payload.widget === "outcome-mix") {
    const counts = (d ?? {}) as Record<string, number>;
    const total = Object.values(counts).reduce((a, b) => a + Number(b), 0);
    const order = ["sent", "improved", "sent_anyway", "cancelled"];
    return barList(
      order.map((k) => ({
        label: OUTCOMES[k][lang],
        value: total === 0 ? 0 : (Number(counts[k] ?? 0) / total) * 100,
        max: 100,
      })),
      { fill: colors.accent, track: colors.soft, muted: colors.muted }
    );
  }

  const avgs = (d ?? {}) as Record<string, number | null>;
  return barList(
    ["clarte", "contexte", "iteration", "critique"].map((k) => ({
      label: RUBRICS[k][lang],
      value: avgs[k] === null || avgs[k] === undefined ? null : Number(avgs[k]),
      max: 25,
    })),
    { fill: colors.accent, track: colors.soft, muted: colors.muted }
  );
}

function page(payload: EmbedPayload): string {
  const accent = safeColor(payload.org.brand_color, "#0060a0");
  const light = {
    bg: "#faf7f0", card: "#ffffff", ink: "#1b1815", muted: "#6e655a",
    border: "#e5ded2", soft: "#f1ebe0", accent,
  };
  const dark = {
    bg: "#161311", card: "#211d19", ink: "#f3eee6", muted: "#9a9084",
    border: "#3a342c", soft: "#2a251f", accent,
  };
  const vars = (c: typeof light) =>
    Object.entries(c).map(([k, v]) => `--${k}:${v}`).join(";");

  // Le thème « auto » suit le site hôte via prefers-color-scheme ; un thème
  // explicite dans le jeton fige le rendu (certains ENT sont clairs en dur).
  const themeCss =
    payload.theme === "auto"
      ? `:root{${vars(light)}} @media (prefers-color-scheme: dark){:root{${vars(dark)}}}`
      : `:root{${vars(payload.theme === "dark" ? dark : light)}}`;

  const title = TITLES[payload.widget]?.[payload.lang] ?? payload.widget;

  return `<!doctype html>
<html lang="${payload.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${themeCss}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:14px/1.5 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;-webkit-font-smoothing:antialiased}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
h1{font:600 15px/1.3 system-ui,sans-serif;letter-spacing:.005em}
.sub{color:var(--muted);font-size:12px;margin-top:2px}
svg{width:100%;height:auto;display:block;margin-top:14px;overflow:visible}
footer{color:var(--muted);font-size:11px;margin-top:12px;text-align:right}
</style>
</head>
<body>
<div class="card">
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(payload.org.name)}</p>
  ${renderBody(payload)}
  <footer>Prompt Tracker</footer>
</div>
</body>
</html>`;
}

function errorPage(message: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>body{font:14px/1.5 system-ui,sans-serif;color:#6e655a;padding:24px;text-align:center}</style>
</head><body>${escapeHtml(message)}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Fail closed : une erreur ne doit pas devenir encadrable partout.
        "Content-Security-Policy": "frame-ancestors 'none'; default-src 'none'; style-src 'unsafe-inline'",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ widget: string }> }
) {
  const { widget } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return errorPage("Jeton manquant.", 400);

  const result = await callApiRpc("api_embed_data", { p_token: token });
  if (result.error) {
    return errorPage(
      result.error.message === "expired_token"
        ? "Ce widget a expiré. Rechargez la page qui l'affiche."
        : result.error.message === "rate_limited"
          ? "Trop de requêtes, réessayez dans une minute."
          : "Ce widget n'est pas accessible.",
      result.error.status
    );
  }

  const payload = result.data as EmbedPayload;
  // Le widget demandé dans l'URL doit être celui signé dans le jeton : sinon
  // un jeton de classe servirait à afficher n'importe quel autre widget.
  if (payload.widget !== widget) return errorPage("Ce widget n'est pas accessible.", 403);

  const ancestors = payload.frame_ancestors ?? [];
  return new Response(page(payload), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Fail closed : sans origine déclarée dans /admin/settings, le widget
      // n'est encadrable nulle part. Pas de X-Frame-Options : il n'a pas de
      // forme multi-origines et écraserait CSP sur les vieux moteurs.
      "Content-Security-Policy":
        `frame-ancestors ${ancestors.length > 0 ? ancestors.join(" ") : "'none'"}; ` +
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; " +
        "base-uri 'none'; form-action 'none'",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
