import { connection } from "next/server";
import { requireUserId } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/errors";
import { listAvailablePlayers } from "@/lib/server/tables";

export async function GET(req: Request) {
  await connection();
  try {
    const userId = await requireUserId();
    const currency = new URL(req.url).searchParams.get("currency") ?? "coris";
    return Response.json({ players: listAvailablePlayers(userId, currency) });
  } catch (e) {
    return jsonError(e);
  }
}
