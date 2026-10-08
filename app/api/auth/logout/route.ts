import { clearSessionCookie, getSessionToken } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/errors";
import { logout } from "@/lib/server/wallet";

export async function POST() {
  try {
    logout(await getSessionToken());
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
