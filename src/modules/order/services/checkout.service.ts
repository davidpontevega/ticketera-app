import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
// Ruta directa: el barrel de event no expone el servicio con `db`.
import { events } from "@/modules/event/db/event.table";
import { getPublishedEvent } from "@/modules/event/services/event.service";
import { isConnectEnabled } from "@/modules/payment/constants/payment.constants";
import { getPayoutAccount } from "@/modules/payment/services/connect.service";
import { getPlatformFeePercent } from "@/modules/payment/services/platform-settings.service";
import { calculatePlatformFee } from "@/modules/payment/utils/payment.utils";
import { getTicketLines, getTicketTotals, getZoneCapacity, tickets } from "@/modules/ticket";
import type { EventAvailabilitySnapshot, TicketLine, VenueLayout } from "@/modules/ticket";
import { users } from "@/modules/user/db/user.table";

import { CHECKOUT_SESSION_TTL_SECONDS } from "../constants/order.constants";
import { orders } from "../db/order.table";
import type { OrderRecord, OrderStatus } from "../db/order.table";
import type { CreateCheckoutSessionInput } from "../schemas/checkout.schema";
import {
  getOrderStatusFromEvent,
  getOrderStatusFromSession,
  getRefundedPaymentIntentId,
  toStripeLineItems,
} from "../utils/stripe-checkout.utils";
import { toTicketRows } from "../utils/order.utils";
import { getTakenInventory } from "./availability.service";
import { applyOrderRefund } from "./refund.service";

export type CreateCheckoutSessionResult =
  | { ok: true; url: string; orderId: string }
  | { ok: false; status: 400 | 404 | 409; message: string };

export interface CheckoutContext {
  origin: string;
  clerkUserId: string | null;
}

function hasInvalidSeatSelection(
  layout: VenueLayout,
  seatIds: Readonly<Record<string, readonly string[]>>,
): boolean {
  return Object.entries(seatIds).some(([zoneId, ids]) => {
    const zone = layout.zones.find((item) => item.id === zoneId);
    return ids.some((id) => {
      const seat = zone?.seats.find((item) => item.id === id);
      return !seat || seat.status === "occupied";
    });
  });
}

class AvailabilityConflictError extends Error {}

// Devuelve el mensaje del primer conflicto (asiento tomado, cupo excedido, zona agotada) o null.
function findAvailabilityConflict(
  layout: VenueLayout,
  lines: readonly TicketLine[],
  taken: EventAvailabilitySnapshot,
): string | null {
  for (const line of lines) {
    const zone = layout.zones.find((item) => item.id === line.zoneId);
    if (!zone) continue;
    if (zone.availability === "sold-out") return `${zone.name} esta agotada`;
    if (zone.seating === "numbered") {
      const takenSeats = new Set(taken.seats[zone.id] ?? []);
      const clash = line.seatLabels.find((label) => takenSeats.has(label));
      if (clash) return `El asiento ${clash} de ${zone.name} ya no esta disponible. Elige otro.`;
    } else if ((taken.sold[zone.id] ?? 0) + line.quantity > getZoneCapacity(zone)) {
      return `No quedan suficientes entradas en ${zone.name}`;
    }
  }
  return null;
}

async function findUserIdByClerkId(clerkId: string): Promise<string | null> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  return user?.id ?? null;
}

const PAYOUT_BLOCKED_MESSAGE = "El organizador aun no habilita los pagos de este evento";

interface ConnectCharge {
  accountId: string;
  feeCents: number;
  netCents: number;
  feePercent: number;
}

