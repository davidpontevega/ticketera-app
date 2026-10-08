import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orders } from "@/modules/order/db/order.table";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { getEventScope } from "./organizer-event-admin.service";
import type { OrganizerEventSummary } from "../types/organizer.types";
import { summarizeOrganizerEvents, type OrganizerEventRow, type PaidOrderRow } from "../utils/organizer.utils";

export async function listOrganizerEvents(): Promise<OrganizerEventSummary[]> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  // organizer ve solo lo suyo; admin/super_admin ven todos los eventos.
  const organizerFilter = getEventScope(viewer);

  const rows: OrganizerEventRow[] = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      status: events.status,
      startsAt: events.startsAt,
      city: events.city,
      imageUrl: events.imageUrl,
      isFeatured: events.isFeatured,
      capacity: sql<number>`coalesce((select sum(${ticketTiers.totalStock}) from ${ticketTiers} where ${ticketTiers.eventId} = "events"."id"), 0)`.mapWith(
        Number,
      ),
    })
    .from(events)
    .where(organizerFilter)
    .orderBy(desc(events.startsAt));

  if (rows.length === 0) return [];

  // ponytail: agrega ordenes en memoria; pasar a SUM/GROUP BY en SQL cuando el volumen lo pida o existan order_items.
  const paidOrders: PaidOrderRow[] = await db
    .select({ eventSlug: orders.eventSlug, totalAmount: orders.totalAmount, lines: orders.lines })
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        inArray(
          orders.eventSlug,
          rows.map((row) => row.slug),
        ),
      ),
    );

  return summarizeOrganizerEvents(rows, paidOrders);
}
