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

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { refundOrderAction } = await import("./refund.actions");

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
