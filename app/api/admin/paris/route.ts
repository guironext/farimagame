import { connection } from "next/server";
import { requireMoneyId } from "@/lib/server/auth";
import { adminOverview, adminSetResult, ensureSynced } from "@/lib/server/betting";
import { readDb } from "@/lib/server/db";
import { AppError, jsonError, readJson } from "@/lib/server/errors";
import { decideWithdrawal, paymentView } from "@/lib/server/payments";

export async function GET() {
  await connection();
  try {
    await requireMoneyId();
    await ensureSynced();
    const db = await readDb();
    const payments = db.payments.slice(-100).reverse().map((p) => paymentView(p, db));
    return Response.json({ ...(await adminOverview()), payments });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireMoneyId();
    const body = await readJson(req);
    switch (body.action) {
      case "result":
        return Response.json({ match: await adminSetResult(body.matchId, body) });
      case "sync":
        await ensureSynced(true);
        return Response.json({ ok: true });
      case "withdrawal":
        return Response.json({ payment: await decideWithdrawal(body.paymentId, body.decision) });
      default:
        throw new AppError(400, "Action inconnue.");
    }
  } catch (e) {
    return jsonError(e);
  }
}
