import type { SeatStatus } from "../types/ticket.types";

export const TICKET_MAX_PER_ZONE = 6;

export type SeatLegendStatus = SeatStatus | "selected";

export const SEAT_STATUS_LABEL: Record<SeatLegendStatus, string> = {
  available: "Disponible",
  selected: "Seleccionado",
  occupied: "Ocupado",
};

// Porcentaje de asientos ocupados en una zona numerada segun su disponibilidad.
export const SEAT_OCCUPANCY_BY_AVAILABILITY = {
  available: 0.25,
  "few-left": 0.75,
  "sold-out": 1,
} as const;
