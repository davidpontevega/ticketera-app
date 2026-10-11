import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS_MOCK, getEventBySlug } from "@/modules/event";
import { getTicketLines, getTicketTotals, getVenueLayout } from "@/modules/ticket";
import type { VenueLayout } from "@/modules/ticket";
import { orders } from "../db/order.table";
import type { CreateCheckoutSessionInput } from "../schemas/checkout.schema";
import { toStripeLineItems } from "../utils/stripe-checkout.utils";
import { createCheckoutSession, handleStripeEvent, syncOrderWithSession } from "./checkout.service";

// "server-only" solo lanza fuera del condition "react-server" de Next; en Vitest se stubea a vacio.
vi.mock("server-only", () => ({}));

// Evento "publicado" = el del mock con su plantilla; el slug desconocido no esta publicado.
let layoutOverride: ((layout: VenueLayout) => VenueLayout) | null = null;
const getPublishedEvent = vi.fn(async (slug: string) => {
  const event = getEventBySlug(EVENTS_MOCK, slug);
  if (!event) return null;
  const layout = getVenueLayout(event);
  return { event, layout: layoutOverride ? layoutOverride(layout) : layout };
});
vi.mock("@/modules/event/services/event.service", () => ({
  getPublishedEvent: (slug: string) => getPublishedEvent(slug),
}));

const insert = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const update = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const updateReturning = vi.fn();
const insertConflict = vi.fn();
const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const execute = vi.fn();
const sessionsExpire = vi.fn();

vi.mock("@/lib/db", () => {
  const client = {
    insert: (...args: unknown[]) => insert(...args),
    update: (...args: unknown[]) => update(...args),
    select: (...args: unknown[]) => select(...args),
    execute: (...args: unknown[]) => execute(...args),
  };
  return { db: { ...client, transaction: (cb: (tx: typeof client) => unknown) => cb(client) } };
});

const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => sessionsCreate(...args),
        retrieve: (...args: unknown[]) => sessionsRetrieve(...args),
        expire: (...args: unknown[]) => sessionsExpire(...args),
      },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  layoutOverride = null;
  insert.mockImplementation(() => ({ values: insertValues }));
  insertConflict.mockResolvedValue(undefined);
  insertValues.mockImplementation(() => ({
    returning: insertReturning,
    onConflictDoNothing: insertConflict,
  }));
  insertReturning.mockResolvedValue([{ id: "order-1" }]);

  update.mockImplementation(() => ({ set: updateSet }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
  // `where()` puede ser el final de la cadena (awaited directo) o seguir con `.returning()`.
  updateWhere.mockImplementation(() =>
    Object.assign(Promise.resolve(undefined), { returning: updateReturning }),
  );
  updateReturning.mockResolvedValue([]);

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  selectWhere.mockResolvedValue([]);
  execute.mockResolvedValue(undefined);
  sessionsExpire.mockResolvedValue({});
});

const EVENT_SLUG = "bad-bunny-world-tour";
const buyer: CreateCheckoutSessionInput["buyer"] = {
  fullName: "Juana Perez",
  email: "juana@example.com",
  documentType: "dni",
  documentNumber: "12345678",
  phone: "987654321",
};

function buildInput(overrides: Partial<CreateCheckoutSessionInput> = {}): CreateCheckoutSessionInput {
  return {
    eventSlug: EVENT_SLUG,
    quantities: {},
    seatIds: {},
    buyer,
    ...overrides,
  };
}

