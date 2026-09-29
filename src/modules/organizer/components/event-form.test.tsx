import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/modules/auth";

import { useOrganizerStore } from "../store/organizer.store";
import { EventForm } from "./event-form";

const push = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  push.mockClear();
  currentSearch = "";
  localStorage.clear();
  useAuthStore.setState({ user: { fullName: "Maria Perez", email: "maria@example.com" } });
  useOrganizerStore.setState({ events: [] });
});

afterEach(cleanup);

describe("EventForm", () => {
  it("shows the errors when publishing an empty form", () => {
    render(<EventForm />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evento" }));
    expect(screen.getByText("Ingresa el nombre del evento (minimo 3 caracteres)")).toBeTruthy();
    expect(screen.getByText("Sube una imagen de portada")).toBeTruthy();
    expect(screen.getAllByText("Ingresa un precio mayor a 0")).toHaveLength(2);
    expect(push).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("event-name");
  });

  it("adds and removes ticket tiers and updates the capacity", () => {
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText("Cantidad (tipo 1)"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Cantidad (tipo 2)"), { target: { value: "50" } });
    expect(screen.getByText("150 entradas")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Agregar tipo de entrada" }));
    expect(screen.getByLabelText("Cantidad (tipo 3)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quitar tipo de entrada 1" }));
    expect(screen.getByText("50 entradas")).toBeTruthy();
  });

  it("saves a draft with only the name and goes back to the dashboard", () => {
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Mi feria" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    const [saved] = useOrganizerStore.getState().events;
    expect(saved).toMatchObject({
      name: "Mi feria",
      status: "draft",
      ownerEmail: "maria@example.com",
    });
    expect(push).toHaveBeenCalledWith("/organizer");
  });

  it("opens a draft for editing without duplicating it", () => {
    currentSearch = "draft=demo-feria-familiar";
    render(<EventForm />);
    expect(screen.getByRole("heading", { name: "Editar borrador" })).toBeTruthy();
    expect((screen.getByLabelText("Nombre del evento") as HTMLInputElement).value).toBe(
      "Feria Familiar de Verano",
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(useOrganizerStore.getState().events.map((event) => event.id)).toEqual([
      "demo-feria-familiar",
    ]);
  });
});
