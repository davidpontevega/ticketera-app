import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelEventWithRefunds, retryEventRefunds } from "./organizer-event-cancel.service";

vi.mock("server-only", () => ({}));

const changeEventStatus = vi.fn();
vi.mock("./organizer-event-admin.service", () => ({
  changeEventStatus: (...args: unknown[]) => changeEventStatus(...args),
}));

const refundEventOrders = vi.fn();
const getEventHeaderForOrders = vi.fn();
vi.mock("./organizer-refund.service", () => ({
  refundEventOrders: (...args: unknown[]) => refundEventOrders(...args),
  getEventHeaderForOrders: (...args: unknown[]) => getEventHeaderForOrders(...args),
}));

const viewer = { id: "organizer-1", role: "organizer" as const };
const input = { eventId: "event-1" };
const summary = { total: 2, refunded: 2, failed: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  changeEventStatus.mockResolvedValue({ ok: true });
  refundEventOrders.mockResolvedValue(summary);
  getEventHeaderForOrders.mockResolvedValue({ title: "Show", status: "cancelled" });
});

describe("cancelEventWithRefunds", () => {
  it("cancela el evento y luego reembolsa; devuelve el resumen (AC1)", async () => {
    expect(await cancelEventWithRefunds(input, viewer)).toEqual({ ok: true, refunds: summary });
    expect(changeEventStatus).toHaveBeenCalledWith({ eventId: "event-1", status: "cancelled" }, viewer);
    expect(refundEventOrders).toHaveBeenCalledWith("event-1", viewer);
  });

  it.each(["not-found", "invalid-transition"])("si falla el cambio (%s) no reembolsa (AC2)", async (error) => {
    changeEventStatus.mockResolvedValue({ ok: false, error });

    expect(await cancelEventWithRefunds(input, viewer)).toEqual({ ok: false, error });
    expect(refundEventOrders).not.toHaveBeenCalled();
  });

  it("evento sin ordenes paid => total 0 (AC2)", async () => {
    refundEventOrders.mockResolvedValue({ total: 0, refunded: 0, failed: 0 });

    expect(await cancelEventWithRefunds(input, viewer)).toEqual({
      ok: true,
      refunds: { total: 0, refunded: 0, failed: 0 },
    });
  });

  it("con fallos parciales sigue siendo ok: true (AC3)", async () => {
    refundEventOrders.mockResolvedValue({ total: 3, refunded: 2, failed: 1 });

    expect(await cancelEventWithRefunds(input, viewer)).toEqual({
      ok: true,
      refunds: { total: 3, refunded: 2, failed: 1 },
    });
  });
});

describe("cancelEventWithRefunds cuando el reembolso masivo lanza", () => {
  it("el evento queda cancelado y devuelve ok con refunds null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    refundEventOrders.mockRejectedValue(new Error("db down"));

    expect(await cancelEventWithRefunds(input, viewer)).toEqual({ ok: true, refunds: null });
    expect(changeEventStatus).toHaveBeenCalled();
  });
});

describe("retryEventRefunds", () => {
  it("evento cancelado en scope => reembolsa (AC5)", async () => {
    expect(await retryEventRefunds(input, viewer)).toEqual({ ok: true, refunds: summary });
    expect(getEventHeaderForOrders).toHaveBeenCalledWith("event-1", viewer);
    expect(changeEventStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistente o ajeno", null],
    ["no cancelado", { title: "Show", status: "published" }],
  ])("evento %s => not-found sin reembolsar (AC5)", async (_n, header) => {
    getEventHeaderForOrders.mockResolvedValue(header);

    expect(await retryEventRefunds(input, viewer)).toEqual({ ok: false, error: "not-found" });
    expect(refundEventOrders).not.toHaveBeenCalled();
  });
});
