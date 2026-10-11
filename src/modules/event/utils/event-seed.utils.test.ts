import { describe, expect, it } from "vitest";

import { SEED_GENERAL_ZONE_STOCK } from "@/modules/ticket/constants/ticket.constants";
import { getVenueLayout } from "@/modules/ticket/utils/ticket.utils";

import { EVENTS_MOCK } from "../mocks/event.mock";
import type { EventEntity } from "../types/event.types";
import { buildEventSeed, CITY_COORDINATES } from "./event-seed.utils";

const ORGANIZER_ID = "11111111-1111-1111-1111-111111111111";

describe("buildEventSeed", () => {
  it("mapea todos los EVENTS_MOCK sin lanzar", () => {
    for (const event of EVENTS_MOCK) {
      expect(() => buildEventSeed(event, ORGANIZER_ID)).not.toThrow();
    }
  });

  it.each(EVENTS_MOCK)("mapea $slug con los campos directos y status published", (event) => {
    const seed = buildEventSeed(event, ORGANIZER_ID);

    expect(seed.event.slug).toBe(event.slug);
    expect(seed.event.title).toBe(event.title);
    expect(seed.event.isFeatured).toBe(event.isFeatured);
    expect(seed.event.isTrending).toBe(event.isTrending);
    expect(seed.event.isBestSeller).toBe(event.isBestSeller);
    expect(seed.event.status).toBe("published");
    expect(seed.event.organizerId).toBe(ORGANIZER_ID);
    expect((seed.event.startsAt as Date).getTime()).toBe(new Date(event.date).getTime());
  });

  it.each(EVENTS_MOCK)("el tier mas barato de $slug coincide con priceFrom", (event) => {
    const seed = buildEventSeed(event, ORGANIZER_ID);
    const cheapest = Math.min(...seed.tiers.map((tier) => Number(tier.price)));
    expect(cheapest).toBe(event.priceFrom);
  });

  it.each(EVENTS_MOCK)("los tiers de $slug coinciden con las zonas de getVenueLayout", (event) => {
    const seed = buildEventSeed(event, ORGANIZER_ID);
    const zones = getVenueLayout(event).zones;

    expect(seed.tiers).toHaveLength(zones.length);
    zones.forEach((zone, index) => {
      const tier = seed.tiers[index];
      expect(tier.name).toBe(zone.name);
      expect(tier.price).toBe(zone.price.toFixed(2));
      expect(Number(tier.totalStock)).toBeGreaterThan(0);
    });
  });

  it("Bad Bunny - World Tour (estadio) tiene 5 tiers", () => {
    const event = EVENTS_MOCK.find((item) => item.slug === "bad-bunny-world-tour");
    expect(event).toBeDefined();
    const seed = buildEventSeed(event as EventEntity, ORGANIZER_ID);
    expect(seed.tiers).toHaveLength(5);
  });

  it("un evento de admision general tiene 1 tier con SEED_GENERAL_ZONE_STOCK", () => {
    const event = EVENTS_MOCK.find((item) => item.slug === "expo-arte-contemporaneo");
    expect(event).toBeDefined();
    const seed = buildEventSeed(event as EventEntity, ORGANIZER_ID);
    expect(seed.tiers).toHaveLength(1);
    expect(seed.tiers[0].totalStock).toBe(SEED_GENERAL_ZONE_STOCK);
  });

  it("lanza un error que nombra la ciudad si no esta en CITY_COORDINATES", () => {
    const event: EventEntity = {
      ...EVENTS_MOCK[0],
      city: "Ciudad Inventada",
    };
    expect(() => buildEventSeed(event, ORGANIZER_ID)).toThrow(/Ciudad Inventada/);
  });

  it("CITY_COORDINATES cubre las 7 ciudades del mock", () => {
    const cities = new Set(EVENTS_MOCK.map((event) => event.city));
    for (const city of cities) {
      expect(CITY_COORDINATES[city]).toBeDefined();
    }
  });
});
