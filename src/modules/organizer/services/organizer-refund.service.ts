import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { events } from "@/modules/event/db/event.table";
import { orders } from "@/modules/order/db/order.table";
import { applyOrderRefund } from "@/modules/order/services/refund.service";
import { tickets } from "@/modules/ticket/db/ticket.table";

import type { RefundOrderInput } from "../schemas/refund.schema";
import type {
  EventOrderRow,
  EventOrdersHeader,
  EventRefundSummary,
  RefundResult,
} from "../types/refund.types";
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

  return refundPaidOrder(
    input.orderId,
    viewer.id,
    order.platformFeeAmount,
    order.paymentIntentId,
    order.sessionId,
  );
}

// Nucleo compartido (boton por orden y cancelacion masiva): Stripe primero, DB despues.
// No valida estado ni scope: el llamador ya lo hizo.
async function refundPaidOrder(
  orderId: string,
  refundedBy: string,
  platformFeeAmount: string | null,
  paymentIntentId: string | null,
  sessionId: string | null,
): Promise<RefundResult> {
  let stripeRefundId: string | null = null;
  try {
    let pi = paymentIntentId;
    if (!pi && sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionPi = session.payment_intent;
      pi = typeof sessionPi === "string" ? sessionPi : (sessionPi?.id ?? null);
    }
    if (!pi) return { result: "not-refundable" };

    // Reembolso total: sin `amount`. La clave determinista evita duplicados en reintentos (24 h).
    // Destination charge (fee no nulo, spec 042): recupera la transferencia del organizador y la comision.
    const isConnect = platformFeeAmount !== null;
    const refund = await stripe.refunds.create(
      {
        payment_intent: pi,
        ...(isConnect && { reverse_transfer: true, refund_application_fee: true }),
      },
      { idempotencyKey: `refund-order-${orderId}` },
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
    await applyOrderRefund({ orderId, refundedBy, stripeRefundId });
  } catch {
    // El dinero ya salio en Stripe: el webhook charge.refunded o reintentar el boton reparan la DB.
    return {
      result: "stripe-error",
      message: "Reembolsado en Stripe, pendiente de sincronizar. Reintenta en unos minutos.",
    };
  }
  return { result: "refunded" };
}

// Reembolsa en serie las ordenes `paid` del evento. Un fallo no corta las demas.
// Idempotente: sirve como reintento. ponytail: serie sin cola; techo = cientos de ordenes por request.
export async function refundEventOrders(
  eventId: string,
  viewer: EventAdminViewer,
): Promise<EventRefundSummary> {
  const paid = await db
    .select({
      id: orders.id,
      paymentIntentId: orders.stripePaymentIntentId,
      sessionId: orders.stripeCheckoutSessionId,
      platformFeeAmount: orders.platformFeeAmount,
    })
    .from(orders)
    .innerJoin(events, eq(events.slug, orders.eventSlug))
    .where(and(eq(events.id, eventId), eq(orders.status, "paid"), getEventScope(viewer)));

  let refunded = 0;
  for (const order of paid) {
    const outcome = await refundPaidOrder(
      order.id,
      viewer.id,
      order.platformFeeAmount,
      order.paymentIntentId,
      order.sessionId,
    );
    if (outcome.result === "refunded") {
      refunded++;
    } else {
      console.error(`[refund] orden ${order.id} no reembolsada: ${outcome.result}`);
    }
  }
  return { total: paid.length, refunded, failed: paid.length - refunded };
}

// Incluye eventos cancelados (getEventForEdit los excluye).
export async function getEventHeaderForOrders(
  eventId: string,
  viewer: EventAdminViewer,
): Promise<EventOrdersHeader | null> {
  const [row] = await db
    .select({ title: events.title, status: events.status })
    .from(events)
    .where(and(eq(events.id, eventId), getEventScope(viewer)))
    .limit(1);
  return row ?? null;
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
