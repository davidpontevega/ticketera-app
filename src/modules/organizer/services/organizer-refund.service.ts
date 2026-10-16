import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { events } from "@/modules/event/db/event.table";
import { orders } from "@/modules/order/db/order.table";
import { applyOrderRefund } from "@/modules/order/services/refund.service";
import { tickets } from "@/modules/ticket/db/ticket.table";

import type { RefundOrderInput } from "../schemas/refund.schema";
import type { EventOrderRow, RefundResult } from "../types/refund.types";
import { getEventScope, type EventAdminViewer } from "./organizer-event-admin.service";

const ALREADY_REFUNDED_CODE = "charge_already_refunded";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

// Union por slug (events.slug UNIQUE = orders.event_slug), igual que check-in.
// Orden: Stripe primero, DB despues. Si la DB falla tras el reembolso, el webhook charge.refunded
// o un reintento (misma idempotencyKey / charge_already_refunded) la reconcilian.
export async function refundOrder(
  input: RefundOrderInput,
  viewer: EventAdminViewer,
): Promise<RefundResult> {
  const [order] = await db
    .select({
      status: orders.status,
      paymentIntentId: orders.stripePaymentIntentId,
      sessionId: orders.stripeCheckoutSessionId,
      platformFeeAmount: orders.platformFeeAmount,
    })
    .from(orders)
    .innerJoin(events, eq(events.slug, orders.eventSlug))
    .where(and(eq(orders.id, input.orderId), eq(events.id, input.eventId), getEventScope(viewer)))
    .limit(1);

  if (!order) return { result: "not-found" };
  if (order.status !== "paid") return { result: "not-refundable" };

  const [used] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(eq(tickets.orderId, input.orderId), eq(tickets.status, "used")))
    .limit(1);
  if (used) return { result: "has-used-tickets" };

  let stripeRefundId: string | null = null;
  try {
    let paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId && order.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(order.sessionId);
      const pi = session.payment_intent;
      paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? null);
    }
    if (!paymentIntentId) return { result: "not-refundable" };

    // Reembolso total: sin `amount`. La clave determinista evita duplicados en reintentos (24 h).
    // Destination charge (fee no nulo, spec 042): recupera la transferencia del organizador y la comision.
    const isConnect = order.platformFeeAmount !== null;
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(isConnect && { reverse_transfer: true, refund_application_fee: true }),
      },
      { idempotencyKey: `refund-order-${input.orderId}` },
    );
    stripeRefundId = refund.id;
  } catch (error) {
    if (errorCode(error) !== ALREADY_REFUNDED_CODE) {
      return {
        result: "stripe-error",
        message: error instanceof Error ? error.message : "Stripe rechazo el reembolso",
      };
    }
  }

  // false = ya aplicada (p. ej. por el webhook): tambien es exito.
  try {
    await applyOrderRefund({ orderId: input.orderId, refundedBy: viewer.id, stripeRefundId });
  } catch {
    // El dinero ya salio en Stripe: el webhook charge.refunded o reintentar el boton reparan la DB.
    return {
      result: "stripe-error",
      message: "Reembolsado en Stripe, pendiente de sincronizar. Reintenta en unos minutos.",
    };
  }
  return { result: "refunded" };
}

// ponytail: sin paginacion; techo = cientos de ordenes por evento.
export async function listEventOrders(
  eventId: string,
  viewer: EventAdminViewer,
): Promise<EventOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      buyer: orders.buyer,
      lines: orders.lines,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(events, eq(events.slug, orders.eventSlug))
    .where(
      and(
        eq(events.id, eventId),
        inArray(orders.status, ["paid", "refunded"]),
        getEventScope(viewer),
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    id: row.id,
    shortId: row.id.slice(0, 8).toUpperCase(),
    buyerName: row.buyer.fullName,
    buyerEmail: row.buyer.email,
    totalAmount: Number(row.totalAmount),
    ticketCount: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    createdAt: row.createdAt.toISOString(),
    status: row.status as EventOrderRow["status"],
  }));
}
