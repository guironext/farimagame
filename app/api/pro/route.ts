import { publicUser, requireUserId } from "@/lib/server/auth";
import { AppError, jsonError, readJson } from "@/lib/server/errors";
import { convertCorisToLions, upgradeToPro } from "@/lib/server/wallet";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJson(req);
    if (body.action === "upgrade") return Response.json({ user: publicUser(await upgradeToPro(userId)) });
    if (body.action === "convert") return Response.json({ user: publicUser(await convertCorisToLions(userId, body.lions)) });
    throw new AppError(400, "Action inconnue.");
  } catch (e) {
    return jsonError(e);
  }
}
