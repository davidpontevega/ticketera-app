import type { CheckInContext, CheckInDiagnosticRow, CheckInFailure } from "../types/check-in.types";

type Failure =
  | { result: "already-used"; checkedInAt: string | null }
  | { result: Exclude<CheckInFailure, "already-used"> };

// Clasifica por que el UPDATE condicional no afecto filas. El orden es parte del contrato.
export function classifyCheckInFailure(
  row: CheckInDiagnosticRow | undefined,
  ctx: CheckInContext,
): Failure {
  if (!row) return { result: "not-found" };
  // No filtra la existencia de entradas de otros organizadores.
  if (ctx.viewer.role === "organizer" && row.organizerId !== ctx.viewer.id) {
    return { result: "not-found" };
  }
  if (row.eventId !== ctx.eventId) return { result: "wrong-event" };
  if (row.orderStatus !== "paid" || row.eventStatus === "cancelled") {
    return { result: "not-valid" };
  }
  if (row.ticketStatus === "cancelled") return { result: "cancelled" };
  // used, o valid que perdio una carrera entre el UPDATE y este SELECT.
  return { result: "already-used", checkedInAt: row.checkedInAt?.toISOString() ?? null };
}
