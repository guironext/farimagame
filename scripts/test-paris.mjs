// Test de bout en bout des paris sportifs / portefeuille F CFA (+ protection des comptes avec Clerk).
// Ne touche PAS à data/db.json : par défaut le script lance lui-même un serveur `next dev` de test
//   - sur le port 3100, avec une base temporaire (FARIMA_DATA_DIR) et un dossier de compilation séparé (.next-test),
//     donc il peut tourner à côté de votre `npm run dev` ;
//   - avec FARIMA_TEST_AUTH=1 : les comptes de test se connectent par l'en-tête « x-farima-test-user »
//     au lieu de Clerk. Ce raccourci n'existe qu'en développement : il est retiré du code par `next build`
//     (voir lib/server/auth.ts), il est donc impossible à utiliser en production.
//   node scripts/test-paris.mjs
// On peut aussi viser un serveur déjà lancé (en dev, avec FARIMA_TEST_AUTH=1 et FARIMA_DATA_DIR) :
//   node scripts/test-paris.mjs http://localhost:3100
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT ?? 3100);
const EXTERNAL = process.argv[2];
const BASE = EXTERNAL ?? `http://localhost:${PORT}`;
const suffix = Date.now().toString(36).slice(-5);
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- serveur de test
let server = null;
const tsconfigBefore = fs.readFileSync("tsconfig.json", "utf8"); // `next dev` y ajoute .next-test : on le remet à la fin
function stopServer() {
  if (server && server.exitCode === null) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* déjà arrêté */
    }
  }
  try {
    fs.writeFileSync("tsconfig.json", tsconfigBefore);
  } catch {
    /* rien */
  }
}
process.on("exit", stopServer);
process.on("SIGINT", () => process.exit(130));

