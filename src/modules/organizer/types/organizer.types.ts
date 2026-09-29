import type { EventCategory } from "@/modules/event";

export type OrganizerEventStatus = "draft" | "published";
export type OrganizerEventFilter = "all" | OrganizerEventStatus;
export type EventFormMode = "draft" | "publish";

export interface OrganizerTicketTier {
  id: string;
  name: string;
  price: number; // PEN
  quantity: number;
  sold: number;
}

export interface OrganizerEvent {
  id: string;
  status: OrganizerEventStatus;
  ownerEmail: string | null; // null = evento de ejemplo
  catalogSlug: string | null; // evento de ejemplo que existe en EVENTS_MOCK (pagina publica)
  name: string;
  category: EventCategory;
  description: string;
  date: string; // "YYYY-MM-DD" ("" si falta)
  time: string; // "HH:mm" ("" si falta)
  venue: string;
  city: string;
  imageUrl: string; // data URL (subida) o https (ejemplos)
  tiers: OrganizerTicketTier[];
  updatedAt: string; // ISO
}

// Valores de los inputs (texto): se parsean al guardar.
export interface EventFormTier {
  id: string;
  name: string;
  price: string;
  quantity: string;
}

export interface EventFormValues {
  name: string;
  category: EventCategory;
  description: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  imageUrl: string;
  tiers: EventFormTier[];
}

// Claves: "name", "date", "tiers", "tiers.0.price", ...
export type EventFormErrors = Partial<Record<string, string>>;

export interface OrganizerKpis {
  sold: number;
  revenue: number;
  published: number;
}
