import { connection } from "next/server";
import { requireAdminId } from "@/lib/server/auth";
import { adminOverview, adminSetResult, ensureSynced } from "@/lib/server/betting";
import { readDb } from "@/lib/server/db";
import { AppError, jsonError, readJson } from "@/lib/server/errors";
import { decideWithdrawal, paymentView } from "@/lib/server/payments";

export async function GET() {
  await connection();
  try {
    await requireAdminId();
    await ensureSynced();
    const db = readDb();
    const payments = db.payments.slice(-100).reverse().map((p) => paymentView(p, db));
    return Response.json({ ...adminOverview(), payments });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminId();
    const body = await readJson(req);
    switch (body.action) {
      case "result":
        return Response.json({ match: adminSetResult(body.matchId, body) });
      case "sync":
        await ensureSynced(true);
        return Response.json({ ok: true });
      case "withdrawal":
        return Response.json({ payment: decideWithdrawal(body.paymentId, body.decision) });
      default:
        throw new AppError(400, "Action inconnue.");
    }
  } catch (e) {
    return jsonError(e);
  }
}
