import { connection } from "next/server";
import { requireUserId } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/errors";
import { listAvailablePlayers } from "@/lib/server/tables";

export async function GET(req: Request) {
  await connection();
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") ?? "coris";
    const game = url.searchParams.get("game");
    return Response.json({ players: await listAvailablePlayers(userId, currency, game) });
  } catch (e) {
    return jsonError(e);
  }
}
