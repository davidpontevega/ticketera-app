import { describe, expect, it } from "vitest";

import type { CheckoutFormValues } from "../types/order.types";
import { CHECKOUT_FORM_DEFAULT, createCheckoutSessionSchema, validateCheckout } from "./checkout.schema";

const validValues: CheckoutFormValues = {
  fullName: "Maria Perez",
  email: "maria@example.com",
  documentType: "dni",
  documentNumber: "12345678",
  phone: "987 654 321",
  acceptedTerms: true,
};

function errorsFor(overrides: Partial<CheckoutFormValues>) {
  return validateCheckout({ ...validValues, ...overrides });
}

describe("validateCheckout", () => {
  it("returns no errors for a valid form", () => {
    expect(validateCheckout(validValues)).toEqual({});
  });

  it("reports every required field for the empty form", () => {
    const errors = validateCheckout(CHECKOUT_FORM_DEFAULT);
    expect(Object.keys(errors).sort()).toEqual(
      [
        "acceptedTerms",
        "documentNumber",
        "email",
        "fullName",
        "phone",
      ].sort(),
    );
  });

  it("validates name and email", () => {
    expect(errorsFor({ fullName: "Al" }).fullName).toBeDefined();
    expect(errorsFor({ fullName: "Maria 123" }).fullName).toBeDefined();
    expect(errorsFor({ email: "maria@" }).email).toBe("Ingresa un correo valido");
  });

  it("validates the document number by type", () => {
    expect(errorsFor({ documentNumber: "1234567" }).documentNumber).toBe(
      "El DNI debe tener 8 digitos",
    );
    expect(
      errorsFor({ documentType: "ce", documentNumber: "12345678" }).documentNumber,
    ).toBeDefined();
    expect(errorsFor({ documentType: "ce", documentNumber: "001234567" })).toEqual({});
    expect(
      errorsFor({ documentType: "passport", documentNumber: "AB123" }).documentNumber,
    ).toBeDefined();
    expect(errorsFor({ documentType: "passport", documentNumber: "AB1234" })).toEqual({});
  });

  it("validates a 9 digit phone starting with 9", () => {
    expect(errorsFor({ phone: "887654321" }).phone).toBeDefined();
    expect(errorsFor({ phone: "98765432" }).phone).toBeDefined();
    expect(errorsFor({ phone: "987654321" })).toEqual({});
  });

  it("requires accepting the terms", () => {
    expect(errorsFor({ acceptedTerms: false }).acceptedTerms).toBe(
      "Acepta los terminos para continuar",
    );
  });
});

describe("createCheckoutSessionSchema", () => {
  const validBody = {
    eventSlug: "feria-del-libro",
    quantities: { general: 2 },
    seatIds: { vip: ["A1", "A2"] },
    buyer: {
      fullName: "Maria Perez",
      email: "maria@example.com",
      documentType: "dni" as const,
      documentNumber: "12345678",
      phone: "987654321",
    },
  };

  it("parses a valid body", () => {
    expect(createCheckoutSessionSchema.parse(validBody)).toEqual(validBody);
  });

  it("rejects an invalid buyer email", () => {
    const result = createCheckoutSessionSchema.safeParse({
      ...validBody,
      buyer: { ...validBody.buyer, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantities", () => {
    const result = createCheckoutSessionSchema.safeParse({
      ...validBody,
      quantities: { general: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty eventSlug", () => {
    const result = createCheckoutSessionSchema.safeParse({ ...validBody, eventSlug: "" });
    expect(result.success).toBe(false);
  });

  it("drops extra price fields from the parsed result", () => {
    const parsed = createCheckoutSessionSchema.parse({
      ...validBody,
      unitPrice: 50,
      total: 100,
    });
    expect(parsed).not.toHaveProperty("unitPrice");
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).toEqual(validBody);
  });
});
