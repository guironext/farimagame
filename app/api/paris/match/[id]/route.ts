import { connection } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { ensureSynced, getMatch } from "@/lib/server/betting";
import { jsonError } from "@/lib/server/errors";

export async function GET(_req: Request, ctx: RouteContext<"/api/paris/match/[id]">) {
  await connection();
  try {
    const { id } = await ctx.params;
    await ensureSynced();
    const u = await currentUser();
    return Response.json(getMatch(decodeURIComponent(id), u?.id ?? null));
  } catch (e) {
    return jsonError(e);
  }
}
