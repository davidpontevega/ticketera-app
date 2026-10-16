import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VenueActionState, VenueZoneDto } from "../types/venue.types";

const createZone = vi.fn<(...args: unknown[]) => Promise<VenueActionState>>();
const updateZone = vi.fn<(...args: unknown[]) => Promise<VenueActionState>>();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("../actions/venue.actions", () => ({
  createZoneAction: (...args: unknown[]) => createZone(...args),
  updateZoneAction: (...args: unknown[]) => updateZone(...args),
}));

const { VenueZoneForm } = await import("./venue-zone-form");

const VENUE_ID = "11111111-1111-4111-8111-111111111111";
const ZONE: VenueZoneDto = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Platea",
  kind: "numbered",
  capacity: 200,
  rows: 10,
  seatsPerRow: 20,
  inUse: false,
  usedByEvents: 0,
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("VenueZoneForm", () => {
  it("muestra filas y asientos para numerada y capacidad para general", () => {
    render(<VenueZoneForm venueId={VENUE_ID} />);
    expect(screen.getByLabelText(/Filas/)).toBeTruthy();
    expect(screen.getByLabelText(/Asientos por fila/)).toBeTruthy();
    expect(screen.queryByLabelText(/Capacidad/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Tipo de zona"), { target: { value: "general" } });
    expect(screen.getByLabelText(/Capacidad/)).toBeTruthy();
    expect(screen.queryByLabelText(/Filas/)).toBeNull();
  });

  it("zona en uso: solo el nombre, con el motivo, y reenvia la estructura actual", async () => {
    updateZone.mockResolvedValue({ status: "success" });
    render(<VenueZoneForm venueId={VENUE_ID} zone={{ ...ZONE, inUse: true, usedByEvents: 2 }} />);
    expect(screen.getByText(/La usa 2 evento\(s\): solo se puede cambiar el nombre/)).toBeTruthy();
    expect(screen.queryByLabelText("Tipo de zona")).toBeNull();
    expect(screen.queryByLabelText(/Filas/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Nombre de la zona"), { target: { value: "VIP" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar zona" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(updateZone).toHaveBeenCalledWith(ZONE.id, {
      name: "VIP",
      kind: "numbered",
      capacity: "",
      rows: "10",
      seatsPerRow: "20",
    });
  });

  it("muestra los errores de campo y el mensaje del servidor", async () => {
    createZone.mockResolvedValue({
      status: "error",
      message: "Revisa los datos",
      fieldErrors: { rows: "Filas: minimo 1" },
    });
    render(<VenueZoneForm venueId={VENUE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar zona" }));

    expect(await screen.findByText("Revisa los datos")).toBeTruthy();
    const rows = screen.getByLabelText(/Filas/);
    expect(rows.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Filas: minimo 1")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
