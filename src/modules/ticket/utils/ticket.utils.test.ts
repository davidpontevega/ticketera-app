import { describe, expect, it } from "vitest";

import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";
import type { EventEntity } from "@/modules/event/types/event.types";

import {
  buildSeats,
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

describe("buildSeats", () => {
  it("builds rows x seatsPerRow seats with row letters and ids", () => {
    const seats = buildSeats("zone", 3, 4, 0);
    expect(seats).toHaveLength(12);
    expect(seats[0]).toEqual({ id: "zone-A-1", row: "A", number: 1, status: "available" });
    expect(seats.at(-1)?.id).toBe("zone-C-4");
  });

  it("is deterministic", () => {
    expect(buildSeats("zone", 5, 10, 0.5)).toEqual(buildSeats("zone", 5, 10, 0.5));
  });

  it("marks roughly the given share of seats as occupied", () => {
    const seats = buildSeats("zone", 10, 24, 0.25);
    const occupied = seats.filter((seat) => seat.status === "occupied").length / seats.length;
    expect(occupied).toBeGreaterThan(0.1);
    expect(occupied).toBeLessThan(0.4);
  });

  it("occupies everything with occupancy 1 and nothing with 0", () => {
    expect(buildSeats("zone", 2, 5, 1).every((seat) => seat.status === "occupied")).toBe(true);
    expect(buildSeats("zone", 2, 5, 0).every((seat) => seat.status === "available")).toBe(true);
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
