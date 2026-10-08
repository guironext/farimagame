// Test des cotes (calculées + The Odds API simulée). Ne touche PAS à data/db.json : le script lance
// lui-même deux serveurs `next start` avec une base temporaire (FARIMA_DATA_DIR).
//   npm run build && node scripts/test-odds.mjs
// Phase A : sans clé -> toutes les issues ont une cote numérique « Cotes FarimaGame ».
// Phase B : clé factice + faux serveur The Odds API (réponses construites à partir des matchs affichés)
//           -> cotes bookmakers sur les matchs rapprochés, cache respecté (pas d'appel par page vue).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT ?? 3101);
const MOCK_PORT = PORT + 98;
const BASE = `http://localhost:${PORT}`;
const SHARE = 0.9;
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? "✅" : "❌"} ${m}`);
  if (!c) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (x) => Math.round(x * 100) / 100;
const oddsFromProb = (p) => Math.min(250, Math.max(1.01, r2(SHARE / p)));

const SPORTS = { epl: "soccer_epl", laliga: "soccer_spain_la_liga", seriea: "soccer_italy_serie_a", bundesliga: "soccer_germany_bundesliga", ligue1: "soccer_france_ligue_one", ucl: "soccer_uefa_champs_league", can: "soccer_africa_cup_of_nations", "wcq-eur": "soccer_fifa_world_cup_qualifiers_europe" };
// noms tels que les bookmakers les écrivent (anglais) pour quelques équipes de la démo
const EN = { "FC Barcelone": "Barcelona", "Atlético Madrid": "Atletico Madrid", "Betis Séville": "Real Betis", "FC Séville": "Sevilla", Valence: "Valencia", Majorque: "Mallorca", Naples: "Napoli", "AS Rome": "AS Roma", Bologne: "Bologna", Côme: "Como", Parme: "Parma", "Hellas Vérone": "Hellas Verona", Pise: "Pisa", "Eintracht Francfort": "Eintracht Frankfurt", Fribourg: "SC Freiburg", Mayence: "FSV Mainz 05", Mönchengladbach: "Borussia Monchengladbach", "Werder Brême": "Werder Bremen", Augsbourg: "FC Augsburg", Cologne: "1. FC Köln", "Hambourg SV": "Hamburger SV", "Paris Saint-Germain": "Paris Saint Germain", "Olympique de Marseille": "Marseille", "LOSC Lille": "Lille", "OGC Nice": "Nice", "Olympique Lyonnais": "Lyon", "Stade Rennais": "Rennes", "Stade Brestois": "Brest", Wolverhampton: "Wolverhampton Wanderers", Tottenham: "Tottenham Hotspur", Brighton: "Brighton and Hove Albion", Newcastle: "Newcastle United", "West Ham": "West Ham United", "Club Bruges": "Club Brugge", "Sporting CP": "Sporting Lisbon", "Côte d'Ivoire": "Ivory Coast", Sénégal: "Senegal", Maroc: "Morocco", Égypte: "Egypt", Cameroun: "Cameroon", Algérie: "Algeria", Tunisie: "Tunisia", "Afrique du Sud": "South Africa", "RD Congo": "DR Congo", Guinée: "Guinea", "Cap-Vert": "Cape Verde", Zambie: "Zambia", Ouganda: "Uganda", Bénin: "Benin", Angleterre: "England", Espagne: "Spain", Allemagne: "Germany", Italie: "Italy", "Pays-Bas": "Netherlands", Belgique: "Belgium", Croatie: "Croatia", Suisse: "Switzerland", Danemark: "Denmark", Autriche: "Austria", Pologne: "Poland", Suède: "Sweden", Norvège: "Norway", Serbie: "Serbia", Turquie: "Turkey", Écosse: "Scotland", "Pays de Galles": "Wales" };
const en = (n) => EN[n] ?? n;

function startServer(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "farima-odds-"));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, FARIMA_DATA_DIR: dir, ODDS_API_KEY: "", API_FOOTBALL_KEY: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // groupe de processus : on arrête aussi le next-server enfant
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, dir, log: () => log };
}

async function portFree() {
  try {
    await fetch(BASE + "/api/me");
    return false;
  } catch {
    return true;
  }
}

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE + "/api/me");
      if (r.ok) return true;
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

function allNumeric(matches) {
  let n = 0;
  for (const m of matches) for (const mk of m.markets) for (const o of mk.outcomes) if (typeof o.odds !== "number" || !(o.odds >= 1.01)) n++;
  return n;
}

// ------------------------------------------------------------------ phase A : sans clé
console.log("\n— Phase A : sans ODDS_API_KEY (cotes calculées par FarimaGame)");
if (!(await portFree())) {
  console.log(`❌ Le port ${PORT} est déjà utilisé : arrêtez le serveur qui l'occupe ou lancez TEST_PORT=3150 node scripts/test-odds.mjs`);
  process.exit(1);
}
let srv = startServer({});
ok(await waitUp(), "serveur de test démarré (base temporaire)");
let data = await getJson("/api/paris");
ok(data.matches.length > 0, `${data.matches.length} matchs listés`);
ok(allNumeric(data.matches) === 0, "toutes les issues 1/N/2 ont une cote numérique (aucun « — »)");
ok(data.matches.every((m) => m.odds.source === "farimagame"), "source = Cotes FarimaGame partout");
const sums = data.matches.map((m) => m.markets[0].outcomes.reduce((a, o) => a + 1 / o.odds, 0));
ok(sums.every((s) => Math.abs(s - 1 / SHARE) < 0.015), `Σ 1/cote (1N2) ∈ [${Math.min(...sums).toFixed(4)} ; ${Math.max(...sums).toFixed(4)}] ≈ 1/0,9 = 1,1111`);
const open = data.matches.find((m) => m.bettingOpen);
const detail = await getJson(`/api/paris/match/${encodeURIComponent(open.id)}`);
ok(detail.match.markets.length === 3 && allNumeric([detail.match]) === 0, "fiche match : 3 marchés (1N2, BTTS, +/-2,5) tous chiffrés");
for (const mk of detail.match.markets) {
  const s = mk.outcomes.reduce((a, o) => a + 1 / o.odds, 0);
  ok(Math.abs(s - 1 / SHARE) < 0.015, `  ${mk.market} : ${mk.outcomes.map((o) => o.odds).join(" / ")} (Σ1/cote ${s.toFixed(4)})`);
}
const again = await getJson("/api/paris");
ok(JSON.stringify(again.matches.map((m) => m.markets[0].outcomes.map((o) => o.odds))) === JSON.stringify(data.matches.map((m) => m.markets[0].outcomes.map((o) => o.odds))), "cotes déterministes (2 appels identiques)");
ok(data.provider.odds && data.provider.odds.enabled === false, "provider.odds.enabled = false");
await stop(srv);

