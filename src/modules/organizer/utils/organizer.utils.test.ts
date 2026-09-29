import { describe, expect, it } from "vitest";

import { ORGANIZER_EVENTS_MOCK } from "../mocks/organizer.mock";
import type { OrganizerEvent } from "../types/organizer.types";
import {
  filterOrganizerEvents,
  getEventCapacity,
  getEventPriceFrom,
  getEventRevenue,
  getEventSold,
  getOrganizerEvents,
  getOrganizerKpis,
  toEventIsoDate,
} from "./organizer.utils";

const [viveLatino, , , draft] = ORGANIZER_EVENTS_MOCK;

describe("event amounts", () => {
  it("computes capacity, sold and revenue", () => {
    expect(getEventCapacity(viveLatino.tiers)).toBe(8000);
    expect(getEventSold(viveLatino)).toBe(7420);
    expect(getEventRevenue(viveLatino)).toBe(5700 * 180 + 1720 * 350);
    expect(getEventCapacity([{ price: 10, quantity: Number.NaN }])).toBe(0);
  });

  it("returns the lowest positive price", () => {
    expect(getEventPriceFrom([{ price: 0 }, { price: 120 }, { price: 80 }])).toBe(80);
    expect(getEventPriceFrom([{ price: 0 }, { price: Number.NaN }])).toBeNull();
  });
});

describe("getOrganizerKpis", () => {
  it("adds up the demo events", () => {
    expect(getOrganizerKpis(ORGANIZER_EVENTS_MOCK)).toEqual({
      sold: 7420 + 312 + 414,
      revenue: ORGANIZER_EVENTS_MOCK.reduce((total, event) => total + getEventRevenue(event), 0),
      published: 3,
    });
  });
});

describe("getOrganizerEvents", () => {
  const own: OrganizerEvent = {
    ...draft,
    id: "evt-1",
    ownerEmail: "maria@example.com",
    updatedAt: "2026-09-29T10:00:00-05:00",
  };
  const replacedDemo: OrganizerEvent = {
    ...draft,
    ownerEmail: "maria@example.com",
    name: "Feria editada",
    updatedAt: "2026-09-28T10:00:00-05:00",
  };
  const other: OrganizerEvent = { ...own, id: "evt-2", ownerEmail: "otro@example.com" };

  it("merges the user events with the demo events by id", () => {
    const events = getOrganizerEvents(
      [own, replacedDemo, other],
      ORGANIZER_EVENTS_MOCK,
      "MARIA@example.com",
    );
    expect(events.map((event) => event.id)).toEqual([
      "evt-1",
      "demo-feria-familiar",
      "demo-vive-latino-peru",
      "demo-romeo-y-julieta",
      "demo-disney-on-ice",
    ]);
    expect(events[1].name).toBe("Feria editada");
  });

  it("does not show other users events", () => {
    const events = getOrganizerEvents([other], ORGANIZER_EVENTS_MOCK, "maria@example.com");
    expect(events).toHaveLength(ORGANIZER_EVENTS_MOCK.length);
  });
});

describe("filterOrganizerEvents", () => {
  it("filters by status", () => {
    expect(filterOrganizerEvents(ORGANIZER_EVENTS_MOCK, "all")).toHaveLength(4);
    expect(filterOrganizerEvents(ORGANIZER_EVENTS_MOCK, "published")).toHaveLength(3);
    expect(filterOrganizerEvents(ORGANIZER_EVENTS_MOCK, "draft")).toEqual([draft]);
  });
});

describe("toEventIsoDate", () => {
  it("builds a Lima ISO date", () => {
    expect(toEventIsoDate("2026-11-14", "21:00")).toBe("2026-11-14T21:00:00-05:00");
    expect(toEventIsoDate("2026-11-14", "")).toBe("2026-11-14T00:00:00-05:00");
    expect(toEventIsoDate("", "21:00")).toBeNull();
  });
});
