import { EVENTS_MOCK, getEventBySlug, type EventEntity } from "@/modules/event";

import type { OrganizerEvent, OrganizerTicketTier } from "../types/organizer.types";

const UPDATED_AT = "2026-09-20T10:00:00-05:00";

function fromCatalog(
  slug: string,
  date: string,
  time: string,
  tiers: OrganizerTicketTier[],
): OrganizerEvent {
  const event = getEventBySlug(EVENTS_MOCK, slug) as EventEntity;
  return {
    id: `demo-${slug}`,
    status: "published",
    ownerEmail: null,
    catalogSlug: slug,
    name: event.title,
    category: event.category,
    description: event.description,
    date,
    time,
    venue: event.venue,
    city: event.city,
    imageUrl: event.imageUrl,
    tiers,
    updatedAt: UPDATED_AT,
  };
}

// Eventos de ejemplo del organizador (como el board): 3 publicados con ventas y 1 borrador.
export const ORGANIZER_EVENTS_MOCK: readonly OrganizerEvent[] = [
  fromCatalog("vive-latino-peru", "2027-03-14", "16:00", [
    { id: "demo-vl-general", name: "General", price: 180, quantity: 6000, sold: 5700 },
    { id: "demo-vl-vip", name: "VIP", price: 350, quantity: 2000, sold: 1720 },
  ]),
  fromCatalog("romeo-y-julieta", "2026-10-18", "19:30", [
    { id: "demo-ryj-galeria", name: "Galeria", price: 60, quantity: 220, sold: 180 },
    { id: "demo-ryj-platea", name: "Platea", price: 130, quantity: 200, sold: 132 },
  ]),
  fromCatalog("disney-on-ice", "2026-12-20", "16:00", [
    { id: "demo-doi-general", name: "General", price: 70, quantity: 900, sold: 330 },
    { id: "demo-doi-preferencial", name: "Preferencial", price: 150, quantity: 300, sold: 84 },
  ]),
  {
    id: "demo-feria-familiar",
    status: "draft",
    ownerEmail: null,
    catalogSlug: null,
    name: "Feria Familiar de Verano",
    category: "family",
    description: "",
    date: "2026-12-01",
    time: "",
    venue: "Parque Selva Alegre",
    city: "Arequipa",
    imageUrl:
      "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?q=80&w=1200&auto=format&fit=crop",
    tiers: [{ id: "demo-ff-general", name: "General", price: 40, quantity: 1500, sold: 0 }],
    updatedAt: UPDATED_AT,
  },
];
