import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { EventFormValues } from "../types/organizer.types";
import { createEvent, getEventForEdit, updateEvent } from "./organizer-event-write.service";

vi.mock("server-only", () => ({}));

// Cola de resultados para los selects, en orden de ejecucion; el resto de operaciones se registran en `calls`.
let selectResults: unknown[][] = [];
const calls: Array<{ op: string; arg?: unknown }> = [];
let insertedValues: unknown[] = [];
let setValues: Record<string, unknown> | undefined;
let wheres: SQL[] = [];
let failWith: unknown;
let updatedRows: unknown[] = [{ id: "e1" }];

function selectChain() {
  const result = () => Promise.resolve(selectResults.shift() ?? []);
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: (arg: SQL) => {
      wheres.push(arg);
      return chain;
    },
    limit: result,
    orderBy: result,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => result().then(resolve, reject),
  };
  return chain;
}

const tx = {
  select: () => selectChain(),
  execute: (arg: SQL) => {
    calls.push({ op: "execute", arg });
    return Promise.resolve([]);
  },
  insert: () => ({
    values: (values: unknown) => {
      calls.push({ op: "insert" });
      insertedValues.push(values);
      return { returning: () => Promise.resolve([{ id: "new-id" }]), then: (r: (v: unknown) => void) => r([]) };
    },
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      calls.push({ op: "update" });
      setValues = values;
      return {
        where: (arg: SQL) => {
          wheres.push(arg);
          return { returning: () => Promise.resolve(updatedRows) };
        },
      };
    },
  }),
  delete: () => ({
    where: () => {
      calls.push({ op: "delete" });
      return Promise.resolve([]);
    },
  }),
};

vi.mock("@/lib/db", () => ({
  db: {
    ...{ select: () => tx.select() },
    transaction: async (fn: (t: typeof tx) => unknown) => {
      if (failWith) throw failWith;
      return fn(tx);
    },
  },
}));

const dialect = new PgDialect();
const sqlText = (q: SQL) => dialect.sqlToQuery(q).sql.toLowerCase();

const FUTURE = "2099-01-01";
const VIEWER = { id: "organizer-1", role: "organizer" as const };
const values: EventFormValues = {
  name: "Festival de Verano",
  category: "concerts",
  description: "Una descripcion suficientemente larga",
  date: FUTURE,
  time: "20:00",
  venue: "Estadio",
  city: "Lima",
  imageUrl: "data:image/png;base64,AAA",
  tiers: [{ id: "tier-1", name: "General", price: "50", quantity: "100" }],
};
const EXISTING_TIER = { id: "tier-1", name: "General", price: "50.00", totalStock: 100 };

beforeEach(() => {
  selectResults = [];
  calls.length = 0;
  insertedValues = [];
  setValues = undefined;
  wheres = [];
  failWith = undefined;
  updatedRows = [{ id: "e1" }];
});

const ops = () => calls.map((call) => call.op);

describe("createEvent", () => {
  it("inserta evento published con organizerId del usuario y sus tiers", async () => {
    selectResults = [[]];

    const result = await createEvent({ values, intent: "publish" }, VIEWER);

    expect(result).toEqual({ ok: true, eventId: "new-id" });
    expect(insertedValues[0]).toMatchObject({
      slug: "festival-de-verano",
      organizerId: "organizer-1",
      status: "published",
    });
    expect(insertedValues[1]).toEqual([expect.objectContaining({ eventId: "new-id", name: "General", price: "50.00", totalStock: 100 })]);
  });

  it("borrador sin tiers no inserta ticket_tiers", async () => {
    selectResults = [[]];

    await createEvent({ values: { ...values, tiers: [] }, intent: "draft" }, VIEWER);

    expect(insertedValues[0]).toMatchObject({ status: "draft" });
    expect(insertedValues).toHaveLength(1);
  });

  it("agrega sufijo -2/-3 si el slug ya existe", async () => {
    selectResults = [[{ slug: "festival-de-verano" }, { slug: "festival-de-verano-2" }]];

    await createEvent({ values, intent: "draft" }, VIEWER);

    expect(insertedValues[0]).toMatchObject({ slug: "festival-de-verano-3" });
  });

  it("violacion UNIQUE devuelve unknown", async () => {
    failWith = { code: "23505" };
    expect(await createEvent({ values, intent: "draft" }, VIEWER)).toEqual({ ok: false, error: "unknown" });
  });
});

