// Interface d'un fournisseur de paiement Mobile Money (agrégateur).
// Pour brancher un vrai agrégateur (CinetPay, PayDunya, Hub2, FedaPay, etc.), créez un fichier qui
// implémente PaymentProvider puis enregistrez-le dans lib/payments/index.ts.
import type { MobileOperator } from "../types";

export interface PaymentRequest {
  reference: string; // identifiant interne du paiement (PaymentRow.id)
  userId: string;
  operator: MobileOperator;
  phone: string; // numéro normalisé (chiffres uniquement, avec indicatif 225)
  amount: number; // francs CFA entiers
}

export interface PaymentResult {
  /**
   * completed : argent reçu / envoyé ; pending : en attente de confirmation (webhook du fournisseur) ;
   * failed : refusé.
   */
  status: "completed" | "pending" | "failed";
  providerRef?: string;
  message?: string;
}

export interface PaymentProvider {
  id: string;
  label: string;
  /** true = aucun argent réel ne circule. */
  isSimulation: boolean;
  /** Encaissement (le joueur paie depuis son compte Mobile Money). */
  collect(req: PaymentRequest): Promise<PaymentResult>;
  /** Décaissement (la plateforme envoie l'argent vers le compte Mobile Money du joueur). */
  payout(req: PaymentRequest): Promise<PaymentResult>;
}

export const OPERATORS: { id: MobileOperator; name: string; color: string; short: string }[] = [
  { id: "orange", name: "Orange Money", short: "OM", color: "from-orange-500 to-orange-600" },
  { id: "mtn", name: "MTN MoMo", short: "MoMo", color: "from-yellow-300 to-yellow-500" },
  { id: "wave", name: "Wave", short: "Wave", color: "from-sky-400 to-blue-600" },
  { id: "moov", name: "Moov Money", short: "Moov", color: "from-blue-600 to-indigo-700" },
];

export const operatorName = (id: string) => OPERATORS.find((o) => o.id === id)?.name ?? id;

/** Normalise un numéro ivoirien : 10 chiffres (ex. 07 07 07 07 07), indicatif +225 facultatif. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("225") && d.length === 13) d = d.slice(3);
  if (!/^0\d{9}$/.test(d)) return null;
  return "225" + d;
}

export function formatPhone(n: string): string {
  const local = n.startsWith("225") ? n.slice(3) : n;
  return "+225 " + local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
