import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventFormValues } from "../types/organizer.types";

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const changeEventStatus = vi.fn();
const deleteEvent = vi.fn();
const setEventFeatured = vi.fn();
vi.mock("../services/organizer-event-admin.service", () => ({
  changeEventStatus: (...args: unknown[]) => changeEventStatus(...args),
  deleteEvent: (...args: unknown[]) => deleteEvent(...args),
  setEventFeatured: (...args: unknown[]) => setEventFeatured(...args),
}));

const cancelEventWithRefunds = vi.fn();
vi.mock("../services/organizer-event-cancel.service", () => ({
  cancelEventWithRefunds: (...args: unknown[]) => cancelEventWithRefunds(...args),
}));

const createEvent = vi.fn();
const updateEvent = vi.fn();
vi.mock("../services/organizer-event-write.service", () => ({
  createEvent: (...args: unknown[]) => createEvent(...args),
  updateEvent: (...args: unknown[]) => updateEvent(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const {
  changeEventStatusAction,
  createEventAction,
  deleteEventAction,
  setEventFeaturedAction,
  updateEventAction,
} = await import(
  "./organizer-event.actions"
);

const VALID_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER = { id: "organizer-1", role: "organizer" };

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(VIEWER);
  changeEventStatus.mockResolvedValue({ ok: true });
  cancelEventWithRefunds.mockResolvedValue({ ok: true, refunds: { total: 0, refunded: 0, failed: 0 } });
  deleteEvent.mockResolvedValue({ ok: true });
  setEventFeatured.mockResolvedValue({ ok: true });
  createEvent.mockResolvedValue({ ok: true, eventId: VALID_EVENT_ID });
  updateEvent.mockResolvedValue({ ok: true });
});

describe("requireRole guard (AC6)", () => {
  it("changeEventStatusAction llama requireRole con ORGANIZER_AREA_ROLES antes de parsear", async () => {
    await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
  });

  it("si requireRole rechaza, changeEventStatus nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      changeEventStatusAction(
        { status: "idle" },
        formData({ eventId: VALID_EVENT_ID, status: "published" }),
      ),
    ).rejects.toThrow();

    expect(changeEventStatus).not.toHaveBeenCalled();
  });

  it("deleteEventAction llama requireRole con ORGANIZER_AREA_ROLES antes de parsear", async () => {
    await deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID }));

    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
  });

  it("si requireRole rechaza, deleteEvent nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID })),
    ).rejects.toThrow();

    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("changeEventStatusAction: el guard corre antes del parseo, incluso con un eventId invalido", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      changeEventStatusAction(
        { status: "idle" },
        formData({ eventId: "no-es-un-uuid", status: "published" }),
      ),
    ).rejects.toThrow();

    expect(changeEventStatus).not.toHaveBeenCalled();
  });

  it("deleteEventAction: el guard corre antes del parseo, incluso con un eventId invalido", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      deleteEventAction({ status: "idle" }, formData({ eventId: "no-es-un-uuid" })),
    ).rejects.toThrow();

    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("setEventFeaturedAction llama requireRole con ORGANIZER_AREA_ROLES antes de parsear", async () => {
    await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "true" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
  });

  it("si requireRole rechaza, setEventFeatured nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      setEventFeaturedAction(
        { status: "idle" },
        formData({ eventId: VALID_EVENT_ID, featured: "true" }),
      ),
    ).rejects.toThrow();

    expect(setEventFeatured).not.toHaveBeenCalled();
  });

  it("setEventFeaturedAction: el guard corre antes del parseo, incluso con un eventId invalido", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      setEventFeaturedAction(
        { status: "idle" },
        formData({ eventId: "no-es-un-uuid", featured: "true" }),
      ),
    ).rejects.toThrow();

    expect(setEventFeatured).not.toHaveBeenCalled();
  });
});

