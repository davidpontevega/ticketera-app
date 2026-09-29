import { describe, expect, it } from "vitest";

import type { CheckoutFormValues } from "../types/order.types";
import { CHECKOUT_FORM_DEFAULT, validateCheckout } from "./checkout.schema";

const NOW = new Date(2026, 8, 29); // 29 set 2026

const validValues: CheckoutFormValues = {
  fullName: "Maria Perez",
  email: "maria@example.com",
  documentType: "dni",
  documentNumber: "12345678",
  phone: "987 654 321",
  paymentMethod: "card",
  card: { number: "4111 1111 1111 1111", expiry: "12/28", cvc: "123", holderName: "Maria Perez" },
  acceptedTerms: true,
};

function errorsFor(overrides: Partial<CheckoutFormValues>) {
  return validateCheckout({ ...validValues, ...overrides }, NOW);
}

describe("validateCheckout", () => {
  it("returns no errors for a valid form", () => {
    expect(validateCheckout(validValues, NOW)).toEqual({});
  });

  it("reports every required field for the empty form", () => {
    const errors = validateCheckout(CHECKOUT_FORM_DEFAULT, NOW);
    expect(Object.keys(errors).sort()).toEqual(
      [
        "acceptedTerms",
        "card.cvc",
        "card.expiry",
        "card.holderName",
        "card.number",
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

  it("validates card fields", () => {
    const card = validValues.card;
    expect(errorsFor({ card: { ...card, number: "4111 1111" } })["card.number"]).toBeDefined();
    expect(errorsFor({ card: { ...card, expiry: "08/26" } })["card.expiry"]).toBeDefined();
    expect(errorsFor({ card: { ...card, expiry: "13/30" } })["card.expiry"]).toBeDefined();
    expect(errorsFor({ card: { ...card, expiry: "09/26" } })).toEqual({});
    expect(errorsFor({ card: { ...card, cvc: "12" } })["card.cvc"]).toBeDefined();
    expect(errorsFor({ card: { ...card, holderName: "" } })["card.holderName"]).toBeDefined();
  });

  it("ignores card fields for Yape and PagoEfectivo", () => {
    const emptyCard = CHECKOUT_FORM_DEFAULT.card;
    expect(errorsFor({ paymentMethod: "yape", card: emptyCard })).toEqual({});
    expect(errorsFor({ paymentMethod: "cash", card: emptyCard })).toEqual({});
  });

  it("requires accepting the terms", () => {
    expect(errorsFor({ acceptedTerms: false }).acceptedTerms).toBe(
      "Acepta los terminos para continuar",
    );
  });
});
