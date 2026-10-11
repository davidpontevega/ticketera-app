import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { events } from "@/modules/event/db/event.table";

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
  selectWhere.mockImplementation(() => ({ orderBy: selectOrderBy }));
  selectOrderBy.mockResolvedValue([]);
});

describe("listOrganizerEvents", () => {
  it("llama a requireRole con ORGANIZER_AREA_ROLES antes de consultar la DB", async () => {
    await listOrganizerEvents();

    expect(requireRole).toHaveBeenCalledWith(["super_admin", "admin", "organizer"]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("sin eventos devuelve [] con una sola consulta", async () => {
    const result = await listOrganizerEvents();

    expect(result).toEqual([]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("mapea sold y revenue (string decimal) calculados en SQL", async () => {
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
        isFeatured: false,
        capacity: 100,
        sold: 3,
        revenue: "150.00",
      },
      {
        id: "event-2",
        slug: "sin-ventas",
        title: "Sin ventas",
        status: "draft",
        startsAt,
        city: "Lima",
        imageUrl: null,
        isFeatured: false,
        capacity: 10,
        sold: 0,
        revenue: "0",
      },
    ]);

    const result = await listOrganizerEvents();

    expect(result).toEqual([
      expect.objectContaining({ slug: "concierto-x", capacity: 100, sold: 3, revenue: 150 }),
      expect.objectContaining({ slug: "sin-ventas", sold: 0, revenue: 0 }),
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

    expect(selectWhere.mock.calls[0]?.[0]).not.toBeUndefined();
  });

  it("el SQL de sold/revenue califica columnas, filtra paid y expande lines", async () => {
    await listOrganizerEvents();

    const fields = select.mock.calls[0][0] as Record<string, never>;
    const dialect = new PgDialect();
    const sold = dialect.sqlToQuery(fields.sold).sql;
    const revenue = dialect.sqlToQuery(fields.revenue).sql;

    expect(sold).toContain("jsonb_array_elements(\"orders\".\"lines\")");
    expect(sold).toContain('"orders"."event_slug" = "events"."slug"');
    expect(sold).toContain(`"orders"."status" = 'paid'`);
    expect(revenue).toContain('sum("orders"."total_amount")');
    expect(revenue).toContain('"orders"."event_slug" = "events"."slug"');
    expect(revenue).toContain(`"orders"."status" = 'paid'`);
    expect(revenue).not.toContain("jsonb_array_elements");
    expect(revenue).toContain("::text");
  });

  it("el select completo conserva el prefijo \"events\".\"slug\" en la correlacion", async () => {
    await listOrganizerEvents();

    const fields = select.mock.calls[0][0];
    const { sql: text } = drizzle.mock().select(fields).from(events).toSQL();

    expect(text).toContain('"orders"."event_slug" = "events"."slug"');
    expect(text).toContain('"events"."id"');
  });
});
