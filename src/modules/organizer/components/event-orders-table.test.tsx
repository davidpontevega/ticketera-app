import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventOrderRow, RefundActionState } from "../types/refund.types";

const action = vi.fn();
vi.mock("../actions/refund.actions", () => ({
  refundOrderAction: (...args: unknown[]) => action(...args),
}));

const { EventOrdersTable } = await import("./event-orders-table");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const PAID: EventOrderRow = {
  id: "22222222-2222-4222-8222-222222222222",
  shortId: "22222222",
  buyerName: "Ana Perez",
  buyerEmail: "ana@example.com",
  totalAmount: 150,
  ticketCount: 2,
  createdAt: "2026-10-14T10:00:00.000Z",
  status: "paid",
};
const REFUNDED: EventOrderRow = { ...PAID, id: "33333333-3333-4333-8333-333333333333", shortId: "33333333", status: "refunded" };

function renderTable(orders: EventOrderRow[] = [PAID, REFUNDED]) {
  return render(<EventOrdersTable eventId={EVENT_ID} orders={orders} />);
}

async function confirm(next: RefundActionState) {
  action.mockResolvedValue(next);
  renderTable();
  fireEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar reembolso" }));
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("EventOrdersTable", () => {
  it("el boton Reembolsar aparece solo en ordenes pagadas", () => {
    renderTable();
    expect(screen.getAllByRole("button", { name: "Reembolsar" })).toHaveLength(1);
    expect(screen.getByText("Reembolsada")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el dialogo muestra comprador y monto y no envia hasta confirmar", async () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Ana Perez");
    expect(dialog.textContent).toContain("ana@example.com");
    expect(dialog.textContent).toMatch(/150/);
    expect(action).not.toHaveBeenCalled();
  });

  it("cancelar cierra el dialogo sin enviar", async () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it("confirmar envia eventId y orderId", async () => {
    await confirm({ status: "refunded" });
    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0][1] as FormData;
    expect(data.get("eventId")).toBe(EVENT_ID);
    expect(data.get("orderId")).toBe(PAID.id);
  });

  it.each([
    [{ status: "refunded" }, "reembolsada"],
    [{ status: "has-used-tickets" }, "ya usadas"],
    [{ status: "not-refundable" }, "no se puede reembolsar"],
    [{ status: "not-found" }, "no encontrada"],
    [{ status: "stripe-error", message: "card_declined" }, "card_declined"],
    [{ status: "error", message: "Orden invalida" }, "Orden invalida"],
  ] as [RefundActionState, string][])("muestra el resultado %j", async (next, text) => {
    await confirm(next);
    expect((await screen.findByRole("status")).textContent).toContain(text);
  });
});
