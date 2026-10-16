import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { checkInTicket, getCheckInStats } from "./organizer-check-in.service";

vi.mock("server-only", () => ({}));

const select = vi.fn();
const selectFrom = vi.fn();
const innerJoin = vi.fn();
const selectWhere = vi.fn();

const update = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ innerJoin }));
  innerJoin.mockImplementation(() => ({ innerJoin, where: selectWhere }));
  selectWhere.mockResolvedValue([]);

  update.mockImplementation(() => ({ set: updateSet }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
  updateWhere.mockImplementation(() => ({ returning: updateReturning }));
  updateReturning.mockResolvedValue([]);
});

const dialect = new PgDialect();
const toQuery = (where: SQL) => dialect.sqlToQuery(where);

const EVENT_ID = "event-1";
const input = { eventId: EVENT_ID, code: "TK-1A2B3C4D-01" };
const organizer = { id: "organizer-1", role: "organizer" as const };
const admin = { id: "admin-1", role: "admin" as const };

const ticketRow = {
  code: "TK-1A2B3C4D-01",
  zoneName: "General",
  seatLabel: null,
  attendeeName: "Ana Torres",
  sequence: 1,
};

describe("checkInTicket", () => {
  it("camino feliz: un solo update con returning, sin select previo (AC2)", async () => {
    updateReturning.mockResolvedValue([ticketRow]);

    const result = await checkInTicket(input, organizer);

    expect(result).toEqual({ result: "valid", ticket: ticketRow });
    expect(update).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "used", checkedInBy: "organizer-1", checkedInAt: expect.any(Date) }),
    );
  });

  it("el WHERE exige status valid, orden paid, evento no cancelado y califica las tablas", async () => {
    updateReturning.mockResolvedValue([ticketRow]);

    await checkInTicket(input, organizer);

    const { sql: text, params } = toQuery(updateWhere.mock.calls[0][0] as SQL);
    const lower = text.toLowerCase();
    expect(params).toEqual(expect.arrayContaining([input.code, "valid", EVENT_ID]));
    expect(lower).toContain("'paid'");
    expect(lower).toContain("<> 'cancelled'");
    expect(text).toContain('"events"."slug" = "orders"."event_slug"');
    expect(text).toContain('"events"."id"');
  });

  it("organizer incluye organizer_id en el WHERE; admin no (AC5)", async () => {
    updateReturning.mockResolvedValue([ticketRow]);

    await checkInTicket(input, organizer);
    await checkInTicket(input, admin);

    const orgQuery = toQuery(updateWhere.mock.calls[0][0] as SQL);
    const adminQuery = toQuery(updateWhere.mock.calls[1][0] as SQL);
    expect(orgQuery.sql).toContain('"organizer_id"');
    expect(orgQuery.params).toContain("organizer-1");
    expect(adminQuery.sql).not.toContain('"organizer_id"');
  });

  it("attendeeName nulo se normaliza a cadena vacia", async () => {
    updateReturning.mockResolvedValue([{ ...ticketRow, attendeeName: null }]);

    const result = await checkInTicket(input, admin);

    expect(result).toEqual({ result: "valid", ticket: { ...ticketRow, attendeeName: "" } });
  });

  it("update vacio y sin fila diagnostica => not-found", async () => {
    selectWhere.mockResolvedValue([]);

    expect(await checkInTicket(input, admin)).toEqual({ result: "not-found" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  const diag = {
    ticketStatus: "valid" as const,
    checkedInAt: null,
    orderStatus: "paid" as const,
    eventId: EVENT_ID,
    eventStatus: "published",
    organizerId: "organizer-1",
  };

  it.each([
    ["organizer con evento ajeno", organizer, { ...diag, organizerId: "other" }, { result: "not-found" }],
    ["otro evento", admin, { ...diag, eventId: "event-2" }, { result: "wrong-event" }],
    ["orden no paid", admin, { ...diag, orderStatus: "pending" as const }, { result: "not-valid" }],
    ["evento cancelado", admin, { ...diag, eventStatus: "cancelled" }, { result: "not-valid" }],
    ["ticket cancelled", admin, { ...diag, ticketStatus: "cancelled" as const }, { result: "cancelled" }],
  ])("update vacio clasifica: %s", async (_name, viewer, row, expected) => {
    selectWhere.mockResolvedValue([row]);

    expect(await checkInTicket(input, viewer)).toEqual(expected);
  });

  it("segunda llamada => already-used con la hora del primer check-in (AC4)", async () => {
    const firstAt = new Date("2026-10-14T20:00:00.000Z");
    updateReturning.mockResolvedValueOnce([ticketRow]).mockResolvedValueOnce([]);
    selectWhere.mockResolvedValue([{ ...diag, ticketStatus: "used", checkedInAt: firstAt }]);

    expect(await checkInTicket(input, organizer)).toMatchObject({ result: "valid" });
    expect(await checkInTicket(input, organizer)).toEqual({
      result: "already-used",
      checkedInAt: firstAt.toISOString(),
    });
  });
});

describe("getCheckInStats", () => {
  it("devuelve total y checkedIn", async () => {
    selectWhere.mockResolvedValue([{ total: 10, checkedIn: 3 }]);

    expect(await getCheckInStats(EVENT_ID, admin)).toEqual({ total: 10, checkedIn: 3 });
  });

  it("sin fila devuelve ceros", async () => {
    expect(await getCheckInStats(EVENT_ID, admin)).toEqual({ total: 0, checkedIn: 0 });
  });

  it("filtra paid, excluye cancelled y aplica scope solo al organizer (AC5, AC7)", async () => {
    selectWhere.mockResolvedValue([{ total: 0, checkedIn: 0 }]);

    await getCheckInStats(EVENT_ID, organizer);
    await getCheckInStats(EVENT_ID, admin);

    const org = toQuery(selectWhere.mock.calls[0][0] as SQL);
    const adm = toQuery(selectWhere.mock.calls[1][0] as SQL);
    expect(org.params).toEqual([EVENT_ID, "paid", "cancelled", "organizer-1"]);
    expect(adm.params).toEqual([EVENT_ID, "paid", "cancelled"]);
  });
});
