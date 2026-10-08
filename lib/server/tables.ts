import { HOUSE_SHARE, INACTIVITY_CLAIM_MS, PRO_STAKE_LIONS, STAKE_CORIS, WINNER_SHARE, fromUnits, toUnits } from "../config";
import { ENGINES } from "../games";
import { GAMES, modeLabel, modePlayers } from "../games/meta";
import type { Currency, GameId, Mode, TableView } from "../types";
import { newId, nowIso, readDb, transact, type Db, type TableRow } from "./db";
import { AppError } from "./errors";
import { CURRENCY_LABEL, getUser, houseMove, walletMove } from "./wallet";

const CPU_NAME = "Ordinateur";
const MAX_LOG = 40;

export function stakeFor(currency: Currency): number {
  return currency === "coris" ? toUnits(STAKE_CORIS) : toUnits(PRO_STAKE_LIONS);
}

function names(t: TableRow) {
  return t.seats.map((s) => s.username);
}

function pushLog(t: TableRow, lines: string[]) {
  t.log = [...t.log, ...lines].slice(-MAX_LOG);
}

function fmt(units: number, c: Currency) {
  const v = fromUnits(units);
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${CURRENCY_LABEL[c]}`;
}

function getTable(db: Db, id: string): TableRow {
  const t = db.tables.find((x) => x.id === id);
  if (!t) throw new AppError(404, "Table introuvable.");
  return t;
}

function startGame(db: Db, t: TableRow) {
  t.status = "playing";
  t.startedAt = nowIso();
  t.lastMoveAt = t.startedAt;
  t.state = ENGINES[t.game].init(t.maxPlayers);
  pushLog(t, [`La partie commence ! Pot : ${fmt(t.pot, t.currency)}`]);
  runCpu(db, t);
}

/** Règlement : 80 % du pot au gagnant, 20 % à la maison. */
function settle(db: Db, t: TableRow, winnerSeat: number | null, draw: boolean) {
  t.status = "finished";
  t.finishedAt = nowIso();
  t.winnerSeat = winnerSeat;
  t.isDraw = draw;
  const pot = t.pot;
  const prize = Math.round(pot * WINNER_SHARE);
  const label = `${GAMES[t.game].name} (${modeLabel(t.mode)})`;
  if (draw) {
    const each = Math.floor(prize / t.seats.length);
    const commission = pot - each * t.seats.length;
    t.payout = each;
    t.commission = commission;
    for (const s of t.seats) {
      if (s.isCpu) houseMove(db, t.currency, each, "nul_ordinateur", `Part de l'ordinateur (nul) – ${label}`, t.id);
      else walletMove(db, getUser(db, s.userId!), t.currency, each, "nul", `Match nul – ${label}`, t.id);
    }
    houseMove(db, t.currency, commission, "commission", `Commission 20 % (nul) – ${label}`, t.id);
    pushLog(t, [`Match nul : chaque joueur reçoit ${fmt(each, t.currency)}`]);
    return;
  }
  const w = t.seats[winnerSeat!];
  const commission = pot - prize;
  t.payout = prize;
  t.commission = commission;
  if (w.isCpu) houseMove(db, t.currency, prize, "gain_ordinateur", `Victoire de l'ordinateur – ${label}`, t.id);
  else walletMove(db, getUser(db, w.userId!), t.currency, prize, "gain", `Victoire – ${label}`, t.id);
  houseMove(db, t.currency, commission, "commission", `Commission ${Math.round(HOUSE_SHARE * 100)} % – ${label}`, t.id);
  pushLog(t, [`${w.username} remporte ${fmt(prize, t.currency)} (maison : ${fmt(commission, t.currency)})`]);
}

function checkOver(db: Db, t: TableRow) {
  const r = ENGINES[t.game].result(t.state);
  if (r.over && t.status === "playing") settle(db, t, r.winner, r.draw);
}

function runCpu(db: Db, t: TableRow) {
  const engine = ENGINES[t.game];
  let guard = 0;
  while (t.status === "playing" && guard++ < 500) {
    const seat = engine.current(t.state);
    if (seat == null || !t.seats[seat]?.isCpu) break;
    const move = engine.ai(t.state, seat);
    const res = engine.apply(t.state, seat, move, names(t));
    t.state = res.state;
    pushLog(t, res.log);
    checkOver(db, t);
  }
}

