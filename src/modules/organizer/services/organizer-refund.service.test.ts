import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { listEventOrders, refundOrder } from "./organizer-refund.service";

vi.mock("server-only", () => ({}));

const select = vi.fn();
const from = vi.fn();
const innerJoin = vi.fn();
const where = vi.fn();
const limit = vi.fn();
const orderBy = vi.fn();

vi.mock("@/lib/db", () => ({ db: { select: (...args: unknown[]) => select(...args) } }));

const refundsCreate = vi.fn();
const sessionsRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    refunds: { create: (...args: unknown[]) => refundsCreate(...args) },
    checkout: { sessions: { retrieve: (...args: unknown[]) => sessionsRetrieve(...args) } },
  },
}));

const applyOrderRefund = vi.fn();
vi.mock("@/modules/order/services/refund.service", () => ({
  applyOrderRefund: (...args: unknown[]) => applyOrderRefund(...args),
}));

const dialect = new PgDialect();
const toQuery = (sqlWhere: SQL) => dialect.sqlToQuery(sqlWhere);

const input = { eventId: "event-1", orderId: "order-1" };
const organizer = { id: "organizer-1", role: "organizer" as const };
const admin = { id: "admin-1", role: "admin" as const };

const paidOrder = { status: "paid", paymentIntentId: "pi_1", sessionId: "cs_1", platformFeeAmount: null };

// 1er limit = orden, 2do limit = ticket usado.
function mockLookups(order: unknown, usedTicket: unknown = undefined) {
  limit.mockResolvedValueOnce(order ? [order] : []).mockResolvedValueOnce(usedTicket ? [usedTicket] : []);
}

beforeEach(() => {
  vi.clearAllMocks();
  select.mockImplementation(() => ({ from }));
  from.mockImplementation(() => ({ innerJoin, where }));
  innerJoin.mockImplementation(() => ({ where }));
  where.mockImplementation(() => ({ limit, orderBy }));
  limit.mockReset();
  limit.mockResolvedValue([]);
  refundsCreate.mockResolvedValue({ id: "re_1" });
  applyOrderRefund.mockResolvedValue(true);
});

