import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const limit = vi.fn();
const onConflictDoUpdate = vi.fn();
const values = vi.fn(() => ({ onConflictDoUpdate }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    insert: () => ({ values }),
  },
}));

const { getPlatformSettings, getPlatformFeePercent, setPlatformFeePercent } = await import("./platform-settings.service");

beforeEach(() => vi.clearAllMocks());

describe("platform settings service", () => {
  it("devuelve el default (10) sin escribir cuando no hay fila", async () => {
    limit.mockResolvedValue([]);
    expect(await getPlatformSettings()).toEqual({ feePercent: 10, updatedBy: null, updatedAt: null });
    expect(await getPlatformFeePercent()).toBe(10);
    expect(values).not.toHaveBeenCalled();
  });

  it("convierte el numeric de la fila a number", async () => {
    const updatedAt = new Date();
    limit.mockResolvedValue([{ id: 1, feePercent: "12.50", updatedBy: "u1", updatedAt }]);
    expect(await getPlatformSettings()).toEqual({ feePercent: 12.5, updatedBy: "u1", updatedAt });
  });

  it("upsert de la fila unica con updated_by", async () => {
    await setPlatformFeePercent(7.5, "admin-1");
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ id: 1, feePercent: "7.50", updatedBy: "admin-1" }));
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ feePercent: "7.50", updatedBy: "admin-1" }) }),
    );
  });
});
