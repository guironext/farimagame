import { connection } from "next/server";
import { requireUserId } from "@/lib/server/auth";
import { jsonError, readJson } from "@/lib/server/errors";
import { getTableView, tableAction } from "@/lib/server/tables";

export async function GET(_req: Request, ctx: RouteContext<"/api/tables/[id]">) {
  await connection();
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    return Response.json({ table: await getTableView(id, userId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/tables/[id]">) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const body = await readJson(req);
    await tableAction(userId, id, body);
    return Response.json({ table: await getTableView(id, userId) });
  } catch (e) {
    return jsonError(e);
  }
}
