import { beforeEach, describe, expect, it, vi } from "vitest";

import { listOrganizerEvents } from "./organizer-events.service";

// "server-only" solo lanza fuera del condition "react-server" de Next; en Vitest se stubea a vacio.
vi.mock("server-only", () => ({}));

const requireRole = vi.fn();
vi.mock("@/modules/user", () => ({
  ORGANIZER_AREA_ROLES: ["super_admin", "admin", "organizer"],
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const selectOrderBy = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ id: "organizer-1", role: "organizer" });

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  // events query encadena .orderBy(); orders query se resuelve directo en .where().
  selectWhere.mockImplementation(() =>
    Object.assign(Promise.resolve([]), { orderBy: selectOrderBy }),
  );
  selectOrderBy.mockResolvedValue([]);
});

describe("listOrganizerEvents", () => {
  it("llama a requireRole con ORGANIZER_AREA_ROLES antes de consultar la DB", async () => {
    await listOrganizerEvents();

    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("sin eventos del organizador devuelve [] y no consulta orders", async () => {
    selectOrderBy.mockResolvedValue([]);

    const result = await listOrganizerEvents();

    expect(result).toEqual([]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("con eventos devuelve el resultado de unir filas y ordenes pagadas", async () => {
    const startsAt = new Date("2026-05-01T20:00:00-05:00");
    selectOrderBy.mockResolvedValue([
      {
        id: "event-1",
        slug: "concierto-x",
        title: "Concierto X",
        status: "published",
        startsAt,
        city: "Lima",
        imageUrl: "https://example.com/x.jpg",
        capacity: 100,
      },
    ]);
    selectWhere.mockImplementationOnce(() =>
      Object.assign(Promise.resolve([]), { orderBy: selectOrderBy }),
    );
    selectWhere.mockImplementationOnce(() =>
      Promise.resolve([
        {
          eventSlug: "concierto-x",
          totalAmount: "150.00",
          lines: [
            { zoneId: "general", zoneName: "General", quantity: 3, unitPrice: 50, amount: 150, seatLabels: [] },
          ],
        },
      ]),
    );

    const result = await listOrganizerEvents();

    expect(select).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      expect.objectContaining({
        slug: "concierto-x",
        capacity: 100,
        sold: 3,
        revenue: 150,
      }),
    ]);
  });

  it.each(["admin", "super_admin"] as const)(
    "rol %s ve todos los eventos (sin filtro de organizerId)",
    async (role) => {
      requireRole.mockResolvedValue({ id: "viewer-1", role });

      await listOrganizerEvents();

      expect(selectWhere).toHaveBeenCalledWith(undefined);
    },
  );

  it("rol organizer filtra por su propio organizerId", async () => {
    await listOrganizerEvents();

    expect(selectWhere).toHaveBeenCalledWith(expect.anything());
    expect(selectWhere.mock.calls[0]?.[0]).not.toBeUndefined();
  });
});