if (!EXTERNAL) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "farima-paris-"));
  let log = "";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      FARIMA_TEST_AUTH: "1",
      FARIMA_DATA_DIR: dir,
      FARIMA_NEXT_DIST_DIR: ".next-test",
      ODDS_API_KEY: "",
      API_FOOTBALL_KEY: "",
      ADMIN_EMAILS: "",
      ADMIN_USERNAMES: "",
      HOME_EMAILS: "",
      HOME_USERNAMES: `maison${suffix}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    await sleep(500);
    if (server.exitCode !== null) break;
    try {
      up = (await fetch(BASE + "/api/me")).ok;
    } catch {
      /* pas encore prêt */
    }
  }
  if (!up) {
    console.log(log);
    console.log("❌ le serveur de test n'a pas démarré");
    process.exit(1);
  }
  console.log(`(serveur de test next dev sur ${BASE}, base ${dir})`);
}

/** Client HTTP ; avec un nom, il est connecté comme ce joueur de test (en-tête x-farima-test-user). */
function client(name) {
  return async function call(path, body) {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(name ? { "x-farima-test-user": name } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* page HTML */
    }
    return { status: res.status, data };
  };
}

async function user(name) {
  const c = client(name);
  const r = await c("/api/me");
  ok(r.status === 200 && r.data?.user?.username === name, `inscription automatique de ${name} à la 1re visite (${r.status})`);
  return c;
}

const me = async (c) => (await c("/api/me")).data.user;

// 1. pages
for (const p of ["/", "/inscription", "/connexion", "/tableau-de-bord", "/salon", "/jeu/x", "/pro", "/maison", "/paris", "/paris/match/demo%3Atest", "/paris/mes-paris", "/portefeuille", "/admin/paris"]) {
  const r = await fetch(BASE + p);
  ok(r.status === 200, `GET ${p} -> ${r.status}`);
}

// 1 bis. protection des comptes (Clerk)
const anon = client();
let a = await anon("/api/me");
ok(a.status === 200 && a.data.user === null, "visiteur : /api/me -> user null");
ok((await anon("/api/wallet")).status === 401, "visiteur : /api/wallet refusé (401)");
ok((await anon("/api/paris/bets", { matchId: "x", market: "1x2", selection: "1", amount: 100 })).status === 401, "visiteur : pari refusé (401)");
ok((await anon("/api/tables", { game: "awale", mode: "cpu", currency: "coris" })).status === 401, "visiteur : table de jeu refusée (401)");
for (const old of ["/api/auth/register", "/api/auth/login"]) {
  const r0 = await fetch(BASE + old, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x_" + suffix, password: "secret123" }) });
  ok(r0.status === 404 || r0.status === 405, `ancienne route ${old} supprimée (${r0.status})`);
}
for (const p of ["/portefeuille", "/tableau-de-bord", "/paris/mes-paris", "/admin/paris"]) {
  const r0 = await fetch(BASE + p, { redirect: "manual" });
  const loc = r0.headers.get("location") ?? "";
  ok(r0.status >= 300 && r0.status < 400 && loc.includes("/connexion") && loc.includes("redirect_url="), `visiteur : ${p} -> redirigé vers la connexion (${r0.status})`);
}
for (const p of ["/connexion", "/inscription", "/connexion/factor-one", "/inscription/verify-email-address"]) {
  const r0 = await fetch(BASE + p);
  const html = await r0.text();
  ok(r0.status === 200 && html.includes("FarimaGame"), `page Clerk ${p} -> ${r0.status}`);
}

// 2. comptes
const admin = await user(`admin_${suffix}`);
const alice = await user(`alice_${suffix}`);
const bob = await user(`bob_${suffix}`);
const carol = await user(`carol_${suffix}`);
const adminMe = await me(admin);
ok(adminMe.role === "ADMIN", `rôle du 1er compte = ${adminMe.role} (attendu ADMIN si base vide ou ADMIN_USERNAMES)`);
ok((await me(alice)).role === "JOUEUR", "alice est JOUEUR");
ok((await me(alice)).fcfa === 0 && (await me(alice)).coris === 500, "alice : 500 Coris, 0 F CFA");
ok((await alice("/api/house")).status === 403, "alice : /api/house interdit (403)");
ok((await alice("/api/admin/paris")).status === 403, "alice : /api/admin/paris interdit (403)");
ok((await admin("/api/house")).status === 200, "admin : /api/house autorisé");
const maison = await user(`maison${suffix}`);
ok((await me(maison)).role === "HOME", `rôle Maison = ${(await me(maison)).role}`);
ok((await maison("/api/house")).status === 200, "Maison : /api/house autorisé");
ok((await maison("/api/admin/paris")).status === 200, "Maison : suivi de l'argent des paris autorisé");

// 3. dépôts simulés
let r = await alice("/api/portefeuille", { action: "deposit", operator: "orange", phone: "07 07 07 07 07", amount: 10000 });
ok(r.status === 200 && r.data.user.fcfa === 10000 && r.data.payment.status === "completed", `alice dépôt 10 000 F (Orange) -> ${r.data?.user?.fcfa}`);
r = await alice("/api/portefeuille", { action: "deposit", operator: "mtn", phone: "0505000000", amount: 1000 });
ok(r.status === 200 && r.data.payment.status === "failed" && r.data.user.fcfa === 10000, "dépôt refusé (numéro ...0000) : solde inchangé");
r = await alice("/api/portefeuille", { action: "deposit", operator: "wave", phone: "0101010101", amount: 50 });
ok(r.status === 400, "dépôt sous le minimum refusé (400)");
r = await alice("/api/portefeuille", { action: "deposit", operator: "wave", phone: "123", amount: 1000 });
ok(r.status === 400, "numéro invalide refusé (400)");
r = await carol("/api/portefeuille", { action: "deposit", operator: "wave", phone: "0101010101", amount: 3000 });
ok(r.data?.user?.fcfa === 3000, "carol dépôt 3 000 F (Wave)");

// 4. conversion Lions -> F CFA
r = await alice("/api/portefeuille", { action: "convert", lions: 1 });
ok(r.status === 403, "alice (non Pro) ne peut pas convertir des Lions (403)");
await bob("/api/pro", { action: "upgrade" });
r = await bob("/api/pro", { action: "convert", lions: 10 });
ok(r.data?.user?.lions === 10 && r.data.user.coris === 0, "bob Pro : 500 Coris -> 10 Lions");
const cfg = (await bob("/api/me")).data.config;
r = await bob("/api/portefeuille", { action: "convert", lions: 10 });
ok(r.data?.user?.fcfa === 10 * cfg.FCFA_PER_LION && r.data.user.lions === 0, `bob : 10 Lions -> ${10 * cfg.FCFA_PER_LION} F CFA (taux ${cfg.FCFA_PER_LION})`);
r = await bob("/api/portefeuille", { action: "convert", lions: 1 });
ok(r.status === 400, "conversion sans Lions refusée (400)");

// 5. matchs
r = await alice("/api/paris");
const { matches, competitions } = r.data;
ok(competitions.length === 12, `12 compétitions (${competitions.length})`);
ok(matches.length > 50, `matchs démo générés : ${matches.length}`);
const compsWithMatches = new Set(matches.map((m) => m.competitionId));
ok(competitions.every((c) => compsWithMatches.has(c.id)), `chaque compétition a des matchs (${[...compsWithMatches].length}/12)`);
const open = matches.filter((m) => m.bettingOpen && Date.parse(m.kickoff) > Date.now() + 3600000);
ok(open.length >= 3, `matchs ouverts aux paris : ${open.length}`);
const [M, M2, M3] = open;
console.log(`   match principal : ${M.home} - ${M.away} (${M.competition.name})`);

// 6. paris
const bet = (c, matchId, market, selection, stake) => c("/api/paris/bets", { matchId, market, selection, stake });
ok((await bet(alice, M.id, "1N2", "1", 50)).status === 400, "mise sous le minimum refusée (400)");
ok((await bet(carol, M.id, "1N2", "1", 99999)).status === 400, "mise supérieure au solde refusée (400)");
ok((await bet(alice, M.id, "1N2", "X", 1000)).status === 400, "issue invalide refusée (400)");
const closed = matches.find((m) => !m.bettingOpen);
if (closed) ok((await bet(alice, closed.id, "1N2", "1", 100)).status === 400, `pari sur match fermé (${closed.status}) refusé`);

ok((await bet(alice, M.id, "1N2", "1", 3000)).status === 200, "alice 3 000 F sur 1");
ok((await bet(bob, M.id, "1N2", "2", 2000)).status === 200, "bob 2 000 F sur 2");
ok((await bet(carol, M.id, "1N2", "1", 1000)).status === 200, "carol 1 000 F sur 1");
ok((await bet(alice, M.id, "BTTS", "non", 1000)).status === 200, "alice 1 000 F sur BTTS non (seule parieuse)");
ok((await bet(bob, M.id, "OU25", "plus", 500)).status === 200, "bob 500 F sur +2,5");
ok((await bet(carol, M.id, "OU25", "plus", 500)).status === 200, "carol 500 F sur +2,5");
ok((await bet(alice, M2.id, "1N2", "N", 1000)).status === 200, "alice 1 000 F sur N (match 2)");
ok((await bet(bob, M2.id, "1N2", "2", 1000)).status === 200, "bob 1 000 F sur 2 (match 2)");
ok((await bet(carol, M3.id, "1N2", "1", 500)).status === 200, "carol 500 F sur 1 (match 3)");

r = await alice(`/api/paris/match/${encodeURIComponent(M.id)}`);
const p1 = r.data.match.markets.find((m) => m.market === "1N2");
ok(p1.total === 6000, `pot 1N2 = 6 000 F (${p1.total})`);
const o1 = p1.outcomes.find((o) => o.selection === "1");
ok(Math.abs(o1.poolOdds - 1.35) < 1e-9, `cote du pot issue 1 = 6000×0,9/4000 = 1,35 (${o1.poolOdds})`);
{
  const w = 6000 / (6000 + p1.blendK);
  const want = Math.round((0.9 / ((1 - w) * o1.refProb + (w * 4000) / 6000)) * 100) / 100;
  ok(Math.abs(o1.odds - want) < 0.011, `cote affichée = mélange référence/pot (w=${w.toFixed(3)}) = ${want} (${o1.odds})`);
  ok(p1.outcomes.every((o) => typeof o.odds === "number"), "toutes les issues ont une cote affichée");
}
ok(r.data.myBets.length === 2, "alice voit ses 2 paris sur le match");
ok((await me(alice)).fcfa === 5000, `alice solde après paris = 5 000 F (${(await me(alice)).fcfa})`);

// 7. règlement par l'admin
ok((await alice("/api/admin/paris", { action: "result", matchId: M.id, home: 2, away: 1 })).status === 403, "alice ne peut pas régler un match (403)");
r = await admin("/api/admin/paris", { action: "result", matchId: M.id, status: "finished", home: 2, away: 1 });
ok(r.status === 200 && r.data.match.settled, "admin règle le match principal 2-1");
r = await admin("/api/admin/paris", { action: "result", matchId: M2.id, status: "finished", home: 1, away: 0 });
ok(r.status === 200, "admin règle le match 2 sur 1-0 (personne sur l'issue 1)");
r = await admin("/api/admin/paris", { action: "result", matchId: M3.id, status: "postponed" });
ok(r.status === 200, "admin déclare le match 3 reporté");
ok((await admin("/api/admin/paris", { action: "result", matchId: M.id, home: 0, away: 0 })).status === 400, "re-règlement refusé (400)");
ok((await bet(alice, M.id, "1N2", "1", 100)).status === 400, "pari après règlement refusé (400)");

const fa = (await me(alice)).fcfa, fb = (await me(bob)).fcfa, fc = (await me(carol)).fcfa;
// alice : 10000 -3000 -1000 -1000 +4050 (gain) +1000 (BTTS remboursé) +1000 (match 2 remboursé) = 11050
ok(fa === 11050, `alice = 11 050 F (gain 4 050 = 3000/4000 × 90 % × 6000) -> ${fa}`);
// bob : 5000 -2000 -500 -1000 +500 (+2,5 sans perdant) +1000 (match 2) = 3000
ok(fb === 3000, `bob = 3 000 F (perd 2 000) -> ${fb}`);
// carol : 3000 -1000 -500 -500 +1350 +500 +500 = 3350
ok(fc === 3350, `carol = 3 350 F (gain 1 350) -> ${fc}`);
r = await admin("/api/admin/paris");
const am = r.data.matches.find((m) => m.id === M.id);
ok(am.commission === 600, `commission maison sur le match = 600 F = 10 % de 6 000 (${am.commission})`);
ok(r.data.stats.commission === 600, `commission totale paris = 600 F (${r.data.stats.commission})`);
ok(am.settlement.BTTS.refunded && am.settlement.OU25.refunded, "BTTS (une seule parieuse) et +/-2,5 (aucun perdant) remboursés");
const h = (await admin("/api/house")).data;
ok(h.commissions.fcfa === 600, `page Maison : commissions F CFA = ${h.commissions.fcfa}`);

const ab = (await alice("/api/paris/bets")).data.bets;
ok(ab.filter((b) => b.status === "won").length === 1 && ab.filter((b) => b.status === "refunded").length === 2, "mes paris (alice) : 1 gagné, 2 remboursés");
const bb = (await bob("/api/paris/bets")).data.bets;
ok(bb.filter((b) => b.status === "lost").length === 1 && bb.filter((b) => b.status === "refunded").length === 2, "mes paris (bob) : 1 perdu, 2 remboursés");
const cb = (await carol("/api/paris/bets")).data.bets;
ok(cb.some((b) => b.status === "refunded" && /report/i.test(b.note ?? "")), "carol : pari du match reporté remboursé");

// 8. retraits
r = await alice("/api/portefeuille", { action: "withdraw", operator: "orange", phone: "0707070707", amount: 2000 });
ok(r.data?.payment?.status === "pending" && r.data.user.fcfa === 9050, "alice demande un retrait de 2 000 F (en attente, montant bloqué)");
await admin("/api/admin/paris", { action: "withdrawal", paymentId: r.data.payment.id, decision: "reject" });
ok((await me(alice)).fcfa === 11050, "retrait refusé par l'admin : montant restitué");
r = await alice("/api/portefeuille", { action: "withdraw", operator: "moov", phone: "0101010101", amount: 1000 });
await admin("/api/admin/paris", { action: "withdrawal", paymentId: r.data.payment.id, decision: "approve" });
ok((await me(alice)).fcfa === 10050, "retrait validé : solde 10 050 F");
ok((await alice("/api/portefeuille", { action: "withdraw", operator: "moov", phone: "0101010101", amount: 50000 })).status === 400, "retrait supérieur au solde refusé");
const wallet = (await alice("/api/portefeuille")).data;
ok(wallet.payments.length === 4 && wallet.transactions.length > 5, `historique : ${wallet.payments.length} opérations Mobile Money, ${wallet.transactions.length} mouvements F CFA`);

// 9. non-régression des jeux
r = await alice("/api/tables", { game: "awale", mode: "cpu", currency: "coris" });
ok(r.status === 200 && r.data.id, "les jeux fonctionnent toujours (table Awalé contre l'ordinateur)");
ok((await me(alice)).coris === 450, "mise de 50 Coris débitée");
ok((await alice("/api/tables", { game: "awale", mode: "cpu", currency: "fcfa" })).status === 400, "pas de table en F CFA");

// 10. une fiche joueur par compte (pas de doublon, pas de 2e bonus)
await alice("/api/me");
ok((await me(alice)).coris === 450, "2e visite d'alice : pas de nouveau bonus");
const carolTwin = await user(`Carol_${suffix}`.toLowerCase());
ok((await me(carolTwin)).id === (await me(carol)).id, "même compte -> même fiche joueur");

console.log(failures === 0 ? "\n🎉 Tous les tests sont passés." : `\n⚠️ ${failures} test(s) en échec.`);

process.exit(failures === 0 ? 0 : 1);
