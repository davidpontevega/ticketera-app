import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminMetrics } from "./admin-metrics.service";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  USER_ADMIN_ROLES: ["super_admin"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const execute = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { execute: (...args: unknown[]) => execute(...args) },
}));

const NOW = new Date("2026-10-16T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ id: "u1", role: "super_admin" });
  execute.mockResolvedValue([]);
});

describe("getAdminMetrics", () => {
  it("rechaza rol no admin sin tocar la DB", async () => {
    requireRole.mockRejectedValue(new Error("forbidden"));

    await expect(getAdminMetrics(NOW)).rejects.toThrow("forbidden");
    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("base vacia -> ceros con 4 consultas agregadas", async () => {
    const metrics = await getAdminMetrics(NOW);

    expect(execute).toHaveBeenCalledTimes(4);
    expect(metrics.revenue.total).toBe(0);
    expect(metrics.sold.points).toHaveLength(6);
    expect(metrics.users.total).toBe(0);
  });

  it("arma AdminMetrics desde filas agregadas", async () => {
    execute
      .mockResolvedValueOnce([{ month: "2026-10", revenue: "100.50", fee: "10.05" }])
      .mockResolvedValueOnce([{ month: "2026-10", value: 4 }])
      .mockResolvedValueOnce([
        { kind: "status", key: "published", value: 3 },
        { kind: "status", key: "draft", value: 1 },
        { kind: "month", key: "2026-09", value: 2 },
      ])
      .mockResolvedValueOnce([
        { kind: "role", key: "customer", value: 9 },
        { kind: "role", key: "organizer", value: 1 },
        { kind: "month", key: "2026-10", value: 5 },
      ]);

    const metrics = await getAdminMetrics(NOW);

    expect(metrics.revenue.current).toBe(100.5);
    expect(metrics.platformFee.current).toBe(10.05);
    expect(metrics.sold.current).toBe(4);
    expect(metrics.events).toEqual({ total: 4, published: 3, draft: 1, cancelled: 0 });
    expect(metrics.newEvents.previous).toBe(2);
    expect(metrics.users.total).toBe(10);
    expect(metrics.newUsers.current).toBe(5);
  });
});