export function createTable(userId: string, gameRaw: unknown, modeRaw: unknown, currencyRaw: unknown): string {
  const game = String(gameRaw) as GameId;
  const mode = String(modeRaw) as Mode;
  const currency = String(currencyRaw) as Currency;
  const meta = GAMES[game];
  if (!meta) throw new AppError(400, "Jeu inconnu.");
  if (!meta.modes.includes(mode)) throw new AppError(400, "Mode non disponible pour ce jeu.");
  if (currency !== "coris" && currency !== "lions") throw new AppError(400, "Monnaie inconnue.");
  return transact((db) => {
    const u = getUser(db, userId);
    if (currency === "lions" && u.level !== "pro") throw new AppError(403, "Les parties en Lions sont réservées aux joueurs Pro.");
    const stake = stakeFor(currency);
    const id = newId("t_");
    const t: TableRow = {
      id,
      game,
      mode,
      currency,
      stake,
      maxPlayers: modePlayers(mode),
      status: "waiting",
      seats: [{ seat: 0, userId: u.id, username: u.username, isCpu: false, active: true }],
      createdBy: u.id,
      createdAt: nowIso(),
      winnerSeat: null,
      isDraw: false,
      pot: stake,
      payout: 0,
      commission: 0,
      state: null,
      log: [`${u.username} a créé la table (mise : ${fmt(stake, currency)})`],
      version: 1,
    };
    walletMove(db, u, currency, -stake, "mise", `Mise – ${meta.name} (${modeLabel(mode)})`, id);
    db.tables.push(t);
    if (mode === "cpu") {
      // L'ordinateur mise le même montant, avancé par la maison.
      t.seats.push({ seat: 1, userId: null, username: CPU_NAME, isCpu: true, active: true });
      houseMove(db, currency, -stake, "mise_ordinateur", `Mise de l'ordinateur – ${meta.name}`, id);
      t.pot += stake;
      startGame(db, t);
    }
    return id;
  });
}

export function joinTable(userId: string, tableId: string) {
  return transact((db) => {
    const t = getTable(db, tableId);
    const u = getUser(db, userId);
    if (t.status !== "waiting") throw new AppError(400, "Cette table n'accepte plus de joueurs.");
    if (t.seats.some((s) => s.userId === u.id)) throw new AppError(400, "Vous êtes déjà à cette table.");
    if (t.seats.length >= t.maxPlayers) throw new AppError(400, "La table est complète.");
    if (t.currency === "lions" && u.level !== "pro") throw new AppError(403, "Table réservée aux joueurs Pro.");
    walletMove(db, u, t.currency, -t.stake, "mise", `Mise – ${GAMES[t.game].name} (${modeLabel(t.mode)})`, t.id);
    t.seats.push({ seat: t.seats.length, userId: u.id, username: u.username, isCpu: false, active: true });
    t.pot += t.stake;
    t.version++;
    pushLog(t, [`${u.username} rejoint la table`]);
    if (t.seats.length === t.maxPlayers) startGame(db, t);
  });
}

export function leaveTable(userId: string, tableId: string) {
  return transact((db) => {
    const t = getTable(db, tableId);
    const u = getUser(db, userId);
    if (t.status !== "waiting") throw new AppError(400, "La partie a déjà commencé : utilisez « Abandonner ».");
    const idx = t.seats.findIndex((s) => s.userId === u.id);
    if (idx < 0) throw new AppError(400, "Vous n'êtes pas à cette table.");
    walletMove(db, u, t.currency, t.stake, "remboursement", `Remboursement – ${GAMES[t.game].name}`, t.id);
    t.seats.splice(idx, 1);
    t.seats.forEach((s, i) => (s.seat = i));
    t.pot -= t.stake;
    t.version++;
    pushLog(t, [`${u.username} quitte la table (mise remboursée)`]);
    if (t.seats.length === 0) {
      t.status = "cancelled";
      t.finishedAt = nowIso();
    }
  });
}

