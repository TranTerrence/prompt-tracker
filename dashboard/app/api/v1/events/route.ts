import { bearerOf, callApiRpc, errorResponse } from "@/lib/api/rpc";

// Curseur keyset opaque : base64("ts|id").
function decodeCursor(cursor: string | null): { ts: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString().split("|");
    return ts && id ? { ts, id } : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const cursor = decodeCursor(params.get("cursor"));

  const result = await callApiRpc("api_events", {
    p_key: bearerOf(req),
    p_since: params.get("since"),
    p_until: params.get("until"),
    p_group: params.get("group_id"),
    p_user: params.get("user_id"),
    p_cursor_ts: cursor?.ts ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: params.get("limit") ? Number(params.get("limit")) : null,
  });
  if (result.error) return errorResponse(result.error);

  const payload = result.data as {
    data: unknown[];
    next_cursor: { ts: string; id: string } | null;
  };
  return Response.json({
    data: payload.data,
    next_cursor: payload.next_cursor
      ? Buffer.from(`${payload.next_cursor.ts}|${payload.next_cursor.id}`).toString("base64url")
      : null,
  });
}
