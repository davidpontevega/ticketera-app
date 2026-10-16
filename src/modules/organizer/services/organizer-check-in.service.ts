import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { orders } from "@/modules/order/db/order.table";
import { tickets } from "@/modules/ticket/db/ticket.table";

import type { CheckInInput } from "../schemas/check-in.schema";
import type { CheckInResult, CheckInStats } from "../types/check-in.types";
import { classifyCheckInFailure } from "../utils/check-in.utils";
import { getEventScope, type EventAdminViewer } from "./organizer-event-admin.service";

// Union por slug (events.slug UNIQUE = orders.event_slug NOT NULL). ponytail: si el slug pasara a
// ser editable tras vender, usar COALESCE(orders.event_id, ...) como fallback.
export async function checkInTicket(
  input: CheckInInput,
  viewer: EventAdminViewer,
): Promise<CheckInResult> {
  const scope = getEventScope(viewer);
  const scopeSql = scope ? sql`and ${scope}` : sql``;

  // Un solo UPDATE condicional: status = 'valid' en el WHERE hace atomico el "usar una sola vez".
  // Subconsulta cruda con columnas calificadas por la plantilla sql (tickets/orders/events).
  const [updated] = await db
    .update(tickets)
    .set({ status: "used", checkedInAt: new Date(), checkedInBy: viewer.id })
    .where(
      and(
        eq(tickets.qrCode, input.code),
        eq(tickets.status, "valid"),
        sql`${tickets.orderId} in (
          select ${orders.id} from ${orders}
          inner join ${events} on ${events.slug} = ${orders.eventSlug}
          where ${orders.status} = 'paid'
            and ${events.id} = ${input.eventId}
            and ${events.status} <> 'cancelled'
            ${scopeSql}
        )`,
      ),
    )
    .returning({
      code: tickets.qrCode,
      zoneName: tickets.zoneName,
      seatLabel: tickets.seatLabel,
      attendeeName: tickets.attendeeName,
      sequence: tickets.sequence,
    });

  if (updated) {
    return { result: "valid", ticket: { ...updated, attendeeName: updated.attendeeName ?? "" } };
  }

  const [row] = await db
    .select({
      ticketStatus: tickets.status,
      checkedInAt: tickets.checkedInAt,
      orderStatus: orders.status,
      eventId: events.id,
      eventStatus: events.status,
      organizerId: events.organizerId,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(events, eq(events.slug, orders.eventSlug))
    .where(eq(tickets.qrCode, input.code));

  return classifyCheckInFailure(row, { eventId: input.eventId, viewer });
}

export async function getCheckInStats(
  eventId: string,
  viewer: EventAdminViewer,
): Promise<CheckInStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      checkedIn: sql<number>`count(*) filter (where ${tickets.status} = 'used')`.mapWith(Number),
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(events, eq(events.slug, orders.eventSlug))
    .where(
      and(
        eq(events.id, eventId),
        eq(orders.status, "paid"),
        ne(tickets.status, "cancelled"),
        getEventScope(viewer),
      ),
    );

  return { total: row?.total ?? 0, checkedIn: row?.checkedIn ?? 0 };
}