describe("changeEventStatusAction", () => {
  it("eventId invalido devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: "no-uuid", status: "published" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { eventId: expect.any(String) } });
    expect(changeEventStatus).not.toHaveBeenCalled();
  });

  it("status fuera del enum devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "deleted" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { status: expect.any(String) } });
    expect(changeEventStatus).not.toHaveBeenCalled();
  });

  it("el servicio recibe el viewer devuelto por requireRole", async () => {
    await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(changeEventStatus).toHaveBeenCalledWith(
      { eventId: VALID_EVENT_ID, status: "published" },
      VIEWER,
    );
  });

  it("not-found mapea al mensaje correcto, sin revalidate", async () => {
    changeEventStatus.mockResolvedValue({ ok: false, error: "not-found" });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "No se encontro el evento o no tienes permiso",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("invalid-transition mapea al mensaje correcto", async () => {
    changeEventStatus.mockResolvedValue({ ok: false, error: "invalid-transition" });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Este evento no admite ese cambio de estado",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("past-date mapea al mensaje correcto", async () => {
    changeEventStatus.mockResolvedValue({ ok: false, error: "past-date" });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "No se puede publicar un evento con fecha pasada",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("no-tiers mapea al mensaje correcto", async () => {
    changeEventStatus.mockResolvedValue({ ok: false, error: "no-tiers" });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Agrega al menos un tipo de entrada antes de publicar",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exito con status published revalida y devuelve 'Evento publicado'", async () => {
    changeEventStatus.mockResolvedValue({ ok: true });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "published" }),
    );

    expect(result).toEqual({ status: "success", message: "Evento publicado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("exito con status draft revalida y devuelve 'Evento despublicado'", async () => {
    changeEventStatus.mockResolvedValue({ ok: true });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "draft" }),
    );

    expect(result).toEqual({ status: "success", message: "Evento despublicado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("cancelled delega en cancelEventWithRefunds (nunca changeEventStatus), arma el mensaje y revalida (AC7)", async () => {
    cancelEventWithRefunds.mockResolvedValue({ ok: true, refunds: { total: 3, refunded: 3, failed: 0 } });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "cancelled" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Evento cancelado. Reembolsadas 3 de 3 ordenes.",
    });
    expect(cancelEventWithRefunds).toHaveBeenCalledWith({ eventId: VALID_EVENT_ID, status: "cancelled" }, VIEWER);
    expect(changeEventStatus).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${VALID_EVENT_ID}/orders`);
    expect(revalidatePath).toHaveBeenCalledWith(`/organizer/events/${VALID_EVENT_ID}/check-in`);
  });

  it("cancelled con fallos menciona cuantas fallaron y el reintento (AC7)", async () => {
    cancelEventWithRefunds.mockResolvedValue({ ok: true, refunds: { total: 3, refunded: 2, failed: 1 } });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "cancelled" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Evento cancelado. Reembolsadas 2 de 3 ordenes. 1 fallaron: reintentalas desde Ordenes.",
    });
  });

  it("cancelled con refunds null avisa que debe reintentar desde Ordenes", async () => {
    cancelEventWithRefunds.mockResolvedValue({ ok: true, refunds: null });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "cancelled" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Evento cancelado; no se pudieron procesar los reembolsos, reintenta desde Ordenes",
    });
  });

  it("cancelled con error del servicio devuelve el mensaje sin revalidar", async () => {
    cancelEventWithRefunds.mockResolvedValue({ ok: false, error: "invalid-transition" });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "cancelled" }),
    );

    expect(result).toEqual({ status: "error", message: "Este evento no admite ese cambio de estado" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("otros estados no usan cancelEventWithRefunds", async () => {
    await changeEventStatusAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID, status: "published" }));

    expect(cancelEventWithRefunds).not.toHaveBeenCalled();
  });
});

describe("deleteEventAction", () => {
  it("eventId invalido devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await deleteEventAction({ status: "idle" }, formData({ eventId: "no-uuid" }));

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { eventId: expect.any(String) } });
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("el servicio recibe el viewer devuelto por requireRole", async () => {
    await deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID }));

    expect(deleteEvent).toHaveBeenCalledWith({ eventId: VALID_EVENT_ID }, VIEWER);
  });

  it("not-found mapea al mensaje correcto, sin revalidate", async () => {
    deleteEvent.mockResolvedValue({ ok: false, error: "not-found" });

    const result = await deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID }));

    expect(result).toEqual({
      status: "error",
      message: "No se encontro el evento o no tienes permiso",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("has-orders mapea al mensaje correcto", async () => {
    deleteEvent.mockResolvedValue({ ok: false, error: "has-orders" });

    const result = await deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID }));

    expect(result).toEqual({
      status: "error",
      message: "Este evento tiene ventas: cancelalo en vez de eliminarlo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exito revalida y devuelve 'Evento eliminado'", async () => {
    deleteEvent.mockResolvedValue({ ok: true });

    const result = await deleteEventAction({ status: "idle" }, formData({ eventId: VALID_EVENT_ID }));

    expect(result).toEqual({ status: "success", message: "Evento eliminado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });
});

describe("setEventFeaturedAction", () => {
  it("eventId invalido devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: "no-uuid", featured: "true" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { eventId: expect.any(String) } });
    expect(setEventFeatured).not.toHaveBeenCalled();
  });

  it("featured fuera de true/false devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "yes" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { featured: expect.any(String) } });
    expect(setEventFeatured).not.toHaveBeenCalled();
  });

  it("el servicio recibe el viewer devuelto por requireRole", async () => {
    await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "true" }),
    );

    expect(setEventFeatured).toHaveBeenCalledWith(
      { eventId: VALID_EVENT_ID, featured: true },
      VIEWER,
    );
  });

  it("not-found mapea al mensaje correcto, sin revalidate (AC4)", async () => {
    setEventFeatured.mockResolvedValue({ ok: false, error: "not-found" });

    const result = await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "true" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "No se encontro el evento o no tienes permiso",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exito con featured true revalida y devuelve 'Evento destacado'", async () => {
    const result = await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "true" }),
    );

    expect(result).toEqual({ status: "success", message: "Evento destacado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("exito con featured false revalida y devuelve 'Evento ya no destacado'", async () => {
    const result = await setEventFeaturedAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, featured: "false" }),
    );

    expect(result).toEqual({ status: "success", message: "Evento ya no destacado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });
});

const VALID_VALUES: EventFormValues = {
  name: "Festival de Verano",
  category: "concerts",
  description: "Una descripcion suficientemente larga",
  date: "2099-01-01",
  time: "20:00",
  venue: "Estadio",
  city: "Lima",
  imageUrl: "data:image/png;base64,AAA",
  venueId: "",
  tiers: [{ id: "t1", name: "General", price: "50", quantity: "100", zoneId: "" }],
};
const PUBLISH = { values: VALID_VALUES, intent: "publish" as const };

describe("createEventAction", () => {
  it("requireRole corre primero: si rechaza no se valida ni se escribe", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createEventAction(PUBLISH)).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("exito crea con el viewer, revalida y devuelve el id", async () => {
    expect(await createEventAction(PUBLISH)).toEqual({ status: "success", eventId: VALID_EVENT_ID });
    expect(createEvent).toHaveBeenCalledWith(PUBLISH, VIEWER);
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("borrador sin fecha devuelve fieldErrors sin escribir", async () => {
    const result = await createEventAction({ values: { ...VALID_VALUES, date: "" }, intent: "draft" });
    expect(result).toMatchObject({ status: "error", fieldErrors: { date: expect.any(String) } });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["sin tiers", { tiers: [] }, "tiers"],
    ["fecha pasada", { date: "2000-01-01" }, "date"],
    ["sin portada", { imageUrl: "" }, "imageUrl"],
    ["portada con formato invalido", { imageUrl: "javascript:alert(1)" }, "imageUrl"],
    ["portada https de otro host", { imageUrl: "https://evil.example.com/a.jpg" }, "imageUrl"],
    ["portada http", { imageUrl: "http://images.unsplash.com/a.jpg" }, "imageUrl"],
    ["precio fuera de rango", { tiers: [{ id: "t1", name: "General", price: "100000000", quantity: "100", zoneId: "" }] }, "tiers.0.price"],
    ["cantidad fuera de rango", { tiers: [{ id: "t1", name: "General", price: "50", quantity: "2147483648", zoneId: "" }] }, "tiers.0.quantity"],
    ["portada demasiado pesada", { imageUrl: "data:image/png;base64," + "A".repeat(700_000) }, "imageUrl"],
  ])("publicar %s devuelve fieldErrors sin escribir", async (_label, patch, field) => {
    const result = await createEventAction({ values: { ...VALID_VALUES, ...patch }, intent: "publish" });
    expect(result).toMatchObject({ status: "error", fieldErrors: { [field]: expect.any(String) } });
    expect(createEvent).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("unknown mapea al mensaje generico", async () => {
    createEvent.mockResolvedValue({ ok: false, error: "unknown" });
    expect(await createEventAction(PUBLISH)).toEqual({
      status: "error",
      message: "No se pudo guardar, intenta de nuevo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateEventAction", () => {
  it("requireRole corre primero", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(updateEventAction(VALID_EVENT_ID, PUBLISH)).rejects.toThrow();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("id invalido devuelve not-found sin llamar al servicio", async () => {
    const result = await updateEventAction("no-uuid", PUBLISH);
    expect(result).toMatchObject({ status: "error", message: "No se encontro el evento o no tienes permiso" });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("exito actualiza con el viewer, revalida y devuelve el id", async () => {
    expect(await updateEventAction(VALID_EVENT_ID, PUBLISH)).toEqual({ status: "success", eventId: VALID_EVENT_ID });
    expect(updateEvent).toHaveBeenCalledWith(VALID_EVENT_ID, PUBLISH, VIEWER);
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });

  it("fecha pasada no la rechaza la action (la decide el servicio, D3)", async () => {
    await updateEventAction(VALID_EVENT_ID, { values: { ...VALID_VALUES, date: "2000-01-01" }, intent: "publish" });
    expect(updateEvent).toHaveBeenCalled();
  });

  it("valida campos en servidor", async () => {
    const result = await updateEventAction(VALID_EVENT_ID, { values: { ...VALID_VALUES, tiers: [] }, intent: "publish" });
    expect(result).toMatchObject({ status: "error", fieldErrors: { tiers: expect.any(String) } });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["tiers-locked", "Este evento tiene ventas: no se pueden cambiar tipos de entrada ni precios", undefined],
    ["past-date", "Elige una fecha futura", "date"],
    ["no-tiers", "Agrega al menos un tipo de entrada", "tiers"],
    ["not-found", "No se encontro el evento o no tienes permiso", undefined],
  ])("%s mapea mensaje (y campo)", async (error, message, field) => {
    updateEvent.mockResolvedValue({ ok: false, error });
    const result = await updateEventAction(VALID_EVENT_ID, PUBLISH);
    expect(result).toEqual({
      status: "error",
      message,
      ...(field && { fieldErrors: { [field]: message } }),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
