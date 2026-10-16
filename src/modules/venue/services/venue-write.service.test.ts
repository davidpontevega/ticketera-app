import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  createVenue,
  createZone,
  deleteVenue,
  deleteZone,
  updateVenue,
  updateZone,
} from "./venue-write.service";

vi.mock("server-only", () => ({}));

// Cola de resultados para los selects (en orden de ejecucion); el resto se registra en `calls`.
let selectResults: unknown[][] = [];
let returningResults: unknown[][] = [];
let inserted: unknown[] = [];
let wheres: SQL[] = [];
let deleteError: unknown;
const calls: string[] = [];

function selectChain() {
  const result = () => Promise.resolve(selectResults.shift() ?? []);
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: (arg: SQL) => {
      wheres.push(arg);
      return chain;
    },
    for: (mode: string) => {
      calls.push(`for-${mode}`);
      return chain;
    },
    limit: result,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => result().then(resolve, reject),
  };
  calls.push("select");
  return chain;
}

const writer = {
  select: () => selectChain(),
  insert: () => ({
    values: (values: unknown) => {
      calls.push("insert");
      inserted.push(values);
      return { returning: () => Promise.resolve(returningResults.shift() ?? []), then: (r: (v: unknown) => void) => r([]) };
    },
  }),
  update: () => ({
    set: (values: unknown) => {
      calls.push("update");
      inserted.push(values);
      return {
        where: (arg: SQL) => {
          wheres.push(arg);
          return { returning: () => Promise.resolve(returningResults.shift() ?? []), then: (r: (v: unknown) => void) => r([]) };
        },
      };
    },
  }),
  delete: () => ({
    where: (arg: SQL) => {
      calls.push("delete");
      wheres.push(arg);
      const run = () => (deleteError ? Promise.reject(deleteError) : Promise.resolve(returningResults.shift() ?? []));
      return {
        returning: run,
        then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => run().then(resolve, reject),
      };
    },
  }),
};

vi.mock("@/lib/db", () => ({
  db: {
    select: () => writer.select(),
    insert: () => writer.insert(),
    update: () => writer.update(),
    delete: () => writer.delete(),
    transaction: async (fn: (t: typeof writer) => unknown) => fn(writer),
  },
}));

const dialect = new PgDialect();
const sqlText = (q: SQL) => dialect.sqlToQuery(q).sql.toLowerCase();

const ORGANIZER = { id: "organizer-1", role: "organizer" as const };
const ADMIN = { id: "admin-1", role: "admin" as const };
const GENERAL = { name: "GA", kind: "general" as const, capacity: 300 };
const NUMBERED = { name: "Platea", kind: "numbered" as const, rows: 10, seatsPerRow: 20 };
const ZONE_ROW = { id: "z1", venueId: "v1", name: "Platea", kind: "numbered", capacity: null };
const VENUE_INPUT = { name: "Estadio", address: "Av 1", city: "Lima", latitude: null, longitude: null };

beforeEach(() => {
  selectResults = [];
  returningResults = [];
  inserted = [];
  wheres = [];
  deleteError = undefined;
  calls.length = 0;
});

describe("createVenue / updateVenue", () => {
  it("createdBy sale de la sesion", async () => {
    returningResults = [[{ id: "v1" }]];
    const result = await createVenue({ ...VENUE_INPUT, createdBy: "hacker" } as never, ORGANIZER);
    expect(result).toEqual({ ok: true, data: { id: "v1" } });
    expect(inserted[0]).toMatchObject({ createdBy: "organizer-1" });
  });

  it("organizer filtra por created_by; admin no; 0 filas => not-found", async () => {
    returningResults = [[]];
    expect(await updateVenue("v1", VENUE_INPUT, ORGANIZER)).toEqual({ ok: false, error: "not-found" });
    expect(sqlText(wheres[0])).toContain("created_by");

    wheres = [];
    returningResults = [[{ id: "v1" }]];
    expect(await updateVenue("v1", VENUE_INPUT, ADMIN)).toEqual({ ok: true, data: undefined });
    expect(sqlText(wheres[0])).not.toContain("created_by");
  });
});

describe("deleteVenue", () => {
  it("recinto ajeno o inexistente => not-found sin borrar", async () => {
    selectResults = [[]];
    expect(await deleteVenue("v1", ORGANIZER)).toEqual({ ok: false, error: "not-found" });
    expect(calls).not.toContain("delete");
  });

  it("elimina cuando ningun evento lo usa; la guarda NOT EXISTS va en el WHERE", async () => {
    selectResults = [[{ id: "v1" }]];
    returningResults = [[{ id: "v1" }]];
    expect(await deleteVenue("v1", ORGANIZER)).toEqual({ ok: true, data: undefined });
    expect(sqlText(wheres[1])).toContain('not exists (select 1 from "events" where "events"."venue_id" = "venues"."id")');
  });

  it("0 filas borradas => in-use", async () => {
    selectResults = [[{ id: "v1" }]];
    returningResults = [[]];
    expect(await deleteVenue("v1", ORGANIZER)).toEqual({ ok: false, error: "in-use" });
  });

  it("23503 => in-use; otros errores se propagan", async () => {
    selectResults = [[{ id: "v1" }]];
    deleteError = { code: "23503" };
    expect(await deleteVenue("v1", ORGANIZER)).toEqual({ ok: false, error: "in-use" });

    selectResults = [[{ id: "v1" }]];
    deleteError = new Error("boom");
    await expect(deleteVenue("v1", ORGANIZER)).rejects.toThrow("boom");
  });
});

