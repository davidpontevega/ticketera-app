import "server-only";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import type { EventAdminViewer } from "@/modules/organizer/services/organizer-event-admin.service";

import { venues, venueZones } from "../db/venue.table";
import type { VenueDto, VenueForEdit, VenueOption, VenueZoneDto } from "../types/venue.types";
import { summarizeZone } from "../utils/venue.utils";

// organizer ve solo lo suyo; admin/super_admin todo (analogo a getEventScope).
export function getVenueScope(viewer: EventAdminViewer): SQL | undefined {
  return viewer.role === "organizer" ? eq(venues.createdBy, viewer.id) : undefined;
}

// Drizzle omite el prefijo de tabla en selects de una sola tabla: todo se califica a mano.
const seatCount = sql<number>`(select count(*)::int from "venue_seats" where "venue_seats"."venue_zone_id" = "venue_zones"."id")`;

const venueSelect = {
  id: venues.id,
  name: venues.name,
  address: venues.address,
  city: venues.city,
  latitude: venues.latitude,
  longitude: venues.longitude,
  createdBy: venues.createdBy,
  zoneCount: sql<number>`(select count(*)::int from "venue_zones" where "venue_zones"."venue_id" = "venues"."id")`,
  capacity: sql<number>`(select coalesce(sum(case when "venue_zones"."kind" = 'general' then "venue_zones"."capacity" else (select count(*) from "venue_seats" where "venue_seats"."venue_zone_id" = "venue_zones"."id") end), 0)::int from "venue_zones" where "venue_zones"."venue_id" = "venues"."id")`,
  eventCount: sql<number>`(select count(*)::int from "events" where "events"."venue_id" = "venues"."id")`,
};

type VenueRow = Omit<VenueDto, "isOwn"> & { createdBy: string | null };

function toVenueDto({ createdBy, ...row }: VenueRow, viewer: EventAdminViewer): VenueDto {
  return { ...row, isOwn: createdBy === viewer.id };
}

export async function listVenues(viewer: EventAdminViewer): Promise<VenueDto[]> {
  const rows = await db
    .select(venueSelect)
    .from(venues)
    .where(getVenueScope(viewer))
    .orderBy(asc(venues.name));
  return rows.map((row) => toVenueDto(row, viewer));
}

export async function getVenueForEdit(id: string, viewer: EventAdminViewer): Promise<VenueForEdit | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const [row] = await db
    .select(venueSelect)
    .from(venues)
    .where(and(eq(venues.id, id), getVenueScope(viewer)));
  if (!row) return null;

  const zoneRows = await db
    .select({
      id: venueZones.id,
      name: venueZones.name,
      kind: venueZones.kind,
      capacity: venueZones.capacity,
      seatCount,
      rows: sql<number>`(select count(distinct "venue_seats"."row_label")::int from "venue_seats" where "venue_seats"."venue_zone_id" = "venue_zones"."id")`,
      seatsPerRow: sql<number>`(select coalesce(max("venue_seats"."seat_number"), 0)::int from "venue_seats" where "venue_seats"."venue_zone_id" = "venue_zones"."id")`,
      usedByEvents: sql<number>`(select count(distinct "ticket_tiers"."event_id")::int from "ticket_tiers" where "ticket_tiers"."venue_zone_id" = "venue_zones"."id")`,
    })
    .from(venueZones)
    .where(eq(venueZones.venueId, id))
    .orderBy(asc(venueZones.sortOrder), asc(venueZones.createdAt));

  const zones: VenueZoneDto[] = zoneRows.map((zone) => ({
    id: zone.id,
    name: zone.name,
    kind: zone.kind,
    capacity: summarizeZone(zone),
    rows: zone.rows,
    seatsPerRow: zone.seatsPerRow,
    inUse: zone.usedByEvents > 0,
    usedByEvents: zone.usedByEvents,
  }));
  return { ...toVenueDto(row, viewer), zones };
}

// Para el selector del form de evento (T4): solo recintos del alcance del viewer.
export async function listVenueOptions(viewer: EventAdminViewer): Promise<VenueOption[]> {
  const venueRows = await db
    .select({ id: venues.id, name: venues.name, city: venues.city })
    .from(venues)
    .where(getVenueScope(viewer))
    .orderBy(asc(venues.name));
  if (venueRows.length === 0) return [];

  const zoneRows = await db
    .select({
      id: venueZones.id,
      venueId: venueZones.venueId,
      name: venueZones.name,
      kind: venueZones.kind,
      capacity: venueZones.capacity,
      seatCount,
    })
    .from(venueZones)
    .where(
      inArray(
        venueZones.venueId,
        venueRows.map((venue) => venue.id),
      ),
    )
    .orderBy(asc(venueZones.sortOrder), asc(venueZones.createdAt));

  return venueRows.map((venue) => ({
    ...venue,
    zones: zoneRows
      .filter((zone) => zone.venueId === venue.id)
      .map((zone) => ({ id: zone.id, name: zone.name, kind: zone.kind, capacity: summarizeZone(zone) })),
  }));
}
