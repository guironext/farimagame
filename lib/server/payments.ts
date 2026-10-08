import {
  DEPOSIT_MAX_FCFA,
  DEPOSIT_MIN_FCFA,
  WITHDRAW_MAX_FCFA,
  WITHDRAW_MIN_FCFA,
  fromUnits,
  toUnits,
} from "../config";
import { getPaymentProvider, normalizePhone, operatorName, OPERATORS } from "../payments";
import type { MobileOperator, PaymentKind, PaymentView } from "../types";
import { newId, nowIso, readDb, transact, type Db, type PaymentRow } from "./db";
import { AppError } from "./errors";
import { getUser, walletMove } from "./wallet";

function parseInput(kind: PaymentKind, body: Record<string, unknown>) {
  const operator = String(body.operator ?? "") as MobileOperator;
  if (!OPERATORS.some((o) => o.id === operator)) throw new AppError(400, "Choisissez un opérateur Mobile Money.");
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) throw new AppError(400, "Numéro de téléphone invalide (10 chiffres, ex. 07 07 07 07 07).");
  const amount = Number(body.amount);
  const [min, max] = kind === "depot" ? [DEPOSIT_MIN_FCFA, DEPOSIT_MAX_FCFA] : [WITHDRAW_MIN_FCFA, WITHDRAW_MAX_FCFA];
  if (!Number.isInteger(amount) || amount < min || amount > max)
    throw new AppError(400, `Le montant doit être un nombre entier entre ${min.toLocaleString("fr-FR")} et ${max.toLocaleString("fr-FR")} F CFA.`);
  return { operator, phone, amount };
}

export function paymentView(p: PaymentRow, db?: Db): PaymentView {
  return {
    id: p.id,
    kind: p.kind,
    operator: p.operator,
    phone: p.phone,
    amount: fromUnits(p.amount),
    status: p.status,
    provider: p.provider,
    providerRef: p.providerRef,
    message: p.message,
    username: db ? db.users.find((u) => u.id === p.userId)?.username : undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Dépôt Mobile Money : crédite le solde F CFA quand le fournisseur confirme le paiement. */
export async function deposit(userId: string, body: Record<string, unknown>) {
  const { operator, phone, amount } = parseInput("depot", body);
  const provider = getPaymentProvider();
  const id = newId("pay_");
  const now = nowIso();
  transact((db) => {
    getUser(db, userId);
    db.payments.push({ id, userId, kind: "depot", operator, phone, amount: toUnits(amount), status: "pending", provider: provider.id, createdAt: now, updatedAt: now });
  });
  const res = await provider.collect({ reference: id, userId, operator, phone, amount });
  return transact((db) => {
    const p = db.payments.find((x) => x.id === id)!;
    p.providerRef = res.providerRef;
    p.message = res.message;
    p.updatedAt = nowIso();
    if (res.status === "completed") {
      p.status = "completed";
      walletMove(db, getUser(db, userId), "fcfa", p.amount, "depot", `Dépôt ${operatorName(operator)}${provider.isSimulation ? " (simulation)" : ""}`, undefined, { paymentId: id });
    } else if (res.status === "failed") {
      p.status = "failed";
    }
    return { payment: paymentView(p), user: getUser(db, userId) };
  });
}

/** Demande de retrait : le montant est débité tout de suite (bloqué) puis versé ou rendu. */
export async function withdraw(userId: string, body: Record<string, unknown>) {
  const { operator, phone, amount } = parseInput("retrait", body);
  const provider = getPaymentProvider();
  const id = newId("pay_");
  const now = nowIso();
  transact((db) => {
    const u = getUser(db, userId);
    if (u.fcfa < toUnits(amount)) throw new AppError(400, "Solde F CFA insuffisant.");
    db.payments.push({ id, userId, kind: "retrait", operator, phone, amount: toUnits(amount), status: "pending", provider: provider.id, createdAt: now, updatedAt: now });
    walletMove(db, u, "fcfa", -toUnits(amount), "retrait", `Retrait ${operatorName(operator)}${provider.isSimulation ? " (simulation)" : ""}`, undefined, { paymentId: id });
  });
  const res = await provider.payout({ reference: id, userId, operator, phone, amount });
  return transact((db) => {
    const p = db.payments.find((x) => x.id === id)!;
    p.providerRef = res.providerRef;
    p.message = res.message;
    p.updatedAt = nowIso();
    if (res.status === "completed") p.status = "completed";
    if (res.status === "failed") {
      p.status = "failed";
      walletMove(db, getUser(db, userId), "fcfa", p.amount, "retrait_annule", "Retrait refusé – montant restitué", undefined, { paymentId: id });
    }
    return { payment: paymentView(p), user: getUser(db, userId) };
  });
}

/** Décision de l'administrateur sur une demande de retrait en attente. */
export function decideWithdrawal(paymentId: unknown, decision: unknown) {
  return transact((db) => {
    const p = db.payments.find((x) => x.id === paymentId && x.kind === "retrait");
    if (!p) throw new AppError(404, "Demande de retrait introuvable.");
    if (p.status !== "pending") throw new AppError(400, "Cette demande a déjà été traitée.");
    p.updatedAt = nowIso();
    if (decision === "approve") {
      p.status = "completed";
      p.message = "Retrait validé et envoyé (simulation).";
    } else if (decision === "reject") {
      p.status = "rejected";
      p.message = "Retrait refusé par l'administrateur – montant restitué.";
      walletMove(db, getUser(db, p.userId), "fcfa", p.amount, "retrait_annule", "Retrait refusé – montant restitué", undefined, { paymentId: p.id });
    } else throw new AppError(400, "Décision inconnue.");
    return paymentView(p, db);
  });
}

export function listPayments(userId: string): PaymentView[] {
  const db = readDb();
  return db.payments.filter((p) => p.userId === userId).slice(-100).reverse().map((p) => paymentView(p));
}
