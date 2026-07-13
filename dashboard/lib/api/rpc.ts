// Pont vers les RPC api_* : toute l'autorisation (hash de clé, scopes, rate
// limit, consentement) vit en SQL security definer. Ici : un simple fetch
// PostgREST avec la clé anon + le mapping des erreurs en statuts HTTP.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type RpcResult =
  | { data: unknown; error?: undefined }
  | { data?: undefined; error: { status: number; message: string } };

export async function callApiRpc(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = (body?.message as string) ?? "unknown_error";
    const status = raw.includes("invalid_key")
      ? 401
      : raw.includes("forbidden_scope")
        ? 403
        : raw.includes("rate_limited")
          ? 429
          : 500;
    const message = ["invalid_key", "forbidden_scope", "rate_limited"].find((m) =>
      raw.includes(m)
    );
    return { error: { status, message: message ?? "internal_error" } };
  }
  return { data: body };
}

export function bearerOf(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export function errorResponse(error: { status: number; message: string }) {
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: error.status === 429 ? { "Retry-After": "60" } : undefined,
    }
  );
}
