import { connection } from "next/server";
import { fromUnits } from "@/lib/config";
import { requireUserId } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";
import { jsonError } from "@/lib/server/errors";
import type { TxView } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    const userId = await requireUserId();
    const db = readDb();
    const txs: TxView[] = db.transactions
      .filter((t) => t.userId === userId)
      .slice(-200)
      .reverse()
      .map((t) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        currency: t.currency,
        amount: fromUnits(t.amount),
        balanceAfter: fromUnits(t.balanceAfter),
        tableId: t.tableId,
        matchId: t.matchId,
        createdAt: t.createdAt,
      }));
    const finished = db.tables.filter((t) => t.status === "finished" && t.seats.some((s) => s.userId === userId));
    const wins = finished.filter((t) => t.winnerSeat != null && t.seats[t.winnerSeat]?.userId === userId).length;
    const draws = finished.filter((t) => t.isDraw).length;
    return Response.json({
      transactions: txs,
      stats: { played: finished.length, wins, draws, losses: finished.length - wins - draws },
    });
  } catch (e) {
    return jsonError(e);
  }
}
