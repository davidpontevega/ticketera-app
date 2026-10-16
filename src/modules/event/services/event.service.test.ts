import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  getPublishedEvent,
  listEventsBySlugs,
  listPublishedEvents,
  publishedEventExists,
} from "./event.service";

vi.mock("server-only", () => ({}));

// Resultados en orden de llamada a db.select(); cada cadena es thenable y soporta limit().
const results: unknown[][] = [];
const wheres: SQL[] = [];

function chain(result: unknown[]) {
  const c: Record<string, unknown> = {
    from: () => c,
    where: (w: SQL) => {
      wheres.push(w);
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(result),
  };
  return c;
}

vi.mock("@/lib/db", () => ({
  db: { select: () => chain(results.shift() ?? []) },
}));

const dialect = new PgDialect();
const sqlOf = (w: SQL) => dialect.sqlToQuery(w);

const eventRow = {
  id: "e1",
  slug: "rock-fest",
  title: "Rock",
  description: "d",
  category: "concerts",
  venueName: "Estadio",
  address: "a",
  city: "Lima",
  startsAt: new Date("2026-11-14T21:00:00.000Z"),
  imageUrl: "i",
  isFeatured: false,
  isTrending: false,
  isBestSeller: false,
  status: "published",
};
const tierRow = { id: "t1", eventId: "e1", name: "General", price: "80.00", totalStock: 100 };

beforeEach(() => {
  results.length = 0;
  wheres.length = 0;
});

describe("listPublishedEvents", () => {
  it("filtra por status published y fecha futura, y devuelve evento + layout", async () => {
    results.push([eventRow], [tierRow]);

    const list = await listPublishedEvents();

    const { sql, params } = sqlOf(wheres[0]);
    expect(sql).toContain("status");
    expect(sql).toContain("starts_at");
    expect(params).toContain("published");
    expect(list).toHaveLength(1);
    expect(list[0].event.priceFrom).toBe(80);
    expect(list[0].layout.zones.length).toBeGreaterThan(0);
  });

  it("sin eventos no consulta tiers", async () => {
    results.push([]);
    expect(await listPublishedEvents()).toEqual([]);
    expect(wheres).toHaveLength(1);
  });
});

describe("venue layout selection", () => {
  const venueEvent = { ...eventRow, venueId: "v1" };
  const zoneRow = (id: string, kind: string, sortOrder: number) => ({
    id,
    kind,
    sortOrder,
    createdAt: new Date("2026-01-01"),
  });

  it("uses the venue builder when the event has a venue and all tiers have zones", async () => {
    results.push(
      [venueEvent],
      [
        { ...tierRow, id: "t1", venueZoneId: "z1" },
        { ...tierRow, id: "t2", venueZoneId: "z2", name: "Platea" },
      ],
      [zoneRow("z1", "general", 1), zoneRow("z2", "numbered", 0)],
      [
        { venueZoneId: "z2", rowLabel: "A", seatNumber: 1 },
        { venueZoneId: "z2", rowLabel: "A", seatNumber: 2 },
      ],
    );
    const [{ layout }] = await listPublishedEvents();
    expect(layout.zones.map((z) => z.id)).toEqual(["t2", "t1"]);
    expect(layout.zones[0].seats.map((s) => s.id)).toEqual(["t2-A-1", "t2-A-2"]);
    expect(layout.zones[1]).toMatchObject({ seating: "general", capacity: 100 });
  });

  it("falls back to tiers when a tier has no zone", async () => {
    results.push([venueEvent], [{ ...tierRow, venueZoneId: null }]);
    const [{ layout }] = await listPublishedEvents();
    expect(layout.zones.map((z) => z.id)).toEqual(["t1"]);
    expect(results).toHaveLength(0);
  });

  it("falls back when the event has no venue even if tiers carry a zone", async () => {
    results.push([{ ...eventRow, venueId: null }], [{ ...tierRow, venueZoneId: "z1" }], []);
    const [{ layout }] = await listPublishedEvents();
    expect(layout.id).toBe("general-admission");
  });
});

describe("getPublishedEvent", () => {
  it("incluye status published en el where", async () => {
    results.push([eventRow], [tierRow]);
    await getPublishedEvent("rock-fest");
    const { sql, params } = sqlOf(wheres[0]);
    expect(sql).toContain("status");
    expect(params).toEqual(expect.arrayContaining(["rock-fest", "published"]));
  });

  it("devuelve null si no existe o no esta publicado", async () => {
    results.push([]);
    expect(await getPublishedEvent("nope")).toBeNull();
  });
});

describe("listEventsBySlugs", () => {
  it("devuelve [] sin slugs y sin consultar", async () => {
    expect(await listEventsBySlugs([])).toEqual([]);
    expect(wheres).toHaveLength(0);
  });

  it("no filtra por estado", async () => {
    results.push([{ ...eventRow, status: "cancelled" }], [tierRow]);
    const list = await listEventsBySlugs(["rock-fest"]);
    expect(sqlOf(wheres[0]).sql).not.toContain("status");
    expect(list.map((e) => e.slug)).toEqual(["rock-fest"]);
  });
});

describe("publishedEventExists", () => {
  it("true si hay fila publicada, false si no", async () => {
    results.push([{ id: "e1" }], []);
    expect(await publishedEventExists("rock-fest")).toBe(true);
    expect(await publishedEventExists("nope")).toBe(false);
    expect(sqlOf(wheres[0]).params).toContain("published");
  });
});
