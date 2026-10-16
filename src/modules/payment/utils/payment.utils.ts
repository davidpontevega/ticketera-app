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

const DAY_MS = 24 * 60 * 60 * 1000;

// Sin `ends_at` el evento "concluye" en `starts_at` (spec 049).
export function getPayoutReleaseDate(startsAt: Date, holdDays: number): Date {
  return new Date(startsAt.getTime() + holdDays * DAY_MS);
}

export function isPayoutReleasable(startsAt: Date, now: Date, holdDays: number): boolean {
  return now.getTime() >= getPayoutReleaseDate(startsAt, holdDays).getTime();
}
