import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TicketLine } from "@/modules/ticket";

import { RESERVATION_WINDOW_SECONDS } from "../constants/order.constants";
import { aggregateTaken, getEventAvailability, getTakenInventory, getTakenInventoryBySlugs } from "./availability.service";

vi.mock("server-only", () => ({}));

const publishedEventExists = vi.fn();
vi.mock("@/modules/event/services/event.service", () => ({
  publishedEventExists: (...args: unknown[]) => publishedEventExists(...args),
}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();

vi.mock("@/lib/db", () => ({ db: { select: (...args: unknown[]) => select(...args) } }));

function line(zoneId: string, quantity: number, seatLabels: string[] = []): TicketLine {
  return { zoneId, zoneName: zoneId, quantity, unitPrice: 10, amount: quantity * 10, seatLabels };
}

beforeEach(() => {
  vi.clearAllMocks();
  select.mockReturnValue({ from: selectFrom });
  selectFrom.mockReturnValue({ where: selectWhere });
});

describe("aggregateTaken", () => {
  it("suma cantidades y junta labels por zona entre ordenes", () => {
    const result = aggregateTaken([
      { lines: [line("vip", 2, ["A1", "A2"]), line("general", 3)] },
      { lines: [line("vip", 1, ["A3"]), line("general", 4)] },
    ]);
    expect(result).toEqual({ seats: { vip: ["A1", "A2", "A3"] }, sold: { vip: 3, general: 7 } });
  });

  it("sin ordenes devuelve un snapshot vacio", () => {
    expect(aggregateTaken([])).toEqual({ seats: {}, sold: {} });
  });
});

describe("getTakenInventory", () => {
  it("filtra por evento, paid o pending dentro de la ventana, y agrega las lineas", async () => {
    selectWhere.mockResolvedValue([{ eventSlug: "evento-x", lines: [line("vip", 1, ["B2"])] }]);

    const result = await getTakenInventory({ select } as never, "evento-x");

    expect(result).toEqual({ seats: { vip: ["B2"] }, sold: { vip: 1 } });
    const { sql: text, params } = new PgDialect().sqlToQuery(selectWhere.mock.calls[0][0]);
    expect(text).toContain("make_interval");
    expect(text).toContain('"orders"."status"');
    expect(params).toEqual(expect.arrayContaining(["evento-x", "paid", "pending", RESERVATION_WINDOW_SECONDS]));
    expect(params).not.toContain("cancelled");
    expect(params).not.toContain("failed");
  });
});

describe("getTakenInventoryBySlugs", () => {
  it("slugs vacio devuelve {} sin consultar", async () => {
    expect(await getTakenInventoryBySlugs({ select } as never, [])).toEqual({});
    expect(select).not.toHaveBeenCalled();
  });

  it("agrega por slug con una sola consulta", async () => {
    selectWhere.mockResolvedValue([
      { eventSlug: "a", lines: [line("vip", 1, ["A1"])] },
      { eventSlug: "b", lines: [line("general", 3)] },
      { eventSlug: "a", lines: [line("vip", 2, ["A2", "A3"])] },
    ]);

    const result = await getTakenInventoryBySlugs({ select } as never, ["a", "b", "c"]);

    expect(select).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      a: { seats: { vip: ["A1", "A2", "A3"] }, sold: { vip: 3 } },
      b: { seats: {}, sold: { general: 3 } },
    });
  });
});

describe("getEventAvailability", () => {
  it("devuelve null si no esta publicado sin consultar ordenes", async () => {
    publishedEventExists.mockResolvedValue(false);
    expect(await getEventAvailability("no-existe")).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("devuelve el snapshot de un evento publicado", async () => {
    publishedEventExists.mockResolvedValue(true);
    selectWhere.mockResolvedValue([]);
    expect(await getEventAvailability("x")).toEqual({ seats: {}, sold: {} });
    expect(select).toHaveBeenCalledTimes(1);
  });
});
