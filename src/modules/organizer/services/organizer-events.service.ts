import "server-only";
import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { getEventScope } from "./organizer-event-admin.service";
import type { OrganizerEventSummary } from "../types/organizer.types";
import { toOrganizerEventSummaries, type OrganizerEventRow } from "../utils/organizer.utils";

export async function listOrganizerEvents(): Promise<OrganizerEventSummary[]> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  // organizer ve solo lo suyo; admin/super_admin ven todos los eventos.
  const organizerFilter = getEventScope(viewer);

  // Drizzle omite el prefijo de tabla en selects de una sola tabla: las subconsultas de
  // sold/revenue califican a mano ("orders"."...", "events"."slug"). Separadas a proposito:
  // un join lateral sobre lines duplicaria total_amount.
  // ponytail: 3 subconsultas correlacionadas por evento (indice orders_event_slug_status_idx);
  // techo: miles de ordenes pagadas por evento, salida: order_items o columna materializada.
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
      sold: sql<number>`coalesce((
        select sum((line->>'quantity')::int)
        from "orders", jsonb_array_elements("orders"."lines") as line
        where "orders"."event_slug" = "events"."slug" and "orders"."status" = 'paid'
      ), 0)`.mapWith(Number),
      revenue: sql<string>`coalesce((
        select sum("orders"."total_amount")
        from "orders"
        where "orders"."event_slug" = "events"."slug" and "orders"."status" = 'paid'
      ), 0)::text`,
    })
    .from(events)
    .where(organizerFilter)
    .orderBy(desc(events.startsAt));

  return toOrganizerEventSummaries(rows);
}
