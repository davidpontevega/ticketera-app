import "server-only";
import { and, asc, eq, inArray, like, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orders } from "@/modules/order/db/order.table";

import type {
  EventForEdit,
  SaveEventError,
  SaveEventInput,
} from "../types/event-write.types";
import { hasTiersChanged, slugify, toEventDbInput, toEventFormDateTime } from "../utils/event-write.utils";
import { getEventStatusChangeError } from "../utils/organizer.utils";
import { getEventScope, type EventAdminViewer } from "./organizer-event-admin.service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "select">;

const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";

// postgres-js lanza con `code`; Drizzle puede envolverlo en `cause`.
function pgErrorCode(error: unknown): string | undefined {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

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
  const { event, tiers } = toEventDbInput(input.values);
  const base = slugify(event.title);

  try {
    const eventId = await db.transaction(async (tx) => {
      // Serializa creaciones con el mismo titulo; el UNIQUE de slug queda como red de seguridad.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${base}))`);
      const slug = await findFreeSlug(tx, base);

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
      return created.id;
    });
    return { ok: true, eventId };
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
  const { event, tiers } = toEventDbInput(input.values);

  try {
    return await db.transaction(async (tx): Promise<{ ok: true } | { ok: false; error: SaveEventError }> => {
      const [row] = await tx
        .select({ slug: events.slug, status: events.status, startsAt: events.startsAt })
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
        const startsAtChanged = event.startsAt.getTime() !== row.startsAt.getTime();
        if (row.status === "draft") {
          const error = getEventStatusChangeError(
            { status: "draft", startsAt: event.startsAt, tierCount: tiers.length },
            "published",
          );
          if (error) return { ok: false, error };
        } else if (startsAtChanged && event.startsAt.getTime() <= Date.now()) {
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
          })
          .from(ticketTiers)
          .where(eq(ticketTiers.eventId, eventId));
        if (hasTiersChanged(currentTiers, input.values.tiers)) {
          return { ok: false, error: "tiers-locked" };
        }
      }

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
      tiers: tierRows.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: String(Number(tier.price)),
        quantity: String(tier.totalStock),
      })),
    },
  };
}
