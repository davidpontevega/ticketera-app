import type { EventEntity } from "@/modules/event";

import { SEAT_OCCUPANCY_BY_AVAILABILITY } from "../constants/ticket.constants";
import { VENUE_LAYOUT_BY_CATEGORY, VENUE_TEMPLATES } from "../mocks/venue.mock";
import type {
  Seat,
  TicketLine,
  TicketTotals,
  VenueLayout,
  VenueZone,
  VenueZoneTemplate,
  ZoneShape,
} from "../types/ticket.types";
import { layoutSeats } from "./venue-geometry";

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// FNV-1a: hash deterministico para que los asientos ocupados sean los mismos
// en servidor y cliente (sin hydration mismatch) y en los tests.
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function buildSeats(
  zoneId: string,
  shape: ZoneShape,
  rows: number,
  seatsPerRow: number,
  occupancy: number,
): Seat[] {
  return layoutSeats(shape, rows, seatsPerRow).map((position) => {
    const row = ROW_LETTERS[position.row];
    const id = `${zoneId}-${row}-${position.number}`;
    const isOccupied = hashString(id) % 100 < occupancy * 100;
    return {
      id,
      row,
      number: position.number,
      status: isOccupied ? "occupied" : "available",
      x: position.x,
      y: position.y,
      rotation: position.rotation,
    };
  });
}

export function getAvailableSeatCount(zone: VenueZone): number {
  return zone.seats.filter((seat) => seat.status === "available").length;
}

// "Mejores asientos": la fila mas cercana al escenario/campo (A primero) que tenga `quantity`
// asientos contiguos disponibles; dentro de la fila, el bloque mas centrado. [] si no hay.
export function findBestSeats(zone: VenueZone, quantity: number): string[] {
  if (quantity < 1) return [];
  const rows = new Map<string, Seat[]>();
  for (const seat of zone.seats) rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);

  for (const seats of rows.values()) {
    const ordered = [...seats].sort((a, b) => a.number - b.number);
    const rowCenter = (ordered[0].number + ordered[ordered.length - 1].number) / 2;
    let best: Seat[] | null = null;
    for (let start = 0; start + quantity <= ordered.length; start += 1) {
      const block = ordered.slice(start, start + quantity);
      const isContiguous = block.every(
        (seat, index) => index === 0 || seat.number === block[index - 1].number + 1,
      );
      if (!isContiguous || block.some((seat) => seat.status !== "available")) continue;
      const blockCenter = (block[0].number + block[block.length - 1].number) / 2;
      const bestCenter = best ? (best[0].number + best[best.length - 1].number) / 2 : Infinity;
      if (Math.abs(blockCenter - rowCenter) < Math.abs(bestCenter - rowCenter)) best = block;
    }
    if (best) return best.map((seat) => seat.id);
  }
  return [];
}

function getZonePrice(priceFrom: number, priceFactor: number): number {
  if (priceFactor === 1) return priceFrom;
  return Math.round((priceFrom * priceFactor) / 10) * 10;
}

function buildZone(template: VenueZoneTemplate, event: EventEntity) {
  const { priceFactor, rows = 0, seatsPerRow = 0, ...zone } = template;
  const availability = event.availability === "sold-out" ? "sold-out" : zone.availability;
  const seats =
    zone.seating === "numbered"
      ? buildSeats(
          zone.id,
          zone.shape,
          rows,
          seatsPerRow,
          SEAT_OCCUPANCY_BY_AVAILABILITY[availability],
        )
      : [];
  return { ...zone, availability, price: getZonePrice(event.priceFrom, priceFactor), seats };
}

export function getVenueLayout(event: EventEntity): VenueLayout {
  const { zones, ...template } = VENUE_TEMPLATES[VENUE_LAYOUT_BY_CATEGORY[event.category]];
  return { ...template, zones: zones.map((zone) => buildZone(zone, event)) };
}

function compareSeats(a: Seat, b: Seat): number {
  return a.row.localeCompare(b.row) || a.number - b.number;
}

export function getTicketLines(
  layout: VenueLayout,
  quantities: Readonly<Record<string, number>>,
  seatIds: Readonly<Record<string, readonly string[]>>,
): TicketLine[] {
  return layout.zones.flatMap((zone) => {
    const selectedIds = new Set(seatIds[zone.id] ?? []);
    const seats = zone.seats.filter((seat) => selectedIds.has(seat.id)).sort(compareSeats);
    const quantity = zone.seating === "numbered" ? seats.length : (quantities[zone.id] ?? 0);
    if (quantity === 0) return [];
    return [
      {
        zoneId: zone.id,
        zoneName: zone.name,
        quantity,
        unitPrice: zone.price,
        amount: quantity * zone.price,
        seatLabels: seats.map((seat) => `${seat.row}${seat.number}`),
      },
    ];
  });
}

export function getTicketTotals(lines: readonly TicketLine[]): TicketTotals {
  return lines.reduce(
    (totals, line) => ({
      quantity: totals.quantity + line.quantity,
      amount: totals.amount + line.amount,
    }),
    { quantity: 0, amount: 0 },
  );
}

export function formatTicketCount(quantity: number): string {
  return quantity === 1 ? "1 entrada" : `${quantity} entradas`;
}
