import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/payout.actions", () => ({ releasePayoutsAction: vi.fn() }));

const { PayoutHoldCard } = await import("./payout-hold-card");

afterEach(cleanup);

const row = (o: object) => ({
  eventId: "e1",
  title: "Concierto",
  amount: 90,
  releaseAt: new Date("2026-10-08T20:00:00Z"),
  status: "held" as const,
  ...o,
});

describe("PayoutHoldCard", () => {
  it("sin eventos muestra estado vacio y boton deshabilitado", () => {
    render(<PayoutHoldCard summary={{ rows: [], heldTotal: 0 }} />);
    expect(screen.getByText(/Aun no tienes ventas/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirar fondos disponibles" }).hasAttribute("disabled")).toBe(true);
  });

  it("muestra total, fila con badge y boton deshabilitado si todo esta retenido", () => {
    render(<PayoutHoldCard summary={{ rows: [row({})], heldTotal: 90 }} />);
    expect(screen.getByText(/Fondos retenidos/)).toBeTruthy();
    expect(screen.getByText("Concierto")).toBeTruthy();
    expect(screen.getByText("Retenido")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirar fondos disponibles" }).hasAttribute("disabled")).toBe(true);
  });

  it("habilita el boton con un evento disponible", () => {
    render(<PayoutHoldCard summary={{ rows: [row({ status: "available" }), row({ eventId: "e2", status: "released" })], heldTotal: 90 }} />);
    expect(screen.getByText("Disponible")).toBeTruthy();
    expect(screen.getByText("Liberado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retirar fondos disponibles" }).hasAttribute("disabled")).toBe(false);
  });
});
