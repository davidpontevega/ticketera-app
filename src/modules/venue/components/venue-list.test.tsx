import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VenueActionState, VenueDto } from "../types/venue.types";

const deleteVenue = vi.fn<(...args: unknown[]) => Promise<VenueActionState>>();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("../actions/venue.actions", () => ({
  deleteVenueAction: (...args: unknown[]) => deleteVenue(...args),
}));

const { VenueList } = await import("./venue-list");

const FREE: VenueDto = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Teatro Libre",
  address: "Av. 1",
  city: "Lima",
  latitude: null,
  longitude: null,
  zoneCount: 2,
  capacity: 500,
  eventCount: 0,
  isOwn: true,
};
const USED: VenueDto = { ...FREE, id: "22222222-2222-4222-8222-222222222222", name: "Estadio Usado", eventCount: 3, isOwn: false };

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("VenueList", () => {
  it("sin recintos muestra el estado vacio con enlace para crear", () => {
    render(<VenueList venues={[]} />);
    expect(screen.getByRole("link", { name: /Nuevo recinto/ }).getAttribute("href")).toBe("/organizer/venues/new");
  });

  it("ofrece eliminar solo si ningun evento lo usa", () => {
    render(<VenueList venues={[FREE, USED]} />);
    expect(screen.getByRole("button", { name: "Eliminar Teatro Libre" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Eliminar Estadio Usado" })).toBeNull();
    expect(screen.getByRole("link", { name: "Editar Estadio Usado" })).toBeTruthy();
    expect(screen.getAllByText("De otro usuario")).toHaveLength(1);
  });

  it("confirma antes de eliminar y refresca", async () => {
    deleteVenue.mockResolvedValue({ status: "success" });
    render(<VenueList venues={[FREE]} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Teatro Libre" }));
    expect(deleteVenue).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar recinto" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(deleteVenue).toHaveBeenCalledWith(FREE.id);
  });

  it("muestra el mensaje del servidor si falla", async () => {
    deleteVenue.mockResolvedValue({ status: "error", message: "Este recinto lo usa un evento" });
    render(<VenueList venues={[FREE]} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Teatro Libre" }));
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar recinto" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Este recinto lo usa un evento");
    expect(refresh).not.toHaveBeenCalled();
  });
});
