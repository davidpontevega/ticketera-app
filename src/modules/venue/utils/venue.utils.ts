import type { VenueZoneKind } from "../types/venue.types";

export const MAX_ROWS = 26;
export const MAX_SEATS_PER_ROW = 40;
export const MAX_GENERAL_CAPACITY = 100_000;
export const MAX_ZONES_PER_VENUE = 20;

type SeatCoord = { rowLabel: string; seatNumber: number };

export function rowLabelAt(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ROWS) {
    throw new RangeError(`Indice de fila fuera de rango: ${index}`);
  }
  return String.fromCharCode(65 + index);
}

export function generateSeatGrid(rows: number, seatsPerRow: number): SeatCoord[] {
  const seats: SeatCoord[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowLabel = rowLabelAt(row);
    for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber += 1) {
      seats.push({ rowLabel, seatNumber });
    }
  }
  return seats;
}

export function summarizeZone(zone: {
  kind: VenueZoneKind;
  capacity: number | null;
  seatCount: number;
}): number {
  return zone.kind === "general" ? (zone.capacity ?? 0) : zone.seatCount;
}

export function getZoneDimensions(seats: readonly SeatCoord[]): { rows: number; seatsPerRow: number } {
  const rows = new Set<string>();
  let seatsPerRow = 0;
  for (const seat of seats) {
    rows.add(seat.rowLabel);
    seatsPerRow = Math.max(seatsPerRow, seat.seatNumber);
  }
  return { rows: rows.size, seatsPerRow };
}
