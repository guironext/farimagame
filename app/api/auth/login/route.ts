import { publicUser, setSessionCookie } from "@/lib/server/auth";
import { jsonError, readJson } from "@/lib/server/errors";
import { login } from "@/lib/server/wallet";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const { token, user } = login(body.username, body.password);
    await setSessionCookie(token);
    return Response.json({ user: publicUser(user) });
  } catch (e) {
    return jsonError(e);
  }
}
