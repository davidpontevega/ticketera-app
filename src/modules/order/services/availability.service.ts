import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
// Ruta directa: el barrel de event no expone el servicio con `db`.
import { publishedEventExists } from "@/modules/event/services/event.service";
import type { EventAvailabilitySnapshot, TicketLine } from "@/modules/ticket";

import { RESERVATION_WINDOW_SECONDS } from "../constants/order.constants";
import { orders } from "../db/order.table";

// Acepta `db` o el `tx` de db.transaction (checkout lo usa dentro del advisory lock).
export type AvailabilityExecutor = Pick<typeof db, "select">;

export function aggregateTaken(rows: readonly { lines: readonly TicketLine[] }[]): EventAvailabilitySnapshot {
  const snapshot: EventAvailabilitySnapshot = { seats: {}, sold: {} };
  for (const { lines } of rows) {
    for (const line of lines) {
      snapshot.sold[line.zoneId] = (snapshot.sold[line.zoneId] ?? 0) + line.quantity;
      if (line.seatLabels.length > 0) {
        (snapshot.seats[line.zoneId] ??= []).push(...line.seatLabels);
      }
    }
  }
  return snapshot;
}

// Cuenta: paid, o pending dentro de la ventana de reserva (TTL perezoso, sin cron).
// El tiempo se compara en SQL: orders.created_at es `timestamp` sin zona con default de la DB.
// Una sola consulta para varios eventos; los slugs sin ordenes que cuentan no aparecen en el resultado.
export async function getTakenInventoryBySlugs(
  executor: AvailabilityExecutor,
  slugs: readonly string[],
): Promise<Record<string, EventAvailabilitySnapshot>> {
  if (slugs.length === 0) return {};
  const rows = await executor
    .select({ eventSlug: orders.eventSlug, lines: orders.lines })
    .from(orders)
    .where(
      and(
        inArray(orders.eventSlug, [...slugs]),
        or(
          eq(orders.status, "paid"),
          and(
            eq(orders.status, "pending"),
            sql`${orders.createdAt} > now() - make_interval(secs => ${RESERVATION_WINDOW_SECONDS})`,
          ),
        ),
      ),
    );
  const bySlug = new Map<string, { lines: readonly TicketLine[] }[]>();
  for (const row of rows) bySlug.set(row.eventSlug, [...(bySlug.get(row.eventSlug) ?? []), row]);
  return Object.fromEntries([...bySlug].map(([slug, group]) => [slug, aggregateTaken(group)]));
}

export async function getTakenInventory(
  executor: AvailabilityExecutor,
  eventSlug: string,
): Promise<EventAvailabilitySnapshot> {
  const bySlug = await getTakenInventoryBySlugs(executor, [eventSlug]);
  return bySlug[eventSlug] ?? aggregateTaken([]);
}

// null si el slug no existe o no esta publicado.
export async function getEventAvailability(slug: string): Promise<EventAvailabilitySnapshot | null> {
  if (!(await publishedEventExists(slug))) return null;
  return getTakenInventory(db, slug);
}
