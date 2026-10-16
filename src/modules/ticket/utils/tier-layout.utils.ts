import type { EventEntity } from "@/modules/event";

import {
  VENUE_LAYOUT_BY_CATEGORY,
  VENUE_TEMPLATES,
  ZONE_TONES,
} from "../mocks/venue.mock";
import type { VenueLayout, VenueZone } from "../types/ticket.types";
import { buildSeats, getAvailabilityByRatio } from "./ticket.utils";

export interface TierInput {
  id: string;
  name: string;
  price: number;
  totalStock: number;
}

// Recinto de admision general: ingreso arriba y una franja por tipo de entrada.
const VIEWBOX_WIDTH = 1000;
const ZONE_X = 200;
const ZONE_WIDTH = 600;
const ZONE_HEIGHT = 90;
const ZONE_GAP = 20;
const ZONES_TOP = 110;
const SHORT_NAME_MAX_LENGTH = 24;
const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// Del tipo mas caro al mas barato (mas oscuro = mas caro, como en las plantillas del mock).
const TONES_BY_PRICE = [
  ZONE_TONES.premium,
  ZONE_TONES.high,
  ZONE_TONES.mid,
  ZONE_TONES.low,
  ZONE_TONES.basic,
];

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

// Tono por precio: del tipo mas caro al mas barato.
function getToneByPrice(tiers: readonly TierInput[]) {
  const priceRank = [...tiers]
    .sort((a, b) => b.price - a.price)
    .map((tier) => tier.id);
  return (tierId: string) =>
    TONES_BY_PRICE[
      Math.min(priceRank.indexOf(tierId), TONES_BY_PRICE.length - 1)
    ];
}

const GENERAL_STAGE: VenueLayout["stage"] = {
  label: "Ingreso",
  shape: { kind: "rect", x: 380, y: 30, width: 240, height: 50, radius: 12 },
};

function buildGeneralLayout(tiers: readonly TierInput[]): VenueLayout {
  const toneOf = getToneByPrice(tiers);
  const zones: VenueZone[] = tiers.map((tier, index) => ({
    id: tier.id,
    name: tier.name,
    shortName: truncate(tier.name, SHORT_NAME_MAX_LENGTH),
    price: tier.price,
    availability: getAvailabilityByRatio(tier.totalStock, tier.totalStock),
    seating: "general",
    ...toneOf(tier.id),
    shape: {
      kind: "rect",
      x: ZONE_X,
      y: ZONES_TOP + index * (ZONE_HEIGHT + ZONE_GAP),
      width: ZONE_WIDTH,
      height: ZONE_HEIGHT,
      radius: 18,
    },
    seats: [],
    remaining: tier.totalStock,
    capacity: tier.totalStock,
  }));
  return {
    id: "general-admission",
    viewBox: {
      width: VIEWBOX_WIDTH,
      height: ZONES_TOP + tiers.length * (ZONE_HEIGHT + ZONE_GAP) + ZONE_GAP,
    },
    stage: GENERAL_STAGE,
    zones,
  };
}

export interface VenueZoneLayoutInput {
  tier: TierInput;
  kind: "general" | "numbered";
  seats: readonly { rowLabel: string; seatNumber: number }[];
}

const NUMBERED_ROW_HEIGHT = 28;
const NUMBERED_PADDING = 40;

// Layout de un evento con recinto: zonas apiladas (orden del arreglo). zone.id = tier.id para que
// el checkout/inventario (033) no cambie; los asientos salen de venue_seats.
export function buildVenueLayoutFromVenueZones(
  _venueName: string,
  zones: readonly VenueZoneLayoutInput[],
): VenueLayout {
  const toneOf = getToneByPrice(zones.map(({ tier }) => tier));
  let y = ZONES_TOP;
  const layoutZones = zones.map(({ tier, kind, seats: venueSeats }): VenueZone => {
    const isNumbered = kind === "numbered";
    const rows = isNumbered
      ? Math.max(0, ...venueSeats.map((s) => ROW_LETTERS.indexOf(s.rowLabel) + 1))
      : 0;
    const seatsPerRow = Math.max(0, ...venueSeats.map((s) => s.seatNumber));
    const height = isNumbered
      ? Math.max(ZONE_HEIGHT, rows * NUMBERED_ROW_HEIGHT + NUMBERED_PADDING)
      : ZONE_HEIGHT;
    const shape = {
      kind: "rect" as const,
      x: ZONE_X,
      y,
      width: ZONE_WIDTH,
      height,
      radius: 18,
    };
    y += height + ZONE_GAP;
    const base = {
      id: tier.id,
      name: tier.name,
      shortName: truncate(tier.name, SHORT_NAME_MAX_LENGTH),
      price: tier.price,
      ...toneOf(tier.id),
      shape,
    };
    if (!isNumbered) {
      return {
        ...base,
        availability: getAvailabilityByRatio(tier.totalStock, tier.totalStock),
        seating: "general",
        seats: [],
        remaining: tier.totalStock,
        capacity: tier.totalStock,
      };
    }
    const existing = new Set(venueSeats.map((s) => `${s.rowLabel}-${s.seatNumber}`));
    const seats = buildSeats(tier.id, shape, rows, seatsPerRow, 0).filter((seat) =>
      existing.has(`${seat.row}-${seat.number}`),
    );
    return {
      ...base,
      availability: getAvailabilityByRatio(seats.length, seats.length),
      seating: "numbered",
      seats,
      capacity: seats.length,
    };
  });
  return {
    id: "general-admission",
    viewBox: { width: VIEWBOX_WIDTH, height: y + ZONE_GAP },
    stage: GENERAL_STAGE,
    zones: layoutZones,
  };
}

// Plantilla de la categoria si los tiers son exactamente sus zonas (caso del seed); si no, admision general.
export function buildVenueLayoutFromTiers(
  event: EventEntity,
  tiers: readonly TierInput[],
): VenueLayout {
  const { zones: templateZones, ...template } =
    VENUE_TEMPLATES[VENUE_LAYOUT_BY_CATEGORY[event.category]];
  const matches = templateZones.flatMap((zone) => {
    const tier = tiers.find((item) => item.name === zone.name);
    return tier ? [{ zone, tier }] : [];
  });
  const seatsByZone = new Map(
    matches.map(({ zone }) => [
      zone.id,
      zone.seating === "numbered"
        ? buildSeats(
            zone.id,
            zone.shape,
            zone.rows ?? 0,
            zone.seatsPerRow ?? 0,
            0,
          )
        : [],
    ]),
  );
  const isTemplate =
    tiers.length > 0 &&
    matches.length === tiers.length &&
    matches.every(
      ({ zone, tier }) =>
        zone.seating !== "numbered" ||
        seatsByZone.get(zone.id)?.length === tier.totalStock,
    );
  if (!isTemplate) return buildGeneralLayout(tiers);

  return {
    ...template,
    zones: matches.map(({ zone, tier }) => {
      /* eslint-disable @typescript-eslint/no-unused-vars -- solo se descartan campos de plantilla */
      const {
        priceFactor: _priceFactor,
        rows: _rows,
        seatsPerRow: _seatsPerRow,
        ...rest
      } = zone;
      /* eslint-enable @typescript-eslint/no-unused-vars */
      const seats = seatsByZone.get(zone.id) ?? [];
      return {
        ...rest,
        price: tier.price,
        availability: tier.totalStock > 0 ? "available" : "sold-out",
        seats,
        capacity: tier.totalStock,
        ...(zone.seating === "general" ? { remaining: tier.totalStock } : {}),
      };
    }),
  };
}
