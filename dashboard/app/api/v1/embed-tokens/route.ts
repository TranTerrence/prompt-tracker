import { bearerOf, callApiRpc, errorResponse } from "@/lib/api/rpc";
import { originOf } from "@/lib/invitations";

/**
 * Frappe un jeton d'affichage pour un widget embarquable.
 *
 * Seul endpoint POST de l'API v1, et il ne persiste RIEN : il signe une
 * capacité de lecture à durée de vie courte. Le reste de l'API reste en
 * lecture seule.
 *
 * À appeler depuis VOTRE serveur, à chaque rendu de page : la clé
 * `pt_live_…` ne doit jamais atteindre un navigateur, et frapper le jeton au
 * dernier moment borne l'impact d'une fuite à sa durée de vie.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const scope = (body.scope ?? {}) as { type?: string; id?: string };
  const result = await callApiRpc("api_embed_token", {
    p_key: bearerOf(req),
    p_widget: body.widget,
    p_scope_type: scope.type,
    p_scope_id: scope.id ?? null,
    p_ttl: body.ttl ?? null,
    p_theme: body.theme ?? "auto",
    p_lang: body.lang ?? "fr",
  });
  if (result.error) return errorResponse(result.error);

  const data = result.data as { token: string; expires_at: string };
  return Response.json({
    ...data,
    // L'URL prête à poser dans un <iframe src>, pour éviter que chaque
    // intégrateur la reconstruise (et se trompe de chemin).
    url: `${await originOf()}/embed/${body.widget}?token=${encodeURIComponent(data.token)}`,
  });
}
