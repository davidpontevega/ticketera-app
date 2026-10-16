import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const svc = {
  createVenue: vi.fn(),
  updateVenue: vi.fn(),
  deleteVenue: vi.fn(),
  createZone: vi.fn(),
  updateZone: vi.fn(),
  deleteZone: vi.fn(),
};
vi.mock("../services/venue-write.service", () => svc);

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const actions = await import("./venue.actions");

const ID = "11111111-1111-4111-8111-111111111111";
const VIEWER = { id: "organizer-1", role: "organizer" };
const VENUE = { name: "Estadio", address: "Av. Principal 123", city: "Lima" };
const ZONE = { name: "Platea", kind: "numbered" as const, rows: "10", seatsPerRow: "20" };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(VIEWER);
  for (const fn of Object.values(svc)) fn.mockResolvedValue({ ok: true, data: { id: ID } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("autorizacion", () => {
  it("requireRole va primero: si rechaza no se toca el servicio", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(actions.createVenueAction(VENUE)).rejects.toThrow();
    await expect(actions.deleteZoneAction(ID)).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("createVenueAction", () => {
  it("usa el viewer de la sesion, ignora createdBy del input y revalida", async () => {
    const result = await actions.createVenueAction({ ...VENUE, createdBy: "hacker" } as never);
    expect(result).toEqual({ status: "success", id: ID });
    expect(svc.createVenue).toHaveBeenCalledWith(
      { ...VENUE, latitude: null, longitude: null },
      VIEWER,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/venues");
  });

  it("validacion fallida: fieldErrors y sin escritura", async () => {
    const result = await actions.createVenueAction({ ...VENUE, name: "a" });
    expect(result).toMatchObject({ status: "error", message: "Revisa los datos", fieldErrors: { name: expect.any(String) } });
    expect(svc.createVenue).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("mapeo de errores y mensajes genericos", () => {
  it.each([
    ["not-found", "No se encontro el recinto o no tienes permiso"],
    ["zone-locked", "La usa un evento: solo se puede cambiar el nombre"],
    ["in-use", "Este recinto lo usa un evento"],
    ["limit", "Alcanzaste el maximo de zonas por recinto"],
  ] as const)("%s", async (error, message) => {
    svc.updateZone.mockResolvedValue({ ok: false, error });
    expect(await actions.updateZoneAction(ID, ZONE)).toEqual({ status: "error", message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("excepcion inesperada: mensaje generico y log", async () => {
    svc.deleteVenue.mockRejectedValue(new Error("db password leaked"));
    const result = await actions.deleteVenueAction(ID);
    expect(result).toEqual({ status: "error", message: "No se pudo guardar, intenta de nuevo" });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("ids y zonas", () => {
  it("id no uuid => not-found sin tocar el servicio", async () => {
    const result = await actions.deleteVenueAction("nope");
    expect(result).toMatchObject({ status: "error" });
    expect(svc.deleteVenue).not.toHaveBeenCalled();
  });

  it("createZoneAction valida y pasa numeros al servicio", async () => {
    await actions.createZoneAction(ID, ZONE);
    expect(svc.createZone).toHaveBeenCalledWith(
      ID,
      { name: "Platea", kind: "numbered", rows: 10, seatsPerRow: 20 },
      VIEWER,
    );
  });

  it("zona invalida no escribe", async () => {
    const result = await actions.createZoneAction(ID, { ...ZONE, rows: "99" });
    expect(result).toMatchObject({ status: "error", fieldErrors: { rows: expect.any(String) } });
    expect(svc.createZone).not.toHaveBeenCalled();
  });

  it("update/delete de venue y delete de zona revalidan", async () => {
    await actions.updateVenueAction(ID, VENUE);
    await actions.deleteZoneAction(ID);
    expect(svc.updateVenue).toHaveBeenCalledWith(ID, expect.objectContaining({ name: "Estadio" }), VIEWER);
    expect(svc.deleteZone).toHaveBeenCalledWith(ID, VIEWER);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});
