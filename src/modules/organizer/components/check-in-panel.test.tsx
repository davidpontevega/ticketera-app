import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckInActionState } from "../types/check-in.types";

const action = vi.fn();
vi.mock("../actions/check-in.actions", () => ({
  checkInTicketAction: (...args: unknown[]) => action(...args),
}));

const { CheckInPanel } = await import("./check-in-panel");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TICKET = { code: "TK-1A2B3C4D-01", zoneName: "VIP", seatLabel: "A-1", attendeeName: "Ana", sequence: 1 };

async function submit(next: CheckInActionState) {
  action.mockResolvedValue(next);
  render(<CheckInPanel eventId={EVENT_ID} stats={{ total: 10, checkedIn: 3 }} />);
  const input = screen.getByLabelText("Codigo de entrada") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "TK-1A2B3C4D-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Validar" }));
  return input;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("CheckInPanel", () => {
  it("muestra el contador y el input enfocado sin resultado inicial", () => {
    render(<CheckInPanel eventId={EVENT_ID} stats={{ total: 10, checkedIn: 3 }} />);
    expect(screen.getByText("3/10")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Codigo de entrada"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("valid: bloque con codigo, zona/asiento y asistente; input limpio y enfocado", async () => {
    const input = await submit({ status: "valid", ticket: TICKET });
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Entrada valida");
    expect(status.textContent).toContain("TK-1A2B3C4D-01 | VIP - A-1 | Ana");
    await waitFor(() => expect(input.value).toBe(""));
    expect(document.activeElement).toBe(input);
  });

  it("valid con attendeeName vacio muestra 'Sin nombre'", async () => {
    await submit({ status: "valid", ticket: { ...TICKET, attendeeName: "" } });
    expect((await screen.findByRole("status")).textContent).toContain("Sin nombre");
  });

  it("already-used muestra 'Ya usada' con la hora", async () => {
    await submit({ status: "already-used", checkedInAt: "2026-10-14T10:00:00.000Z" });
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Ya usada");
    expect(status.textContent).toContain("Ingreso el");
  });

  it.each([
    ["not-found", "Entrada no encontrada"],
    ["wrong-event", "otro evento"],
    ["not-valid", "no valida"],
    ["cancelled", "Entrada cancelada"],
  ] as const)("%s muestra su mensaje", async (status, text) => {
    await submit({ status });
    expect((await screen.findByRole("status")).textContent).toContain(text);
  });

  it("error muestra el mensaje de validacion", async () => {
    await submit({ status: "error", message: "Codigo invalido" });
    expect((await screen.findByRole("status")).textContent).toContain("Codigo invalido");
  });
});
