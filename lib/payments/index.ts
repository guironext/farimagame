import { PAYMENT_PROVIDER } from "../config";
import { simulatedProvider } from "./simulated";
import type { PaymentProvider } from "./types";

// Registre des fournisseurs. Ajoutez ici votre agrégateur réel, ex. : cinetpay: cinetpayProvider
const PROVIDERS: Record<string, PaymentProvider> = {
  simulation: simulatedProvider,
};

export function getPaymentProvider(): PaymentProvider {
  return PROVIDERS[PAYMENT_PROVIDER] ?? simulatedProvider;
}

export * from "./types";
