import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { pgErrorCode } from "@/lib/pg-error";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import type { EventAdminViewer } from "@/modules/organizer/services/organizer-event-admin.service";

import { venues, venueSeats, venueZones } from "../db/venue.table";
import type { ParsedVenueInput, ParsedZoneInput } from "../schemas/venue.schema";
import type { VenueError } from "../types/venue.types";
import { generateSeatGrid, getZoneDimensions, MAX_ZONES_PER_VENUE } from "../utils/venue.utils";
import { getVenueScope } from "./venue.service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type R<T = void> = Promise<{ ok: true; data: T } | { ok: false; error: VenueError }>;

const PG_FK_VIOLATION = "23503";
const SEAT_CHUNK = 500; // limite de parametros de Postgres

const ok = <T>(data: T) => ({ ok: true as const, data });
const fail = (error: VenueError) => ({ ok: false as const, error });

async function insertSeats(tx: Tx, zoneId: string, rows: number, seatsPerRow: number) {
  const seats = generateSeatGrid(rows, seatsPerRow).map((seat) => ({ ...seat, venueZoneId: zoneId }));
  for (let i = 0; i < seats.length; i += SEAT_CHUNK) {
    await tx.insert(venueSeats).values(seats.slice(i, i + SEAT_CHUNK));
  }
}

export async function createVenue(input: ParsedVenueInput, viewer: EventAdminViewer): R<{ id: string }> {
  // createdBy sale siempre de la sesion.
  const [created] = await db
    .insert(venues)
    .values({ ...input, createdBy: viewer.id })
    .returning({ id: venues.id });
  return ok({ id: created.id });
}

export async function updateVenue(id: string, input: ParsedVenueInput, viewer: EventAdminViewer): R {
  const updated = await db
    .update(venues)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(venues.id, id), getVenueScope(viewer)))
    .returning({ id: venues.id });
  return updated.length > 0 ? ok(undefined) : fail("not-found");
}

export async function deleteVenue(id: string, viewer: EventAdminViewer): R {
  const scope = getVenueScope(viewer);
  const [row] = await db
    .select({ id: venues.id })
    .from(venues)
    .where(and(eq(venues.id, id), scope));
  if (!row) return fail("not-found");

  try {
    // La guarda va en el WHERE; el FK RESTRICT es la red de seguridad.
    const deleted = await db
      .delete(venues)
      .where(
        and(
          eq(venues.id, id),
          scope,
          sql`not exists (select 1 from "events" where "events"."venue_id" = "venues"."id")`,
        ),
      )
      .returning({ id: venues.id });
    return deleted.length > 0 ? ok(undefined) : fail("in-use");
  } catch (error) {
    if (pgErrorCode(error) === PG_FK_VIOLATION) return fail("in-use");
    throw error;
  }
}

export async function createZone(
  venueId: string,
  input: ParsedZoneInput,
  viewer: EventAdminViewer,
): R<{ id: string }> {
  return db.transaction(async (tx): R<{ id: string }> => {
    // Bloquea el recinto: serializa el conteo de zonas (limite) entre creaciones concurrentes.
    const [venue] = await tx
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueId), getVenueScope(viewer)))
      .for("update");
    if (!venue) return fail("not-found");

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(venueZones)
      .where(eq(venueZones.venueId, venueId));
    if (count >= MAX_ZONES_PER_VENUE) return fail("limit");

    const [zone] = await tx
      .insert(venueZones)
      .values({
        venueId,
        name: input.name,
        kind: input.kind,
        capacity: input.kind === "general" ? input.capacity : null,
        sortOrder: count,
      })
      .returning({ id: venueZones.id });
    if (input.kind === "numbered") await insertSeats(tx, zone.id, input.rows, input.seatsPerRow);
    return ok({ id: zone.id });
  });
}

// Bloquea la fila de la zona y verifica el alcance del recinto (ajena o inexistente => null).
async function lockZone(tx: Tx, zoneId: string, viewer: EventAdminViewer) {
  const [zone] = await tx.select().from(venueZones).where(eq(venueZones.id, zoneId)).for("update");
  if (!zone) return null;
  const [venue] = await tx
    .select({ id: venues.id })
    .from(venues)
    .where(and(eq(venues.id, zone.venueId), getVenueScope(viewer)));
  return venue ? zone : null;
}

async function isZoneInUse(tx: Tx, zoneId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: ticketTiers.id })
    .from(ticketTiers)
    .where(eq(ticketTiers.venueZoneId, zoneId))
    .limit(1);
  return rows.length > 0;
}

export async function updateZone(zoneId: string, input: ParsedZoneInput, viewer: EventAdminViewer): R {
  return db.transaction(async (tx): R => {
    const zone = await lockZone(tx, zoneId, viewer);
    if (!zone) return fail("not-found");

    // Estructura actual vs pedida (solo las numeradas leen sus asientos).
    let structureChanged = zone.kind !== input.kind;
    if (!structureChanged && input.kind === "general") {
      structureChanged = zone.capacity !== input.capacity;
    }
    if (!structureChanged && input.kind === "numbered") {
      const seats = await tx
        .select({ rowLabel: venueSeats.rowLabel, seatNumber: venueSeats.seatNumber })
        .from(venueSeats)
        .where(eq(venueSeats.venueZoneId, zoneId));
      const current = getZoneDimensions(seats);
      structureChanged = current.rows !== input.rows || current.seatsPerRow !== input.seatsPerRow;
    }

    // Verificacion dentro de la transaccion, tras el lock de la zona.
    if (structureChanged && (await isZoneInUse(tx, zoneId))) return fail("zone-locked");

    await tx
      .update(venueZones)
      .set({
        name: input.name,
        kind: input.kind,
        capacity: input.kind === "general" ? input.capacity : null,
        updatedAt: new Date(),
      })
      .where(eq(venueZones.id, zoneId));

    if (structureChanged) {
      await tx.delete(venueSeats).where(eq(venueSeats.venueZoneId, zoneId));
      if (input.kind === "numbered") await insertSeats(tx, zoneId, input.rows, input.seatsPerRow);
    }
    return ok(undefined);
  });
}

export async function deleteZone(zoneId: string, viewer: EventAdminViewer): R {
  try {
    return await db.transaction(async (tx): R => {
      const zone = await lockZone(tx, zoneId, viewer);
      if (!zone) return fail("not-found");
      if (await isZoneInUse(tx, zoneId)) return fail("zone-locked");
      await tx.delete(venueZones).where(eq(venueZones.id, zoneId));
      return ok(undefined);
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_FK_VIOLATION) return fail("zone-locked");
    throw error;
  }
}
