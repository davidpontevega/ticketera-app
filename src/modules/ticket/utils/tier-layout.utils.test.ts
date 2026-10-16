import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";

import { getVenueLayout, getZoneCapacity } from "./ticket.utils";
import { buildVenueLayoutFromTiers, buildVenueLayoutFromVenueZones } from "./tier-layout.utils";

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

describe("buildVenueLayoutFromVenueZones", () => {
  const grid = (rows: number, perRow: number) =>
    Array.from({ length: rows * perRow }, (_, i) => ({
      rowLabel: "ABCDEFGHIJ"[Math.floor(i / perRow)],
      seatNumber: (i % perRow) + 1,
    }));
  const zones = [
    { tier: { id: "t1", name: "Platea", price: 100, totalStock: 20 }, kind: "numbered" as const, seats: grid(2, 10) },
    { tier: { id: "t2", name: "General", price: 40, totalStock: 300 }, kind: "general" as const, seats: [] },
  ];

  it("uses tier ids as zone ids and builds seats from venue seats", () => {
    const layout = buildVenueLayoutFromVenueZones("Teatro", zones);
    const [numbered, general] = layout.zones;
    expect(layout.zones.map((z) => z.id)).toEqual(["t1", "t2"]);
    expect(numbered).toMatchObject({ seating: "numbered", capacity: 20 });
    expect(numbered.seats).toHaveLength(20);
    expect(numbered.seats[0]).toMatchObject({ id: "t1-A-1", row: "A", number: 1, status: "available" });
    expect(general).toMatchObject({ seating: "general", capacity: 300, remaining: 300, seats: [] });
  });

  it("keeps seats inside the zone rectangle without overlapping", () => {
    const [numbered] = buildVenueLayoutFromVenueZones("Teatro", zones).zones;
    const { x, y, width, height } = numbered.shape as { x: number; y: number; width: number; height: number };
    for (const seat of numbered.seats) {
      expect(seat.x).toBeGreaterThan(x);
      expect(seat.x).toBeLessThan(x + width);
      expect(seat.y).toBeGreaterThan(y);
      expect(seat.y).toBeLessThan(y + height);
    }
    expect(new Set(numbered.seats.map((s) => `${s.x},${s.y}`)).size).toBe(20);
  });

  it("only draws seats that exist and stacks zones", () => {
    const sparse = [{ ...zones[0], seats: grid(2, 10).filter((s) => s.seatNumber !== 3) }, zones[1]];
    const layout = buildVenueLayoutFromVenueZones("Teatro", sparse);
    expect(layout.zones[0].seats).toHaveLength(18);
    expect(layout.zones[0].capacity).toBe(18);
    const first = layout.zones[0].shape as { y: number; height: number };
    expect((layout.zones[1].shape as { y: number }).y).toBeGreaterThan(first.y + first.height);
    expect(layout.viewBox.height).toBeGreaterThan((layout.zones[1].shape as { y: number }).y);
  });

  it("is deterministic", () => {
    expect(buildVenueLayoutFromVenueZones("T", zones)).toEqual(buildVenueLayoutFromVenueZones("T", zones));
  });
});