// ------------------------------------------------------------------ phase B : The Odds API simulée
console.log("\n— Phase B : ODDS_API_KEY factice + faux serveur The Odds API");
const calls = [];
const expected = new Map(); // matchId -> { prices, totals }
const mock = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${MOCK_PORT}`);
  const m = u.pathname.match(/^\/v4\/sports\/([^/]+)\/odds$/);
  calls.push({ path: u.pathname, q: Object.fromEntries(u.searchParams) });
  if (!m) return res.writeHead(404).end("{}");
  if (u.searchParams.get("apiKey") !== "test-key") return res.writeHead(401, { "content-type": "application/json" }).end('{"message":"Invalid key"}');
  const sport = m[1];
  const list = (await (await fetch(BASE + "/api/paris")).json()).matches.filter((x) => SPORTS[x.competitionId] === sport && x.bettingOpen);
  const events = [];
  list.forEach((x, i) => {
    if (i % 2 === 1) return; // un match sur deux seulement : les autres restent en cotes FarimaGame
    const base = [[2.1, 3.4, 3.5], [1.55, 4.2, 5.8], [3.1, 3.3, 2.35]][i % 3];
    const books = [0, 0.05, -0.04].map((d) => base.map((p) => r2(p + d)));
    const withTotals = i % 4 === 0;
    expected.set(x.id, { median: base, withTotals }); // médiane des 3 bookmakers = prix de base
    events.push({
      id: `ev_${x.id}`,
      sport_key: sport,
      commence_time: x.kickoff,
      home_team: en(x.home),
      away_team: en(x.away),
      bookmakers: books.map((b, k) => ({
        key: `book${k}`,
        title: `Book ${k}`,
        markets: [
          { key: "h2h", outcomes: [{ name: en(x.home), price: b[0] }, { name: en(x.away), price: b[2] }, { name: "Draw", price: b[1] }] },
          ...(withTotals ? [{ key: "totals", outcomes: [{ name: "Over", price: r2(1.8 + k * 0.03), point: 2.5 }, { name: "Under", price: r2(2.0 - k * 0.03), point: 2.5 }] }] : []),
        ],
      })),
    });
  });
  // leurre : un match qui n'existe pas chez nous
  events.push({ id: "decoy", sport_key: sport, commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: "Nowhere United", away_team: "Ghost Town FC", bookmakers: [{ key: "b", markets: [{ key: "h2h", outcomes: [{ name: "Nowhere United", price: 2 }, { name: "Ghost Town FC", price: 3 }, { name: "Draw", price: 3 }] }] }] });
  res.writeHead(200, { "content-type": "application/json", "x-requests-remaining": "480", "x-requests-used": "20", "x-requests-last": "2" }).end(JSON.stringify(events));
});
await new Promise((r) => mock.listen(MOCK_PORT, r));
srv = startServer({ ODDS_API_KEY: "test-key", ODDS_API_BASE_URL: `http://localhost:${MOCK_PORT}`, ODDS_API_WITH_DEMO: "1" });
ok(await waitUp(), "serveur de test démarré avec la clé factice");
await getJson("/api/paris"); // déclenche le rafraîchissement en arrière-plan
let bk = [];
for (let i = 0; i < 60; i++) {
  data = await getJson("/api/paris");
  bk = data.matches.filter((m) => m.odds.source === "bookmakers");
  if (bk.length > 0 && data.provider.odds.fetchedAt) break;
  await sleep(500);
}
const sportsCalled = new Set(calls.map((c) => c.path));
ok(calls.length > 0 && calls.every((c) => c.q.regions === "eu" && c.q.markets === "h2h,totals" && c.q.oddsFormat === "decimal"), `requêtes The Odds API conformes (${calls.length} appel(s), ${sportsCalled.size} compétition(s))`);
ok(bk.length > 0, `${bk.length} match(s) avec « Cotes bookmakers »`);
ok(data.matches.some((m) => m.odds.source === "farimagame"), "les matchs non trouvés restent en « Cotes FarimaGame »");
ok(allNumeric(data.matches) === 0, "toujours aucune cote manquante");
let exact = 0;
for (const m of bk) {
  const e = expected.get(m.id);
  if (!e) continue;
  const [h, d, a] = e.median; // médiane des 3 bookmakers = prix de base
  const inv = 1 / h + 1 / d + 1 / a;
  const want = [1 / h / inv, 1 / d / inv, 1 / a / inv].map((p) => oddsFromProb(Math.round(p * 10000) / 10000));
  const got = m.markets[0].outcomes.map((o) => o.odds);
  if (JSON.stringify(want) === JSON.stringify(got)) exact++;
  else console.log("   écart", m.home, m.away, want, got);
}
ok(exact === bk.length, `cotes = médiane bookmakers, marge retirée puis marge FarimaGame 10 % (${exact}/${bk.length})`);
const sample = bk[0];
console.log(`   ex. ${sample.home} - ${sample.away} : bookmakers ${expected.get(sample.id).median.join(" / ")} -> FarimaGame ${sample.markets[0].outcomes.map((o) => o.odds).join(" / ")}`);
const d2 = await getJson(`/api/paris/match/${encodeURIComponent(sample.id)}`);
ok(d2.match.odds.source === "bookmakers" && d2.match.markets.every((mk) => mk.outcomes.every((o) => typeof o.odds === "number")), `fiche match bookmakers : ${d2.match.markets.map((mk) => `${mk.market}=${mk.outcomes.map((o) => o.odds).join("/")} (${mk.refSource})`).join(" · ")}`);
const before = calls.length;
for (let i = 0; i < 5; i++) await getJson("/api/paris");
await getJson(`/api/paris/match/${encodeURIComponent(sample.id)}`);
await sleep(500);
ok(calls.length === before, `cache respecté : 6 pages vues de plus, 0 nouvel appel à l'API (${calls.length} au total)`);
ok(data.provider.odds.remaining === 480, `crédits restants lus dans l'en-tête x-requests-remaining (${data.provider.odds.remaining})`);
const next = Date.parse(data.provider.odds.nextAt) - Date.parse(data.provider.odds.fetchedAt);
console.log(`   prochain rafraîchissement planifié dans ${(next / 3600000).toFixed(1)} h (budget : 480 crédits répartis jusqu'à la fin du mois)`);
ok(next >= 15 * 60 * 1000, "intervalle ≥ 15 min");
await stop(srv);

