import type { EventEntity } from "@/modules/event";

import { SEAT_OCCUPANCY_BY_AVAILABILITY } from "../constants/ticket.constants";
import { VENUE_LAYOUT_BY_CATEGORY, VENUE_TEMPLATES } from "../mocks/venue.mock";
import type {
  Seat,
  TicketLine,
  TicketTotals,
  VenueLayout,
  VenueZoneTemplate,
} from "../types/ticket.types";

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
  rows: number,
  seatsPerRow: number,
  occupancy: number,
): Seat[] {
  const seats: Seat[] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = ROW_LETTERS[rowIndex];
    for (let number = 1; number <= seatsPerRow; number += 1) {
      const id = `${zoneId}-${row}-${number}`;
      const isOccupied = hashString(id) % 100 < occupancy * 100;
      seats.push({ id, row, number, status: isOccupied ? "occupied" : "available" });
    }
  }
  return seats;
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
      ? buildSeats(zone.id, rows, seatsPerRow, SEAT_OCCUPANCY_BY_AVAILABILITY[availability])
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
