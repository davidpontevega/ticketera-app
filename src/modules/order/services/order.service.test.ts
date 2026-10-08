import axios, { AxiosError, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateCheckoutSessionInput } from "../schemas/checkout.schema";
import { getCheckoutErrorMessage, startCheckoutSession } from "./order.service";

const input: CreateCheckoutSessionInput = {
  eventSlug: "evento-1",
  quantities: { general: 2 },
  seatIds: { general: [] },
  buyer: {
    fullName: "Ana Perez",
    email: "ana@example.com",
    documentType: "dni",
    documentNumber: "12345678",
    phone: "999888777",
  },
};

function httpError(status: number, data?: unknown) {
  return new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

afterEach(() => vi.restoreAllMocks());

describe("startCheckoutSession", () => {
  it("posts the input and returns the url", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } });

    await expect(startCheckoutSession(input)).resolves.toEqual({ url: "https://checkout.stripe.com/x" });
    expect(post).toHaveBeenCalledWith("/api/checkout/session", input);
  });

  it("throws the server message on 400", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(httpError(400, { message: "Datos invalidos" }));

    await expect(startCheckoutSession(input)).rejects.toThrow("Datos invalidos");
  });

  it("throws the unavailable message on 404 without message", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(httpError(404));

    await expect(startCheckoutSession(input)).rejects.toThrow(
      "Este evento todavia no admite pagos en linea.",
    );
  });

  it("throws the generic message on network or 500 errors", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Network Error"));
    await expect(startCheckoutSession(input)).rejects.toThrow("No pudimos iniciar el pago. Intenta de nuevo.");

    vi.spyOn(axios, "post").mockRejectedValue(httpError(500));
    await expect(startCheckoutSession(input)).rejects.toThrow("No pudimos iniciar el pago. Intenta de nuevo.");
  });
});

describe("getCheckoutErrorMessage", () => {
  it("falls back to generic for unknown values", () => {
    expect(getCheckoutErrorMessage("boom")).toBe("No pudimos iniciar el pago. Intenta de nuevo.");
  });
});
