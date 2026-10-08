"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Erreur ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export function fmtAmount(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** "Aujourd'hui", "Demain", "Hier" ou "samedi 10 octobre". */
export function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const offset = (n: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + n);
    return key(x);
  };
  if (key(d) === offset(0)) return "Aujourd'hui";
  if (key(d) === offset(1)) return "Demain";
  if (key(d) === offset(-1)) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Encode un identifiant pour une URL (sans double encodage). */
export function idParam(id: string) {
  let raw = id;
  try {
    raw = decodeURIComponent(id);
  } catch {
    /* ignore */
  }
  return encodeURIComponent(raw);
}
