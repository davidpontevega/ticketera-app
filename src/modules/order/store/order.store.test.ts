import { beforeEach, describe, expect, it } from "vitest";

import type { PlaceOrderInput } from "../types/order.types";
import { useOrderStore } from "./order.store";

const { getState } = useOrderStore;

const input: PlaceOrderInput = {
  eventId: "1",
  buyer: {
    fullName: "Maria Perez",
    email: "maria@example.com",
    documentType: "dni",
    documentNumber: "12345678",
    phone: "987654321",
  },
  paymentMethod: "card",
  lines: [
    {
      zoneId: "general",
      zoneName: "Campo General",
      quantity: 2,
      unitPrice: 450,
      amount: 900,
      seatLabels: [],
    },
  ],
  total: 900,
};

describe("useOrderStore", () => {
  beforeEach(() => {
    getState().clearOrder();
    sessionStorage.clear();
  });

  it("placeOrder stores the order with a number and creation date", () => {
    const order = getState().placeOrder(input);
    expect(order.number).toMatch(/^TK-\d{5}$/);
    expect(Number.isNaN(Date.parse(order.createdAt))).toBe(false);
    expect(getState().lastOrder).toEqual(order);
  });

  it("never stores card data even if it is passed at runtime", () => {
    const withCard = { ...input, card: { number: "4111111111111111" } } as PlaceOrderInput;
    getState().placeOrder(withCard);
    expect(JSON.stringify(getState().lastOrder)).not.toContain("4111");
    expect(sessionStorage.getItem("ticketera-last-order")).not.toContain("4111");
  });

  it("persists the last order in sessionStorage", () => {
    const order = getState().placeOrder(input);
    expect(sessionStorage.getItem("ticketera-last-order")).toContain(order.number);
  });

  it("clearOrder removes the order", () => {
    getState().placeOrder(input);
    getState().clearOrder();
    expect(getState().lastOrder).toBeNull();
  });
});
