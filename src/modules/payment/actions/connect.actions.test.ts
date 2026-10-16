import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

const startConnectOnboarding = vi.fn();
vi.mock("../services/connect.service", () => ({
  startConnectOnboarding: (...a: unknown[]) => startConnectOnboarding(...a),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

const { startConnectOnboardingAction } = await import("./connect.actions");

const VIEWER = { id: "u1", role: "organizer", stripeAccountId: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(VIEWER);
  startConnectOnboarding.mockResolvedValue({ url: "https://connect.stripe.com/x" });
});

describe("startConnectOnboardingAction", () => {
  it("exige ORGANIZER_AREA_ROLES y no toca el servicio si falla", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    await expect(startConnectOnboardingAction()).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(startConnectOnboarding).not.toHaveBeenCalled();
  });

  it("usa el viewer de la sesion y el origen del request, y redirige a Stripe", async () => {
    await expect(startConnectOnboardingAction()).rejects.toThrow("NEXT_REDIRECT:https://connect.stripe.com/x");
    expect(startConnectOnboarding).toHaveBeenCalledWith(VIEWER, "http://localhost:3000");
  });

  it("flag apagado devuelve error sin redirigir", async () => {
    startConnectOnboarding.mockResolvedValue({ error: "connect-disabled" });
    expect(await startConnectOnboardingAction()).toEqual({ error: "Stripe Connect desactivado" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("error de Stripe devuelve mensaje", async () => {
    startConnectOnboarding.mockRejectedValue(new Error("stripe down"));
    expect(await startConnectOnboardingAction()).toEqual({ error: expect.stringContaining("onboarding") });
    expect(redirect).not.toHaveBeenCalled();
  });
});
