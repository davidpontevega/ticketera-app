import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VenueActionState } from "../types/venue.types";

const createVenue = vi.fn<(...args: unknown[]) => Promise<VenueActionState>>();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("../actions/venue.actions", () => ({
  createVenueAction: (...args: unknown[]) => createVenue(...args),
  updateVenueAction: vi.fn(),
}));

const { VenueForm } = await import("./venue-form");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const fill = () => {
  fireEvent.change(screen.getByLabelText("Nombre del recinto"), { target: { value: "Teatro" } });
  fireEvent.change(screen.getByLabelText("Direccion"), { target: { value: "Av. 1" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Lima" } });
};

describe("VenueForm", () => {
  it("al crear navega al editor del recinto nuevo", async () => {
    createVenue.mockResolvedValue({ status: "success", id: "abc" });
    render(<VenueForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Crear recinto" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organizer/venues/abc"));
    expect(createVenue).toHaveBeenCalledWith(expect.objectContaining({ name: "Teatro", city: "Lima" }));
  });

  it("muestra errores por campo con aria-invalid y el mensaje general", async () => {
    createVenue.mockResolvedValue({
      status: "error",
      message: "Revisa los datos",
      fieldErrors: { latitude: "Ingresa latitud y longitud juntas" },
    });
    render(<VenueForm />);
    fireEvent.click(screen.getByRole("button", { name: "Crear recinto" }));

    expect(await screen.findByText("Revisa los datos")).toBeTruthy();
    expect(screen.getByLabelText("Latitud (opcional)").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Ingresa latitud y longitud juntas")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
