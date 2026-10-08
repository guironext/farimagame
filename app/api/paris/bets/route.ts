import { connection } from "next/server";
import { publicUser, requireUserId } from "@/lib/server/auth";
import { ensureSynced, myBets, placeBet } from "@/lib/server/betting";
import { jsonError, readJson } from "@/lib/server/errors";

export async function GET() {
  await connection();
  try {
    const userId = await requireUserId();
    await ensureSynced();
    return Response.json({ bets: myBets(userId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJson(req);
    const r = placeBet(userId, body);
    return Response.json({ bet: r.bet, match: r.match, user: publicUser(r.user) });
  } catch (e) {
    return jsonError(e);
  }
}
