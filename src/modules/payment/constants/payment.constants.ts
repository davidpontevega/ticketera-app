export const DEFAULT_PLATFORM_FEE_PERCENT = 10;
export const FEE_PERCENT_MAX = 50;
export const PAYMENTS_PATH = "/organizer/payments";
export const ADMIN_SETTINGS_PATH = "/admin/settings";

export function isConnectEnabled(): boolean {
  return process.env.STRIPE_CONNECT_ENABLED === "true";
}
