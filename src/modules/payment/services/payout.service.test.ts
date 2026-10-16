import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const balanceRetrieve = vi.fn();
const payoutsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    balance: { retrieve: (...a: unknown[]) => balanceRetrieve(...a) },
    payouts: { create: (...a: unknown[]) => payoutsCreate(...a) },
  },
}));

const groupBy = vi.fn();
const values = vi.fn();
const returning = vi.fn();
const onConflictDoNothing = vi.fn(() => ({ returning }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ leftJoin: () => ({ where: () => ({ groupBy }) }) }) }),
    }),
    insert: () => ({ values: (v: unknown) => (values(v), { onConflictDoNothing }) }),
  },
}));

const { getPayoutSummary, releaseDuePayouts } = await import("./payout.service");

const NOW = new Date("2026-10-20T12:00:00Z");
const row = (o: Record<string, unknown>) => ({
  eventId: "e1",
  title: "Evento 1",
  startsAt: new Date("2020-10-01T12:00:00Z"), // vencido
  net: "90.00",
  payoutId: null,
  payoutAmount: null,
  ...o,
});
const USER = { id: "org1", stripeAccountId: "acct_1" };

beforeEach(() => {
  vi.clearAllMocks();
  balanceRetrieve.mockResolvedValue({ available: [{ currency: "pen", amount: 100000 }] });
  payoutsCreate.mockResolvedValue({ id: "po_1" });
  returning.mockResolvedValue([{ id: "ep1" }]);
});

describe("getPayoutSummary", () => {
  it("clasifica held / available / released y suma lo no liberado", async () => {
    groupBy.mockResolvedValue([
      row({ eventId: "held", startsAt: new Date("2026-10-18T12:00:00Z"), net: "10.00" }),
      row({ eventId: "avail", startsAt: new Date("2026-10-01T12:00:00Z"), net: "90.00" }),
      row({ eventId: "rel", startsAt: new Date("2026-09-01T12:00:00Z"), payoutId: "p1", payoutAmount: "50.00", net: "60.00" }),
    ]);
    const { rows, heldTotal } = await getPayoutSummary("org1", NOW);
    expect(rows.map((r) => [r.eventId, r.status, r.amount])).toEqual([
      ["rel", "released", 50],
      ["avail", "available", 90],
      ["held", "held", 10],
    ]);
    expect(rows.find((r) => r.eventId === "held")?.releaseAt.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(heldTotal).toBe(100);
  });

  it("sin filas devuelve resumen vacio", async () => {
    groupBy.mockResolvedValue([]);
    expect(await getPayoutSummary("org1", NOW)).toEqual({ rows: [], heldTotal: 0 });
  });
});

describe("releaseDuePayouts", () => {
  it("sin eventos vencidos no llama a Stripe", async () => {
    groupBy.mockResolvedValue([row({ startsAt: new Date(Date.now() + 86_400_000) })]);
    expect(await releaseDuePayouts(USER)).toEqual({ released: 0, errors: [] });
    expect(balanceRetrieve).not.toHaveBeenCalled();
    expect(payoutsCreate).not.toHaveBeenCalled();
  });

  it("crea el payout con stripeAccount, idempotencyKey y registra la fila", async () => {
    groupBy.mockResolvedValue([row({})]);
    expect(await releaseDuePayouts(USER)).toEqual({ released: 1, errors: [] });
    expect(payoutsCreate).toHaveBeenCalledWith(
      { amount: 9000, currency: "pen", metadata: { eventId: "e1" } },
      { stripeAccount: "acct_1", idempotencyKey: "event-payout-e1" },
    );
    expect(values).toHaveBeenCalledWith({ eventId: "e1", organizerId: "org1", amount: "90.00", stripePayoutId: "po_1" });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("limita el monto al saldo disponible y usa la moneda del balance si falta PEN; la key no incluye cents", async () => {
    groupBy.mockResolvedValue([row({})]);
    balanceRetrieve.mockResolvedValue({ available: [{ currency: "usd", amount: 5000 }] });
    await releaseDuePayouts(USER);
    expect(payoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, currency: "usd" }),
      expect.objectContaining({ idempotencyKey: "event-payout-e1" }),
    );
  });

  it("insert sin fila (conflicto) no cuenta como liberado ni descuenta saldo", async () => {
    groupBy.mockResolvedValue([row({ eventId: "e1" }), row({ eventId: "e2" })]);
    balanceRetrieve.mockResolvedValue({ available: [{ currency: "pen", amount: 9000 }] });
    returning.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "ep2" }]);
    const result = await releaseDuePayouts(USER);
    expect(result.released).toBe(1);
    // e2 aun tiene saldo completo porque e1 no descontó
    expect(payoutsCreate).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 9000 }), expect.anything());
  });

  it("saldo 0: error legible y sin fila", async () => {
    groupBy.mockResolvedValue([row({})]);
    balanceRetrieve.mockResolvedValue({ available: [{ currency: "pen", amount: 0 }] });
    const result = await releaseDuePayouts(USER);
    expect(result.released).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(payoutsCreate).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("un fallo de Stripe no impide procesar el resto", async () => {
    groupBy.mockResolvedValue([row({ eventId: "e1", title: "A" }), row({ eventId: "e2", title: "B" })]);
    payoutsCreate.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ id: "po_2" });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await releaseDuePayouts(USER);
    expect(result.released).toBe(1);
    expect(result.errors).toEqual([expect.stringContaining("A")]);
    expect(values).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("e1"), expect.any(Error));
    logSpy.mockRestore();
  });
});
