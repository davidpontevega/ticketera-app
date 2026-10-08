import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event";

import type { Order } from "../types/order.types";
import { toOrderEventSnapshot } from "../utils/order.utils";
import { MyTickets } from "./my-tickets";

const buyer = {
  fullName: "Maria Perez",
  email: "maria@example.com",
  documentType: "dni" as const,
  documentNumber: "45678912",
  phone: "987654321",
};

function makeOrder(number: string, date: string, quantity = 2): Order {
  const event = EVENTS_MOCK[0];
  return {
    number,
    eventId: event.id,
    event: { ...toOrderEventSnapshot(event), date },
    buyer,
    lines: [
      {
        zoneId: "general",
        zoneName: "Campo General",
        quantity,
        unitPrice: 100,
        amount: 100 * quantity,
        seatLabels: [],
      },
    ],
    total: 100 * quantity,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const FUTURE = "2099-01-01T20:00:00-05:00";
const PAST = "2020-01-01T20:00:00-05:00";
const orders = [
  makeOrder("TK-AAAAAAAA", FUTURE),
  makeOrder("TK-BBBBBBBB", FUTURE, 1),
  makeOrder("TK-CCCCCCCC", PAST),
];

afterEach(cleanup);

describe("MyTickets", () => {
  it("shows the tabs with counters and the first ticket", () => {
    render(<MyTickets orders={orders} />);
    expect(screen.getByRole("tab", { name: "Proximas (2)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pasadas (1)" })).toBeTruthy();
    expect(screen.getByText("Entrada 1 de 2")).toBeTruthy();
  });

  it("moves between the tickets of an order", () => {
    render(<MyTickets orders={orders} />);
    const next = screen.getByRole("button", { name: "Entrada siguiente" });
    fireEvent.click(next);
    expect(screen.getByText("Entrada 2 de 2")).toBeTruthy();
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  it("preselects a past order and opens the past tab", () => {
    render(<MyTickets orders={orders} initialOrderNumber="TK-CCCCCCCC" />);
    expect(screen.getByRole("tab", { name: "Pasadas (1)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByText("Finalizado")).toBeTruthy();
  });

  it("switches tab on click", () => {
    render(<MyTickets orders={orders} />);
    fireEvent.click(screen.getByRole("tab", { name: "Pasadas (1)" }));
    expect(screen.getByRole("tab", { name: "Pasadas (1)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("shows the empty state with a link to explore", () => {
    render(<MyTickets orders={[]} />);
    expect(screen.getByText("Aun no tienes entradas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar eventos" })).toBeTruthy();
  });

  it("warns about purchases of unavailable events", () => {
    render(<MyTickets orders={orders} unavailableCount={2} />);
    expect(screen.getByRole("status").textContent).toContain("2 compras de eventos");
  });

  it("shows no warning when every event is available", () => {
    render(<MyTickets orders={orders} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