function forfeit(db: Db, t: TableRow, seat: number, reason: string) {
  const s = t.seats[seat];
  s.active = false;
  pushLog(t, [`${s.username} ${reason}`]);
  const activeSeats = t.seats.filter((x) => x.active);
  if (t.game === "ludo" && activeSeats.length >= 2) {
    t.state = ENGINES.ludo.resign(t.state, seat);
    runCpu(db, t);
    checkOver(db, t);
    return;
  }
  // il ne reste qu'un joueur : il gagne
  const winner = activeSeats.length === 1 ? activeSeats[0].seat : t.seats.find((x) => x.seat !== seat)!.seat;
  settle(db, t, winner, false);
}

export type TableAction =
  | { action: "join" }
  | { action: "leave" }
  | { action: "move"; move: unknown }
  | { action: "resign" }
  | { action: "claim" };

export function tableAction(userId: string, tableId: string, body: Record<string, unknown>) {
  const action = String(body.action ?? "");
  if (action === "join") return joinTable(userId, tableId);
  if (action === "leave") return leaveTable(userId, tableId);
  return transact((db) => {
    const t = getTable(db, tableId);
    if (t.status !== "playing") throw new AppError(400, "La partie n'est pas en cours.");
    const seat = t.seats.find((s) => s.userId === userId);
    if (!seat) throw new AppError(403, "Vous n'êtes pas joueur à cette table.");
    if (!seat.active) throw new AppError(400, "Vous avez abandonné cette partie.");
    const engine = ENGINES[t.game];
    if (action === "move") {
      const res = engine.apply(t.state, seat.seat, body.move as never, names(t));
      t.state = res.state;
      pushLog(t, res.log);
      checkOver(db, t);
      runCpu(db, t);
    } else if (action === "resign") {
      forfeit(db, t, seat.seat, "abandonne la partie");
    } else if (action === "claim") {
      const cur = engine.current(t.state);
      if (cur == null || cur === seat.seat || t.seats[cur].isCpu) throw new AppError(400, "Rien à réclamer.");
      const idle = Date.now() - new Date(t.lastMoveAt ?? t.startedAt ?? t.createdAt).getTime();
      if (idle < INACTIVITY_CLAIM_MS) throw new AppError(400, "L'adversaire a encore du temps pour jouer.");
      forfeit(db, t, cur, "est déclaré forfait (inactivité)");
    } else throw new AppError(400, "Action inconnue.");
    t.lastMoveAt = nowIso();
    t.version++;
  });
}

export function viewTable(t: TableRow, userId: string | null): TableView {
  const engine = ENGINES[t.game];
  const mySeat = userId ? (t.seats.find((s) => s.userId === userId)?.seat ?? null) : null;
  return {
    id: t.id,
    game: t.game,
    mode: t.mode,
    currency: t.currency,
    stake: fromUnits(t.stake),
    maxPlayers: t.maxPlayers,
    status: t.status,
    seats: t.seats.map((s) => ({ ...s })),
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
    lastMoveAt: t.lastMoveAt,
    currentSeat: t.status === "playing" && t.state ? engine.current(t.state) : null,
    winnerSeat: t.winnerSeat,
    isDraw: t.isDraw,
    pot: fromUnits(t.pot),
    payout: fromUnits(t.payout),
    commission: fromUnits(t.commission),
    state: t.state,
    log: t.log,
    mySeat,
    version: t.version,
  };
}

export function getTableView(tableId: string, userId: string | null) {
  const db = readDb();
  return viewTable(getTable(db, tableId), userId);
}

export function listTables(userId: string) {
  const db = readDb();
  const open = db.tables
    .filter((t) => t.status === "waiting" && !t.seats.some((s) => s.userId === userId))
    .slice(-50)
    .reverse()
    .map((t) => viewTable(t, userId));
  const mine = db.tables
    .filter((t) => t.seats.some((s) => s.userId === userId) && t.status !== "cancelled")
    .slice(-30)
    .reverse()
    .map((t) => {
      const v = viewTable(t, userId);
      v.state = null; // allège la réponse
      v.log = [];
      return v;
    });
  return { open, mine };
}
