import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";
import type { EventEntity } from "@/modules/event/types/event.types";

import type { VenueZone, ZoneShape } from "../types/ticket.types";
import {
  applyAvailability,
  deriveEventAvailability,
  getZoneCapacity,
  buildSeats,
  findBestSeats,
  getAvailableSeatCount,
  formatTicketCount,
  getTicketLines,
  getTicketTotals,
  getVenueLayout,
} from "./ticket.utils";

function getMockEvent(slug: string): EventEntity {
  const event = EVENTS_MOCK.find((item) => item.slug === slug);
  if (!event) throw new Error(`Missing mock event ${slug}`);
  return event;
}

const badBunny = getMockEvent("bad-bunny-world-tour");
const RECT: ZoneShape = { kind: "rect", x: 0, y: 0, width: 100, height: 100 };

describe("buildSeats", () => {
  it("builds rows x seatsPerRow seats with row letters and ids", () => {
    const seats = buildSeats("zone", RECT, 3, 4, 0);
    expect(seats).toHaveLength(12);
    expect(seats[0]).toMatchObject({ id: "zone-A-1", row: "A", number: 1, status: "available" });
    expect(Number.isFinite(seats[0].x) && Number.isFinite(seats[0].y)).toBe(true);
    expect(seats.at(-1)?.id).toBe("zone-C-4");
  });

  it("is deterministic", () => {
    expect(buildSeats("zone", RECT, 5, 10, 0.5)).toEqual(buildSeats("zone", RECT, 5, 10, 0.5));
  });

  it("marks roughly the given share of seats as occupied", () => {
    const seats = buildSeats("zone", RECT, 10, 24, 0.25);
    const occupied = seats.filter((seat) => seat.status === "occupied").length / seats.length;
    expect(occupied).toBeGreaterThan(0.1);
    expect(occupied).toBeLessThan(0.4);
  });

  it("occupies everything with occupancy 1 and nothing with 0", () => {
    expect(buildSeats("zone", RECT, 2, 5, 1).every((seat) => seat.status === "occupied")).toBe(
      true,
    );
    expect(buildSeats("zone", RECT, 2, 5, 0).every((seat) => seat.status === "available")).toBe(
      true,
    );
  });
});

describe("getVenueLayout", () => {
  it("uses the stadium template with the design prices for Bad Bunny", () => {
    const layout = getVenueLayout(badBunny);
    expect(layout.id).toBe("stadium");
    expect(Object.fromEntries(layout.zones.map((zone) => [zone.id, zone.price]))).toEqual({
      vip: 690,
      general: 450,
      occidente: 380,
      oriente: 320,
      norte: 250,
    });
  });

  it("generates seats only for numbered zones", () => {
    const layout = getVenueLayout(badBunny);
    for (const zone of layout.zones) {
      expect(zone.seats.length > 0).toBe(zone.seating === "numbered");
    }
  });

  it("picks the template by category", () => {
    expect(getVenueLayout(getMockEvent("el-fantasma-de-la-opera")).id).toBe("theater");
    expect(getVenueLayout(getMockEvent("feria-internacional-del-libro")).id).toBe(
      "general-admission",
    );
  });

  it("keeps priceFrom exact for the cheapest zone", () => {
    const layout = getVenueLayout(getMockEvent("feria-internacional-del-libro"));
    expect(layout.zones[0].price).toBe(15);
  });

  it("marks every zone as sold out when the event is sold out", () => {
    const layout = getVenueLayout(getMockEvent("romeo-y-julieta"));
    expect(layout.zones.every((zone) => zone.availability === "sold-out")).toBe(true);
    const numbered = layout.zones.filter((zone) => zone.seating === "numbered");
    expect(numbered.every((zone) => zone.seats.every((seat) => seat.status === "occupied"))).toBe(
      true,
    );
  });
});

describe("getTicketLines", () => {
  const layout = getVenueLayout(badBunny);

  it("returns lines in layout order and skips empty zones", () => {
    const lines = getTicketLines(
      layout,
      { norte: 1, general: 2, vip: 0 },
      { occidente: ["occidente-C-13", "occidente-A-2", "occidente-C-12"] },
    );
    expect(lines.map((line) => line.zoneId)).toEqual(["general", "occidente", "norte"]);
    expect(lines[0]).toEqual({
      zoneId: "general",
      zoneName: "Campo General",
      quantity: 2,
      unitPrice: 450,
      amount: 900,
      seatLabels: [],
    });
    expect(lines[1].quantity).toBe(3);
    expect(lines[1].amount).toBe(1140);
    expect(lines[1].seatLabels).toEqual(["A2", "C12", "C13"]);
  });

  it("returns an empty array without selection", () => {
    expect(getTicketLines(layout, {}, {})).toEqual([]);
  });
});

