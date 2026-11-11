import { connection } from "next/server";
import { fromUnits } from "@/lib/config";
import { requireMoneyId } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";
import { AppError, jsonError, readJson } from "@/lib/server/errors";
import { decideWithdrawal, paymentView } from "@/lib/server/payments";

export async function GET() {
  await connection();
  try {
    await requireMoneyId();
    const db = await readDb();
    const sum = (type: string, cur: string) =>
      fromUnits(db.house.ledger.filter((l) => l.type === type && l.currency === cur).reduce((a, l) => a + l.amount, 0));
    return Response.json({
      balances: { coris: fromUnits(db.house.coris), lions: fromUnits(db.house.lions), fcfa: fromUnits(db.house.fcfa) },
      commissions: { coris: sum("commission", "coris"), lions: sum("commission", "lions"), fcfa: sum("commission_pari", "fcfa") },
      players: db.users.length,
      tables: {
        playing: db.tables.filter((t) => t.status === "playing").length,
        finished: db.tables.filter((t) => t.status === "finished").length,
      },
      ledger: db.house.ledger.slice(-100).reverse().map((l) => ({ ...l, amount: fromUnits(l.amount) })),
      withdrawals: db.payments.filter((p) => p.kind === "retrait").slice(-50).reverse().map((p) => paymentView(p, db)),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireMoneyId();
    const body = await readJson(req);
    if (body.action !== "withdrawal") throw new AppError(400, "Action inconnue.");
    return Response.json({ payment: await decideWithdrawal(body.paymentId, body.decision) });
  } catch (e) {
    return jsonError(e);
  }
}
