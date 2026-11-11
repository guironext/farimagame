import { connection } from "next/server";
import { requireAdminId } from "@/lib/server/auth";
import { jsonError, readJson } from "@/lib/server/errors";
import { inviteStaff, listAccounts, revokeStaffInvite, setAccountRole } from "@/lib/server/staff";

function redirectUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}/inscription`;
}

export async function GET() {
  await connection();
  try {
    await requireAdminId();
    return Response.json(await listAccounts());
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminId();
    const body = await readJson(req);
    if (body.action === "role") return Response.json({ user: await setAccountRole(adminId, body.userId, body.role) });
    if (body.action === "invite") return Response.json(await inviteStaff(adminId, body.email, body.role, redirectUrl(req)));
    if (body.action === "revoke") return Response.json({ invite: await revokeStaffInvite(body.inviteId) });
    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return jsonError(e);
  }
}