describe("createZone", () => {
  it("recinto ajeno => not-found", async () => {
    selectResults = [[]];
    expect(await createZone("v1", NUMBERED, ORGANIZER)).toEqual({ ok: false, error: "not-found" });
    expect(calls).not.toContain("insert");
  });

  it("20 zonas => limit", async () => {
    selectResults = [[{ id: "v1" }], [{ count: 20 }]];
    expect(await createZone("v1", GENERAL, ORGANIZER)).toEqual({ ok: false, error: "limit" });
    expect(calls).not.toContain("insert");
  });

  it("numerada inserta zona y rows*seatsPerRow asientos en chunks de 500", async () => {
    selectResults = [[{ id: "v1" }], [{ count: 2 }]];
    returningResults = [[{ id: "z1" }]];
    const result = await createZone("v1", { ...NUMBERED, rows: 26, seatsPerRow: 40 }, ORGANIZER);
    expect(result).toEqual({ ok: true, data: { id: "z1" } });
    expect(calls[0]).toBe("select");
    expect(calls[1]).toBe("for-update");
    expect(inserted[0]).toMatchObject({ kind: "numbered", capacity: null, sortOrder: 2 });
    const chunks = inserted.slice(1) as unknown[][];
    expect(chunks.map((c) => c.length)).toEqual([500, 500, 40]);
    expect(chunks[0][0]).toMatchObject({ venueZoneId: "z1", rowLabel: "A", seatNumber: 1 });
  });

  it("general guarda capacity y ningun asiento", async () => {
    selectResults = [[{ id: "v1" }], [{ count: 0 }]];
    returningResults = [[{ id: "z1" }]];
    await createZone("v1", GENERAL, ORGANIZER);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ kind: "general", capacity: 300 });
  });
});

describe("updateZone", () => {
  const seats = (rows: number, perRow: number) =>
    Array.from({ length: rows * perRow }, (_, i) => ({
      rowLabel: String.fromCharCode(65 + Math.floor(i / perRow)),
      seatNumber: (i % perRow) + 1,
    }));

  it("zona ajena => not-found", async () => {
    selectResults = [[ZONE_ROW], []];
    expect(await updateZone("z1", NUMBERED, ORGANIZER)).toEqual({ ok: false, error: "not-found" });
    selectResults = [[]];
    expect(await updateZone("z1", NUMBERED, ORGANIZER)).toEqual({ ok: false, error: "not-found" });
  });

  it("libre: reemplaza asientos (delete + insert) tras for update", async () => {
    selectResults = [[ZONE_ROW], [{ id: "v1" }], seats(10, 20), []];
    const result = await updateZone("z1", { ...NUMBERED, rows: 5 }, ORGANIZER);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(calls.indexOf("for-update")).toBeLessThan(calls.indexOf("delete"));
    expect(calls.indexOf("delete")).toBeLessThan(calls.lastIndexOf("insert"));
    expect((inserted[1] as unknown[]).length).toBe(100);
  });

  it.each([
    ["kind", { ...GENERAL }, [[ZONE_ROW], [{ id: "v1" }], [{ id: "t1" }]]],
    ["rows", { ...NUMBERED, rows: 5 }, [[ZONE_ROW], [{ id: "v1" }], seats(10, 20), [{ id: "t1" }]]],
    ["seatsPerRow", { ...NUMBERED, seatsPerRow: 10 }, [[ZONE_ROW], [{ id: "v1" }], seats(10, 20), [{ id: "t1" }]]],
  ])("en uso: cambio de %s => zone-locked sin escribir (chequeo tras for update)", async (_label, input, queue) => {
    selectResults = queue as unknown[][];
    expect(await updateZone("z1", input, ORGANIZER)).toEqual({ ok: false, error: "zone-locked" });
    expect(calls).not.toContain("update");
    expect(calls).not.toContain("delete");
    expect(calls.indexOf("for-update")).toBe(1);
  });

  it("en uso: capacity de zona general => zone-locked", async () => {
    selectResults = [[{ ...ZONE_ROW, kind: "general", capacity: 300 }], [{ id: "v1" }], [{ id: "t1" }]];
    expect(await updateZone("z1", { ...GENERAL, capacity: 400 }, ORGANIZER)).toEqual({
      ok: false,
      error: "zone-locked",
    });
  });

  it("en uso: renombrar funciona sin tocar asientos", async () => {
    selectResults = [[ZONE_ROW], [{ id: "v1" }], seats(10, 20)];
    const result = await updateZone("z1", { ...NUMBERED, name: "Nuevo" }, ORGANIZER);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(inserted[0]).toMatchObject({ name: "Nuevo" });
    expect(calls).not.toContain("delete");
    expect(calls).not.toContain("insert");
  });
});

describe("deleteZone", () => {
  it("en uso => zone-locked", async () => {
    selectResults = [[ZONE_ROW], [{ id: "v1" }], [{ id: "t1" }]];
    expect(await deleteZone("z1", ORGANIZER)).toEqual({ ok: false, error: "zone-locked" });
    expect(calls).not.toContain("delete");
  });

  it("libre => elimina", async () => {
    selectResults = [[ZONE_ROW], [{ id: "v1" }], []];
    expect(await deleteZone("z1", ADMIN)).toEqual({ ok: true, data: undefined });
    expect(calls).toContain("delete");
  });

  it("23503 => zone-locked", async () => {
    selectResults = [[ZONE_ROW], [{ id: "v1" }], []];
    deleteError = { cause: { code: "23503" } };
    expect(await deleteZone("z1", ADMIN)).toEqual({ ok: false, error: "zone-locked" });
  });
});
