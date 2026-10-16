import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) } } }));

const handleConnectEvent = vi.fn();
vi.mock("@/modules/payment/services/connect.service", () => ({
  handleConnectEvent: (...a: unknown[]) => handleConnectEvent(...a),
}));

const { POST } = await import("./route");

const req = (headers: Record<string, string> = { "stripe-signature": "sig" }) =>
  new NextRequest("http://localhost/api/webhooks/stripe-connect", { method: "POST", body: "raw", headers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_other");
  constructEvent.mockReturnValue({ type: "account.updated" });
  handleConnectEvent.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/stripe-connect", () => {
  it("sin stripe-signature => 400", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(handleConnectEvent).not.toHaveBeenCalled();
  });

  it("firma invalida => 400 sin llamar al handler", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad");
    });
    expect((await POST(req())).status).toBe(400);
    expect(handleConnectEvent).not.toHaveBeenCalled();
  });

  it("sin secreto => 500", async () => {
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "");
    expect((await POST(req())).status).toBe(500);
  });

  it("handler que lanza => 500", async () => {
    handleConnectEvent.mockRejectedValue(new Error("boom"));
    expect((await POST(req())).status).toBe(500);
  });

  it("ok => 200, firma con el secreto Connect sobre el cuerpo crudo", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith("raw", "sig", "whsec_connect");
    expect(handleConnectEvent).toHaveBeenCalledWith({ type: "account.updated" });
  });
});
