import { connection } from "next/server";
import { fromUnits } from "@/lib/config";
import { requireAdminId } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";
import { jsonError } from "@/lib/server/errors";

export async function GET() {
  await connection();
  try {
    await requireAdminId();
    const db = readDb();
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
    });
  } catch (e) {
    return jsonError(e);
  }
}
