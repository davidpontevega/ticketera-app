import type { EventAvailability, EventEntity } from "@/modules/event";
import {
  getEventPriceFrom,
  toEventIsoDate,
  type OrganizerEvent,
  type OrganizerTicketTier,
} from "@/modules/organizer";
import { ZONE_TONES, type TicketLine, type VenueLayout, type VenueZone } from "@/modules/ticket";

const DOORS_OPEN_BEFORE_MS = 60 * 60 * 1000;
const FEW_LEFT_RATIO = 0.2; // quedan <= 20% de las entradas -> "Ultimas entradas"
const SLUG_SUFFIX_LENGTH = 6;

// Recinto de admision general: ingreso arriba y una franja por tipo de entrada.
const VIEWBOX_WIDTH = 1000;
const ZONE_X = 200;
const ZONE_WIDTH = 600;
const ZONE_HEIGHT = 90;
const ZONE_GAP = 20;
const ZONES_TOP = 110;
const SHORT_NAME_MAX_LENGTH = 24;
// Del tipo mas caro al mas barato (mas oscuro = mas caro, como en las plantillas del mock).
const TONES_BY_PRICE = [
  ZONE_TONES.premium,
  ZONE_TONES.high,
  ZONE_TONES.mid,
  ZONE_TONES.low,
  ZONE_TONES.basic,
];

// "Festival de Verano ¡2026!" -> "festival-de-verano-2026"
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSlug(event: OrganizerEvent): string {
  const suffix = event.id
    .replace(/[^a-z0-9]/gi, "")
    .slice(-SLUG_SUFFIX_LENGTH)
    .toLowerCase();
  return `${slugify(event.name) || "evento"}-${suffix}`;
}

function getRemaining(tier: OrganizerTicketTier): number {
  return Math.max(0, tier.quantity - tier.sold);
}

function getAvailability(remaining: number, capacity: number): EventAvailability {
  if (remaining <= 0) return "sold-out";
  return remaining / capacity <= FEW_LEFT_RATIO ? "few-left" : "available";
}

export function toCatalogEvent(event: OrganizerEvent): EventEntity {
  const date = toEventIsoDate(event.date, event.time) ?? "";
  const capacity = event.tiers.reduce((total, tier) => total + tier.quantity, 0);
  const remaining = event.tiers.reduce((total, tier) => total + getRemaining(tier), 0);
  return {
    id: `org-${event.id}`,
    slug: getSlug(event),
    title: event.name,
    category: event.category,
    date,
    venue: event.venue,
    city: event.city,
    priceFrom: getEventPriceFrom(event.tiers) ?? 0,
    imageUrl: event.imageUrl,
    availability: getAvailability(remaining, capacity),
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    description: event.description,
    address: event.venue, // el formulario no pide direccion; la UI ya agrega la ciudad
    doorsOpen: new Date(Date.parse(date) - DOORS_OPEN_BEFORE_MS).toISOString(),
    minAge: null,
  };
}

// Eventos creados en el panel y publicados. Los de ejemplo (catalogSlug) ya estan en EVENTS_MOCK.
export function getPublishedOrganizerEvents(events: readonly OrganizerEvent[]): OrganizerEvent[] {
  return events.filter(
    (event) =>
      event.status === "published" &&
      event.catalogSlug === null &&
      toEventIsoDate(event.date, event.time) !== null,
  );
}

export function getPublishedCatalogEvents(events: readonly OrganizerEvent[]): EventEntity[] {
  return getPublishedOrganizerEvents(events).map(toCatalogEvent);
}

export function findOrganizerEventBySlug(
  events: readonly OrganizerEvent[],
  slug: string,
): OrganizerEvent | undefined {
  return getPublishedOrganizerEvents(events).find((event) => getSlug(event) === slug);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function getOrganizerVenueLayout(event: OrganizerEvent): VenueLayout {
  const priceRank = [...event.tiers].sort((a, b) => b.price - a.price).map((tier) => tier.id);
  const zones: VenueZone[] = event.tiers.map((tier, index) => {
    const remaining = getRemaining(tier);
    const tone = TONES_BY_PRICE[Math.min(priceRank.indexOf(tier.id), TONES_BY_PRICE.length - 1)];
    return {
      id: tier.id,
      name: tier.name,
      shortName: truncate(tier.name, SHORT_NAME_MAX_LENGTH),
      price: tier.price,
      availability: getAvailability(remaining, tier.quantity),
      seating: "general",
      ...tone,
      shape: {
        kind: "rect",
        x: ZONE_X,
        y: ZONES_TOP + index * (ZONE_HEIGHT + ZONE_GAP),
        width: ZONE_WIDTH,
        height: ZONE_HEIGHT,
        radius: 18,
      },
      seats: [],
      remaining,
    };
  });
  return {
    id: "general-admission",
    viewBox: {
      width: VIEWBOX_WIDTH,
      height: ZONES_TOP + event.tiers.length * (ZONE_HEIGHT + ZONE_GAP) + ZONE_GAP,
    },
    stage: {
      label: "Ingreso",
      shape: { kind: "rect", x: 380, y: 30, width: 240, height: 50, radius: 12 },
    },
    zones,
  };
}

// Suma lo comprado a `sold` de cada tipo de entrada (sin pasar la capacidad).
export function applyOrderToOrganizerEvent(
  event: OrganizerEvent,
  lines: readonly TicketLine[],
): OrganizerEvent {
  return {
    ...event,
    tiers: event.tiers.map((tier) => {
      const bought = lines
        .filter((line) => line.zoneId === tier.id)
        .reduce((total, line) => total + line.quantity, 0);
      return { ...tier, sold: Math.min(tier.quantity, tier.sold + bought) };
    }),
  };
}
