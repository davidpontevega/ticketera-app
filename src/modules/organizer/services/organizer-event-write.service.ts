import "server-only";
import { and, asc, eq, inArray, like, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { pgErrorCode } from "@/lib/pg-error";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orders } from "@/modules/order/db/order.table";
import { venues, venueSeats, venueZones } from "@/modules/venue/db/venue.table";
import { getVenueScope } from "@/modules/venue/services/venue.service";

import type { EventFormValues } from "../types/organizer.types";
import type {
  EventForEdit,
  SaveEventError,
  SaveEventInput,
} from "../types/event-write.types";
import {
  hasTiersChanged,
  isBlankTier,
  slugify,
  toEventDbInput,
  toEventFormDateTime,
  type EventDbInput,
  type VenueSnapshot,
} from "../utils/event-write.utils";
import { getEventStatusChangeError } from "../utils/organizer.utils";
import { getEventScope, type EventAdminViewer } from "./organizer-event-admin.service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "select">;

const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";

// Mismo predicado que deleteEvent (030): ordenes paid/pending del slug.
async function eventHasOrders(executor: Executor, slug: string): Promise<boolean> {
  const rows = await executor
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.eventSlug, slug), inArray(orders.status, ["paid", "pending"])))
    .limit(1);
  return rows.length > 0;
}

// createdAt escalonado: conserva el orden de los tipos al releerlos (un insert en bloque comparte timestamp).
function withOrderedCreatedAt<T extends object>(tiers: readonly T[]) {
  const base = Date.now();
  return tiers.map((tier, index) => ({ ...tier, createdAt: new Date(base + index) }));
}

type VenueResolution = { ok: true; venue?: VenueSnapshot; numberedStock: Map<string, number> } | { ok: false; error: SaveEventError };

// Nada del cliente es de confianza: recinto dentro del alcance del viewer, zonas de ese recinto
// (leidas con `for share`: una edicion estructural concurrente espera) y stock de zonas numeradas = asientos.
async function resolveVenue(tx: Tx, values: EventFormValues, viewer: EventAdminViewer): Promise<VenueResolution> {
  const numberedStock = new Map<string, number>();
  if (!values.venueId) return { ok: true, numberedStock };
  if (!z.uuid().safeParse(values.venueId).success) return { ok: false, error: "not-found" };

  const [venue] = await tx
    .select({
      id: venues.id,
      name: venues.name,
      address: venues.address,
      city: venues.city,
      latitude: venues.latitude,
      longitude: venues.longitude,
    })
    .from(venues)
    .where(and(eq(venues.id, values.venueId), getVenueScope(viewer)));
  if (!venue) return { ok: false, error: "not-found" };

  const zones = await tx
    .select({ id: venueZones.id, kind: venueZones.kind, capacity: venueZones.capacity })
    .from(venueZones)
    .where(eq(venueZones.venueId, venue.id))
    .for("share");
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

  // Zona inexistente o ajena (p. ej. borrada desde otra pestana) => not-found.
  const used = new Set<string>();
  for (const tier of values.tiers.filter((item) => !isBlankTier(item))) {
    const zone = zoneById.get(tier.zoneId);
    if (!zone) return { ok: false, error: "not-found" };
    if (used.has(zone.id)) return { ok: false, error: "unknown" };
    used.add(zone.id);
  }

  // Conteo despues del lock y en la misma transaccion: una edicion estructural concurrente ya confirmo o espera.
  const numberedIds = [...used].filter((id) => zoneById.get(id)?.kind === "numbered");
  const counts = new Map<string, number>();
  if (numberedIds.length > 0) {
    const rows = await tx
      .select({ zoneId: venueSeats.venueZoneId, count: sql<number>`count(*)::int` })
      .from(venueSeats)
      .where(inArray(venueSeats.venueZoneId, numberedIds))
      .groupBy(venueSeats.venueZoneId);
    for (const row of rows) counts.set(row.zoneId, row.count);
  }

  for (const tier of values.tiers.filter((item) => !isBlankTier(item))) {
    const zone = zoneById.get(tier.zoneId)!;
    if (zone.kind === "numbered") {
      const seatCount = counts.get(zone.id) ?? 0;
      if (seatCount < 1) return { ok: false, error: "unknown" };
      numberedStock.set(zone.id, seatCount);
    } else {
      const quantity = Number(tier.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > (zone.capacity ?? 0)) {
        return { ok: false, error: "unknown" };
      }
    }
  }
  return { ok: true, venue, numberedStock };
}

function toVenueDbInput(values: EventFormValues, resolution: Extract<VenueResolution, { ok: true }>): EventDbInput {
  const input = toEventDbInput(values, undefined, resolution.venue);
  return {
    ...input,
    tiers: input.tiers.map((tier) => ({
      ...tier,
      totalStock: (tier.venueZoneId && resolution.numberedStock.get(tier.venueZoneId)) || tier.totalStock,
    })),
  };
}

