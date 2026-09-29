import { describe, expect, it } from "vitest";

import type { OrganizerEvent } from "@/modules/organizer";
import type { TicketLine } from "@/modules/ticket";

import {
  applyOrderToOrganizerEvent,
  findOrganizerEventBySlug,
  getOrganizerVenueLayout,
  getPublishedCatalogEvents,
  slugify,
  toCatalogEvent,
} from "./catalog.utils";

function makeEvent(overrides: Partial<OrganizerEvent> = {}): OrganizerEvent {
  return {
    id: "evt-mf3k2abc12",
    status: "published",
    ownerEmail: "ana@test.pe",
    catalogSlug: null,
    name: "Festival de Verano ¡2026!",
    category: "festivals",
    description: "Un festival.",
    date: "2026-12-20",
    time: "20:00",
    venue: "Parque de la Exposicion",
    city: "Lima",
    imageUrl: "data:image/png;base64,AAAA",
    tiers: [
      { id: "tier-a", name: "General", price: 80, quantity: 100, sold: 0 },
      { id: "tier-b", name: "VIP", price: 200, quantity: 10, sold: 0 },
    ],
    updatedAt: "2026-09-29T10:00:00-05:00",
    ...overrides,
  };
}

function makeLine(zoneId: string, quantity: number): TicketLine {
  return { zoneId, zoneName: zoneId, quantity, unitPrice: 0, amount: 0, seatLabels: [] };
}

describe("slugify", () => {
  it("quita tildes, simbolos y espacios", () => {
    expect(slugify("Festival de Verano ¡2026!")).toBe("festival-de-verano-2026");
    expect(slugify("  Música   en la  Ñusta  ")).toBe("musica-en-la-nusta");
    expect(slugify("¡¿?!")).toBe("");
  });
});

describe("toCatalogEvent", () => {
  it("convierte un evento publicado en EventEntity", () => {
    const event = toCatalogEvent(makeEvent());
    expect(event).toMatchObject({
      id: "org-evt-mf3k2abc12",
      slug: "festival-de-verano-2026-2abc12",
      title: "Festival de Verano ¡2026!",
      date: "2026-12-20T20:00:00-05:00",
      priceFrom: 80,
      availability: "available",
      isFeatured: false,
      isTrending: false,
      isBestSeller: false,
      address: "Parque de la Exposicion",
      minAge: null,
    });
    expect(Date.parse(event.doorsOpen)).toBe(Date.parse("2026-12-20T19:00:00-05:00"));
  });

  it("genera slugs distintos para eventos con el mismo nombre", () => {
    const a = toCatalogEvent(makeEvent({ id: "evt-aaaaaa111111" }));
    const b = toCatalogEvent(makeEvent({ id: "evt-aaaaaa222222" }));
    expect(a.slug).not.toBe(b.slug);
  });

  it("calcula la disponibilidad segun las vendidas", () => {
    const fewLeft = makeEvent({
      tiers: [{ id: "t", name: "General", price: 50, quantity: 100, sold: 85 }],
    });
    const soldOut = makeEvent({
      tiers: [{ id: "t", name: "General", price: 50, quantity: 100, sold: 100 }],
    });
    expect(toCatalogEvent(fewLeft).availability).toBe("few-left");
    expect(toCatalogEvent(soldOut).availability).toBe("sold-out");
  });
});

describe("getPublishedCatalogEvents", () => {
  it("solo incluye eventos publicados creados en el panel", () => {
    const events = [
      makeEvent({ id: "evt-published1" }),
      makeEvent({ id: "evt-draft00001", status: "draft" }),
      makeEvent({ id: "demo-bad-bunny", catalogSlug: "bad-bunny-world-tour", ownerEmail: null }),
    ];
    expect(getPublishedCatalogEvents(events).map((event) => event.id)).toEqual([
      "org-evt-published1",
    ]);
  });

  it("encuentra un evento del organizador por su slug", () => {
    const event = makeEvent();
    const { slug } = toCatalogEvent(event);
    expect(findOrganizerEventBySlug([event], slug)).toBe(event);
    expect(findOrganizerEventBySlug([event], "otro-slug")).toBeUndefined();
  });
});

describe("getOrganizerVenueLayout", () => {
  it("arma una zona general por tipo de entrada con la capacidad restante", () => {
    const layout = getOrganizerVenueLayout(
      makeEvent({
        tiers: [
          { id: "tier-a", name: "General", price: 80, quantity: 100, sold: 40 },
          { id: "tier-b", name: "VIP", price: 200, quantity: 10, sold: 10 },
        ],
      }),
    );
    expect(layout.id).toBe("general-admission");
    expect(layout.zones).toHaveLength(2);
    expect(layout.zones[0]).toMatchObject({
      id: "tier-a",
      name: "General",
      price: 80,
      seating: "general",
      remaining: 60,
      availability: "available",
      seats: [],
    });
    expect(layout.zones[0].shape.kind).toBe("rect");
    expect(layout.zones[1]).toMatchObject({ remaining: 0, availability: "sold-out" });
    // el tipo mas caro lleva el tono mas oscuro
    expect(layout.zones[1].fillColor).toBe("#4338CA");
  });
});

describe("applyOrderToOrganizerEvent", () => {
  it("suma lo comprado a cada tipo sin pasar la capacidad", () => {
    const updated = applyOrderToOrganizerEvent(
      makeEvent({
        tiers: [
          { id: "tier-a", name: "General", price: 80, quantity: 100, sold: 10 },
          { id: "tier-b", name: "VIP", price: 200, quantity: 10, sold: 9 },
        ],
      }),
      [makeLine("tier-a", 3), makeLine("tier-b", 4), makeLine("otra-zona", 2)],
    );
    expect(updated.tiers.map((tier) => tier.sold)).toEqual([13, 10]);
  });
});
