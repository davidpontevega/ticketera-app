import type Stripe from "stripe";

import type { OrderStatus } from "@/modules/order/db/order.table";
import { EVENT_CURRENCY } from "@/modules/event";
import type { TicketLine } from "@/modules/ticket";

export function toStripeLineItems(
  eventTitle: string,
  lines: readonly TicketLine[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: EVENT_CURRENCY.toLowerCase(),
      unit_amount: Math.round(line.unitPrice * 100),
      product_data: {
        name: `${eventTitle} — ${line.zoneName}`,
        ...(line.seatLabels.length > 0 ? { description: line.seatLabels.join(", ") } : {}),
      },
    },
  }));
}

export function getOrderStatusFromSession(session: Stripe.Checkout.Session): OrderStatus {
  if (session.status === "expired") return "cancelled";
  if (
    session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required")
  ) {
    return "paid";
  }
  return "pending";
}

export function getOrderStatusFromEvent(event: Stripe.Event): OrderStatus | null {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return getOrderStatusFromSession(event.data.object as Stripe.Checkout.Session);
    case "checkout.session.async_payment_failed":
      return "failed";
    case "checkout.session.expired":
      return "cancelled";
    default:
      return null;
  }
}

// PaymentIntent de un reembolso TOTAL (`charge.refunded`); null si el evento no aplica o es parcial.
export function getRefundedPaymentIntentId(event: Stripe.Event): string | null {
  if (event.type !== "charge.refunded") return null;
  const charge = event.data.object as Stripe.Charge;
  if (!charge.refunded) return null;
  const intent = charge.payment_intent;
  return (typeof intent === "string" ? intent : intent?.id) ?? null;
}
