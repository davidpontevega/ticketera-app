import "server-only";
import { cache } from "react";

import { db } from "@/lib/db";
import { getPublishedEvent, listPublishedEvents } from "@/modules/event/services/event.service";
import type { PublishedEvent } from "@/modules/event/services/event.service";
import { getTakenInventoryBySlugs } from "@/modules/order/services/availability.service";
import { applyAvailability, deriveEventAvailability } from "@/modules/ticket";
import type { EventAvailabilitySnapshot } from "@/modules/ticket";

const EMPTY_SNAPSHOT: EventAvailabilitySnapshot = { seats: {}, sold: {} };

// Suma la ocupacion real (orders paid/pending en ventana) al layout y deriva `event.availability`.
function withAvailability({ event, layout }: PublishedEvent, taken: EventAvailabilitySnapshot): PublishedEvent {
  const live = applyAvailability(layout, taken);
  return { event: { ...event, availability: deriveEventAvailability(live) }, layout: live };
}

// Una sola consulta a `orders` para todo el listado (sin N+1).
export async function listCatalogEvents(): Promise<PublishedEvent[]> {
  const published = await listPublishedEvents();
  if (published.length === 0) return [];
  const taken = await getTakenInventoryBySlugs(
    db,
    published.map(({ event }) => event.slug),
  );
  return published.map((item) => withAvailability(item, taken[item.event.slug] ?? EMPTY_SNAPSHOT));
}

// cache(): deduplica generateMetadata + page dentro del mismo request.
export const getCatalogEvent = cache(async (slug: string): Promise<PublishedEvent | null> => {
  const published = await getPublishedEvent(slug);
  if (!published) return null;
  const taken = await getTakenInventoryBySlugs(db, [slug]);
  return withAvailability(published, taken[slug] ?? EMPTY_SNAPSHOT);
});
