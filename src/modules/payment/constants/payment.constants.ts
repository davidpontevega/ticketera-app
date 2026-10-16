export const DEFAULT_PLATFORM_FEE_PERCENT = 10;
export const FEE_PERCENT_MAX = 50;
export const PAYMENTS_PATH = "/organizer/payments";
export const PAYMENTS_REFRESH_PATH = "/organizer/payments/refresh";
export const ADMIN_SETTINGS_PATH = "/admin/settings";

export function isConnectEnabled(): boolean {
  return process.env.STRIPE_CONNECT_ENABLED === "true";
}

export function parsePayoutHoldDays(raw: string | undefined): number {
  const days = Number(raw);
  return raw?.trim() && Number.isInteger(days) && days >= 0 ? days : 7;
}

/** Dias de retencion tras el inicio del evento (env `PAYOUT_HOLD_DAYS`, default 7). */
export const PAYOUT_HOLD_DAYS = parsePayoutHoldDays(process.env.PAYOUT_HOLD_DAYS);
