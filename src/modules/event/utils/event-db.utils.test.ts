import { describe, expect, it } from "vitest";

import { toEventEntity, type EventRow, type TierRow } from "./event-db.utils";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "rock-fest",
  title: "Rock Fest",
  description: "desc",
  category: "concerts",
  organizerId: null,
  venueName: "Estadio",
  address: "Av. 1",
  latitude: "0",
  longitude: "0",
  city: "Lima",
  startsAt: new Date("2026-11-14T21:00:00.000Z"),
  imageUrl: "https://img/x.jpg",
  isFeatured: true,
  isTrending: false,
  isBestSeller: true,
  status: "published",
  createdAt: new Date(),
  updatedAt: new Date(),
} as EventRow;

const tier = (price: string) => ({ price }) as TierRow;

describe("toEventEntity", () => {
  it("mapea la fila con priceFrom = min, doorsOpen = date - 1h y minAge null", () => {
    const event = toEventEntity(row, [tier("120.00"), tier("45.50"), tier("300.00")]);

    expect(event).toMatchObject({
      id: row.id,
      slug: "rock-fest",
      date: "2026-11-14T21:00:00.000Z",
      venue: "Estadio",
      city: "Lima",
      priceFrom: 45.5,
      availability: "available",
      isFeatured: true,
      isTrending: false,
      isBestSeller: true,
      doorsOpen: "2026-11-14T20:00:00.000Z",
      minAge: null,
    });
  });

  it("priceFrom es 0 sin tiers", () => {
    expect(toEventEntity(row, []).priceFrom).toBe(0);
  });
});
