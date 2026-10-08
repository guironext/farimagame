// Test de bout en bout des paris sportifs / portefeuille F CFA.
// À lancer contre un serveur qui utilise une base de TEST séparée, par exemple :
//   FARIMA_DATA_DIR=/tmp/farima-test PORT=3100 npm start      (après npm run build)
//   node scripts/test-paris.mjs http://localhost:3100
// Le premier compte créé dans une base vide devient ADMIN : ne lancez pas ce script sur votre vraie base.
const BASE = process.argv[2] ?? "http://localhost:3100";
const suffix = Date.now().toString(36).slice(-5);
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures++;
};

function client() {
  let cookie = "";
  return async function call(path, body) {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* page HTML */
    }
    return { status: res.status, data };
  };
}

async function user(name, password = "secret123") {
  const c = client();
  const r = await c("/api/auth/register", { username: name, password });
  ok(r.status === 200, `inscription ${name} (${r.status})`);
  return c;
}

const me = async (c) => (await c("/api/me")).data.user;

// 1. pages
for (const p of ["/", "/inscription", "/connexion", "/tableau-de-bord", "/salon", "/jeu/x", "/pro", "/maison", "/paris", "/paris/match/demo%3Atest", "/paris/mes-paris", "/portefeuille", "/admin/paris"]) {
  const r = await fetch(BASE + p);
  ok(r.status === 200, `GET ${p} -> ${r.status}`);
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

console.log(failures === 0 ? "\n🎉 Tous les tests sont passés." : `\n⚠️ ${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
