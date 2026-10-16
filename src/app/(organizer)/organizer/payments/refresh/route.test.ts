import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

const startConnectOnboarding = vi.fn();
vi.mock("@/modules/payment/services/connect.service", () => ({
  startConnectOnboarding: (...a: unknown[]) => startConnectOnboarding(...a),
}));
vi.mock("@/modules/payment/utils/request-origin", () => ({ getRequestOrigin: async () => "http://localhost:3000" }));
vi.mock("@/modules/payment", () => ({ PAYMENTS_PATH: "/organizer/payments" }));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

const { GET } = await import("./route");

const VIEWER = { id: "u1", role: "organizer", stripeAccountId: "acct_1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireRole.mockResolvedValue(VIEWER);
  startConnectOnboarding.mockResolvedValue({ url: "https://connect.stripe.com/new" });
});

describe("GET /organizer/payments/refresh", () => {
  it("exige rol y no llama al servicio si falla", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    await expect(GET()).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(startConnectOnboarding).not.toHaveBeenCalled();
  });

  it("redirige al nuevo AccountLink usando el viewer de la sesion", async () => {
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT:https://connect.stripe.com/new");
    expect(startConnectOnboarding).toHaveBeenCalledWith(VIEWER, "http://localhost:3000");
  });

  it("connect-disabled redirige a la pagina de pagos", async () => {
    startConnectOnboarding.mockResolvedValue({ error: "connect-disabled" });
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT:/organizer/payments");
  });

  it("si el servicio lanza redirige a la pagina de pagos", async () => {
    startConnectOnboarding.mockRejectedValue(new Error("stripe down"));
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT:/organizer/payments");
  });
});
