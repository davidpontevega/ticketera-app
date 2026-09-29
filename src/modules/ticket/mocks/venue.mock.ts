import type { EventCategory } from "@/modules/event";

import type { VenueLayoutId, VenueTemplate } from "../types/ticket.types";

// Tonos por precio (mas oscuro = mas caro) con su color de texto (contraste AA).
export const ZONE_TONES = {
  premium: { fillColor: "#4338CA", labelColor: "#FFFFFF" },
  high: { fillColor: "#4F46E5", labelColor: "#FFFFFF" },
  mid: { fillColor: "#818CF8", labelColor: "#1E1B4B" },
  low: { fillColor: "#A5B4FC", labelColor: "#1E1B4B" },
  basic: { fillColor: "#C7D2FE", labelColor: "#1E1B4B" },
} as const;

// Estadio: escenario arriba, campo al centro y tribunas en arco alrededor del campo.
const STADIUM_CENTER = { cx: 500, cy: 330 };

// Teatro: platea en abanico frente al escenario, palcos a los costados, mezzanine y galeria detras.
const THEATER_CENTER = { cx: 500, cy: 40 };

export const VENUE_TEMPLATES: Record<VenueLayoutId, VenueTemplate> = {
  stadium: {
    id: "stadium",
    viewBox: { width: 1000, height: 720 },
    stage: {
      label: "Escenario",
      shape: { kind: "rect", x: 380, y: 30, width: 240, height: 60, radius: 12 },
    },
    zones: [
      {
        id: "vip",
        name: "Campo VIP",
        shortName: "VIP",
        priceFactor: 2.76,
        availability: "sold-out",
        seating: "general",
        ...ZONE_TONES.premium,
        shape: { kind: "rect", x: 380, y: 115, width: 240, height: 130, radius: 14 },
      },
      {
        id: "general",
        name: "Campo General",
        shortName: "General",
        priceFactor: 1.8,
        availability: "available",
        seating: "general",
        ...ZONE_TONES.high,
        shape: { kind: "rect", x: 330, y: 265, width: 340, height: 220, radius: 18 },
      },
      {
        id: "occidente",
        name: "Tribuna Occidente",
        shortName: "Occidente",
        priceFactor: 1.52,
        availability: "few-left",
        seating: "numbered",
        ...ZONE_TONES.mid,
        shape: {
          kind: "arc",
          ...STADIUM_CENTER,
          innerRadius: 230,
          outerRadius: 360,
          startAngle: 145,
          endAngle: 215,
        },
        rows: 10,
        seatsPerRow: 24,
      },
      {
        id: "oriente",
        name: "Tribuna Oriente",
        shortName: "Oriente",
        priceFactor: 1.28,
        availability: "available",
        seating: "numbered",
        ...ZONE_TONES.low,
        shape: {
          kind: "arc",
          ...STADIUM_CENTER,
          innerRadius: 230,
          outerRadius: 360,
          startAngle: -35,
          endAngle: 35,
        },
        rows: 10,
        seatsPerRow: 24,
      },
      {
        id: "norte",
        name: "Tribuna Norte",
        shortName: "Norte",
        priceFactor: 1,
        availability: "available",
        seating: "general",
        ...ZONE_TONES.basic,
        shape: {
          kind: "arc",
          ...STADIUM_CENTER,
          innerRadius: 230,
          outerRadius: 360,
          startAngle: 55,
          endAngle: 125,
        },
      },
    ],
  },
  theater: {
    id: "theater",
    viewBox: { width: 1000, height: 700 },
    stage: {
      label: "Escenario",
      shape: { kind: "rect", x: 330, y: 20, width: 340, height: 56, radius: 28 },
    },
    zones: [
      {
        id: "platea",
        name: "Platea",
        shortName: "Platea",
        priceFactor: 2.2,
        availability: "available",
        seating: "numbered",
        ...ZONE_TONES.high,
        shape: {
          kind: "arc",
          ...THEATER_CENTER,
          innerRadius: 110,
          outerRadius: 360,
          startAngle: 55,
          endAngle: 125,
        },
        rows: 12,
        seatsPerRow: 20,
      },
      {
        id: "palco-izquierdo",
        name: "Palco Izquierdo",
        shortName: "Palco Izq.",
        priceFactor: 3,
        availability: "few-left",
        seating: "general",
        ...ZONE_TONES.premium,
        shape: {
          kind: "arc",
          ...THEATER_CENTER,
          innerRadius: 150,
          outerRadius: 330,
          startAngle: 130,
          endAngle: 160,
        },
      },
      {
        id: "palco-derecho",
        name: "Palco Derecho",
        shortName: "Palco Der.",
        priceFactor: 3,
        availability: "few-left",
        seating: "general",
        ...ZONE_TONES.premium,
        shape: {
          kind: "arc",
          ...THEATER_CENTER,
          innerRadius: 150,
          outerRadius: 330,
          startAngle: 20,
          endAngle: 50,
        },
      },
      {
        id: "mezzanine",
        name: "Mezzanine",
        shortName: "Mezzanine",
        priceFactor: 1.6,
        availability: "available",
        seating: "numbered",
        ...ZONE_TONES.mid,
        shape: {
          kind: "arc",
          ...THEATER_CENTER,
          innerRadius: 390,
          outerRadius: 500,
          startAngle: 45,
          endAngle: 135,
        },
        rows: 6,
        seatsPerRow: 28,
      },
      {
        id: "galeria",
        name: "Galeria",
        shortName: "Galeria",
        priceFactor: 1,
        availability: "available",
        seating: "general",
        ...ZONE_TONES.basic,
        shape: {
          kind: "arc",
          ...THEATER_CENTER,
          innerRadius: 530,
          outerRadius: 620,
          startAngle: 42,
          endAngle: 138,
        },
      },
    ],
  },
  "general-admission": {
    id: "general-admission",
    viewBox: { width: 1000, height: 520 },
    stage: {
      label: "Ingreso",
      shape: { kind: "rect", x: 380, y: 30, width: 240, height: 50, radius: 12 },
    },
    zones: [
      {
        id: "entrada-general",
        name: "Entrada General",
        shortName: "General",
        priceFactor: 1,
        availability: "available",
        seating: "general",
        ...ZONE_TONES.high,
        shape: { kind: "rect", x: 200, y: 110, width: 600, height: 370, radius: 24 },
      },
    ],
  },
};

export const VENUE_LAYOUT_BY_CATEGORY: Record<EventCategory, VenueLayoutId> = {
  concerts: "stadium",
  sports: "stadium",
  festivals: "stadium",
  theater: "theater",
  standup: "theater",
  cinema: "theater",
  family: "theater",
  conferences: "theater",
  arts: "general-admission",
  fairs: "general-admission",
};
