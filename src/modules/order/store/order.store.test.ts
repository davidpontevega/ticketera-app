import { beforeEach, describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import type { PlaceOrderInput } from "../types/order.types";
import { toOrderEventSnapshot } from "../utils/order.utils";
import { useOrderStore } from "./order.store";

const { getState } = useOrderStore;

const input: PlaceOrderInput = {
  eventId: "1",
  event: toOrderEventSnapshot(EVENTS_MOCK[0]),
  accountEmail: "maria@example.com",
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
    getState().clearOrders();
    localStorage.clear();
  });

  it("placeOrder adds the order to the history and marks it as the last one", () => {
    const first = getState().placeOrder(input);
    const second = getState().placeOrder(input);
    expect(first.number).toMatch(/^TK-\d{5}$/);
    expect(Number.isNaN(Date.parse(second.createdAt))).toBe(false);
    expect(getState().orders).toEqual([first, second]);
    expect(getState().lastOrderNumber).toBe(second.number);
  });

  it("never stores card data even if it is passed at runtime", () => {
    const withCard = { ...input, card: { number: "4111111111111111" } } as PlaceOrderInput;
    getState().placeOrder(withCard);
    expect(JSON.stringify(getState().orders)).not.toContain("4111");
    expect(localStorage.getItem("ticketera-orders")).not.toContain("4111");
  });

  it("persists the history in localStorage", () => {
    const order = getState().placeOrder(input);
    expect(localStorage.getItem("ticketera-orders")).toContain(order.number);
  });

  it("clearOrders empties the history", () => {
    getState().placeOrder(input);
    getState().clearOrders();
    expect(getState().orders).toEqual([]);
    expect(getState().lastOrderNumber).toBeNull();
  });
});