// Solo con Connect encendido. null = el organizador no puede cobrar (sin organizador o sin cuenta complete).
async function resolveConnectCharge(eventSlug: string, totalAmount: number): Promise<ConnectCharge | null> {
  const [row] = await db.select({ organizerId: events.organizerId }).from(events).where(eq(events.slug, eventSlug));
  const account = row?.organizerId ? await getPayoutAccount(row.organizerId) : null;
  if (!account) return null;
  const feePercent = await getPlatformFeePercent();
  return { accountId: account.accountId, feePercent, ...calculatePlatformFee(totalAmount, feePercent) };
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  context: CheckoutContext,
): Promise<CreateCheckoutSessionResult> {
  const published = await getPublishedEvent(input.eventSlug);
  if (!published) {
    return { ok: false, status: 404, message: "Evento no encontrado" };
  }
  const { event, layout } = published;

  if (hasInvalidSeatSelection(layout, input.seatIds)) {
    return { ok: false, status: 400, message: "Uno de los asientos seleccionados ya no esta disponible" };
  }

  const lines = getTicketLines(layout, input.quantities, input.seatIds);
  const totals = getTicketTotals(lines);
  if (totals.quantity === 0) {
    return { ok: false, status: 400, message: "Selecciona al menos una entrada" };
  }

  // Antes de reservar inventario: sin destino no se cobra a la plataforma por cuenta de un tercero.
  let connect: ConnectCharge | null = null;
  if (isConnectEnabled()) {
    connect = await resolveConnectCharge(input.eventSlug, totals.amount);
    if (!connect) return { ok: false, status: 409, message: PAYOUT_BLOCKED_MESSAGE };
  }

  const userId = context.clerkUserId ? await findUserIdByClerkId(context.clerkUserId) : null;

  let reserved: { order: OrderRecord; replacedSessionIds: string[] };
  try {
    // ponytail: el lock serializa las compras de un mismo evento; si un evento muy popular satura,
    // pasar a reservas por asiento con unique parcial.
    reserved = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.eventSlug}))`);

      // Reintento del mismo comprador: libera sus pendientes para no chocar con su propia reserva.
      const replaced = await tx
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(orders.eventSlug, input.eventSlug),
            eq(orders.status, "pending"),
            sql`lower(${orders.buyer}->>'email') = ${input.buyer.email.toLowerCase()}`,
          ),
        )
        .returning({ sessionId: orders.stripeCheckoutSessionId });

      const conflict = findAvailabilityConflict(layout, lines, await getTakenInventory(tx, input.eventSlug));
      if (conflict) throw new AvailabilityConflictError(conflict); // rollback: las pendientes siguen vivas

      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          eventSlug: input.eventSlug,
          buyer: input.buyer,
          lines,
          status: "pending",
          totalAmount: totals.amount.toFixed(2),
          ...(connect && {
            platformFeeAmount: (connect.feeCents / 100).toFixed(2),
            organizerNetAmount: (connect.netCents / 100).toFixed(2),
            platformFeePercent: connect.feePercent.toFixed(2),
          }),
        })
        .returning();
      return {
        order,
        replacedSessionIds: replaced.flatMap((row) => (row?.sessionId ? [row.sessionId] : [])),
      };
    });
  } catch (error) {
    if (error instanceof AvailabilityConflictError) {
      return { ok: false, status: 409, message: error.message };
    }
    throw error;
  }
  const { order, replacedSessionIds } = reserved;

  // Best-effort: la orden ya esta cancelled; un fallo de expire no debe romper la compra.
  await Promise.all(
    replacedSessionIds.map((id) =>
      stripe.checkout.sessions.expire(id).catch((error: unknown) => {
        console.error("Failed to expire replaced checkout session:", error);
      }),
    ),
  );

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: toStripeLineItems(event.title, lines),
      customer_email: input.buyer.email,
      payment_intent_data: {
        receipt_email: input.buyer.email,
        metadata: { orderId: order.id },
        ...(connect && {
          transfer_data: { destination: connect.accountId },
          ...(connect.feeCents > 0 && { application_fee_amount: connect.feeCents }),
        }),
      },
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      success_url: `${context.origin}/events/${input.eventSlug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${context.origin}/events/${input.eventSlug}/checkout?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
    });
  } catch (error) {
    // Sin session no hay pago posible: libera el cupo en vez de dejarlo pending.
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw error;
  }

  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(orders.id, order.id));

  return { ok: true, url: session.url!, orderId: order.id };
}

async function applySessionStatus(
  session: Stripe.Checkout.Session,
  status: OrderStatus,
): Promise<OrderRecord | null> {
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, session.id));
  if (!existing) return null;
  const isTransition = existing.status === "pending" && status !== "pending";
  // Una orden ya paid tambien entra: repara tickets faltantes (insert idempotente).
  if (!isTransition && existing.status !== "paid") return existing;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  // Update de estado + emision de tickets atomicos: si el insert falla, la orden sigue pending.
  return db.transaction(async (tx) => {
    let record = existing;
    if (isTransition) {
      const [updated] = await tx
        .update(orders)
        .set({
          status,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(orders.stripeCheckoutSessionId, session.id), eq(orders.status, "pending")))
        .returning();
      // Update vacio = otro proceso gano la carrera; el estado a emitir sigue siendo el recibido.
      record = updated ?? existing;
    }

    const isPaid = isTransition ? status === "paid" : true;
    const rows = isPaid ? toTicketRows(record) : [];
    // UNIQUE(order_id, sequence) + DO NOTHING => un solo juego de tickets ante reintentos/carreras.
    if (rows.length > 0) await tx.insert(tickets).values(rows).onConflictDoNothing();

    return record;
  });
}

export async function syncOrderWithSession(sessionId: string): Promise<OrderRecord | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return applySessionStatus(session, getOrderStatusFromSession(session));
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = getRefundedPaymentIntentId(event);
    if (!paymentIntentId) {
      console.warn("Ignoring charge.refunded (partial refund or no payment_intent):", charge.id);
      return;
    }
    await applyOrderRefund({ paymentIntentId, refundedBy: null, stripeRefundId: charge.refunds?.data[0]?.id ?? null });
    return;
  }
  const status = getOrderStatusFromEvent(event);
  if (!status) return;
  const session = event.data.object as Stripe.Checkout.Session;
  await applySessionStatus(session, status);
}
