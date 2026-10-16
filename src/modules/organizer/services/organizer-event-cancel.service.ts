import "server-only";

import type { CancelEventResult, RetryEventRefundsResult } from "../types/refund.types";
import { changeEventStatus, type EventAdminViewer } from "./organizer-event-admin.service";
import { getEventHeaderForOrders, refundEventOrders } from "./organizer-refund.service";

// Paso A: cancelar (corta la venta). Paso B: reembolsar; si falla algo, la cancelacion sigue valida
// y se reintenta con retryEventRefunds.
export async function cancelEventWithRefunds(
  input: { eventId: string },
  viewer: EventAdminViewer,
): Promise<CancelEventResult> {
  const changed = await changeEventStatus({ eventId: input.eventId, status: "cancelled" }, viewer);
  if (!changed.ok) return changed;
  try {
    return { ok: true, refunds: await refundEventOrders(input.eventId, viewer) };
  } catch (error) {
    // El evento ya esta cancelado: no propagar; el reintento recoge las ordenes.
    console.error("[refund] fallo el reembolso masivo tras cancelar", error);
    return { ok: true, refunds: null };
  }
}

export async function retryEventRefunds(
  input: { eventId: string },
  viewer: EventAdminViewer,
): Promise<RetryEventRefundsResult> {
  const event = await getEventHeaderForOrders(input.eventId, viewer);
  if (event?.status !== "cancelled") return { ok: false, error: "not-found" };
  return { ok: true, refunds: await refundEventOrders(input.eventId, viewer) };
}
