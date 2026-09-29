import type { LucideIcon } from "lucide-react";

export type EventCategory =
  | "concerts"
  | "sports"
  | "theater"
  | "festivals"
  | "family"
  | "standup"
  | "cinema"
  | "arts"
  | "fairs"
  | "conferences";

export type EventAvailability = "available" | "few-left" | "sold-out";

export interface EventEntity {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  date: string; // ISO 8601, ej. "2026-11-14T21:00:00-05:00"
  venue: string; // "Estadio Nacional"
  city: string; // "Lima"
  priceFrom: number; // precio minimo en soles (PEN), en unidades y no en centimos; ej. 45 -> "Desde S/ 45"
  imageUrl: string; // https://images.unsplash.com/...
  availability: EventAvailability;
  isFeatured: boolean; // se muestra en el hero
  isTrending: boolean; // se muestra en la seccion de tendencias
  isBestSeller: boolean; // se muestra en el ranking de mas vendidos
  description: string; // texto de "Acerca del evento"
  address: string; // "Av. Jose Diaz s/n, Cercado de Lima"
  doorsOpen: string; // ISO 8601, apertura de puertas (antes de `date`)
  minAge: number | null; // null = apto para todo publico
}

export type EventCategoryFilter = EventCategory | "all";

export interface EventCategoryOption {
  id: EventCategory;
  label: string; // copy en espanol: "Conciertos", "Deportes", ...
  icon: LucideIcon;
  bgClassName: string; // fondo pastel del chip, ej. "bg-[#EDE9FE]"
  textClassName: string; // color saturado, ej. "text-[#7C3AED]"
  labelClassName: string; // color del label de categoria como texto sobre blanco (contraste >= 4.5:1), ej. "text-[#A16207]"
}

// Compatible estructuralmente con DateRange de react-day-picker (from requerido, puede ser undefined).
// El tipo es propio para que el dominio no dependa de la libreria de UI.
export interface EventDateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export type EventPriceRange = [min: number, max: number];

export type EventSortOption = "date" | "price";
export type EventPriceBucket = "up-to-50" | "50-150" | "150-300" | "over-300";

// Filtros de la pagina /events. Viven en la URL (ver event-search.utils.ts).
export interface EventSearchParams {
  query: string;
  categories: EventCategory[];
  cities: string[];
  month: string | null; // "2026-11"
  price: EventPriceBucket | null;
  sort: EventSortOption;
}

export interface EventFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface EventFilters {
  query: string; // texto libre sobre title/venue/city
  category: EventCategoryFilter; // "all" | EventCategory
  dateRange: EventDateRange | undefined;
  priceRange: EventPriceRange; // inclusivo, sobre priceFrom
}
