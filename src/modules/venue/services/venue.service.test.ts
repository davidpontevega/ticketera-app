import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { getVenueForEdit, getVenueScope, listVenueOptions, listVenues } from "./venue.service";

vi.mock("server-only", () => ({}));

let selectResults: unknown[][] = [];
let wheres: (SQL | undefined)[] = [];
let selectCount = 0;

function chain() {
  const result = () => Promise.resolve(selectResults.shift() ?? []);
  const c: Record<string, unknown> = {
    from: () => c,
    where: (arg: SQL | undefined) => {
      wheres.push(arg);
      return c;
    },
    orderBy: result,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => result().then(resolve, reject),
  };
  return c;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      selectCount += 1;
      return chain();
    },
  },
}));

const dialect = new PgDialect();
const sqlText = (q: SQL | undefined) => (q ? dialect.sqlToQuery(q).sql.toLowerCase() : "");

const ORGANIZER = { id: "organizer-1", role: "organizer" as const };
const ADMIN = { id: "admin-1", role: "admin" as const };
const VENUE_ID = "11111111-1111-4111-8111-111111111111";
const VENUE_ROW = {
  id: VENUE_ID,
  name: "Estadio",
  address: "Av 1",
  city: "Lima",
  latitude: null,
  longitude: null,
  createdBy: "organizer-1",
  zoneCount: 2,
  capacity: 500,
  eventCount: 0,
};

beforeEach(() => {
  selectResults = [];
  wheres = [];
  selectCount = 0;
});

describe("getVenueScope", () => {
  it("organizer filtra por created_by; admin y super_admin no", () => {
    expect(sqlText(getVenueScope(ORGANIZER))).toContain("created_by");
    expect(getVenueScope(ADMIN)).toBeUndefined();
    expect(getVenueScope({ id: "s", role: "super_admin" })).toBeUndefined();
  });
});

describe("listVenues", () => {
  it("aplica el alcance y marca isOwn", async () => {
    selectResults = [[VENUE_ROW, { ...VENUE_ROW, id: "v2", createdBy: "other" }]];
    const result = await listVenues(ORGANIZER);
    expect(sqlText(wheres[0])).toContain("created_by");
    expect(result.map((v) => v.isOwn)).toEqual([true, false]);
    expect(result[0]).not.toHaveProperty("createdBy");
  });
});

describe("getVenueForEdit", () => {
  it("id no uuid => null sin consultar la DB", async () => {
    expect(await getVenueForEdit("nope", ORGANIZER)).toBeNull();
    expect(selectCount).toBe(0);
  });

  it("ajeno o inexistente => null", async () => {
    selectResults = [[]];
    expect(await getVenueForEdit(VENUE_ID, ORGANIZER)).toBeNull();
  });

  it("arma zonas con capacidad efectiva y estado en uso", async () => {
    selectResults = [
      [VENUE_ROW],
      [
        { id: "z1", name: "Platea", kind: "numbered", capacity: null, seatCount: 200, rows: 10, seatsPerRow: 20, usedByEvents: 1 },
        { id: "z2", name: "GA", kind: "general", capacity: 300, seatCount: 0, rows: 0, seatsPerRow: 0, usedByEvents: 0 },
      ],
    ];
    const result = await getVenueForEdit(VENUE_ID, ADMIN);
    expect(result?.zones).toEqual([
      { id: "z1", name: "Platea", kind: "numbered", capacity: 200, rows: 10, seatsPerRow: 20, inUse: true, usedByEvents: 1 },
      { id: "z2", name: "GA", kind: "general", capacity: 300, rows: 0, seatsPerRow: 0, inUse: false, usedByEvents: 0 },
    ]);
  });
});

describe("listVenueOptions", () => {
  it("sin recintos no consulta zonas", async () => {
    selectResults = [[]];
    expect(await listVenueOptions(ORGANIZER)).toEqual([]);
    expect(selectCount).toBe(1);
  });

  it("incluye capacidad efectiva por zona agrupada por recinto", async () => {
    selectResults = [
      [{ id: "v1", name: "A", city: "Lima" }, { id: "v2", name: "B", city: "Cusco" }],
      [
        { id: "z1", venueId: "v1", name: "Platea", kind: "numbered", capacity: null, seatCount: 200 },
        { id: "z2", venueId: "v1", name: "GA", kind: "general", capacity: 300, seatCount: 0 },
      ],
    ];
    const result = await listVenueOptions(ORGANIZER);
    expect(result[0].zones).toEqual([
      { id: "z1", name: "Platea", kind: "numbered", capacity: 200 },
      { id: "z2", name: "GA", kind: "general", capacity: 300 },
    ]);
    expect(result[1].zones).toEqual([]);
  });
});
