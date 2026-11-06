import { connection } from "next/server";
import { requireUserId } from "@/lib/server/auth";
import { jsonError, readJson } from "@/lib/server/errors";
import { createTable, listTables } from "@/lib/server/tables";

export async function GET() {
  await connection();
  try {
    const userId = await requireUserId();
    return Response.json(listTables(userId));
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJson(req);
    const id = createTable(userId, body.game, body.mode, body.currency, body.invites);
    return Response.json({ id });
  } catch (e) {
    return jsonError(e);
  }
}
