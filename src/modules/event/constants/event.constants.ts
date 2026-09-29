import {
  Clapperboard,
  Drama,
  FerrisWheel,
  MicVocal,
  Music,
  Palette,
  PartyPopper,
  Presentation,
  Tent,
  Trophy,
} from "lucide-react";

import type {
  EventAvailability,
  EventCategoryOption,
  EventFilters,
  EventPriceRange,
} from "../types/event.types";

export const EVENT_CATEGORIES: readonly EventCategoryOption[] = [
  {
    id: "concerts",
    label: "Conciertos",
    icon: Music,
    bgClassName: "bg-[#EDE9FE]",
    textClassName: "text-[#7C3AED]",
    labelClassName: "text-[#7C3AED]",
  },
  {
    id: "sports",
    label: "Deportes",
    icon: Trophy,
    bgClassName: "bg-[#D1FAE5]",
    textClassName: "text-[#059669]",
    labelClassName: "text-[#047857]",
  },
  {
    id: "theater",
    label: "Teatro",
    icon: Drama,
    bgClassName: "bg-[#FEE2E2]",
    textClassName: "text-[#DC2626]",
    labelClassName: "text-[#DC2626]",
  },
  {
    id: "festivals",
    label: "Festivales",
    icon: PartyPopper,
    bgClassName: "bg-[#FFEDD5]",
    textClassName: "text-[#EA580C]",
    labelClassName: "text-[#C2410C]",
  },
  {
    id: "family",
    label: "Familiar",
    icon: FerrisWheel,
    bgClassName: "bg-[#DBEAFE]",
    textClassName: "text-[#2563EB]",
    labelClassName: "text-[#2563EB]",
  },
  {
    id: "standup",
    label: "Standup",
    icon: MicVocal,
    bgClassName: "bg-[#FEF9C3]",
    textClassName: "text-[#CA8A04]",
    labelClassName: "text-[#A16207]",
  },
  {
    id: "cinema",
    label: "Cine",
    icon: Clapperboard,
    bgClassName: "bg-[#E0E7FF]",
    textClassName: "text-[#4F46E5]",
    labelClassName: "text-[#4F46E5]",
  },
  {
    id: "arts",
    label: "Arte y cultura",
    icon: Palette,
    bgClassName: "bg-[#FCE7F3]",
    textClassName: "text-[#DB2777]",
    labelClassName: "text-[#DB2777]",
  },
  {
    id: "fairs",
    label: "Ferias y exposiciones",
    icon: Tent,
    bgClassName: "bg-[#CCFBF1]",
    textClassName: "text-[#0D9488]",
    labelClassName: "text-[#0F766E]",
  },
  {
    id: "conferences",
    label: "Conferencias",
    icon: Presentation,
    bgClassName: "bg-[#CFFAFE]",
    textClassName: "text-[#0891B2]",
    labelClassName: "text-[#0E7490]",
  },
];

export const EVENT_AVAILABILITY_LABEL: Record<EventAvailability, string> = {
  available: "Disponible",
  "few-left": "Ultimas entradas",
  "sold-out": "Agotado",
};

export const EVENT_LOCALE = "es-PE";
export const EVENT_CURRENCY = "PEN";

export const EVENT_PRICE_RANGE: EventPriceRange = [0, 500];
export const EVENT_PRICE_STEP = 10;

export const EVENT_FILTERS_DEFAULT: EventFilters = {
  query: "",
  category: "all",
  dateRange: undefined,
  priceRange: EVENT_PRICE_RANGE,
};