async function findFreeSlug(tx: Tx, base: string): Promise<string> {
  // base solo contiene [a-z0-9-]: sin comodines de LIKE que escapar.
  const rows = await tx.select({ slug: events.slug }).from(events).where(like(events.slug, `${base}%`));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function createEvent(
  input: SaveEventInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true; eventId: string } | { ok: false; error: SaveEventError }> {
  const base = slugify(input.values.name.trim());

  try {
    return await db.transaction(async (tx): Promise<{ ok: true; eventId: string } | { ok: false; error: SaveEventError }> => {
      // Serializa creaciones con el mismo titulo; el UNIQUE de slug queda como red de seguridad.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${base}))`);
      const slug = await findFreeSlug(tx, base);

      const resolution = await resolveVenue(tx, input.values, viewer);
      if (!resolution.ok) return resolution;
      const { event, tiers } = toVenueDbInput(input.values, resolution);

      const [created] = await tx
        .insert(events)
        .values({
          ...event,
          slug,
          organizerId: viewer.id,
          status: input.intent === "publish" ? "published" : "draft",
        })
        .returning({ id: events.id });

      if (tiers.length > 0) {
        await tx
          .insert(ticketTiers)
          .values(withOrderedCreatedAt(tiers).map((tier) => ({ ...tier, eventId: created.id })));
      }
      return { ok: true, eventId: created.id };
    });
  } catch (error) {
    // ponytail: colision de slug con otra transaccion pese al lock; reintento automatico si aparece.
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) return { ok: false, error: "unknown" };
    throw error;
  }
}

export async function updateEvent(
  eventId: string,
  input: SaveEventInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: SaveEventError }> {
  const scope = getEventScope(viewer);
  const { event: draftEvent, tiers: draftTiers } = toEventDbInput(input.values);

  try {
    return await db.transaction(async (tx): Promise<{ ok: true } | { ok: false; error: SaveEventError }> => {
      const [row] = await tx
        .select({
          slug: events.slug,
          status: events.status,
          startsAt: events.startsAt,
          venueId: events.venueId,
        })
        .from(events)
        .where(and(eq(events.id, eventId), scope, ne(events.status, "cancelled")));
      if (!row) return { ok: false, error: "not-found" };

      // Published nunca vuelve a borrador desde el form.
      if (row.status === "published" && input.intent === "draft") {
        return { ok: false, error: "invalid-transition" };
      }

      // Mismo lock que checkout (033): sin carrera con una compra en curso. Antes de leer ordenes.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${row.slug}))`);

      if (input.intent === "publish") {
        const startsAtChanged = draftEvent.startsAt.getTime() !== row.startsAt.getTime();
        if (row.status === "draft") {
          const error = getEventStatusChangeError(
            { status: "draft", startsAt: draftEvent.startsAt, tierCount: draftTiers.length },
            "published",
          );
          if (error) return { ok: false, error };
        } else if (startsAtChanged && draftEvent.startsAt.getTime() <= Date.now()) {
          // Un published ya realizado se edita sin tocar la fecha (D3).
          return { ok: false, error: "past-date" };
        }
      }

      const hasOrders = await eventHasOrders(tx, row.slug);
      let currentTiers: { id: string; name: string; price: string; totalStock: number }[] = [];
      if (hasOrders) {
        currentTiers = await tx
          .select({
            id: ticketTiers.id,
            name: ticketTiers.name,
            price: ticketTiers.price,
            totalStock: ticketTiers.totalStock,
            venueZoneId: ticketTiers.venueZoneId,
          })
          .from(ticketTiers)
          .where(eq(ticketTiers.eventId, eventId));
        if (hasTiersChanged(currentTiers, input.values.tiers, {
            current: row.venueId,
            next: input.values.venueId,
          })) {
          return { ok: false, error: "tiers-locked" };
        }
      }

      // Con ordenes el recinto/zonas no cambian (hasTiersChanged); igual se revalida el alcance y se refresca el snapshot.
      const resolution = await resolveVenue(tx, input.values, viewer);
      if (!resolution.ok) return resolution;
      const { event, tiers } = toVenueDbInput(input.values, resolution);

      // slug, organizerId y flags (featured/trending/best seller) no se tocan.
      const updated = await tx
        .update(events)
        .set({
          ...event,
          status: input.intent === "publish" ? "published" : "draft",
          updatedAt: new Date(),
        })
        .where(and(eq(events.id, eventId), ne(events.status, "cancelled")))
        .returning({ id: events.id });
      if (updated.length === 0) return { ok: false, error: "not-found" };

      if (!hasOrders) {
        await tx.delete(ticketTiers).where(eq(ticketTiers.eventId, eventId));
        if (tiers.length > 0) {
          await tx
            .insert(ticketTiers)
            .values(withOrderedCreatedAt(tiers).map((tier) => ({ ...tier, eventId })));
        }
      }
      return { ok: true };
    });
  } catch (error) {
    // order_items.ticket_tier_id es restrict: si ya hay referencias, los tipos no se pueden reemplazar.
    if (pgErrorCode(error) === PG_FK_VIOLATION) return { ok: false, error: "tiers-locked" };
    throw error;
  }
}

export async function getEventForEdit(
  eventId: string,
  viewer: EventAdminViewer,
): Promise<EventForEdit | null> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), getEventScope(viewer), ne(events.status, "cancelled")));
  if (!row) return null;

  const tierRows = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, eventId))
    .orderBy(asc(ticketTiers.createdAt));

  return {
    status: row.status,
    hasOrders: await eventHasOrders(db, row.slug),
    values: {
      name: row.title,
      category: row.category,
      description: row.description,
      ...toEventFormDateTime(row.startsAt),
      venue: row.venueName,
      city: row.city,
      imageUrl: row.imageUrl,
      venueId: row.venueId ?? "",
      tiers: tierRows.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: String(Number(tier.price)),
        quantity: String(tier.totalStock),
        zoneId: tier.venueZoneId ?? "",
      })),
    },
  };
}
