import { CalendarDays, LayoutDashboard, Plus, type LucideIcon } from "lucide-react";

import type { OrganizerEventFilter } from "../types/organizer.types";

export const ORGANIZER_PATH = "/organizer";
export const ORGANIZER_NEW_EVENT_PATH = "/organizer/events/new";
export const ORGANIZER_EVENTS_ANCHOR = "my-events";

export interface OrganizerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ORGANIZER_NAV: readonly OrganizerNavItem[] = [
  { href: ORGANIZER_PATH, label: "Resumen", icon: LayoutDashboard },
  {
    href: `${ORGANIZER_PATH}#${ORGANIZER_EVENTS_ANCHOR}`,
    label: "Mis eventos",
    icon: CalendarDays,
  },
  { href: ORGANIZER_NEW_EVENT_PATH, label: "Crear evento", icon: Plus },
];

export const ORGANIZER_EVENT_FILTERS: readonly { value: OrganizerEventFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "published", label: "Publicados" },
  { value: "draft", label: "Borradores" },
];

export const EVENT_COVER_MAX_BYTES = 1024 * 1024; // 1 MB: la imagen se guarda en localStorage
export const EVENT_COVER_TYPES = ["image/jpeg", "image/png"] as const;
