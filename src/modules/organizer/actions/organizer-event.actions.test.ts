import { beforeEach, describe, expect, it, vi } from "vitest";

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

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { changeEventStatusAction, deleteEventAction, setEventFeaturedAction } = await import(
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
  deleteEvent.mockResolvedValue({ ok: true });
  setEventFeatured.mockResolvedValue({ ok: true });
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

  it("exito con status cancelled revalida y devuelve 'Evento cancelado'", async () => {
    changeEventStatus.mockResolvedValue({ ok: true });

    const result = await changeEventStatusAction(
      { status: "idle" },
      formData({ eventId: VALID_EVENT_ID, status: "cancelled" }),
    );

    expect(result).toEqual({ status: "success", message: "Evento cancelado" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
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
