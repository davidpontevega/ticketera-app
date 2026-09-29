import type { AuthUser } from "@/modules/auth";
import { EVENTS_MOCK, getEventBySlug, type EventEntity } from "@/modules/event";

import type { Order, OrderEventSnapshot } from "../types/order.types";
import { toOrderEventSnapshot } from "../utils/order.utils";

function snapshotOf(slug: string): OrderEventSnapshot {
  const event = getEventBySlug(EVENTS_MOCK, slug) as EventEntity;
  return toOrderEventSnapshot(event);
}

// Evento pasado: no esta en EVENTS_MOCK (el catalogo solo tiene eventos futuros).
const PAST_FESTIVAL: OrderEventSnapshot = {
  id: "past-1",
  slug: "selvamonos-festival-2026",
  title: "Selvamonos Festival 2026",
  category: "festivals",
  date: "2026-05-16T15:00:00-05:00",
  venue: "Villa Rica",
  address: "Carretera Central km 3, Villa Rica, Oxapampa",
  city: "Oxapampa",
  imageUrl:
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
};

// Pedidos de ejemplo para que "Mis entradas" tenga contenido sin comprar antes.
// Se generan para el usuario logueado (titular = su nombre).
export function getDemoOrders(user: AuthUser): Order[] {
  const buyer = {
    fullName: user.fullName,
    email: user.email,
    documentType: "dni" as const,
    documentNumber: "45678912",
    phone: "987654321",
  };
  const base = { accountEmail: user.email, buyer, paymentMethod: "card" as const };

  return [
    {
      ...base,
      number: "TK-24817",
      eventId: "1",
      event: snapshotOf("bad-bunny-world-tour"),
      lines: [
        {
          zoneId: "general",
          zoneName: "Campo General",
          quantity: 2,
          unitPrice: 450,
          amount: 900,
          seatLabels: [],
        },
      ],
      total: 900,
      createdAt: "2026-09-20T15:30:00-05:00",
    },
    {
      ...base,
      number: "TK-24790",
      eventId: "2",
      event: snapshotOf("coldplay-music-of-the-spheres"),
      lines: [
        {
          zoneId: "oriente",
          zoneName: "Tribuna Oriente",
          quantity: 2,
          unitPrice: 410,
          amount: 820,
          seatLabels: ["C12", "C13"],
        },
      ],
      total: 820,
      createdAt: "2026-09-12T11:05:00-05:00",
    },
    {
      ...base,
      number: "TK-23105",
      eventId: PAST_FESTIVAL.id,
      event: PAST_FESTIVAL,
      lines: [
        {
          zoneId: "entrada-general",
          zoneName: "General",
          quantity: 1,
          unitPrice: 200,
          amount: 200,
          seatLabels: [],
        },
      ],
      total: 200,
      createdAt: "2026-03-02T19:40:00-05:00",
    },
  ];
}
