import { GameError } from "../games/engine";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonError(e: unknown) {
  if (e instanceof AppError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof GameError) return Response.json({ error: e.message }, { status: 400 });
  console.error(e);
  return Response.json({ error: "Erreur interne du serveur." }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
