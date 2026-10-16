import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { users } from "@/modules/user/db/user.table";

import { PAYMENTS_PATH, PAYMENTS_REFRESH_PATH, isConnectEnabled } from "../constants/payment.constants";
import type { OnboardingStatus } from "../types/payment.types";
import { mapAccountToOnboardingStatus } from "../utils/payment.utils";

interface ConnectUser {
  id: string;
  stripeAccountId: string | null;
}

// Payout manual: el balance queda en la cuenta conectada hasta que la plataforma lo libera (spec 049).
const MANUAL_PAYOUTS = { payouts: { schedule: { interval: "manual" } } } as const;

export type StartOnboardingResult = { url: string } | { error: "connect-disabled" };

export async function startConnectOnboarding(user: ConnectUser, origin: string): Promise<StartOnboardingResult> {
  if (!isConnectEnabled()) return { error: "connect-disabled" };

  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        type: "express",
        country: process.env.STRIPE_CONNECT_ACCOUNT_COUNTRY || "US",
        capabilities: { transfers: { requested: true } },
        settings: MANUAL_PAYOUTS,
        metadata: { userId: user.id },
      },
      { idempotencyKey: `connect-account-${user.id}` },
    );
    accountId = account.id;
    // Carrera: si otro request ya guardo la cuenta, el idempotencyKey garantiza que es la misma.
    await db
      .update(users)
      .set({ stripeAccountId: accountId, stripeOnboardingStatus: "pending" })
      .where(and(eq(users.id, user.id), isNull(users.stripeAccountId)));
  } else {
    // Idempotente: migra cuentas creadas con payout automatico.
    await stripe.accounts.update(accountId, { settings: MANUAL_PAYOUTS });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${origin}${PAYMENTS_PATH}?connect=return`,
    refresh_url: `${origin}${PAYMENTS_REFRESH_PATH}`,
  });
  return { url: link.url };
}

/** Consulta Stripe y persiste el estado; sin cuenta devuelve `not_started`. */
export async function syncOnboardingStatus(user: ConnectUser): Promise<OnboardingStatus> {
  if (!user.stripeAccountId) return "not_started";
  const status = mapAccountToOnboardingStatus(await stripe.accounts.retrieve(user.stripeAccountId));
  await db.update(users).set({ stripeOnboardingStatus: status }).where(eq(users.id, user.id));
  return status;
}

/** Cuenta destino del cobro: solo si el onboarding esta `complete` (lee DB, nunca Stripe). */
export async function getPayoutAccount(organizerId: string): Promise<{ accountId: string } | null> {
  const [row] = await db
    .select({ accountId: users.stripeAccountId, status: users.stripeOnboardingStatus })
    .from(users)
    .where(eq(users.id, organizerId))
    .limit(1);
  return row?.accountId && row.status === "complete" ? { accountId: row.accountId } : null;
}

/** Webhook Connect: sincroniza el estado desde Stripe (retrieve), inmune a eventos desordenados o repetidos. */
export async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "account.updated") return;
  const accountId = event.data.object.id;
  const status = mapAccountToOnboardingStatus(await stripe.accounts.retrieve(accountId));
  // Cuenta desconocida: el UPDATE no afecta filas (no-op).
  await db.update(users).set({ stripeOnboardingStatus: status }).where(eq(users.stripeAccountId, accountId));
}
