import "server-only";

import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { events } from "@/modules/event/db/event.table";
import { EVENT_CURRENCY } from "@/modules/event/constants/event.constants";
import { orders } from "@/modules/order/db/order.table";

import { PAYOUT_HOLD_DAYS } from "../constants/payment.constants";
import { eventPayouts } from "../db/event-payout.table";
import type { EventPayoutRow, PayoutStatus, PayoutSummary } from "../types/payment.types";
import { getPayoutReleaseDate, isPayoutReleasable } from "../utils/payment.utils";

export interface ReleasePayoutsResult {
  released: number;
  errors: string[];
}

const NO_BALANCE_ERROR = "No hay saldo disponible en Stripe para retirar.";

export async function getPayoutSummary(organizerId: string, now = new Date()): Promise<PayoutSummary> {
  const data = await db
    .select({
      eventId: events.id,
      title: events.title,
      startsAt: events.startsAt,
      net: sql<string>`sum(${orders.organizerNetAmount})`,
      payoutId: eventPayouts.id,
      payoutAmount: eventPayouts.amount,
    })
    .from(events)
    .innerJoin(orders, eq(orders.eventId, events.id))
    .leftJoin(eventPayouts, eq(eventPayouts.eventId, events.id))
    .where(
      and(
        eq(events.organizerId, organizerId),
        ne(events.status, "cancelled"),
        eq(orders.status, "paid"),
        isNotNull(orders.organizerNetAmount),
      ),
    )
    .groupBy(events.id, events.title, events.startsAt, eventPayouts.id, eventPayouts.amount);

  const rows: EventPayoutRow[] = data
    .map((r) => {
      const status: PayoutStatus = r.payoutId
        ? "released"
        : isPayoutReleasable(r.startsAt, now, PAYOUT_HOLD_DAYS)
          ? "available"
          : "held";
      return {
        eventId: r.eventId,
        title: r.title,
        // Liberado: el monto realmente pagado; si no, lo acumulado en ordenes pagadas.
        amount: Number(r.payoutAmount ?? r.net),
        releaseAt: getPayoutReleaseDate(r.startsAt, PAYOUT_HOLD_DAYS),
        status,
      };
    })
    .sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime());

  const heldTotal = rows.filter((r) => r.status !== "released").reduce((sum, r) => sum + r.amount, 0);
  return { rows, heldTotal };
}

/**
 * Paga a la cuenta bancaria los eventos cuya retencion vencio. Un fallo en un evento no frena el resto.
 * # ponytail: el payout sale en la moneda del balance sin conversion PEN->USD (spec 049, decision 6).
 */
export async function releaseDuePayouts(user: { id: string; stripeAccountId: string }): Promise<ReleasePayoutsResult> {
  const due = (await getPayoutSummary(user.id)).rows.filter((r) => r.status === "available");
  if (due.length === 0) return { released: 0, errors: [] };

  const { available } = await stripe.balance.retrieve({}, { stripeAccount: user.stripeAccountId });
  const wanted = EVENT_CURRENCY.toLowerCase();
  const entry = available.find((b) => b.currency === wanted) ?? available.find((b) => b.amount > 0);
  let remaining = entry?.amount ?? 0;
  if (!entry || remaining <= 0) return { released: 0, errors: [NO_BALANCE_ERROR] };

  const result: ReleasePayoutsResult = { released: 0, errors: [] };
  for (const row of due) {
    const cents = Math.min(Math.round(row.amount * 100), remaining);
    if (cents <= 0) {
      result.errors.push(`${row.title}: ${NO_BALANCE_ERROR}`);
      continue;
    }
    try {
      const payout = await stripe.payouts.create(
        { amount: cents, currency: entry.currency, metadata: { eventId: row.eventId } },
        { stripeAccount: user.stripeAccountId, idempotencyKey: `event-payout-${row.eventId}` },
      );
      const inserted = await db
        .insert(eventPayouts)
        .values({
          eventId: row.eventId,
          organizerId: user.id,
          amount: (cents / 100).toFixed(2),
          stripePayoutId: payout.id,
        })
        .onConflictDoNothing()
        .returning({ id: eventPayouts.id });
      // Sin fila nueva otro request ya registro este evento: no cuenta ni descuenta saldo.
      if (inserted.length === 0) continue;
      remaining -= cents;
      result.released++;
    } catch (error) {
      console.error(`[payout] fallo el retiro del evento ${row.eventId}`, error);
      result.errors.push(`${row.title}: no se pudo crear el retiro en Stripe.`);
    }
  }
  return result;
}