describe("updateEvent", () => {
  const draftRow = { slug: "festival", status: "draft", startsAt: new Date("2099-01-01T01:00:00Z") };

  it("evento ajeno, inexistente o cancelled devuelve not-found sin escribir", async () => {
    selectResults = [[]];
    expect(await updateEvent("e1", { values, intent: "publish" }, VIEWER)).toEqual({ ok: false, error: "not-found" });
    expect(calls).toHaveLength(0);
  });

  it("organizer filtra por su id, admin no", async () => {
    selectResults = [[]];
    await updateEvent("e1", { values, intent: "draft" }, VIEWER);
    selectResults = [[]];
    await updateEvent("e1", { values, intent: "draft" }, { id: "admin-1", role: "admin" });
    const params = wheres.map((w) => dialect.sqlToQuery(w).params);
    expect(params[0]).toContain("organizer-1");
    expect(params[1]).not.toContain("admin-1");
  });

  it("sin ordenes reemplaza tiers, mantiene slug y no toca flags", async () => {
    selectResults = [[draftRow], []];

    const result = await updateEvent("e1", { values, intent: "draft" }, VIEWER);

    expect(result).toEqual({ ok: true });
    expect(ops()).toEqual(["execute", "update", "delete", "insert"]);
    expect(setValues).not.toHaveProperty("slug");
    expect(setValues).not.toHaveProperty("isFeatured");
    expect(setValues).not.toHaveProperty("organizerId");
    expect(setValues).toMatchObject({ status: "draft", title: "Festival de Verano" });
    expect(setValues?.updatedAt).toBeInstanceOf(Date);
  });

  it("el update excluye cancelled y 0 filas afectadas devuelve not-found sin tocar tiers", async () => {
    selectResults = [[draftRow], []];
    updatedRows = [];

    expect(await updateEvent("e1", { values, intent: "draft" }, VIEWER)).toEqual({ ok: false, error: "not-found" });
    expect(ops()).toEqual(["execute", "update"]);
    // wheres: [select del evento, select de ordenes, where del update]
    const updateWhere = dialect.sqlToQuery(wheres[wheres.length - 1]);
    expect(updateWhere.sql.toLowerCase()).toContain("<>");
    expect(updateWhere.params).toContain("cancelled");
  });

  it("toma el lock por slug antes de consultar ordenes", async () => {
    selectResults = [[draftRow], []];
    await updateEvent("e1", { values, intent: "draft" }, VIEWER);
    const lock = calls[0].arg as SQL;
    expect(sqlText(lock)).toContain("pg_advisory_xact_lock(hashtext(");
    expect(dialect.sqlToQuery(lock).params).toEqual(["festival"]);
  });

  it("con ordenes y tiers modificados devuelve tiers-locked sin escribir", async () => {
    selectResults = [[draftRow], [{ id: "o1" }], [EXISTING_TIER]];
    const changed = { ...values, tiers: [{ ...values.tiers[0], price: "60" }] };

    expect(await updateEvent("e1", { values: changed, intent: "draft" }, VIEWER)).toEqual({
      ok: false,
      error: "tiers-locked",
    });
    expect(ops()).toEqual(["execute"]);
  });

  it("con ordenes y tiers identicos guarda contenido sin tocar tiers", async () => {
    selectResults = [[draftRow], [{ id: "o1" }], [EXISTING_TIER]];

    expect(await updateEvent("e1", { values, intent: "draft" }, VIEWER)).toEqual({ ok: true });
    expect(ops()).toEqual(["execute", "update"]);
  });

  it("violacion de FK al borrar tiers devuelve tiers-locked", async () => {
    failWith = { cause: { code: "23503" } };
    expect(await updateEvent("e1", { values, intent: "draft" }, VIEWER)).toEqual({ ok: false, error: "tiers-locked" });
  });

  it("draft -> published con fecha pasada devuelve past-date", async () => {
    selectResults = [[draftRow]];
    const past = { ...values, date: "2000-01-01" };
    expect(await updateEvent("e1", { values: past, intent: "publish" }, VIEWER)).toEqual({ ok: false, error: "past-date" });
  });

  it("draft -> published sin tiers devuelve no-tiers", async () => {
    selectResults = [[draftRow]];
    expect(await updateEvent("e1", { values: { ...values, tiers: [] }, intent: "publish" }, VIEWER)).toEqual({
      ok: false,
      error: "no-tiers",
    });
  });

  it("draft -> published valido pasa a published", async () => {
    selectResults = [[draftRow], []];
    expect(await updateEvent("e1", { values, intent: "publish" }, VIEWER)).toEqual({ ok: true });
    expect(setValues).toMatchObject({ status: "published" });
  });

  it("published ya realizado se edita si no cambia la fecha", async () => {
    const pastStart = new Date("2000-01-01T01:00:00Z"); // 2000-01-01 20:00 Lima = 2000-01-02T01:00Z
    selectResults = [[{ slug: "festival", status: "published", startsAt: new Date("2000-01-02T01:00:00Z") }], []];
    const sameDate = { ...values, date: "2000-01-01" };
    void pastStart;

    expect(await updateEvent("e1", { values: sameDate, intent: "publish" }, VIEWER)).toEqual({ ok: true });
    expect(setValues).toMatchObject({ status: "published" });
  });

  it("published con fecha cambiada al pasado devuelve past-date", async () => {
    selectResults = [[{ slug: "festival", status: "published", startsAt: new Date("2099-01-01T01:00:00Z") }]];
    expect(await updateEvent("e1", { values: { ...values, date: "2000-01-01" }, intent: "publish" }, VIEWER)).toEqual({
      ok: false,
      error: "past-date",
    });
  });

  it("published nunca vuelve a draft", async () => {
    selectResults = [[{ ...draftRow, status: "published" }]];
    expect(await updateEvent("e1", { values, intent: "draft" }, VIEWER)).toEqual({ ok: false, error: "invalid-transition" });
  });
});

describe("getEventForEdit", () => {
  it("devuelve null si no hay fila", async () => {
    selectResults = [[]];
    expect(await getEventForEdit("e1", VIEWER)).toBeNull();
  });

  it("mapea fila y tiers a valores del form (hora de Lima)", async () => {
    selectResults = [
      [
        {
          slug: "festival",
          status: "draft",
          title: "Festival",
          category: "concerts",
          description: "desc",
          startsAt: new Date("2099-01-02T01:30:00Z"),
          venueName: "Estadio",
          city: "Lima",
          imageUrl: "https://x/y.png",
        },
      ],
      [{ id: "t1", name: "General", price: "50.00", totalStock: 100 }],
      [{ id: "o1" }],
    ];

    expect(await getEventForEdit("e1", VIEWER)).toEqual({
      status: "draft",
      hasOrders: true,
      values: {
        name: "Festival",
        category: "concerts",
        description: "desc",
        date: "2099-01-01",
        time: "20:30",
        venue: "Estadio",
        city: "Lima",
        imageUrl: "https://x/y.png",
        tiers: [{ id: "t1", name: "General", price: "50", quantity: "100" }],
      },
    });
  });
});
