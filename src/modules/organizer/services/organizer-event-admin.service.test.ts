import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { changeEventStatus, deleteEvent, getEventScope, setEventFeatured } from "./organizer-event-admin.service";

// "server-only" solo lanza fuera del condition "react-server" de Next; en Vitest se stubea a vacio.
vi.mock("server-only", () => ({}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();

const update = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const updateReturning = vi.fn();

const del = vi.fn();
const deleteWhere = vi.fn();
const deleteReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  selectWhere.mockResolvedValue([]);

  update.mockImplementation(() => ({ set: updateSet }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
  updateWhere.mockImplementation(() => ({ returning: updateReturning }));
  updateReturning.mockResolvedValue([]);

  del.mockImplementation(() => ({ where: deleteWhere }));
  deleteWhere.mockImplementation(() => ({ returning: deleteReturning }));
  deleteReturning.mockResolvedValue([]);
});

const dialect = new PgDialect();

function paramsOf(where: SQL): unknown[] {
  return dialect.sqlToQuery(where).params;
}

function sqlTextOf(where: SQL): string {
  return dialect.sqlToQuery(where).sql;
}

describe("getEventScope", () => {
  it("organizer devuelve una condicion definida", () => {
    expect(getEventScope({ id: "organizer-1", role: "organizer" })).toBeDefined();
  });

  it.each(["admin", "super_admin"] as const)("%s devuelve undefined (sin filtro)", (role) => {
    expect(getEventScope({ id: "viewer-1", role })).toBeUndefined();
  });
});

describe("changeEventStatus", () => {
  const viewer = { id: "organizer-1", role: "organizer" as const };
  const adminViewer = { id: "admin-1", role: "admin" as const };

  it("sin fila en el select devuelve not-found sin llamar a update", async () => {
    selectWhere.mockResolvedValue([]);

    const result = await changeEventStatus({ eventId: "event-1", status: "published" }, viewer);

    expect(result).toEqual({ ok: false, error: "not-found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("transicion invalida devuelve el error sin llamar a update", async () => {
    selectWhere.mockResolvedValue([{ status: "cancelled", startsAt: new Date(), tierCount: 1 }]);

    const result = await changeEventStatus({ eventId: "event-1", status: "published" }, viewer);

    expect(result).toEqual({ ok: false, error: "invalid-transition" });
    expect(update).not.toHaveBeenCalled();
  });

  it("caso exitoso llama a update y devuelve ok", async () => {
    selectWhere.mockResolvedValue([{ status: "published", startsAt: new Date(), tierCount: 2 }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    const result = await changeEventStatus({ eventId: "event-1", status: "draft" }, viewer);

    expect(update).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("update sin filas afectadas devuelve not-found", async () => {
    selectWhere.mockResolvedValue([{ status: "published", startsAt: new Date(), tierCount: 2 }]);
    updateReturning.mockResolvedValue([]);

    const result = await changeEventStatus({ eventId: "event-1", status: "draft" }, viewer);

    expect(result).toEqual({ ok: false, error: "not-found" });
  });

  it("organizer: el WHERE del select y del update incluyen el id del organizador (AC5)", async () => {
    selectWhere.mockResolvedValue([{ status: "published", startsAt: new Date(), tierCount: 2 }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    await changeEventStatus({ eventId: "event-1", status: "draft" }, viewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const updateWhereArg = updateWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).toContain("organizer-1");
    expect(paramsOf(updateWhereArg)).toContain("organizer-1");
  });

  it("admin/super_admin: el WHERE del select y del update no filtran por organizador (sin scope)", async () => {
    selectWhere.mockResolvedValue([{ status: "published", startsAt: new Date(), tierCount: 2 }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    await changeEventStatus({ eventId: "event-1", status: "draft" }, adminViewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const updateWhereArg = updateWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).not.toContain("admin-1");
    expect(paramsOf(updateWhereArg)).not.toContain("admin-1");
  });
});

describe("setEventFeatured", () => {
  const viewer = { id: "organizer-1", role: "organizer" as const };
  const adminViewer = { id: "admin-1", role: "admin" as const };

  it("sin fila en el scope devuelve not-found sin llamar a update", async () => {
    selectWhere.mockResolvedValue([]);

    const result = await setEventFeatured({ eventId: "event-1", featured: true }, viewer);

    expect(result).toEqual({ ok: false, error: "not-found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("con fila llama a update con isFeatured del input y devuelve ok", async () => {
    selectWhere.mockResolvedValue([{ id: "event-1" }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    const result = await setEventFeatured({ eventId: "event-1", featured: true }, viewer);

    expect(update).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ isFeatured: true }));
    expect(result).toEqual({ ok: true });
  });

  it("update sin filas afectadas devuelve not-found", async () => {
    selectWhere.mockResolvedValue([{ id: "event-1" }]);
    updateReturning.mockResolvedValue([]);

    const result = await setEventFeatured({ eventId: "event-1", featured: false }, viewer);

    expect(result).toEqual({ ok: false, error: "not-found" });
  });

  it("organizer: el WHERE del select y del update incluyen el id del organizador (AC4)", async () => {
    selectWhere.mockResolvedValue([{ id: "event-1" }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    await setEventFeatured({ eventId: "event-1", featured: true }, viewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const updateWhereArg = updateWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).toContain("organizer-1");
    expect(paramsOf(updateWhereArg)).toContain("organizer-1");
  });

  it("admin/super_admin: el WHERE del select y del update no filtran por organizador (sin scope)", async () => {
    selectWhere.mockResolvedValue([{ id: "event-1" }]);
    updateReturning.mockResolvedValue([{ id: "event-1" }]);

    await setEventFeatured({ eventId: "event-1", featured: true }, adminViewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const updateWhereArg = updateWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).not.toContain("admin-1");
    expect(paramsOf(updateWhereArg)).not.toContain("admin-1");
  });
});

describe("deleteEvent", () => {
  const viewer = { id: "organizer-1", role: "organizer" as const };
  const adminViewer = { id: "admin-1", role: "admin" as const };

  it("sin fila en el select devuelve not-found sin llamar a delete", async () => {
    selectWhere.mockResolvedValue([]);

    const result = await deleteEvent({ eventId: "event-1" }, viewer);

    expect(result).toEqual({ ok: false, error: "not-found" });
    expect(del).not.toHaveBeenCalled();
  });

  it("delete sin filas afectadas devuelve has-orders", async () => {
    selectWhere.mockResolvedValue([{ slug: "evento-1" }]);
    deleteReturning.mockResolvedValue([]);

    const result = await deleteEvent({ eventId: "event-1" }, viewer);

    expect(result).toEqual({ ok: false, error: "has-orders" });
  });

  it("delete con fila afectada devuelve ok", async () => {
    selectWhere.mockResolvedValue([{ slug: "evento-1" }]);
    deleteReturning.mockResolvedValue([{ id: "event-1" }]);

    const result = await deleteEvent({ eventId: "event-1" }, viewer);

    expect(result).toEqual({ ok: true });
  });

  it("organizer: el WHERE del select y del delete incluyen el id del organizador (AC5)", async () => {
    selectWhere.mockResolvedValue([{ slug: "evento-1" }]);
    deleteReturning.mockResolvedValue([{ id: "event-1" }]);

    await deleteEvent({ eventId: "event-1" }, viewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const deleteWhereArg = deleteWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).toContain("organizer-1");
    expect(paramsOf(deleteWhereArg)).toContain("organizer-1");
  });

  it("admin/super_admin: el WHERE del select y del delete no filtran por organizador (sin scope)", async () => {
    selectWhere.mockResolvedValue([{ slug: "evento-1" }]);
    deleteReturning.mockResolvedValue([{ id: "event-1" }]);

    await deleteEvent({ eventId: "event-1" }, adminViewer);

    const selectWhereArg = selectWhere.mock.calls[0][0] as SQL;
    const deleteWhereArg = deleteWhere.mock.calls[0][0] as SQL;
    expect(paramsOf(selectWhereArg)).not.toContain("admin-1");
    expect(paramsOf(deleteWhereArg)).not.toContain("admin-1");
  });

  it("el WHERE del delete protege con NOT EXISTS ordenes paid/pending (D4)", async () => {
    selectWhere.mockResolvedValue([{ slug: "evento-1" }]);
    deleteReturning.mockResolvedValue([{ id: "event-1" }]);

    await deleteEvent({ eventId: "event-1" }, viewer);

    const deleteWhereArg = deleteWhere.mock.calls[0][0] as SQL;
    const sqlText = sqlTextOf(deleteWhereArg).toLowerCase();
    expect(sqlText).toContain("not exists");
    expect(sqlText).toContain("'paid'");
    expect(sqlText).toContain("'pending'");
  });
});
