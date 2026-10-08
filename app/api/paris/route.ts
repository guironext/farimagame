import { connection } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { ensureSynced, listMatches } from "@/lib/server/betting";
import { jsonError } from "@/lib/server/errors";
import { COMPETITIONS, GROUPS } from "@/lib/sports";

// Liste publique des matchs (consultable sans compte ; il faut être connecté pour parier).
export async function GET() {
  await connection();
  try {
    await ensureSynced();
    const u = await currentUser();
    const competitions = COMPETITIONS.map(({ id, name, short, group, country, flag }) => ({ id, name, short, group, country, flag }));
    return Response.json({ ...listMatches(u?.id ?? null), competitions, groups: GROUPS });
  } catch (e) {
    return jsonError(e);
  }
}
