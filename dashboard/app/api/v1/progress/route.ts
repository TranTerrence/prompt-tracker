import { bearerOf, callApiRpc, errorResponse } from "@/lib/api/rpc";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const result = await callApiRpc("api_progress", {
    p_key: bearerOf(req),
    p_group: params.get("group_id"),
    p_user: params.get("user_id"),
    p_from: params.get("from"),
    p_to: params.get("to"),
  });
  if (result.error) return errorResponse(result.error);
  return Response.json({ data: result.data });
}
