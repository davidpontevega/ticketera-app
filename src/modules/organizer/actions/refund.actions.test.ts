import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const refundOrder = vi.fn();
vi.mock("../services/organizer-refund.service", () => ({
  refundOrder: (...args: unknown[]) => refundOrder(...args),
}));

const retryEventRefunds = vi.fn();
vi.mock("../services/organizer-event-cancel.service", () => ({
  retryEventRefunds: (...args: unknown[]) => retryEventRefunds(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { refundOrderAction, retryEventRefundsAction } = await import("./refund.actions");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const VIEWER = { id: "organizer-1", role: "organizer" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const run = (entries: Record<string, string>) => refundOrderAction({ status: "idle" }, form(entries));

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(VIEWER);
  refundOrder.mockResolvedValue({ result: "refunded" });
});

describe("refundOrderAction", () => {
  it("llama requireRole con ORGANIZER_AREA_ROLES y si rechaza no toca el servicio", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(run({ eventId: EVENT_ID, orderId: ORDER_ID })).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(refundOrder).not.toHaveBeenCalled();
  });

  it("payload invalido devuelve error sin llamar al servicio", async () => {
    const result = await run({ eventId: EVENT_ID, orderId: "xx" });
    expect(result).toEqual({ status: "error", message: "Orden invalida" });
    expect(refundOrder).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refunded: usa el viewer de requireRole (ignora viewer del form) y revalida", async () => {
    const result = await run({ eventId: EVENT_ID, orderId: ORDER_ID, role: "admin", viewer: "x" });
    expect(result).toEqual({ status: "refunded" });
    expect(refundOrder).toHaveBeenCalledWith({ eventId: EVENT_ID, orderId: ORDER_ID }, VIEWER);
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${EVENT_ID}/orders`);
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${EVENT_ID}/check-in`);
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it.each(["not-found", "not-refundable", "has-used-tickets"])("%s mapea a status sin revalidar", async (result) => {
    refundOrder.mockResolvedValue({ result });
    expect(await run({ eventId: EVENT_ID, orderId: ORDER_ID })).toEqual({ status: result });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stripe-error conserva el mensaje", async () => {
    refundOrder.mockResolvedValue({ result: "stripe-error", message: "boom" });
    expect(await run({ eventId: EVENT_ID, orderId: ORDER_ID })).toEqual({
      status: "stripe-error",
      message: "boom",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("retryEventRefundsAction", () => {
  const retry = (entries: Record<string, string>) => retryEventRefundsAction({ status: "idle" }, form(entries));
  const refunds = { total: 2, refunded: 2, failed: 0 };

  beforeEach(() => {
    retryEventRefunds.mockResolvedValue({ ok: true, refunds });
  });

  it("requireRole con ORGANIZER_AREA_ROLES; si rechaza no toca el servicio", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(retry({ eventId: EVENT_ID })).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(retryEventRefunds).not.toHaveBeenCalled();
  });

  it("eventId invalido => error sin servicio ni revalidar", async () => {
    expect(await retry({ eventId: "xx" })).toEqual({ status: "error", message: "Evento invalido" });
    expect(retryEventRefunds).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("usa el viewer de la sesion (ignora el form), devuelve el resumen y revalida", async () => {
    const result = await retry({ eventId: EVENT_ID, role: "admin" });
    expect(result).toEqual({ status: "done", refunds });
    expect(retryEventRefunds).toHaveBeenCalledWith({ eventId: EVENT_ID }, VIEWER);
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${EVENT_ID}/orders`);
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("not-found => error sin revalidar", async () => {
    retryEventRefunds.mockResolvedValue({ ok: false, error: "not-found" });
    expect(await retry({ eventId: EVENT_ID })).toMatchObject({ status: "error" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
