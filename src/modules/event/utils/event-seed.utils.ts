import { SEED_GENERAL_ZONE_STOCK } from "@/modules/ticket/constants/ticket.constants";
import { getVenueLayout } from "@/modules/ticket/utils/ticket.utils";

import type { events } from "../db/event.table";
import type { ticketTiers } from "../db/ticket-tier.table";
import type { EventEntity } from "../types/event.types";

// Centro de cada ciudad (placeholder: ninguna pantalla lee estas columnas todavia).
export const CITY_COORDINATES: Record<string, { latitude: string; longitude: string }> = {
  Lima: { latitude: "-12.0463731", longitude: "-77.0427934" },
  Arequipa: { latitude: "-16.3988975", longitude: "-71.5369705" },
  Cusco: { latitude: "-13.5319200", longitude: "-71.9674900" },
  Trujillo: { latitude: "-8.1115942", longitude: "-79.0287602" },
  Chiclayo: { latitude: "-6.7713802", longitude: "-79.8408425" },
  Piura: { latitude: "-5.1944740", longitude: "-80.6327600" },
  Oxapampa: { latitude: "-10.5766700", longitude: "-75.4019300" },
};

export interface EventSeed {
  event: typeof events.$inferInsert;
  tiers: Array<Omit<typeof ticketTiers.$inferInsert, "eventId">>;
}

export function buildEventSeed(event: EventEntity, organizerId: string): EventSeed {
  const coordinates = CITY_COORDINATES[event.city];
  if (!coordinates) {
    throw new Error(`No hay coordenadas registradas para la ciudad "${event.city}"`);
  }

  const tiers = getVenueLayout(event).zones.map((zone) => ({
    name: zone.name,
    price: zone.price.toFixed(2),
    totalStock: zone.seating === "numbered" ? zone.seats.length : SEED_GENERAL_ZONE_STOCK,
    salesStartAt: null,
    salesEndAt: null,
  }));

  return {
    event: {
      slug: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      city: event.city,
      imageUrl: event.imageUrl,
      isFeatured: event.isFeatured,
      isTrending: event.isTrending,
      isBestSeller: event.isBestSeller,
      venueName: event.venue,
      address: event.address,
      startsAt: new Date(event.date),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      status: "published",
      organizerId,
    },
    tiers,
  };
}
