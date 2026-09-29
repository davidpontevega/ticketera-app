import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { CHECKOUT_FORM_DEFAULT } from "../schemas/checkout.schema";
import {
  buildEventCalendarFile,
  formatPaymentMethod,
  generateOrderNumber,
  getCheckoutFieldId,
  setCheckoutField,
} from "./order.utils";

describe("generateOrderNumber", () => {
  it("builds TK- plus 5 digits", () => {
    expect(generateOrderNumber(() => 0)).toBe("TK-10000");
    expect(generateOrderNumber(() => 0.99999)).toBe("TK-99999");
    expect(generateOrderNumber()).toMatch(/^TK-\d{5}$/);
  });
});

describe("buildEventCalendarFile", () => {
  it("builds an ics event in UTC with title and location", () => {
    const event = EVENTS_MOCK[0]; // Bad Bunny, 2026-11-14T21:00:00-05:00
    const ics = buildEventCalendarFile(event, new Date("2026-09-29T00:00:00Z"));
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("DTSTART:20261115T020000Z");
    expect(lines).toContain("DTEND:20261115T050000Z");
    expect(lines).toContain("SUMMARY:Bad Bunny - World Tour");
    expect(lines).toContain(
      "LOCATION:Estadio Nacional\\, Av. Jose Diaz s/n\\, Cercado de Lima\\, Lima",
    );
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });
});

describe("formatPaymentMethod", () => {
  it("returns the label of each method", () => {
    expect(formatPaymentMethod("card")).toBe("Tarjeta");
    expect(formatPaymentMethod("yape")).toBe("Yape");
    expect(formatPaymentMethod("cash")).toBe("PagoEfectivo");
  });
});

describe("getCheckoutFieldId", () => {
  it("builds a DOM friendly id", () => {
    expect(getCheckoutFieldId("email")).toBe("checkout-email");
    expect(getCheckoutFieldId("card.number")).toBe("checkout-card-number");
  });
});

describe("setCheckoutField", () => {
  it("updates top level and nested card fields without mutating", () => {
    const withEmail = setCheckoutField(CHECKOUT_FORM_DEFAULT, "email", "a@b.com");
    expect(withEmail.email).toBe("a@b.com");
    const withCard = setCheckoutField(withEmail, "card.cvc", "123");
    expect(withCard.card.cvc).toBe("123");
    expect(withCard.email).toBe("a@b.com");
    expect(CHECKOUT_FORM_DEFAULT.email).toBe("");
    expect(CHECKOUT_FORM_DEFAULT.card.cvc).toBe("");
  });
});
