import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listFavoriteEventIds, listFavoriteEventSlugs, setFavorite } from "./favorite.service";

vi.mock("server-only", () => ({}));

const select = vi.fn();
const from = vi.fn();
const where = vi.fn();
const limit = vi.fn();
const innerJoin = vi.fn();
const orderBy = vi.fn();
const insert = vi.fn();
const values = vi.fn();
const onConflictDoNothing = vi.fn();
const del = vi.fn();
const delWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...a: unknown[]) => select(...a),
    insert: (...a: unknown[]) => insert(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

const dialect = new PgDialect();
const query = (fragment: unknown) => dialect.sqlToQuery(fragment as never);

beforeEach(() => {
  vi.clearAllMocks();
  select.mockReturnValue({ from });
  from.mockReturnValue({ where, innerJoin });
  where.mockReturnValue({ limit, orderBy });
  innerJoin.mockReturnValue({ where });
  insert.mockReturnValue({ values });
  values.mockReturnValue({ onConflictDoNothing });
  onConflictDoNothing.mockResolvedValue(undefined);
  del.mockReturnValue({ where: delWhere });
  delWhere.mockResolvedValue(undefined);
});

describe("setFavorite", () => {
  it("true: inserta con onConflictDoNothing si el evento esta publicado", async () => {
    limit.mockResolvedValue([{ id: "e1" }]);

    expect(await setFavorite("u1", "e1", true)).toBe("ok");

    const q = query(where.mock.calls[0][0]);
    expect(q.params).toEqual(expect.arrayContaining(["e1", "published"]));
    expect(values).toHaveBeenCalledWith({ userId: "u1", eventId: "e1" });
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("true: evento inexistente, draft o cancelled => not-found y no inserta", async () => {
    limit.mockResolvedValue([]);
    expect(await setFavorite("u1", "e1", true)).toBe("not-found");
    expect(insert).not.toHaveBeenCalled();
  });

  it("false: borra solo (user_id, event_id) sin consultar el evento", async () => {
    expect(await setFavorite("u1", "e1", false)).toBe("ok");

    const q = query(delWhere.mock.calls[0][0]);
    expect(q.sql).toContain('"favorites"."user_id"');
    expect(q.sql).toContain('"favorites"."event_id"');
    expect(q.params).toEqual(["u1", "e1"]);
    expect(select).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("listFavoriteEventIds", () => {
  it("filtra por user_id y devuelve los ids", async () => {
    where.mockResolvedValue([{ eventId: "a" }, { eventId: "b" }]);

    expect(await listFavoriteEventIds("u1")).toEqual(["a", "b"]);
    expect(query(where.mock.calls[0][0]).params).toEqual(["u1"]);
  });
});

describe("listFavoriteEventSlugs", () => {
  it("filtra por user_id, published y futuros, orden created_at desc", async () => {
    orderBy.mockResolvedValue([{ slug: "s1" }, { slug: "s2" }]);

    expect(await listFavoriteEventSlugs("u1")).toEqual(["s1", "s2"]);

    const w = query(where.mock.calls[0][0]);
    expect(w.sql).toContain('"favorites"."user_id"');
    expect(w.sql).toContain('"events"."status"');
    expect(w.sql).toContain('"events"."starts_at" >=');
    expect(w.params[0]).toBe("u1");
    expect(w.params[1]).toBe("published");

    expect(query(orderBy.mock.calls[0][0]).sql).toMatch(/"favorites"."created_at" desc/);
  });
});
