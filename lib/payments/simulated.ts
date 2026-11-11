// Fournisseur SIMULÉ (mode démo) : aucun argent réel ne circule.
// Les dépôts sont confirmés immédiatement. Les retraits sont acceptés par le "fournisseur" mais restent
// "en attente" jusqu'à validation par la Maison (page /maison), comme chez un vrai opérateur
// où l'envoi est déclenché après contrôle.
// Pour tester un échec : un numéro se terminant par 0000 est refusé.
import type { PaymentProvider, PaymentRequest, PaymentResult } from "./types";

function ref(prefix: string) {
  return `${prefix}-SIM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const simulatedProvider: PaymentProvider = {
  id: "simulation",
  label: "Simulation (mode démo)",
  isSimulation: true,
  async collect(req: PaymentRequest): Promise<PaymentResult> {
    if (req.phone.endsWith("0000")) return { status: "failed", message: "Paiement refusé par l'opérateur (simulation)." };
    return { status: "completed", providerRef: ref("DEP"), message: "Paiement simulé confirmé." };
  },
  async payout(req: PaymentRequest): Promise<PaymentResult> {
    if (req.phone.endsWith("0000")) return { status: "failed", message: "Numéro refusé par l'opérateur (simulation)." };
    return { status: "pending", providerRef: ref("RET"), message: "Demande de retrait enregistrée (simulation)." };
  },
};
