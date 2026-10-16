import type { OnboardingStatus } from "../types/payment.types";

/** Comision en centavos enteros; el fee siempre queda por debajo del total (Stripe lo exige). */
export function calculatePlatformFee(totalAmount: number, feePercent: number) {
  const totalCents = Math.round(totalAmount * 100);
  const feeCents = Math.min(Math.round((totalCents * feePercent) / 100), Math.max(totalCents - 1, 0));
  return { feeCents, netCents: totalCents - feeCents };
}

export function mapAccountToOnboardingStatus(account: {
  details_submitted?: boolean;
  capabilities?: { transfers?: string } | null;
}): Exclude<OnboardingStatus, "not_started"> {
  return account.details_submitted && account.capabilities?.transfers === "active" ? "complete" : "pending";
}
