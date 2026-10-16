import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  USER_ADMIN_ROLES: ["super_admin"],
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

const setPlatformFeePercent = vi.fn();
vi.mock("../services/platform-settings.service", () => ({
  setPlatformFeePercent: (...a: unknown[]) => setPlatformFeePercent(...a),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const { updatePlatformFeeAction } = await import("./platform-settings.actions");

const run = (feePercent?: string) => {
  const data = new FormData();
  if (feePercent !== undefined) data.set("feePercent", feePercent);
  data.set("userId", "attacker"); // nunca se usa
  return updatePlatformFeeAction({}, data);
};

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ id: "admin-1", role: "super_admin" });
});

describe("updatePlatformFeeAction", () => {
  it("rechaza roles distintos de super_admin sin tocar el servicio", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    await expect(run("10")).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(setPlatformFeePercent).not.toHaveBeenCalled();
  });

  it.each(["-1", "51", "abc", "1.234", ""])("valida %j antes de la DB", async (value) => {
    const result = await run(value);
    expect(result.error).toBeTruthy();
    expect(setPlatformFeePercent).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("guarda con el viewer de la sesion y revalida", async () => {
    expect(await run("12.5")).toEqual({ success: true });
    expect(setPlatformFeePercent).toHaveBeenCalledWith(12.5, "admin-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });
});
