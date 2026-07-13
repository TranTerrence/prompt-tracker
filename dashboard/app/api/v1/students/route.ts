import { bearerOf, callApiRpc, errorResponse } from "@/lib/api/rpc";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const result = await callApiRpc("api_students", {
    p_key: bearerOf(req),
    p_group: params.get("group_id"),
  });
  if (result.error) return errorResponse(result.error);
  return Response.json({ data: result.data });
}
