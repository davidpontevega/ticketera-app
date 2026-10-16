import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

const getPayoutAccount = vi.fn();
vi.mock("../services/connect.service", () => ({
  getPayoutAccount: (...a: unknown[]) => getPayoutAccount(...a),
}));

const releaseDuePayouts = vi.fn();
vi.mock("../services/payout.service", () => ({
  releaseDuePayouts: (...a: unknown[]) => releaseDuePayouts(...a),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const { releasePayoutsAction } = await import("./payout.actions");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_CONNECT_ENABLED", "true");
  requireRole.mockResolvedValue({ id: "u1", role: "organizer" });
  getPayoutAccount.mockResolvedValue({ accountId: "acct_1" });
  releaseDuePayouts.mockResolvedValue({ released: 1, errors: [] });
});

describe("releasePayoutsAction", () => {
  it("exige ORGANIZER_AREA_ROLES y no llama al servicio si falla", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    await expect(releasePayoutsAction()).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(releaseDuePayouts).not.toHaveBeenCalled();
  });

  it("Connect apagado devuelve error sin llamar a Stripe", async () => {
    vi.stubEnv("STRIPE_CONNECT_ENABLED", "false");
    expect(await releasePayoutsAction()).toEqual({ error: expect.any(String) });
    expect(releaseDuePayouts).not.toHaveBeenCalled();
  });

  it("onboarding no complete devuelve error sin llamar a Stripe", async () => {
    getPayoutAccount.mockResolvedValue(null);
    expect(await releasePayoutsAction()).toEqual({ error: expect.any(String) });
    expect(releaseDuePayouts).not.toHaveBeenCalled();
  });

  it("opera sobre el viewer de la sesion y revalida", async () => {
    expect(await releasePayoutsAction()).toEqual({ success: true });
    expect(getPayoutAccount).toHaveBeenCalledWith("u1");
    expect(releaseDuePayouts).toHaveBeenCalledWith({ id: "u1", stripeAccountId: "acct_1" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/payments");
  });

  it("errores parciales se reportan y tambien revalida", async () => {
    releaseDuePayouts.mockResolvedValue({ released: 0, errors: ["A: fallo"] });
    expect(await releasePayoutsAction()).toEqual({ error: "A: fallo" });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("excepcion del servicio devuelve error y revalida", async () => {
    releaseDuePayouts.mockRejectedValue(new Error("down"));
    expect(await releasePayoutsAction()).toEqual({ error: expect.any(String) });
    expect(revalidatePath).toHaveBeenCalled();
  });
});