describe("getTicketTotals", () => {
  it("sums quantities and amounts", () => {
    const layout = getVenueLayout(badBunny);
    const lines = getTicketLines(layout, { general: 2, norte: 1 }, {});
    expect(getTicketTotals(lines)).toEqual({ quantity: 3, amount: 1150 });
  });

  it("returns zeros for no lines", () => {
    expect(getTicketTotals([])).toEqual({ quantity: 0, amount: 0 });
  });
});

describe("formatTicketCount", () => {
  it("pluralizes", () => {
    expect(formatTicketCount(1)).toBe("1 entrada");
    expect(formatTicketCount(0)).toBe("0 entradas");
    expect(formatTicketCount(3)).toBe("3 entradas");
  });
});

function zoneWith(statuses: Record<string, ("available" | "occupied")[]>): VenueZone {
  const seats = Object.entries(statuses).flatMap(([row, rowStatuses]) =>
    rowStatuses.map((status, index) => ({
      id: `z-${row}-${index + 1}`,
      row,
      number: index + 1,
      status,
      x: 0,
      y: 0,
      rotation: 0,
    })),
  );
  return { ...getVenueLayout(badBunny).zones[2], id: "z", seats };
}

const A = "available" as const;
const O = "occupied" as const;

describe("findBestSeats", () => {
  it("picks contiguous centered seats in the closest row", () => {
    const zone = zoneWith({ A: [A, A, A, A, A, A, A], B: [A, A, A, A, A, A, A] });
    expect(findBestSeats(zone, 3)).toEqual(["z-A-3", "z-A-4", "z-A-5"]);
  });

  it("skips occupied seats and rows without a contiguous block", () => {
    const zone = zoneWith({ A: [A, O, A, O, A], B: [O, A, A, O, O] });
    expect(findBestSeats(zone, 2)).toEqual(["z-B-2", "z-B-3"]);
    expect(findBestSeats(zone, 1)).toEqual(["z-A-3"]);
  });

  it("returns [] when there is no block", () => {
    expect(findBestSeats(zoneWith({ A: [A, O, A] }), 2)).toEqual([]);
    expect(findBestSeats(zoneWith({ A: [A] }), 0)).toEqual([]);
  });
});

describe("getAvailableSeatCount", () => {
  it("counts available seats", () => {
    expect(getAvailableSeatCount(zoneWith({ A: [A, O, A], B: [O] }))).toBe(2);
  });
});

describe("getZoneCapacity / applyAvailability", () => {
  const layout = getVenueLayout(badBunny);
  const numbered = layout.zones.find((zone) => zone.seating === "numbered")!;
  const general = layout.zones.find((zone) => zone.seating === "general")!;
  const empty = { seats: {}, sold: {} };

  it("capacity: numbered = seats, general = 500", () => {
    expect(getZoneCapacity(numbered)).toBe(numbered.seats.length);
    expect(getZoneCapacity(general)).toBe(500);
  });

  it("marks taken seat occupied by label without mutating", () => {
    const seat = numbered.seats.find((item) => item.status === "available")!;
    const next = applyAvailability(layout, {
      seats: { [numbered.id]: [`${seat.row}${seat.number}`] },
      sold: {},
    });
    const zone = next.zones.find((item) => item.id === numbered.id)!;
    expect(zone.seats.find((item) => item.id === seat.id)?.status).toBe("occupied");
    expect(numbered.seats.find((item) => item.id === seat.id)?.status).toBe("available");
  });

  it("general zone: remaining = capacity - sold, clamps and sold-out at 0", () => {
    const some = applyAvailability(layout, { seats: {}, sold: { [general.id]: 120 } });
    expect(some.zones.find((z) => z.id === general.id)?.remaining).toBe(380);
    const full = applyAvailability(layout, { seats: {}, sold: { [general.id]: 900 } });
    const zone = full.zones.find((z) => z.id === general.id)!;
    expect(zone.remaining).toBe(0);
    expect(zone.availability).toBe("sold-out");
  });

  it("empty snapshot leaves layout equal", () => {
    expect(applyAvailability(layout, empty)).toEqual(layout);
  });
});

describe("getZoneCapacity with capacity and deriveEventAvailability", () => {
  const base = getVenueLayout(badBunny);
  const general = (capacity: number | undefined, remaining?: number): VenueZone => ({
    ...base.zones[0],
    seating: "general",
    seats: [],
    capacity,
    remaining,
  });

  it("prefers zone.capacity over the default rule", () => {
    expect(getZoneCapacity(general(42))).toBe(42);
    expect(getZoneCapacity(general(undefined))).toBe(500);
  });

  it("derives sold-out, few-left (threshold) and available", () => {
    const layout = (remaining: number) => ({ ...base, zones: [general(100, remaining)] });
    expect(deriveEventAvailability(layout(0))).toBe("sold-out");
    expect(deriveEventAvailability(layout(20))).toBe("few-left");
    expect(deriveEventAvailability(layout(21))).toBe("available");
  });
});
