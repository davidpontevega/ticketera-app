import type { EventAvailability } from "@/modules/event";

export type ZoneSeating = "general" | "numbered";
export type SeatStatus = "available" | "occupied";
export type VenueLayoutId = "stadium" | "theater" | "general-admission";

export interface Seat {
  id: string; // "<zoneId>-<row>-<number>", ej. "occidente-C-12"
  row: string; // "A".."J"
  number: number; // 1..seatsPerRow
  status: SeatStatus;
}

// Valores CSS grid, ej. { column: "1", row: "1 / 4" }
export interface ZoneGridArea {
  column: string;
  row: string;
}

export interface VenueZone {
  id: string;
  name: string; // "Tribuna Occidente"
  shortName: string; // "Occidente" (mobile)
  price: number; // PEN, en unidades
  availability: EventAvailability;
  seating: ZoneSeating;
  colorClassName: string; // fondo + texto de la zona en el mapa
  seatClassName: string; // relleno del asiento disponible
  area: ZoneGridArea;
  seats: Seat[]; // [] si seating === "general"
}

interface VenueLayoutBase {
  id: VenueLayoutId;
  stageLabel: string;
  stageArea: ZoneGridArea;
  gridTemplateColumns: string;
  gridTemplateRows: string;
}

export interface VenueLayout extends VenueLayoutBase {
  zones: VenueZone[];
}

// Plantilla mock: la zona tiene un factor sobre event.priceFrom en vez de precio,
// y filas/asientos en vez de la lista de asientos ya generada.
export interface VenueZoneTemplate extends Omit<VenueZone, "price" | "seats"> {
  priceFactor: number;
  rows?: number;
  seatsPerRow?: number;
}

export interface VenueTemplate extends VenueLayoutBase {
  zones: VenueZoneTemplate[];
}

export interface TicketLine {
  zoneId: string;
  zoneName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  seatLabels: string[]; // ["C12", "C13"]; [] en zona general
}

export interface TicketTotals {
  quantity: number;
  amount: number;
}
