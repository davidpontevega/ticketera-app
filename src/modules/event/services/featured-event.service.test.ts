import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { listFeaturedEvents } from "./featured-event.service";

// "server-only" solo lanza fuera del condition "react-server" de Next; en Vitest se stubea a vacio.
vi.mock("server-only", () => ({}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const selectOrderBy = vi.fn();
const selectLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  selectWhere.mockImplementation(() => ({ orderBy: selectOrderBy }));
  selectOrderBy.mockImplementation(() => ({ limit: selectLimit }));
  selectLimit.mockResolvedValue([]);
});

const dialect = new PgDialect();

function sqlTextOf(where: SQL): string {
  return dialect.sqlToQuery(where).sql;
}

function paramsOf(where: SQL): unknown[] {
  return dialect.sqlToQuery(where).params;
}

describe("listFeaturedEvents", () => {
  it("filtra por is_featured = true y status = published", async () => {
    await listFeaturedEvents();

    expect(selectWhere).toHaveBeenCalledTimes(1);
    const condition = selectWhere.mock.calls[0]?.[0] as SQL;
    const sqlText = sqlTextOf(condition).toLowerCase();
    expect(sqlText).toContain("is_featured");
    expect(sqlText).toContain("status");
    expect(paramsOf(condition)).toEqual([true, "published"]);
  });

  it("aplica limit(8)", async () => {
    await listFeaturedEvents();

    expect(selectLimit).toHaveBeenCalledWith(8);
  });

  it("mapea startsAt (Date) a date (ISO string)", async () => {
    const startsAt = new Date("2026-05-01T20:00:00-05:00");
    selectLimit.mockResolvedValue([
      {
        id: "event-1",
        slug: "concierto-x",
        title: "Concierto X",
        imageUrl: "https://example.com/x.jpg",
        startsAt,
        venue: "Estadio Nacional",
        city: "Lima",
      },
    ]);

    const result = await listFeaturedEvents();

    expect(result).toEqual([
      {
        id: "event-1",
        slug: "concierto-x",
        title: "Concierto X",
        imageUrl: "https://example.com/x.jpg",
        date: startsAt.toISOString(),
        venue: "Estadio Nacional",
        city: "Lima",
      },
    ]);
  });
});
