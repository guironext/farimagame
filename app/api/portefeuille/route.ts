import { connection } from "next/server";
import { fromUnits } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payments";
import { publicUser, requireUserId } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";
import { AppError, jsonError, readJson } from "@/lib/server/errors";
import { deposit, listPayments, withdraw } from "@/lib/server/payments";
import { convertLionsToFcfa } from "@/lib/server/wallet";
import type { TxView } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    const userId = await requireUserId();
    const db = await readDb();
    const transactions: TxView[] = db.transactions
      .filter((t) => t.userId === userId && (t.currency === "fcfa" || (t.type.startsWith("conversion") && t.label.includes("F CFA"))))
      .slice(-200)
      .reverse()
      .map((t) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        currency: t.currency,
        amount: fromUnits(t.amount),
        balanceAfter: fromUnits(t.balanceAfter),
        matchId: t.matchId,
        createdAt: t.createdAt,
      }));
    const p = getPaymentProvider();
    return Response.json({ transactions, payments: await listPayments(userId), provider: { id: p.id, label: p.label, isSimulation: p.isSimulation } });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJson(req);
    if (body.action === "deposit") {
      const r = await deposit(userId, body);
      return Response.json({ payment: r.payment, user: publicUser(r.user) });
    }
    if (body.action === "withdraw") {
      const r = await withdraw(userId, body);
      return Response.json({ payment: r.payment, user: publicUser(r.user) });
    }
    if (body.action === "convert") return Response.json({ user: publicUser(await convertLionsToFcfa(userId, body.lions)) });
    throw new AppError(400, "Action inconnue.");
  } catch (e) {
    return jsonError(e);
  }
}