// ------------------------------------------------------------------ phase C : clé refusée -> repli
console.log("\n— Phase C : clé refusée par l'API -> repli sur les cotes FarimaGame");
calls.length = 0;
srv = startServer({ ODDS_API_KEY: "mauvaise-cle", ODDS_API_BASE_URL: `http://localhost:${MOCK_PORT}`, ODDS_API_WITH_DEMO: "1" });
ok(await waitUp(), "serveur de test démarré avec une clé invalide");
await getJson("/api/paris");
for (let i = 0; i < 40 && !(data.provider.odds && data.provider.odds.lastError); i++) {
  await sleep(500);
  data = await getJson("/api/paris");
}
ok(calls.length === 1, `un seul appel puis arrêt (401) -> ${calls.length}`);
ok(!!data.provider.odds.lastError && !String(data.provider.odds.lastError).includes("mauvaise-cle"), `erreur enregistrée sans exposer la clé : « ${data.provider.odds.lastError} »`);
ok(data.matches.every((m) => m.odds.source === "farimagame") && allNumeric(data.matches) === 0, "toutes les cotes restent affichées (FarimaGame)");
await stop(srv);
mock.close();

console.log(failures ? `\n❌ ${failures} échec(s)` : "\n✅ Tous les tests de cotes sont OK");
process.exit(failures ? 1 : 0);