describe("refundOrder", () => {
  it("camino feliz: Stripe una vez, sin amount, con idempotencyKey; luego aplica en DB (AC2)", async () => {
    mockLookups(paidOrder);

    expect(await refundOrder(input, organizer)).toEqual({ result: "refunded" });
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    expect(refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_1" },
      { idempotencyKey: "refund-order-order-1" },
    );
    expect(applyOrderRefund).toHaveBeenCalledWith({
      orderId: "order-1",
      refundedBy: "organizer-1",
      stripeRefundId: "re_1",
    });
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it("orden Connect (fee no nulo): incluye reverse_transfer y refund_application_fee (spec 042)", async () => {
    mockLookups({ ...paidOrder, platformFeeAmount: "10.00" });

    expect(await refundOrder(input, organizer)).toEqual({ result: "refunded" });
    expect(refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_1", reverse_transfer: true, refund_application_fee: true },
      { idempotencyKey: "refund-order-order-1" },
    );
  });

  it("orden sin fee: no incluye los flags de Connect", async () => {
    mockLookups(paidOrder);

    await refundOrder(input, organizer);
    const [params] = refundsCreate.mock.calls[0];
    expect(params).not.toHaveProperty("reverse_transfer");
    expect(params).not.toHaveProperty("refund_application_fee");
  });

  it.each([
    ["inexistente o ajena", undefined, undefined, "not-found"],
    ["no paid", { ...paidOrder, status: "pending" }, undefined, "not-refundable"],
    ["con ticket used", paidOrder, { id: "t1" }, "has-used-tickets"],
  ])("guarda %s => %s sin llamar a Stripe (AC3)", async (_n, order, used, expected) => {
    mockLookups(order, used);

    expect(await refundOrder(input, admin)).toEqual({ result: expected });
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(applyOrderRefund).not.toHaveBeenCalled();
  });

  it("precedencia: orden no paid no consulta tickets", async () => {
    mockLookups({ ...paidOrder, status: "refunded" }, { id: "t1" });

    expect(await refundOrder(input, admin)).toEqual({ result: "not-refundable" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("sin payment_intent usa la sesion de Stripe (AC4)", async () => {
    mockLookups({ ...paidOrder, paymentIntentId: null });
    sessionsRetrieve.mockResolvedValue({ payment_intent: "pi_sess" });

    expect(await refundOrder(input, admin)).toEqual({ result: "refunded" });
    expect(sessionsRetrieve).toHaveBeenCalledWith("cs_1");
    expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: "pi_sess" }, expect.any(Object));
  });

  it("payment_intent de la sesion como objeto", async () => {
    mockLookups({ ...paidOrder, paymentIntentId: null });
    sessionsRetrieve.mockResolvedValue({ payment_intent: { id: "pi_obj" } });

    await refundOrder(input, admin);

    expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: "pi_obj" }, expect.any(Object));
  });

  it("sin payment_intent en columna ni sesion => not-refundable sin refunds.create (AC4)", async () => {
    mockLookups({ ...paidOrder, paymentIntentId: null });
    sessionsRetrieve.mockResolvedValue({ payment_intent: null });

    expect(await refundOrder(input, admin)).toEqual({ result: "not-refundable" });
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("error generico de Stripe => stripe-error y la DB no cambia (AC5)", async () => {
    mockLookups(paidOrder);
    refundsCreate.mockRejectedValue(new Error("card network down"));

    expect(await refundOrder(input, admin)).toEqual({
      result: "stripe-error",
      message: "card network down",
    });
    expect(applyOrderRefund).not.toHaveBeenCalled();
  });

  it("charge_already_refunded se trata como exito y reconcilia la DB (AC5)", async () => {
    mockLookups(paidOrder);
    refundsCreate.mockRejectedValue(Object.assign(new Error("already"), { code: "charge_already_refunded" }));

    expect(await refundOrder(input, admin)).toEqual({ result: "refunded" });
    expect(applyOrderRefund).toHaveBeenCalledWith({
      orderId: "order-1",
      refundedBy: "admin-1",
      stripeRefundId: null,
    });
  });

  it("applyOrderRefund=false (ya aplicada por el webhook) sigue siendo exito", async () => {
    mockLookups(paidOrder);
    applyOrderRefund.mockResolvedValue(false);

    expect(await refundOrder(input, admin)).toEqual({ result: "refunded" });
  });

  it("falla la DB tras reembolsar en Stripe => stripe-error con aviso de sincronizacion", async () => {
    mockLookups(paidOrder);
    applyOrderRefund.mockRejectedValue(new Error("db down"));

    const result = await refundOrder(input, admin);

    expect(result).toMatchObject({ result: "stripe-error" });
    expect(result).toHaveProperty("message", expect.stringContaining("pendiente de sincronizar"));
  });

  it("scope: organizer filtra por organizer_id; admin no (AC8)", async () => {
    mockLookups(paidOrder);
    mockLookups(paidOrder);

    await refundOrder(input, organizer);
    await refundOrder(input, admin);

    const org = toQuery(where.mock.calls[0][0] as SQL);
    const adm = toQuery(where.mock.calls[2][0] as SQL);
    expect(org.sql).toContain('"organizer_id"');
    expect(org.params).toEqual(expect.arrayContaining(["order-1", "event-1", "organizer-1"]));
    expect(adm.sql).not.toContain('"organizer_id"');
  });
});

describe("listEventOrders", () => {
  const row = {
    id: "abcdef12-0000-0000-0000-000000000000",
    buyer: { fullName: "Ana Torres", email: "ana@mail.com" },
    lines: [{ quantity: 2 }, { quantity: 1 }],
    totalAmount: "150.50",
    status: "paid",
    createdAt: new Date("2026-10-14T20:00:00.000Z"),
  };

  it("mapea filas a EventOrderRow", async () => {
    orderBy.mockResolvedValue([row]);

    expect(await listEventOrders("event-1", admin)).toEqual([
      {
        id: row.id,
        shortId: "ABCDEF12",
        buyerName: "Ana Torres",
        buyerEmail: "ana@mail.com",
        totalAmount: 150.5,
        ticketCount: 3,
        createdAt: "2026-10-14T20:00:00.000Z",
        status: "paid",
      },
    ]);
  });

  it("filtra solo paid/refunded y aplica scope solo al organizer (AC8, AC10)", async () => {
    orderBy.mockResolvedValue([]);

    await listEventOrders("event-1", organizer);
    await listEventOrders("event-1", admin);

    const org = toQuery(where.mock.calls[0][0] as SQL);
    const adm = toQuery(where.mock.calls[1][0] as SQL);
    expect(org.params).toEqual(["event-1", "paid", "refunded", "organizer-1"]);
    expect(adm.params).toEqual(["event-1", "paid", "refunded"]);
  });
});
