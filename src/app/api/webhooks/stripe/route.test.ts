import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { constructEvent, handleStripeEvent } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  handleStripeEvent: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent } } }));
vi.mock("@/modules/order/services/checkout.service", () => ({ handleStripeEvent }));

import { POST } from "./route";

const RAW_BODY = '{"id":"evt_1","type":"checkout.session.completed"}';

function makeRequest(headers: Record<string, string> = { "stripe-signature": "sig_1" }) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: RAW_BODY,
    headers,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    constructEvent.mockReset();
    handleStripeEvent.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 400 without stripe-signature and processes nothing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature is invalid", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("verifies the raw body and processes a valid event", async () => {
    const event = { id: "evt_1", type: "checkout.session.completed" };
    constructEvent.mockReturnValue(event);
    handleStripeEvent.mockResolvedValue(undefined);

    const response = await POST(makeRequest());

    expect(constructEvent).toHaveBeenCalledWith(RAW_BODY, "sig_1", "whsec_test");
    expect(handleStripeEvent).toHaveBeenCalledWith(event);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("returns 500 when processing fails so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    constructEvent.mockReturnValue({ id: "evt_1" });
    handleStripeEvent.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("db down");
  });
});
