// Test du direct (onglets « En direct » / « Résultats »). Ne touche PAS à data/db.json : le script lance
// lui-même des serveurs `next start` avec une base temporaire (FARIMA_DATA_DIR).
//   npm run build && node scripts/test-live.mjs
// Phase A : démo avec une horloge simulée (un samedi à 16:20 UTC) -> minute, période, buteurs, mi-temps cohérents,
//           puis le même jour à 19:30 -> les scores finaux prolongent exactement les scores en direct.
// Phase B : clé API-Football factice + faux serveur API-Football -> statut 2H / minute / buteurs / csc / carton rouge,
//           match a.p. réglé sur le score à 90 min, 1 seule requête « direct » (cache + quota respectés).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT ?? 3102);
const MOCK_PORT = PORT + 97;
const BASE = `http://localhost:${PORT}`;
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? "✅" : "❌"} ${m}`);
  if (!c) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// horloge simulée pour le serveur : Date.now() décalé vers FAKE_NOW
const FAKE = path.join(os.tmpdir(), "farima-fake-now.cjs");
fs.writeFileSync(
  FAKE,
  `const target = Date.parse(process.env.FAKE_NOW); if (!Number.isNaN(target)) { const off = target - Date.now(); const R = Date;
   class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } }
   D.UTC = R.UTC; D.parse = R.parse; globalThis.Date = D; }`,
);

function startServer(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "farima-live-"));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, FARIMA_DATA_DIR: dir, ODDS_API_KEY: "", API_FOOTBALL_KEY: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, dir, log: () => log };
}
async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(BASE + "/api/me")).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(500);
  }
  return false;
}
async function stop(s) {
  const exited = new Promise((r) => s.child.once("exit", r));
  try {
    process.kill(-s.child.pid, "SIGTERM");
  } catch {
    s.child.kill("SIGTERM");
  }
  await exited;
  await sleep(300);
  fs.rmSync(s.dir, { recursive: true, force: true });
}
const getJson = async (p) => (await fetch(BASE + p)).json();
const tally = (events, team) => events.filter((e) => e.team === team && ["goal", "penalty", "own-goal"].includes(e.type)).length;

// ------------------------------------------------------------------ Phase A : démo
console.log("\n— Phase A : démo, horloge simulée");
const sat = new Date();
sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
const day = sat.toISOString().slice(0, 10);
let s = startServer({ FAKE_NOW: `${day}T16:20:00Z`, NODE_OPTIONS: `--require ${FAKE}` });
ok(await waitUp(), `serveur démarré (horloge ${day} 16:20 UTC)`);
let data = await getJson("/api/paris");
const live = data.matches.filter((m) => m.status === "live");
ok(live.length >= 3, `${live.length} matchs en direct`);
ok(live.every((m) => m.live && ["1H", "HT", "2H"].includes(m.live.period) && typeof m.live.elapsed === "number"), "chaque match en direct a une période et une minute");
ok(live.every((m) => m.live.goals.home === tally(m.live.events, "home") && m.live.goals.away === tally(m.live.events, "away")), "score en direct = buts listés");
ok(
  live.filter((m) => m.live.period !== "1H").every((m) => m.live.halftime && m.live.halftime.home <= m.live.goals.home && m.live.halftime.away <= m.live.goals.away),
  "score à la mi-temps présent et cohérent après la 1re MT",
);
ok(live.every((m) => !m.bettingOpen), "paris fermés pendant le direct (règle inchangée)");
const l1 = live.find((m) => m.competitionId === "ligue1");
ok(l1 && l1.live.period === "2H" && l1.live.elapsed >= 60 && l1.live.elapsed <= 75, `Ligue 1 de 15:00 en 2e MT (${l1?.live.period} ${l1?.live.elapsed}')`);
const fin = data.matches.filter((m) => m.status === "finished");
ok(fin.length > 10, `${fin.length} résultats`);
ok(fin.every((m) => m.live && m.live.period === "FT" && m.live.goals.home === m.score.home && m.live.goals.away === m.score.away), "résultats : score final = score de la simulation");
ok(fin.every((m) => tally(m.live.events, "home") === m.score.home && tally(m.live.events, "away") === m.score.away), "résultats : buteurs cohérents avec le score");
ok(fin.some((m) => m.live.events.some((e) => e.player)), "résultats : noms des buteurs (fictifs) présents");
const m1 = await getJson(`/api/paris/match/${encodeURIComponent(live[0].id)}`);
ok(m1.match.live && m1.match.live.events.length === live[0].live.events.length, "page match : mêmes infos en direct");
const snapshot = Object.fromEntries(live.map((m) => [m.id, m.live.goals]));
await stop(s);

s = startServer({ FAKE_NOW: `${day}T19:30:00Z`, NODE_OPTIONS: `--require ${FAKE}` });
ok(await waitUp(), "serveur redémarré (19:30 UTC)");
data = await getJson("/api/paris");
const later = data.matches.filter((m) => snapshot[m.id]);
ok(later.length === live.length && later.every((m) => m.status === "finished" || m.status === "live"), "les matchs suivis sont terminés (ou encore en cours)");
ok(
  later.every((m) => !m.score || (m.score.home >= snapshot[m.id].home && m.score.away >= snapshot[m.id].away)),
  "score final ≥ score vu en direct (pas de but qui disparaît)",
);
await stop(s);

// ------------------------------------------------------------------ Phase B : API-Football simulée
console.log("\n— Phase B : API-Football simulée");
const now = Date.now();
const iso = (ms) => new Date(now + ms).toISOString();
const team = (id, name) => ({ id, name, logo: `https://media.example/teams/${id}.png` });
const LIV = team(40, "Liverpool");
const ARS = team(42, "Arsenal");
const CHE = team(49, "Chelsea");
const TOT = team(47, "Tottenham");
const fx = (id, date, short, elapsed, home, away, goals, score, events) => ({
  fixture: { id, date, status: { short, long: short, elapsed, extra: null }, venue: { name: "Stadium" } },
  league: { id: 39, round: "Regular Season - 7" },
  teams: { home, away },
  goals,
  score,
  ...(events ? { events } : {}),
});
const LIST = [
  fx(1001, iso(-70 * 60000), "2H", 67, LIV, ARS, { home: 2, away: 1 }, { halftime: { home: 1, away: 1 }, fulltime: { home: null, away: null } }),
  fx(1002, iso(-3 * 3600000), "AET", 120, CHE, TOT, { home: 3, away: 2 }, { halftime: { home: 1, away: 1 }, fulltime: { home: 2, away: 2 }, extratime: { home: 1, away: 0 }, penalty: { home: null, away: null } }),
  fx(1003, iso(2 * 3600000), "NS", null, ARS, CHE, { home: null, away: null }, { halftime: { home: null, away: null }, fulltime: { home: null, away: null } }),
];
const EVENTS = [
  { time: { elapsed: 12, extra: null }, team: LIV, player: { name: "M. Salah" }, assist: { name: "T. Alexander-Arnold" }, type: "Goal", detail: "Normal Goal" },
  { time: { elapsed: 30, extra: null }, team: LIV, player: { name: "V. van Dijk" }, assist: { name: null }, type: "Goal", detail: "Own Goal" },
  { time: { elapsed: 45, extra: 2 }, team: ARS, player: { name: "B. Saka" }, type: "Card", detail: "Yellow Card" },
  { time: { elapsed: 55, extra: null }, team: LIV, player: { name: "M. Salah" }, type: "Goal", detail: "Penalty" },
  { time: { elapsed: 60, extra: null }, team: ARS, player: { name: "D. Rice" }, type: "Card", detail: "Red Card" },
  { time: { elapsed: 61, extra: null }, team: LIV, player: { name: "C. Jones" }, type: "subst", detail: "Substitution 1" },
];
const calls = { list: 0, ids: [] };
const mock = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const n = calls.list + calls.ids.length + 1;
  res.setHeader("content-type", "application/json");
  res.setHeader("x-ratelimit-requests-limit", "100");
  res.setHeader("x-ratelimit-requests-remaining", String(100 - n));
  if (req.headers["x-apisports-key"] !== "test-key") return res.end(JSON.stringify({ errors: { token: "bad key" }, response: [] }));
  if (u.pathname === "/fixtures" && u.searchParams.get("ids")) {
    calls.ids.push(u.searchParams.get("ids"));
    const live = { ...LIST[0], fixture: { ...LIST[0].fixture, status: { short: "2H", long: "Second Half", elapsed: 68, extra: null } }, events: EVENTS };
    return res.end(JSON.stringify({ errors: [], response: u.searchParams.get("ids").split("-").includes("1001") ? [live] : [] }));
  }
  if (u.pathname === "/fixtures" && u.searchParams.get("league")) {
    calls.list++;
    return res.end(JSON.stringify({ errors: [], response: u.searchParams.get("league") === "39" ? LIST : [] }));
  }
  res.statusCode = 404;
  res.end("{}");
});
await new Promise((r) => mock.listen(MOCK_PORT, r));
s = startServer({ API_FOOTBALL_KEY: "test-key", API_FOOTBALL_BASE_URL: `http://localhost:${MOCK_PORT}` });
ok(await waitUp(), "serveur démarré avec API-Football simulée");
data = await getJson("/api/paris");
ok(calls.list === 12, `synchro complète : 12 requêtes (une par compétition) -> ${calls.list}`);
ok(calls.ids.length === 1 && calls.ids[0] === "1001", `direct : 1 requête /fixtures?ids=1001 -> ${JSON.stringify(calls.ids)}`);
const lv = data.matches.find((m) => m.id === "af:1001");
ok(lv?.status === "live" && lv.live?.period === "2H" && lv.live.elapsed === 68, `match en cours : ${lv?.live?.period} ${lv?.live?.elapsed}'`);
ok(lv?.live?.goals?.home === 2 && lv.live.goals.away === 1 && lv.live.halftime?.home === 1, "score 2-1, mi-temps 1-1");
const ev = lv?.live?.events ?? [];
ok(ev.length === 4, `4 faits retenus (2 buts, 1 csc, 1 rouge ; jaunes et remplacements ignorés) -> ${ev.length}`);
ok(ev.find((e) => e.type === "own-goal")?.team === "away", "csc de van Dijk compté pour Arsenal (score cohérent)");
ok(ev.find((e) => e.type === "penalty")?.player === "M. Salah" && ev.find((e) => e.type === "goal")?.assist === "T. Alexander-Arnold", "buteur, passeur et penalty mappés");
ok(ev.find((e) => e.type === "red-card")?.player === "D. Rice", "carton rouge mappé");
const aet = data.matches.find((m) => m.id === "af:1002");
ok(aet?.status === "finished" && aet.settled && aet.score?.home === 2 && aet.score?.away === 2, "match a.p. réglé sur le score à 90 min (2-2)");
ok(aet?.live?.period === "AET" && aet.live.goals.home === 3, "affichage : 3-2 après prolongation");
ok(aet?.markets?.[0]?.winner === "N", "1N2 gagnant = N (score à 90 min)");
const ns = data.matches.find((m) => m.id === "af:1003");
ok(ns?.status === "scheduled" && ns.live === null && ns.bettingOpen, "match à venir : pas d'infos en direct, paris ouverts");
ok(data.provider.live?.quota?.used === 13 && data.provider.live.quota.remaining === 87, `quota suivi : ${JSON.stringify(data.provider.live?.quota)}`);
for (let i = 0; i < 5; i++) await getJson("/api/paris");
await getJson("/api/paris/match/af%3A1001");
ok(calls.ids.length === 1 && calls.list === 12, "pages vues suivantes : aucune requête supplémentaire (cache 60 s minimum)");
await stop(s);
mock.close();
fs.rmSync(FAKE, { force: true });

console.log(failures ? `\n${failures} échec(s).` : "\n🎉 Tous les tests du direct sont passés.");
process.exit(failures ? 1 : 0);
