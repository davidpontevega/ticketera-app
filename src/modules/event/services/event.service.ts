import "server-only";
import { and, asc, eq, gte, inArray, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  buildVenueLayoutFromTiers,
  buildVenueLayoutFromVenueZones,
  type VenueZoneLayoutInput,
} from "@/modules/ticket/utils/tier-layout.utils";
import type { VenueLayout } from "@/modules/ticket/types/ticket.types";
import { venueSeats, venueZones } from "@/modules/venue/db/venue.table";

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

type VenueZoneRow = typeof venueZones.$inferSelect;
type VenueSeatRow = { venueZoneId: string; rowLabel: string; seatNumber: number };

// Una consulta por lote para zonas y asientos de los eventos con recinto (no N+1).
async function loadVenueZones(zoneIds: string[]) {
  const zones = new Map<string, VenueZoneRow>();
  const seats = new Map<string, VenueSeatRow[]>();
  if (zoneIds.length === 0) return { zones, seats };

  const zoneRows = await db.select().from(venueZones).where(inArray(venueZones.id, zoneIds));
  for (const zone of zoneRows) zones.set(zone.id, zone);
  const numberedIds = zoneRows.filter((zone) => zone.kind === "numbered").map((zone) => zone.id);
  if (numberedIds.length > 0) {
    const seatRows = await db
      .select({
        venueZoneId: venueSeats.venueZoneId,
        rowLabel: venueSeats.rowLabel,
        seatNumber: venueSeats.seatNumber,
      })
      .from(venueSeats)
      .where(inArray(venueSeats.venueZoneId, numberedIds));
    for (const seat of seatRows) {
      seats.set(seat.venueZoneId, [...(seats.get(seat.venueZoneId) ?? []), seat]);
    }
  }
  return { zones, seats };
}

const isVenueEvent = (row: EventRow, tiers: readonly TierRow[]) =>
  Boolean(row.venueId) && tiers.length > 0 && tiers.every((tier) => Boolean(tier.venueZoneId));

async function toPublished(rows: EventRow[]): Promise<PublishedEvent[]> {
  const tiersByEvent = await loadTiersByEvent(rows.map((row) => row.id));
  const venueZoneIds = rows.flatMap((row) => {
    const tiers = tiersByEvent.get(row.id) ?? [];
    return isVenueEvent(row, tiers) ? tiers.map((tier) => tier.venueZoneId!) : [];
  });
  const venue = await loadVenueZones(venueZoneIds);

  return rows.map((row) => {
    const tiers = tiersByEvent.get(row.id) ?? [];
    const event = toEventEntity(row, tiers);
    const toInput = (tier: TierRow) => ({
      id: tier.id,
      name: tier.name,
      price: Number(tier.price),
      totalStock: tier.totalStock,
    });

    if (isVenueEvent(row, tiers) && tiers.every((tier) => venue.zones.has(tier.venueZoneId!))) {
      const inputs = tiers
        .map((tier): VenueZoneLayoutInput & { zone: VenueZoneRow } => {
          const zone = venue.zones.get(tier.venueZoneId!)!;
          return {
            zone,
            kind: zone.kind,
            seats: venue.seats.get(zone.id) ?? [],
            tier: toInput(tier),
          };
        })
        .sort(
          (a, b) =>
            a.zone.sortOrder - b.zone.sortOrder ||
            a.zone.createdAt.getTime() - b.zone.createdAt.getTime(),
        );
      return { event, layout: buildVenueLayoutFromVenueZones(row.venueName, inputs) };
    }
    return { event, layout: buildVenueLayoutFromTiers(event, tiers.map(toInput)) };
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
