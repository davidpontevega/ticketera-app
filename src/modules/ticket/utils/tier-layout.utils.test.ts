import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { getVenueLayout, getZoneCapacity } from "./ticket.utils";
import { buildVenueLayoutFromTiers } from "./tier-layout.utils";

const event = EVENTS_MOCK[0];

function seededTiers() {
  return getVenueLayout(event).zones.map((zone) => ({
    id: `uuid-${zone.id}`,
    name: zone.name,
    price: zone.price,
    totalStock: zone.seating === "numbered" ? zone.seats.length : 500,
  }));
}

describe("buildVenueLayoutFromTiers", () => {
  it("uses the category template with original zone ids when tiers match", () => {
    const tiers = seededTiers();
    const layout = buildVenueLayoutFromTiers(event, tiers);
    const template = getVenueLayout(event);
    expect(layout.id).toBe(template.id);
    expect(layout.zones.map((zone) => zone.id)).toEqual(template.zones.map((zone) => zone.id));
    layout.zones.forEach((zone, index) => {
      expect(zone.price).toBe(tiers[index].price);
      expect(zone.capacity).toBe(tiers[index].totalStock);
      expect(getZoneCapacity(zone)).toBe(tiers[index].totalStock);
      expect(zone.seats.every((seat) => seat.status === "available")).toBe(true);
    });
  });

  it("falls back to general admission with one zone per tier when names differ", () => {
    const tiers = [
      { id: "a", name: "VIP", price: 300, totalStock: 10 },
      { id: "b", name: "General", price: 50, totalStock: 100 },
    ];
    const layout = buildVenueLayoutFromTiers(event, tiers);
    expect(layout.id).toBe("general-admission");
    expect(layout.zones.map((zone) => zone.id)).toEqual(["a", "b"]);
    expect(layout.zones[0]).toMatchObject({ seating: "general", remaining: 10, capacity: 10 });
  });

  it("falls back when numbered stock does not match the seat count", () => {
    const numberedEvent = EVENTS_MOCK.find((item) =>
      getVenueLayout(item).zones.some((zone) => zone.seating === "numbered"),
    );
    expect(numberedEvent).toBeDefined();
    const template = getVenueLayout(numberedEvent!);
    // Mismos nombres que la plantilla; solo las zonas numeradas tienen un stock distinto a sus asientos.
    const tiers = template.zones.map((zone) => ({
      id: `uuid-${zone.id}`,
      name: zone.name,
      price: zone.price,
      totalStock: zone.seating === "numbered" ? zone.seats.length + 1 : 500,
    }));
    const layout = buildVenueLayoutFromTiers(numberedEvent!, tiers);
    expect(layout.id).toBe("general-admission");
    expect(layout.zones.map((zone) => zone.id)).toEqual(tiers.map((tier) => tier.id));
  });

  it("falls back when a tier is not in the template", () => {
    const tiers = [...seededTiers(), { id: "x", name: "Extra", price: 1, totalStock: 5 }];
    expect(buildVenueLayoutFromTiers(event, tiers).id).toBe("general-admission");
  });
});
