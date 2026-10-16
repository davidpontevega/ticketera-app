import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const changeEventStatusAction = vi.fn();
vi.mock("../actions/organizer-event.actions", () => ({
  changeEventStatusAction: (...args: unknown[]) => changeEventStatusAction(...args),
  deleteEventAction: vi.fn(),
}));
vi.mock("@/modules/event", () => ({ getEventHref: (slug: string) => `/events/${slug}` }));

const { OrganizerEventActions } = await import("./organizer-event-actions");

const event = { id: "event-1", slug: "show", title: "Show", status: "published" as const };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("OrganizerEventActions - cancelar", () => {
  it("tras cancelar muestra el resumen (role=status) con un unico boton Cerrar", async () => {
    changeEventStatusAction.mockResolvedValue({
      status: "success",
      message: "Evento cancelado. Reembolsadas 2 de 3 ordenes. 1 fallaron: reintentalas desde Ordenes.",
    });
    render(<OrganizerEventActions event={event} />);

    fireEvent.click(screen.getByRole("button", { name: "Acciones de Show" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancelar evento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar evento" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Reembolsadas 2 de 3");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});
