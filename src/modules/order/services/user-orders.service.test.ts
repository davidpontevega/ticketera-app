import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listUserOrders } from "./user-orders.service";

vi.mock("server-only", () => ({}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const selectOrderBy = vi.fn();

vi.mock("@/lib/db", () => ({ db: { select: (...args: unknown[]) => select(...args) } }));

beforeEach(() => {
  vi.clearAllMocks();
  select.mockReturnValue({ from: selectFrom });
  selectFrom.mockReturnValue({ where: selectWhere });
  selectWhere.mockReturnValue({ orderBy: selectOrderBy });
});

describe("listUserOrders", () => {
  it("filtra por user_id y paid, ordena por created_at desc y devuelve los registros tal cual", async () => {
    const records = [{ id: "a" }, { id: "b" }];
    selectOrderBy.mockResolvedValue(records);

    expect(await listUserOrders("user-1")).toBe(records);

    const dialect = new PgDialect();
    const where = dialect.sqlToQuery(selectWhere.mock.calls[0][0]);
    expect(where.sql).toContain('"orders"."user_id"');
    expect(where.sql).toContain('"orders"."status"');
    expect(where.params).toEqual(["user-1", "paid"]);

    const order = dialect.sqlToQuery(selectOrderBy.mock.calls[0][0]);
    expect(order.sql).toMatch(/"orders"."created_at" desc/);
  });

  it("sin ordenes devuelve []", async () => {
    selectOrderBy.mockResolvedValue([]);
    expect(await listUserOrders("user-1")).toEqual([]);
  });
});
