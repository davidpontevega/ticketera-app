import { describe, expect, it } from "vitest";

import type { CheckInContext, CheckInDiagnosticRow } from "../types/check-in.types";
import { classifyCheckInFailure } from "./check-in.utils";

const ctx: CheckInContext = { eventId: "ev-1", viewer: { id: "org-1", role: "organizer" } };
const adminCtx: CheckInContext = { eventId: "ev-1", viewer: { id: "adm-1", role: "admin" } };
const usedAt = new Date("2026-11-15T20:00:00.000Z");

const row = (over: Partial<CheckInDiagnosticRow> = {}): CheckInDiagnosticRow => ({
  ticketStatus: "used",
  checkedInAt: usedAt,
  orderStatus: "paid",
  eventId: "ev-1",
  eventStatus: "published",
  organizerId: "org-1",
  ...over,
});

describe("classifyCheckInFailure", () => {
  it("not-found si no existe", () => {
    expect(classifyCheckInFailure(undefined, ctx)).toEqual({ result: "not-found" });
  });

  it("not-found si el evento es de otro organizer (no filtra existencia)", () => {
    expect(classifyCheckInFailure(row({ organizerId: "otro", eventId: "ev-9" }), ctx)).toEqual({
      result: "not-found",
    });
  });

  it("admin no pasa por el chequeo de organizer", () => {
    expect(classifyCheckInFailure(row({ organizerId: "otro" }), adminCtx)).toMatchObject({
      result: "already-used",
    });
  });

  it("wrong-event si es de otro evento propio", () => {
    expect(classifyCheckInFailure(row({ eventId: "ev-2" }), ctx)).toEqual({ result: "wrong-event" });
  });

  it("not-valid si la orden no esta paid o el evento esta cancelado", () => {
    expect(classifyCheckInFailure(row({ orderStatus: "refunded" }), ctx)).toEqual({ result: "not-valid" });
    expect(classifyCheckInFailure(row({ orderStatus: "pending" }), ctx)).toEqual({ result: "not-valid" });
    expect(classifyCheckInFailure(row({ eventStatus: "cancelled" }), ctx)).toEqual({ result: "not-valid" });
  });

  it("already-used con la hora original", () => {
    expect(classifyCheckInFailure(row(), ctx)).toEqual({
      result: "already-used",
      checkedInAt: usedAt.toISOString(),
    });
  });

  it("cancelled", () => {
    expect(classifyCheckInFailure(row({ ticketStatus: "cancelled", checkedInAt: null }), ctx)).toEqual({
      result: "cancelled",
    });
  });

  it("precedencia: wrong-event gana a not-valid; not-valid gana a already-used", () => {
    expect(classifyCheckInFailure(row({ eventId: "ev-2", orderStatus: "pending" }), ctx).result).toBe(
      "wrong-event",
    );
    expect(classifyCheckInFailure(row({ orderStatus: "failed" }), ctx).result).toBe("not-valid");
  });

  it("not-found gana a todo para organizer ajeno", () => {
    expect(
      classifyCheckInFailure(row({ organizerId: "otro", eventId: "ev-2", orderStatus: "pending" }), ctx).result,
    ).toBe("not-found");
  });
});
