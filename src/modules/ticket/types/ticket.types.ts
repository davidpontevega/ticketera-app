import type { EventAvailability } from "@/modules/event";

export type ZoneSeating = "general" | "numbered";
export type SeatStatus = "available" | "occupied";
export type VenueLayoutId = "stadium" | "theater" | "general-admission";

export interface Seat {
  id: string; // "<zoneId>-<row>-<number>", ej. "occidente-C-12"
  row: string; // "A".."J" (A = la fila mas cercana al escenario/campo)
  number: number; // 1..seatsPerRow
  status: SeatStatus;
  x: number; // centro del asiento en el viewBox del recinto
  y: number;
  rotation: number; // grados, orientado hacia el centro del arco
}

// Formas de zona en el viewBox del recinto. Angulos en grados: 0° = derecha, 90° = abajo.
export type ZoneShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius?: number }
  | {
      kind: "arc";
      cx: number;
      cy: number;
      innerRadius: number;
      outerRadius: number;
      startAngle: number;
      endAngle: number;
    };

export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VenueZone {
  id: string;
  name: string; // "Tribuna Occidente"
  shortName: string; // "Occidente" (etiqueta corta en el mapa)
  price: number; // PEN, en unidades
  availability: EventAvailability;
  seating: ZoneSeating;
  shape: ZoneShape;
  fillColor: string; // color de la zona (SVG fill y swatches)
  labelColor: string; // texto sobre fillColor (contraste AA)
  seats: Seat[]; // [] si seating === "general"
  remaining?: number; // entradas que quedan en una zona general con cupo (eventos del organizador)
}

interface VenueLayoutBase {
  id: VenueLayoutId;
  viewBox: { width: number; height: number };
  stage: { label: string; shape: ZoneShape };
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
