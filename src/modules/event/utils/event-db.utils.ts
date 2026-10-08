import type { events } from "../db/event.table";
import type { ticketTiers } from "../db/ticket-tier.table";
import type { EventEntity } from "../types/event.types";

export type EventRow = typeof events.$inferSelect;
export type TierRow = typeof ticketTiers.$inferSelect;

const DOORS_OPEN_OFFSET_MS = 60 * 60 * 1000;

// `availability` queda en "available": se deriva despues con el layout y las ordenes (catalog.service).
// `doorsOpen`/`minAge`: la DB no tiene esas columnas (spec 035, D4).
export function toEventEntity(row: EventRow, tiers: readonly TierRow[]): EventEntity {
  const date = row.startsAt.toISOString();

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    date,
    venue: row.venueName,
    city: row.city,
    priceFrom: tiers.length > 0 ? Math.min(...tiers.map((tier) => Number(tier.price))) : 0,
    imageUrl: row.imageUrl,
    availability: "available",
    isFeatured: row.isFeatured,
    isTrending: row.isTrending,
    isBestSeller: row.isBestSeller,
    description: row.description,
    address: row.address,
    doorsOpen: new Date(row.startsAt.getTime() - DOORS_OPEN_OFFSET_MS).toISOString(),
    minAge: null,
  };
}
