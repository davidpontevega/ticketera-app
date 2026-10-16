import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import type { TicketLine } from "@/modules/ticket";

import {
  getOrderStatusFromEvent,
  getOrderStatusFromSession,
  getRefundedPaymentIntentId,
  toStripeLineItems,
} from "./stripe-checkout.utils";

function buildLine(overrides: Partial<TicketLine> = {}): TicketLine {
  return {
    zoneId: "zone-1",
    zoneName: "General",
    quantity: 2,
    unitPrice: 89.9,
    amount: 179.8,
    seatLabels: [],
    ...overrides,
  };
}

describe("toStripeLineItems", () => {
  it("converts unit price to cents with Math.round", () => {
    const [item] = toStripeLineItems("Concierto", [buildLine({ unitPrice: 89.9 })]);

    expect(item.price_data?.unit_amount).toBe(8990);
  });

  it("uses lowercase currency", () => {
    const [item] = toStripeLineItems("Concierto", [buildLine()]);

    expect(item.price_data?.currency).toBe("pen");
  });

  it("omits description for general admission zones without seats", () => {
    const [item] = toStripeLineItems("Concierto", [buildLine({ seatLabels: [] })]);

    expect(item.price_data?.product_data?.description).toBeUndefined();
  });

  it("includes description joining seat labels when there are seats", () => {
    const [item] = toStripeLineItems("Concierto", [
      buildLine({ zoneName: "Platea", seatLabels: ["C12", "C13"] }),
    ]);

    expect(item.price_data?.product_data?.name).toBe("Concierto — Platea");
    expect(item.price_data?.product_data?.description).toBe("C12, C13");
  });
});

function buildSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    status: "complete",
    payment_status: "paid",
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe("getOrderStatusFromSession", () => {
  it("returns paid when complete and payment_status paid", () => {
    expect(getOrderStatusFromSession(buildSession())).toBe("paid");
  });

  it("returns pending when complete but payment_status is not paid/no_payment_required", () => {
    expect(
      getOrderStatusFromSession(buildSession({ status: "complete", payment_status: "unpaid" })),
    ).toBe("pending");
  });

  it("returns cancelled when status is expired", () => {
    expect(
      getOrderStatusFromSession(buildSession({ status: "expired", payment_status: "unpaid" })),
    ).toBe("cancelled");
  });

  it("returns paid when payment_status is no_payment_required", () => {
    expect(
      getOrderStatusFromSession(
        buildSession({ status: "complete", payment_status: "no_payment_required" }),
      ),
    ).toBe("paid");
  });
});

function buildEvent(type: string, session: Stripe.Checkout.Session = buildSession()): Stripe.Event {
  return {
    type,
    data: { object: session },
  } as unknown as Stripe.Event;
}

describe("getOrderStatusFromEvent", () => {
  it("maps checkout.session.completed to session status", () => {
    expect(getOrderStatusFromEvent(buildEvent("checkout.session.completed"))).toBe("paid");
  });

  it("maps checkout.session.async_payment_succeeded to session status", () => {
    expect(getOrderStatusFromEvent(buildEvent("checkout.session.async_payment_succeeded"))).toBe(
      "paid",
    );
  });

  it("maps checkout.session.async_payment_failed to failed", () => {
    expect(getOrderStatusFromEvent(buildEvent("checkout.session.async_payment_failed"))).toBe(
      "failed",
    );
  });

  it("maps checkout.session.expired to cancelled", () => {
    expect(getOrderStatusFromEvent(buildEvent("checkout.session.expired"))).toBe("cancelled");
  });

  it("returns null for unhandled event types", () => {
    expect(getOrderStatusFromEvent(buildEvent("payment_intent.created"))).toBeNull();
  });
});

describe("getRefundedPaymentIntentId", () => {
  const charge = (object: object, type = "charge.refunded") =>
    ({ type, data: { object } }) as unknown as Stripe.Event;

  it("returns the payment intent id for a full refund (string or object)", () => {
    expect(getRefundedPaymentIntentId(charge({ refunded: true, payment_intent: "pi_1" }))).toBe("pi_1");
    expect(getRefundedPaymentIntentId(charge({ refunded: true, payment_intent: { id: "pi_2" } }))).toBe("pi_2");
  });

  it("returns null for partial refunds, missing payment_intent or other event types", () => {
    expect(getRefundedPaymentIntentId(charge({ refunded: false, payment_intent: "pi_1" }))).toBeNull();
    expect(getRefundedPaymentIntentId(charge({ refunded: true, payment_intent: null }))).toBeNull();
    expect(getRefundedPaymentIntentId(charge({ refunded: true, payment_intent: "pi_1" }, "charge.succeeded"))).toBeNull();
  });
});
