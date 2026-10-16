import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyOrderRefund } from "./refund.service";

vi.mock("server-only", () => ({}));

const update = vi.fn();
const set = vi.fn();
const where = vi.fn();
const returning = vi.fn();

vi.mock("@/lib/db", () => {
  const tx = { update: (...a: unknown[]) => update(...a) };
  return { db: { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(() => ({ set }));
  set.mockImplementation(() => ({ where }));
  where.mockImplementation(() => Object.assign(Promise.resolve(undefined), { returning }));
});

describe("applyOrderRefund", () => {
  it("marks the order refunded and cancels valid tickets when the order was paid", async () => {
    returning.mockResolvedValueOnce([{ id: "o1" }]);

    await expect(
      applyOrderRefund({ orderId: "o1", refundedBy: "u1", stripeRefundId: "re_1" }),
    ).resolves.toBe(true);

    expect(set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "refunded", refundedBy: "u1", stripeRefundId: "re_1" }),
    );
    expect(set).toHaveBeenNthCalledWith(2, { status: "cancelled" });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("does nothing else when 0 rows match (already refunded / not paid)", async () => {
    returning.mockResolvedValueOnce([]);

    await expect(
      applyOrderRefund({ paymentIntentId: "pi_1", refundedBy: null, stripeRefundId: null }),
    ).resolves.toBe(false);

    expect(update).toHaveBeenCalledTimes(1);
  });
});
