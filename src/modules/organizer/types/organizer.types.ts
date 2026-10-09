import type { EventCategory } from "@/modules/event";

export type OrganizerEventStatus = "draft" | "published";
export type OrganizerEventFilter = "all" | OrganizerEventStatus;
export type EventFormMode = "draft" | "publish";

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

export type OrganizerDbEventStatus = "draft" | "published" | "cancelled"; // = events.status

export interface OrganizerEventSummary {
  id: string;
  slug: string;
  title: string;
  status: OrganizerDbEventStatus;
  startsAt: string; // ISO
  city: string;
  imageUrl: string;
  capacity: number;
  sold: number;
  revenue: number; // PEN
  isFeatured: boolean;
}

export type EventStatusChangeError = "invalid-transition" | "past-date" | "no-tiers";

export type EventAdminActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"eventId" | "status" | "featured", string>>;
    };
