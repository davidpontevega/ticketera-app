import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orders } from "@/modules/order/db/order.table";
import type { UserEntity } from "@/modules/user";

import type {
  ChangeEventStatusInput,
  DeleteEventInput,
  SetEventFeaturedInput,
} from "../schemas/event-admin.schema";
import type { EventStatusChangeError } from "../types/organizer.types";
import { getEventStatusChangeError } from "../utils/organizer.utils";

export type EventAdminViewer = Pick<UserEntity, "id" | "role">;

// organizer muta solo lo suyo; admin/super_admin mutan cualquier evento (sin filtro).
export function getEventScope(viewer: EventAdminViewer): SQL | undefined {
  return viewer.role === "organizer" ? eq(events.organizerId, viewer.id) : undefined;
}

export async function changeEventStatus(
  input: ChangeEventStatusInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: "not-found" | EventStatusChangeError }> {
  const scope = getEventScope(viewer);
  const [row] = await db
    .select({
      status: events.status,
      startsAt: events.startsAt,
      // "events"."id" calificado a mano: en un select de una sola tabla Drizzle omite el prefijo y
      // `"id"` se resolveria a ticket_tiers.id dentro de la subconsulta (siempre 0 tiers).
      tierCount:
        sql<number>`(select count(*) from ${ticketTiers} where ${ticketTiers.eventId} = "events"."id")`.mapWith(
          Number,
        ),
    })
    .from(events)
    .where(and(eq(events.id, input.eventId), scope));

  if (!row) return { ok: false, error: "not-found" };

  const changeError = getEventStatusChangeError(row, input.status);
  if (changeError) return { ok: false, error: changeError };

  // status = <leido> en el WHERE evita pisar un cambio concurrente.
  const updated = await db
    .update(events)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(events.id, input.eventId), scope, eq(events.status, row.status)))
    .returning({ id: events.id });

  return updated.length > 0 ? { ok: true } : { ok: false, error: "not-found" };
}

export async function setEventFeatured(
  input: SetEventFeaturedInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: "not-found" }> {
  const scope = getEventScope(viewer);
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, input.eventId), scope));

  if (!row) return { ok: false, error: "not-found" };

  const updated = await db
    .update(events)
    .set({ isFeatured: input.featured, updatedAt: new Date() })
    .where(and(eq(events.id, input.eventId), scope))
    .returning({ id: events.id });

  return updated.length > 0 ? { ok: true } : { ok: false, error: "not-found" };
}

export async function deleteEvent(
  input: DeleteEventInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: "not-found" | "has-orders" }> {
  const scope = getEventScope(viewer);
  const [row] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(and(eq(events.id, input.eventId), scope));

  if (!row) return { ok: false, error: "not-found" };

  // NOT EXISTS en la misma sentencia: atomico, sin ventana entre check y borrado.
  const deleted = await db
    .delete(events)
    .where(
      and(
        eq(events.id, input.eventId),
        scope,
        sql`not exists (select 1 from ${orders} where ${orders.eventSlug} = ${events.slug} and ${orders.status} in ('paid', 'pending'))`,
      ),
    )
    .returning({ id: events.id });

  return deleted.length > 0 ? { ok: true } : { ok: false, error: "has-orders" };
}
