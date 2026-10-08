import "server-only";
import { and, asc, eq, gte, inArray, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { buildVenueLayoutFromTiers } from "@/modules/ticket/utils/tier-layout.utils";
import type { VenueLayout } from "@/modules/ticket/types/ticket.types";

import { events } from "../db/event.table";
import { ticketTiers } from "../db/ticket-tier.table";
import type { EventEntity } from "../types/event.types";
import { toEventEntity, type EventRow, type TierRow } from "../utils/event-db.utils";

// ponytail: techo del catalogo en memoria; pasar a filtros SQL + paginacion si crece.
export const CATALOG_EVENTS_LIMIT = 200;

export interface PublishedEvent {
  event: EventEntity;
  layout: VenueLayout; // sin ocupacion real (ver catalog.service)
}

async function loadTiersByEvent(eventIds: string[]): Promise<Map<string, TierRow[]>> {
  const byEvent = new Map<string, TierRow[]>();
  if (eventIds.length === 0) return byEvent;

  const tiers = await db.select().from(ticketTiers).where(inArray(ticketTiers.eventId, eventIds));
  for (const tier of tiers) {
    byEvent.set(tier.eventId, [...(byEvent.get(tier.eventId) ?? []), tier]);
  }
  return byEvent;
}

async function selectEvents(where: SQL | undefined, limit?: number): Promise<EventRow[]> {
  const query = db.select().from(events).where(where).orderBy(asc(events.startsAt));
  return limit ? query.limit(limit) : query;
}

async function toPublished(rows: EventRow[]): Promise<PublishedEvent[]> {
  const tiersByEvent = await loadTiersByEvent(rows.map((row) => row.id));
  return rows.map((row) => {
    const tiers = tiersByEvent.get(row.id) ?? [];
    const event = toEventEntity(row, tiers);
    const layout = buildVenueLayoutFromTiers(
      event,
      tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: Number(tier.price),
        totalStock: tier.totalStock,
      })),
    );
    return { event, layout };
  });
}

// Publica, sin auth: solo publicados y futuros.
export async function listPublishedEvents(): Promise<PublishedEvent[]> {
  const rows = await selectEvents(
    and(eq(events.status, "published"), gte(events.startsAt, new Date())),
    CATALOG_EVENTS_LIMIT,
  );
  return toPublished(rows);
}

export async function getPublishedEvent(slug: string): Promise<PublishedEvent | null> {
  const rows = await selectEvents(and(eq(events.slug, slug), eq(events.status, "published")), 1);
  const [published] = await toPublished(rows);
  return published ?? null;
}

// Cualquier estado: /my-tickets conserva eventos cancelados o despublicados.
export async function listEventsBySlugs(slugs: readonly string[]): Promise<EventEntity[]> {
  if (slugs.length === 0) return [];
  const rows = await selectEvents(inArray(events.slug, [...slugs]));
  const tiersByEvent = await loadTiersByEvent(rows.map((row) => row.id));
  return rows.map((row) => toEventEntity(row, tiersByEvent.get(row.id) ?? []));
}

export async function publishedEventExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  return rows.length > 0;
}
