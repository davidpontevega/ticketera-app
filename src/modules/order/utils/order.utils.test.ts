import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { CHECKOUT_FORM_DEFAULT } from "../schemas/checkout.schema";
import {
  buildEventCalendarFile,
  formatPaymentMethod,
  generateOrderNumber,
  getCheckoutFieldId,
  getCheckoutPrefill,
  getOrderTickets,
  getUserOrders,
  isOrderUpcoming,
  setCheckoutField,
  splitOrdersByTime,
  toOrderEventSnapshot,
} from "./order.utils";
import { getDemoOrders } from "../mocks/order.mock";
import type { Order } from "../types/order.types";

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

const NOW = new Date("2026-09-29T12:00:00-05:00");
const demoOrders = getDemoOrders({ fullName: "Maria Perez", email: "maria@example.com" });

describe("toOrderEventSnapshot", () => {
  it("copies only the fields the order needs", () => {
    const snapshot = toOrderEventSnapshot(EVENTS_MOCK[0]);
    expect(Object.keys(snapshot).sort()).toEqual(
      ["address", "category", "city", "date", "id", "imageUrl", "slug", "title", "venue"].sort(),
    );
    expect(snapshot.title).toBe(EVENTS_MOCK[0].title);
  });
});

describe("getOrderTickets", () => {
  it("builds one ticket per quantity with sequential codes and seats", () => {
    const order: Order = {
      ...demoOrders[0],
      number: "TK-11111",
      lines: [
        {
          zoneId: "general",
          zoneName: "Campo General",
          quantity: 1,
          unitPrice: 450,
          amount: 450,
          seatLabels: [],
        },
        {
          zoneId: "oriente",
          zoneName: "Tribuna Oriente",
          quantity: 2,
          unitPrice: 320,
          amount: 640,
          seatLabels: ["C12", "C13"],
        },
      ],
    };
    expect(getOrderTickets(order)).toEqual([
      { code: "TK-11111-01", index: 1, total: 3, zoneName: "Campo General", seatLabel: null },
      { code: "TK-11111-02", index: 2, total: 3, zoneName: "Tribuna Oriente", seatLabel: "C12" },
      { code: "TK-11111-03", index: 3, total: 3, zoneName: "Tribuna Oriente", seatLabel: "C13" },
    ]);
  });
});

describe("splitOrdersByTime", () => {
  it("separates upcoming (ascending) and past (descending)", () => {
    const { upcoming, past } = splitOrdersByTime(demoOrders, NOW);
    expect(upcoming.map((order) => order.number)).toEqual(["TK-24817", "TK-24790"]);
    expect(past.map((order) => order.number)).toEqual(["TK-23105"]);
    expect(isOrderUpcoming(demoOrders[2], NOW)).toBe(false);
  });
});

describe("getUserOrders", () => {
  it("matches by account or buyer email, ignoring case", () => {
    const guestOrder: Order = {
      ...demoOrders[0],
      number: "TK-2",
      accountEmail: null,
      buyer: { ...demoOrders[0].buyer, email: "Ana@Example.com" },
    };
    const otherOrder: Order = {
      ...demoOrders[0],
      number: "TK-3",
      accountEmail: "otro@example.com",
      buyer: { ...demoOrders[0].buyer, email: "otro@example.com" },
    };
    const orders = [demoOrders[0], guestOrder, otherOrder];
    expect(getUserOrders(orders, "MARIA@example.com").map((order) => order.number)).toEqual([
      "TK-24817",
    ]);
    expect(getUserOrders(orders, "ana@example.com").map((order) => order.number)).toEqual(["TK-2"]);
  });
});

describe("getCheckoutPrefill", () => {
  const user = { fullName: "Ana Torres", email: "ana@test.pe" };
  const baseOrder = getDemoOrders({ fullName: "Demo", email: "demo@test.pe" })[0];
  const makeOrder = (number: string, createdAt: string, documentNumber: string): Order => ({
    ...baseOrder,
    number,
    createdAt,
    accountEmail: "ana@test.pe",
    buyer: { ...baseOrder.buyer, documentType: "dni", documentNumber, phone: "987654321" },
  });

  it("returns nothing without a user", () => {
    expect(getCheckoutPrefill(null, [])).toEqual({});
  });

  it("uses the account name and email", () => {
    expect(getCheckoutPrefill(user, [])).toEqual({
      fullName: "Ana Torres",
      email: "ana@test.pe",
    });
  });

  it("adds document and phone from the user's latest order", () => {
    const orders = [
      makeOrder("TK-1", "2026-09-01T10:00:00Z", "11111111"),
      makeOrder("TK-2", "2026-09-20T10:00:00Z", "22222222"),
      {
        ...makeOrder("TK-3", "2026-09-25T10:00:00Z", "33333333"),
        accountEmail: "otro@test.pe",
        buyer: { ...baseOrder.buyer, email: "otro@test.pe", documentNumber: "33333333" },
      },
    ];
    expect(getCheckoutPrefill(user, orders)).toEqual({
      fullName: "Ana Torres",
      email: "ana@test.pe",
      documentType: "dni",
      documentNumber: "22222222",
      phone: "987654321",
    });
  });
});
