import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, createCheckoutSession } = vi.hoisted(() => ({
  auth: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("@/modules/order/services/checkout.service", () => ({ createCheckoutSession }));

import { POST } from "./route";

const validBody = {
  eventSlug: "rock-fest",
  quantities: { general: 2 },
  seatIds: {},
  buyer: {
    fullName: "Maria Perez",
    email: "maria@example.com",
    documentType: "dni",
    documentNumber: "12345678",
    phone: "987654321",
  },
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/checkout/session", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/checkout/session", () => {
  beforeEach(() => {
    auth.mockReset();
    createCheckoutSession.mockReset();
    auth.mockResolvedValue({ userId: "user_1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(makeRequest("{not json"));

    expect(response.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 400 with the first issue message when the body breaks the schema", async () => {
    const response = await POST(
      makeRequest({ ...validBody, buyer: { ...validBody.buyer, email: "maria@" } }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Ingresa un correo valido" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("passes the Clerk user id and request origin to the service and returns the url", async () => {
    createCheckoutSession.mockResolvedValue({ ok: true, url: "https://stripe.test/pay" });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://stripe.test/pay" });
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ eventSlug: "rock-fest", quantities: { general: 2 } }),
      { origin: "http://localhost:3000", clerkUserId: "user_1" },
    );
  });

  it("allows guests: no session still creates the checkout with a null user id", async () => {
    auth.mockResolvedValue({ userId: null });
    createCheckoutSession.mockResolvedValue({ ok: true, url: "https://stripe.test/pay" });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.anything(), {
      origin: "http://localhost:3000",
      clerkUserId: null,
    });
  });

  it.each([
    [404, "Evento no encontrado"],
    [409, "Sin stock disponible"],
  ])("maps a service failure with status %i to that status and message", async (status, message) => {
    createCheckoutSession.mockResolvedValue({ ok: false, status, message });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message });
  });

  it("returns a generic 500 without leaking the error message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createCheckoutSession.mockRejectedValue(new Error("stripe secret exploded"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "No pudimos iniciar el pago" });
  });
});
