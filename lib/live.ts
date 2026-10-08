// Outils d'affichage du direct (utilisables côté client et serveur, sans dépendance serveur).
import type { LiveInfo, MatchEvent, MatchPeriod, MatchView, ScorePair } from "./types";

export const PERIOD_LABEL: Record<MatchPeriod, string> = {
  NS: "À venir",
  TBD: "Horaire à confirmer",
  "1H": "1re mi-temps",
  HT: "Mi-temps",
  "2H": "2e mi-temps",
  ET: "Prolongation",
  BT: "Pause avant prolongation",
  P: "Tirs au but",
  SUSP: "Match suspendu",
  INT: "Match interrompu",
  LIVE: "En cours",
  FT: "Terminé",
  AET: "Terminé après prolongation",
  PEN: "Terminé aux tirs au but",
  PST: "Reporté",
  CANC: "Annulé",
  ABD: "Abandonné",
  AWD: "Victoire sur tapis vert",
  WO: "Forfait",
};

/** Périodes pendant lesquelles le chrono tourne. */
const RUNNING = new Set<MatchPeriod>(["1H", "2H", "ET", "LIVE"]);
const PERIOD_CAP: Partial<Record<MatchPeriod, number>> = { "1H": 45, "2H": 90, ET: 120 };

/** Libellé court de la minute : « 67' », « 45+2' », « MT », « TAB »… Avance d'au plus 3 min entre deux mises à jour. */
export function minuteLabel(live: LiveInfo | null | undefined, now = Date.now()): string {
  if (!live) return "En cours";
  switch (live.period) {
    case "HT":
      return "MT";
    case "BT":
      return "Pause";
    case "P":
      return "TAB";
    case "SUSP":
      return "Susp.";
    case "INT":
      return "Int.";
    case "FT":
    case "AET":
    case "PEN":
      return "Fin";
  }
  if (live.elapsed == null) return "En cours";
  const drift = RUNNING.has(live.period) ? Math.min(3, Math.max(0, Math.floor((now - Date.parse(live.updatedAt)) / 60000))) : 0;
  const cap = PERIOD_CAP[live.period];
  if (live.extra != null && live.extra > 0) return `${live.elapsed}+${live.extra + drift}'`;
  return `${cap ? Math.min(cap, live.elapsed + drift) : live.elapsed + drift}'`;
}

/** Avancement du match (0 → 1) sur 90 min, ou 120 min en prolongation. */
export function matchProgress(live: LiveInfo | null | undefined, now = Date.now()): { value: number; total: 90 | 120 } {
  if (!live) return { value: 0, total: 90 };
  const ext = live.period === "ET" || live.period === "BT" || live.period === "P" || live.period === "AET" || live.period === "PEN";
  const total = ext ? 120 : 90;
  if (live.period === "FT" || live.period === "AET" || live.period === "PEN" || live.period === "P") return { value: 1, total };
  if (live.period === "HT") return { value: 45 / total, total };
  if (live.period === "BT") return { value: 90 / total, total };
  const drift = RUNNING.has(live.period) ? Math.min(3, Math.max(0, (now - Date.parse(live.updatedAt)) / 60000)) : 0;
  const cap = PERIOD_CAP[live.period] ?? total;
  const m = Math.min(cap, (live.elapsed ?? 0) + drift);
  return { value: Math.max(0, Math.min(1, m / total)), total };
}

export const isGoal = (e: MatchEvent) => e.type === "goal" || e.type === "penalty" || e.type === "own-goal";

export function eventMinute(e: Pick<MatchEvent, "minute" | "extra">) {
  return `${e.minute}${e.extra ? `+${e.extra}` : ""}'`;
}

/** Buteurs d'une équipe regroupés : « A. Koné 12', 67' (pen.) ». */
export function scorers(events: MatchEvent[], team: "home" | "away"): { player: string; minutes: string; red?: boolean }[] {
  const out = new Map<string, string[]>();
  for (const e of events) {
    if (e.team !== team || !isGoal(e)) continue;
    const name = e.player ?? "But";
    const tag = e.type === "penalty" ? " (pen.)" : e.type === "own-goal" ? " (csc)" : "";
    out.set(name, [...(out.get(name) ?? []), eventMinute(e) + tag]);
  }
  const list: { player: string; minutes: string; red?: boolean }[] = [...out.entries()].map(([player, mins]) => ({ player, minutes: mins.join(", ") }));
  for (const e of events) if (e.team === team && e.type === "red-card") list.push({ player: e.player ?? "Carton rouge", minutes: eventMinute(e), red: true });
  return list;
}

/** Score à afficher : score en direct (prolongation comprise) sinon score réglementaire. */
export function displayScore(m: Pick<MatchView, "score" | "live" | "status">): ScorePair | null {
  if (m.live?.goals && (m.status === "live" || m.status === "finished")) return m.live.goals;
  return m.score;
}

/** Vainqueur affiché (prolongation / tirs au but compris). */
export function displayWinner(m: Pick<MatchView, "score" | "live" | "status">): "home" | "away" | "draw" | null {
  const s = displayScore(m);
  if (!s || m.status !== "finished") return null;
  if (s.home !== s.away) return s.home > s.away ? "home" : "away";
  const p = m.live?.penalties;
  if (p && p.home !== p.away) return p.home > p.away ? "home" : "away";
  return "draw";
}

/** Dernier but marqué il y a moins de 3 minutes de jeu (pour l'animation « BUT ! »). */
export function recentGoal(live: LiveInfo | null | undefined): MatchEvent | null {
  if (!live || !RUNNING.has(live.period) || live.elapsed == null) return null;
  const goals = live.events.filter(isGoal);
  const last = goals[goals.length - 1];
  if (!last) return null;
  const now = live.elapsed + (live.extra ?? 0);
  const at = last.minute + (last.extra ?? 0);
  return now - at <= 2 && now >= at ? last : null;
}

/** « 1 h 05 min 12 s » → format compact « 01:05:12 » (ou « 05:12 »). */
export function fmtCountdown(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d} j ${p(h)} h ${p(m)}`;
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
