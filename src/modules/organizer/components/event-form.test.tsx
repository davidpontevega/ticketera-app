import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventFormValues } from "../types/organizer.types";
import { EventForm } from "./event-form";

const push = vi.fn();
const createEventAction = vi.fn();
const updateEventAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("../actions/organizer-event.actions", () => ({
  createEventAction: (...args: unknown[]) => createEventAction(...args),
  updateEventAction: (...args: unknown[]) => updateEventAction(...args),
}));

const INITIAL: EventFormValues = {
  name: "Feria Familiar de Verano",
  category: "concerts",
  description: "Una feria para toda la familia con musica y comida.",
  date: "2099-01-10",
  time: "18:00",
  venue: "Parque Central",
  city: "Lima",
  imageUrl: "data:image/png;base64,AAAA",
  tiers: [{ id: "11111111-1111-4111-8111-111111111111", name: "General", price: "50", quantity: "100" }],
};

beforeEach(() => {
  push.mockClear();
  createEventAction.mockReset();
  updateEventAction.mockReset();
});

afterEach(cleanup);

describe("EventForm", () => {
  it("shows the errors when publishing an empty form", () => {
    render(<EventForm />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evento" }));
    expect(screen.getByText("Ingresa el nombre del evento (minimo 3 caracteres)")).toBeTruthy();
    expect(screen.getByText("Sube una imagen de portada")).toBeTruthy();
    expect(screen.getAllByText("Ingresa un precio mayor a 0")).toHaveLength(2);
    expect(createEventAction).not.toHaveBeenCalled();
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

  it("saves a draft with name, date and time and goes back to the dashboard", async () => {
    createEventAction.mockResolvedValue({ status: "success", eventId: "e1" });
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Mi feria" } });
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2099-01-10" } });
    fireEvent.change(screen.getByLabelText("Hora de inicio"), { target: { value: "20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organizer"));
    expect(createEventAction).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "draft",
        values: expect.objectContaining({ name: "Mi feria", date: "2099-01-10", time: "20:00" }),
      }),
    );
  });

  it("publishes a valid event with the publish intent", async () => {
    createEventAction.mockResolvedValue({ status: "success", eventId: "e1" });
    render(<EventForm initialValues={INITIAL} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evento" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organizer"));
    expect(createEventAction).toHaveBeenCalledWith({ values: INITIAL, intent: "publish" });
  });

  it("edits a draft: preloads values and calls updateEventAction with the id", async () => {
    updateEventAction.mockResolvedValue({ status: "success", eventId: "e1" });
    render(<EventForm eventId="e1" status="draft" initialValues={INITIAL} />);
    expect(screen.getByRole("heading", { name: "Editar evento" })).toBeTruthy();
    expect((screen.getByLabelText("Nombre del evento") as HTMLInputElement).value).toBe(
      "Feria Familiar de Verano",
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organizer"));
    expect(updateEventAction).toHaveBeenCalledWith("e1", { values: INITIAL, intent: "draft" });
    expect(createEventAction).not.toHaveBeenCalled();
  });

  it("shows a single save button when editing a published event", () => {
    render(<EventForm eventId="e1" status="published" initialValues={INITIAL} />);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
  });

  it("saves a published event whose date already passed without a date error", async () => {
    updateEventAction.mockResolvedValue({ status: "success", eventId: "e1" });
    const past = { ...INITIAL, date: "2020-01-10" };
    render(<EventForm eventId="e1" status="published" initialValues={past} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/organizer"));
    expect(screen.queryByText("Elige una fecha futura")).toBeNull();
    expect(updateEventAction).toHaveBeenCalledWith("e1", { values: past, intent: "publish" });
  });

  it("still rejects a past date when publishing a draft", () => {
    const past = { ...INITIAL, date: "2020-01-10" };
    render(<EventForm eventId="e1" status="draft" initialValues={past} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evento" }));
    expect(screen.getByText("Elige una fecha futura")).toBeTruthy();
    expect(updateEventAction).not.toHaveBeenCalled();
  });

  it("locks the tier inputs and hides add/remove when tiersLocked", () => {
    render(<EventForm eventId="e1" status="published" initialValues={INITIAL} tiersLocked />);
    expect((screen.getByLabelText("Precio (S/) (tipo 1)") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Agregar tipo de entrada" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Este evento tiene ventas/)).toBeTruthy();
  });

  it("shows server errors per field and the general message", async () => {
    createEventAction.mockResolvedValue({
      status: "error",
      message: "Revisa los campos marcados",
      fieldErrors: { venue: "Lugar no permitido" },
    });
    render(<EventForm initialValues={INITIAL} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evento" }));
    expect(await screen.findByText("Lugar no permitido")).toBeTruthy();
    expect(screen.getByText("Revisa los campos marcados")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
