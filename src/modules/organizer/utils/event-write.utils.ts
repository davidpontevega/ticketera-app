import type { events } from "@/modules/event/db/event.table";
import type { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { CITY_COORDINATES } from "@/modules/event/utils/event-seed.utils";

import type { EventFormTier, EventFormValues } from "../types/organizer.types";
import { toEventIsoDate } from "./organizer.utils";

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, sin horario de verano
const NO_COORDINATES = { latitude: "0", longitude: "0" };

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "evento";
}

export interface EventDbInput {
  event: Omit<typeof events.$inferInsert, "slug" | "organizerId" | "status">;
  tiers: Array<Omit<typeof ticketTiers.$inferInsert, "eventId">>;
}

// Datos del recinto que se copian al evento al guardar (snapshot, spec 043 D8).
export interface VenueSnapshot {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
}

// Filas de tipo vacias (borrador con filas en blanco) no se guardan.
export function isBlankTier(tier: EventFormTier): boolean {
  return !tier.name.trim() && !tier.price.trim() && !tier.quantity.trim();
}

function getVenueCoordinates(venue: VenueSnapshot): { latitude: string; longitude: string } {
  return venue.latitude && venue.longitude
    ? { latitude: venue.latitude, longitude: venue.longitude }
    : (CITY_COORDINATES[venue.city] ?? NO_COORDINATES);
}

// `venue`: recinto ya validado por el servidor; pisa lugar/ciudad/coordenadas del form y fija venueId/zonas.
export function toEventDbInput(
  values: EventFormValues,
  coordinates?: { latitude: string; longitude: string },
  venue?: VenueSnapshot,
): EventDbInput {
  const place = venue
    ? { venueName: venue.name, address: venue.address, city: venue.city }
    : { venueName: values.venue.trim(), address: values.venue.trim(), city: values.city.trim() };
  const coords =
    coordinates ??
    (venue ? getVenueCoordinates(venue) : (CITY_COORDINATES[place.city] ?? NO_COORDINATES));
  return {
    event: {
      title: values.name.trim(),
      description: values.description.trim(),
      category: values.category,
      ...place,
      latitude: coords.latitude,
      longitude: coords.longitude,
      venueId: venue?.id ?? null,
      startsAt: new Date(toEventIsoDate(values.date, values.time) ?? ""),
      imageUrl: values.imageUrl,
    },
    tiers: values.tiers
      .filter((tier) => !isBlankTier(tier))
      .map((tier) => ({
        name: tier.name.trim(),
        price: (Number(tier.price) || 0).toFixed(2),
        totalStock: Math.max(0, Math.trunc(Number(tier.quantity) || 0)),
        venueZoneId: venue ? tier.zoneId : null,
      })),
  };
}

// Inversa de toEventIsoDate: instante -> fecha/hora de pared en Lima.
export function toEventFormDateTime(startsAt: Date): { date: string; time: string } {
  const iso = new Date(startsAt.getTime() - LIMA_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// true si el payload difiere de los tiers actuales (ids, nombre, precio, cantidad, zona) o del recinto.
export function hasTiersChanged(
  current: readonly {
    id: string;
    name: string;
    price: string;
    totalStock: number;
    venueZoneId?: string | null;
  }[],
  next: readonly EventFormTier[],
  venue: { current: string | null; next: string } = { current: null, next: "" },
): boolean {
  if ((venue.current ?? "") !== venue.next) return true;
  if (current.length !== next.length) return true;
  const byId = new Map(current.map((tier) => [tier.id, tier]));
  return next.some((tier) => {
    const saved = byId.get(tier.id);
    return (
      !saved ||
      saved.name !== tier.name.trim() ||
      Number(saved.price) !== Number(tier.price) ||
      saved.totalStock !== Number(tier.quantity) ||
      (saved.venueZoneId ?? "") !== tier.zoneId
    );
  });
}