describe("createCheckoutSession", () => {
  it("slug inexistente devuelve 404 y no inserta ninguna orden", async () => {
    const result = await createCheckoutSession(buildInput({ eventSlug: "no-existe" }), {
      origin: "https://app.test",
      clerkUserId: null,
    });

    expect(result).toEqual({ ok: false, status: 404, message: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("usa los precios del layout publicado (DB) para el total de la orden", async () => {
    layoutOverride = (layout) => ({
      ...layout,
      zones: layout.zones.map((z) => (z.id === "general" ? { ...z, price: 123 } : z)),
    });
    sessionsCreate.mockResolvedValue({ id: "cs_p", url: "https://x" });

    await createCheckoutSession(buildInput({ quantities: { general: 2 } }), {
      origin: "https://app.test",
      clerkUserId: null,
    });

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: "246.00" }));
  });

  it("seleccion vacia devuelve 400 y no inserta ninguna orden", async () => {
    const result = await createCheckoutSession(buildInput(), {
      origin: "https://app.test",
      clerkUserId: null,
    });

    expect(result).toEqual({ ok: false, status: 400, message: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("asiento inexistente devuelve 400 y no inserta ninguna orden", async () => {
    const result = await createCheckoutSession(
      buildInput({ seatIds: { occidente: ["occidente-Z-999"] } }),
      { origin: "https://app.test", clerkUserId: null },
    );

    expect(result).toEqual({ ok: false, status: 400, message: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("asiento ocupado devuelve 400 y no inserta ninguna orden", async () => {
    const event = getEventBySlug(EVENTS_MOCK, EVENT_SLUG)!;
    const layout = getVenueLayout(event);
    const occupiedSeat = layout.zones
      .find((zone) => zone.id === "occidente")!
      .seats.find((seat) => seat.status === "occupied")!;

    const result = await createCheckoutSession(
      buildInput({ seatIds: { occidente: [occupiedSeat.id] } }),
      { origin: "https://app.test", clerkUserId: null },
    );

    expect(result).toEqual({ ok: false, status: 400, message: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("caso feliz crea la orden pending, calcula montos en servidor y crea la session de Stripe", async () => {
    const event = getEventBySlug(EVENTS_MOCK, EVENT_SLUG)!;
    const layout = getVenueLayout(event);
    const lines = getTicketLines(layout, { general: 2 }, {});
    const totals = getTicketTotals(lines);

    sessionsCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/pay/cs_test_1",
      payment_intent: null,
    });

    const input = buildInput({ quantities: { general: 2 } });

    const result = await createCheckoutSession(input, {
      origin: "https://app.test",
      clerkUserId: null,
    });

    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/pay/cs_test_1",
      orderId: "order-1",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        eventSlug: EVENT_SLUG,
        buyer,
        lines,
        status: "pending",
        totalAmount: totals.amount.toFixed(2),
      }),
    );

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: toStripeLineItems(event.title, lines),
        customer_email: buyer.email,
        payment_intent_data: { receipt_email: buyer.email, metadata: { orderId: "order-1" } },
        client_reference_id: "order-1",
        metadata: { orderId: "order-1" },
        success_url: `https://app.test/events/${EVENT_SLUG}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://app.test/events/${EVENT_SLUG}/checkout?payment=cancelled`,
      }),
    );

    expect(updateSet).toHaveBeenCalledWith({ stripeCheckoutSessionId: "cs_test_1" });
    expect(updateWhere).toHaveBeenCalledWith(eq(orders.id, "order-1"));
  });
});

describe("createCheckoutSession anti-sobreventa", () => {
  const ctx = { origin: "https://app.test", clerkUserId: null };
  const seatLayout = () => getVenueLayout(getEventBySlug(EVENTS_MOCK, EVENT_SLUG)!);
  const freeSeat = () =>
    seatLayout().zones.find((z) => z.id === "occidente")!.seats.find((seat) => seat.status !== "occupied")!;
  const seatLabel = (seat: { row: string; number: number }) => `${seat.row}${seat.number}`;

  it("toma el advisory lock antes de cualquier select o insert", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://x" });
    await createCheckoutSession(buildInput({ quantities: { general: 1 } }), ctx);

    const lockOrder = execute.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(select.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(insert.mock.invocationCallOrder[0]);
  });

  it("409 si el asiento ya esta en una orden que cuenta", async () => {
    const seat = freeSeat();
    selectWhere.mockResolvedValueOnce([
      { eventSlug: EVENT_SLUG, lines: [{ zoneId: "occidente", quantity: 1, seatLabels: [seatLabel(seat)] }] },
    ]);

    const result = await createCheckoutSession(buildInput({ seatIds: { occidente: [seat.id] } }), ctx);

    expect(result).toEqual({ ok: false, status: 409, message: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("409 si el cupo de la zona general se excede", async () => {
    selectWhere.mockResolvedValueOnce([{ eventSlug: EVENT_SLUG, lines: [{ zoneId: "general", quantity: 499, seatLabels: [] }] }]);

    const result = await createCheckoutSession(buildInput({ quantities: { general: 2 } }), ctx);

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("cabe justo en el cupo: crea la orden", async () => {
    selectWhere.mockResolvedValueOnce([{ eventSlug: EVENT_SLUG, lines: [{ zoneId: "general", quantity: 498, seatLabels: [] }] }]);
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://x" });

    const result = await createCheckoutSession(buildInput({ quantities: { general: 2 } }), ctx);

    expect(result).toMatchObject({ ok: true });
  });

  it("409 si la zona esta sold-out", async () => {
    layoutOverride = (layout) => ({
      ...layout,
      zones: layout.zones.map((z) => (z.id === "general" ? { ...z, availability: "sold-out" as const } : z)),
    });

    const result = await createCheckoutSession(buildInput({ quantities: { general: 1 } }), ctx);

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("reintento: cancela pendientes previas y expira su session; un fallo de expire no propaga", async () => {
    updateReturning.mockResolvedValueOnce([{ sessionId: "cs_old" }, { sessionId: null }]);
    sessionsExpire.mockRejectedValueOnce(new Error("expire fail"));
    sessionsCreate.mockResolvedValue({ id: "cs_new", url: "https://x" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCheckoutSession(buildInput({ quantities: { general: 1 } }), ctx);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(sessionsExpire).toHaveBeenCalledTimes(1);
    expect(sessionsExpire).toHaveBeenCalledWith("cs_old");
    expect(result).toMatchObject({ ok: true });
  });

  it("si Stripe create falla, la orden queda cancelled y el error se propaga", async () => {
    sessionsCreate.mockRejectedValue(new Error("stripe down"));

    await expect(createCheckoutSession(buildInput({ quantities: { general: 1 } }), ctx)).rejects.toThrow(
      "stripe down",
    );

    expect(updateSet).toHaveBeenLastCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(updateWhere).toHaveBeenLastCalledWith(eq(orders.id, "order-1"));
  });
});

describe("handleStripeEvent", () => {
  it("un tipo de evento no manejado no escribe en la DB", async () => {
    await handleStripeEvent({ type: "payment_intent.created", data: { object: {} } } as never);

    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("evento con session sin orden no escribe ni emite tickets", async () => {
    // selectWhere devuelve [] por defecto: session desconocida.
    await expect(
      handleStripeEvent({
        type: "checkout.session.completed",
        data: { object: { id: "cs_unknown", status: "complete", payment_status: "paid" } },
      } as never),
    ).resolves.toBeUndefined();

    expect(select).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["checkout.session.async_payment_failed", "failed"],
    ["checkout.session.expired", "cancelled"],
  ])("%s sobre una orden pending fija status %s", async (type, status) => {
    selectWhere.mockResolvedValueOnce([{ id: "order-9", status: "pending", stripeCheckoutSessionId: "cs_9", buyer, lines: [] }]);
    updateReturning.mockResolvedValueOnce([{ id: "order-9", status, lines: [] }]);

    await handleStripeEvent({ type, data: { object: { id: "cs_9" } } } as never);

    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(insert).not.toHaveBeenCalled();
  });

  // RIESGO ACEPTADO (specs 033 y 039): un pago confirmado de una orden ya cancelled o failed
  // (p. ej. cancelada por el reemplazo de pendientes del mismo comprador, o expirada) NO cambia de
  // estado ni emite tickets: el cobro queda sin entradas y requiere reconciliacion manual o
  // reembolso. Este test documenta el comportamiento actual; si se decide manejar esa carrera,
  // hay que cambiar este test junto con applySessionStatus.
  it.each(["cancelled", "failed"])(
    "completed tardio sobre una orden %s no cambia estado ni emite tickets",
    async (status) => {
      selectWhere.mockResolvedValueOnce([
        { id: "order-8", status, stripeCheckoutSessionId: "cs_8", buyer, lines: [{ zoneName: "General", quantity: 1, seatLabels: [] }] },
      ]);

      await handleStripeEvent({
        type: "checkout.session.completed",
        data: { object: { id: "cs_8", status: "complete", payment_status: "paid", payment_intent: "pi_8" } },
      } as never);

      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    },
  );
});

describe("syncOrderWithSession", () => {
  it("session pending (open/unpaid) no escribe ni emite tickets", async () => {
    sessionsRetrieve.mockResolvedValue({ id: "cs_p", status: "open", payment_status: "unpaid" });
    const pendingOrder = { id: "order-p", status: "pending", stripeCheckoutSessionId: "cs_p", buyer, lines: [] };
    selectWhere.mockResolvedValueOnce([pendingOrder]);

    const result = await syncOrderWithSession("cs_p");

    expect(result).toEqual(pendingOrder);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("session desconocida devuelve null sin escribir", async () => {
    sessionsRetrieve.mockResolvedValue({ id: "cs_x", status: "open", payment_status: "unpaid" });

    await expect(syncOrderWithSession("cs_x")).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("cuando la session esta pagada, aplica el status paid", async () => {
    sessionsRetrieve.mockResolvedValue({
      id: "cs_test_2",
      status: "complete",
      payment_status: "paid",
      payment_intent: "pi_123",
    });
    selectWhere.mockResolvedValueOnce([
      { id: "order-2", status: "pending", stripeCheckoutSessionId: "cs_test_2", buyer, lines: [] },
    ]);
    updateReturning.mockResolvedValueOnce([
      { id: "order-2", status: "paid", stripeCheckoutSessionId: "cs_test_2", buyer, lines: [] },
    ]);

    const result = await syncOrderWithSession("cs_test_2");

    expect(result).toMatchObject({ id: "order-2", status: "paid" });
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", stripePaymentIntentId: "pi_123" }),
    );
  });
});

describe("emision de tickets", () => {
  const baseOrder = {
    id: "abcdef12-0000-0000-0000-000000000000",
    stripeCheckoutSessionId: "cs_t",
    buyer,
    lines: [{ zoneName: "General", quantity: 2, seatLabels: [] }],
  };
  const completed = {
    type: "checkout.session.completed",
    data: { object: { id: "cs_t", status: "complete", payment_status: "paid", payment_intent: "pi_1" } },
  } as never;

  function mockOrder(status: string, updated: unknown[] = []) {
    selectWhere.mockResolvedValueOnce([{ ...baseOrder, status }]);
    updateReturning.mockResolvedValueOnce(updated);
  }

  it("pending -> paid inserta los tickets con onConflictDoNothing", async () => {
    mockOrder("pending", [{ ...baseOrder, status: "paid" }]);

    await handleStripeEvent(completed);

    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ orderId: baseOrder.id, sequence: 1, qrCode: "TK-ABCDEF12-01", attendeeName: "Juana Perez" }),
      expect.objectContaining({ sequence: 2, qrCode: "TK-ABCDEF12-02" }),
    ]);
    expect(insertConflict).toHaveBeenCalledTimes(1);
  });

  it("segundo completed (update vacio) no falla y repite el insert idempotente", async () => {
    mockOrder("pending", []);

    await expect(handleStripeEvent(completed)).resolves.toBeUndefined();
    expect(insertConflict).toHaveBeenCalledTimes(1);
  });

  it("orden ya paid repara tickets sin hacer update", async () => {
    mockOrder("paid");

    await handleStripeEvent(completed);

    expect(updateSet).not.toHaveBeenCalled();
    expect(insertConflict).toHaveBeenCalledTimes(1);
  });

  it("failed/expired no inserta tickets", async () => {
    mockOrder("pending", [{ ...baseOrder, status: "failed" }]);
    await handleStripeEvent({
      type: "checkout.session.expired",
      data: { object: { id: "cs_t" } },
    } as never);

    expect(insertValues).not.toHaveBeenCalled();
  });

  it("si el insert falla el error se propaga", async () => {
    mockOrder("pending", [{ ...baseOrder, status: "paid" }]);
    insertConflict.mockRejectedValueOnce(new Error("boom"));

    await expect(handleStripeEvent(completed)).rejects.toThrow("boom");
  });
});
