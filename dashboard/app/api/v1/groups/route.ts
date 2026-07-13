import { bearerOf, callApiRpc, errorResponse } from "@/lib/api/rpc";

export async function GET(req: Request) {
  const result = await callApiRpc("api_groups", { p_key: bearerOf(req) });
  if (result.error) return errorResponse(result.error);
  return Response.json({ data: result.data });
}
