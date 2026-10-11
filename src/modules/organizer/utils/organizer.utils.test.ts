import { describe, expect, it } from "vitest";

import type { OrganizerEventSummary } from "../types/organizer.types";
import {
  filterOrganizerEvents,
  getEventCapacity,
  getEventPriceFrom,
  getEventStatusChangeError,
  getOrganizerKpis,
  toEventIsoDate,
  toOrganizerEventSummaries,
  type OrganizerEventRow,
} from "./organizer.utils";

describe("event amounts", () => {
  it("computes capacity", () => {
    expect(getEventCapacity([{ price: 10, quantity: 5000 }, { price: 20, quantity: 3000 }])).toBe(8000);
    expect(getEventCapacity([{ price: 10, quantity: Number.NaN }])).toBe(0);
  });

  it("returns the lowest positive price", () => {
    expect(getEventPriceFrom([{ price: 0 }, { price: 120 }, { price: 80 }])).toBe(80);
    expect(getEventPriceFrom([{ price: 0 }, { price: Number.NaN }])).toBeNull();
  });
});

describe("toOrganizerEventSummaries", () => {
  const rows: OrganizerEventRow[] = [
    {
      id: "evt-1",
      slug: "vive-latino-peru",
      title: "Vive Latino Peru",
      status: "published",
      startsAt: new Date("2026-11-14T21:00:00-05:00"),
      city: "Lima",
      imageUrl: "https://example.com/vive-latino.jpg",
      capacity: 8000,
      isFeatured: true,
      sold: 3,
      revenue: "535.00",
    },
    {
      id: "evt-2",
      slug: "feria-familiar",
      title: "Feria Familiar",
      status: "draft",
      startsAt: new Date("2026-12-01T10:00:00-05:00"),
      city: "Arequipa",
      imageUrl: "https://example.com/feria.jpg",
      capacity: 500,
      isFeatured: false,
      sold: 0,
      revenue: "0",
    },
  ];

  it("converts revenue text to number and passes sold through", () => {
    const summaries = toOrganizerEventSummaries(rows);
    expect(summaries[0]).toMatchObject({ sold: 3, revenue: 535 });
    expect(summaries[1]).toMatchObject({ sold: 0, revenue: 0 });
    expect(toOrganizerEventSummaries([{ ...rows[1], revenue: "0.00" }])[0].revenue).toBe(0);
  });

  it("keeps order and fields, and serializes startsAt as ISO", () => {
    const summaries = toOrganizerEventSummaries(rows);
    expect(summaries.map((summary) => summary.id)).toEqual(["evt-1", "evt-2"]);
    expect(summaries[0].capacity).toBe(8000);
    expect(summaries[0].startsAt).toBe("2026-11-15T02:00:00.000Z");
    expect(summaries[0].isFeatured).toBe(true);
    expect(summaries[1].isFeatured).toBe(false);
  });
});

describe("getOrganizerKpis", () => {
  const summaries: Pick<OrganizerEventSummary, "sold" | "revenue" | "status">[] = [
    { sold: 100, revenue: 1000, status: "published" },
    { sold: 20, revenue: 200, status: "draft" },
    { sold: 5, revenue: 50, status: "cancelled" },
  ];

  it("adds up sold and revenue across all events", () => {
    expect(getOrganizerKpis(summaries)).toEqual({ sold: 125, revenue: 1250, published: 1 });
  });

  it("rounds revenue to cents to avoid float artifacts", () => {
    expect(
      getOrganizerKpis([
        { sold: 1, revenue: 0.1, status: "published" },
        { sold: 1, revenue: 0.2, status: "published" },
      ]),
    ).toEqual({ sold: 2, revenue: 0.3, published: 2 });
  });

  it("counts published ignoring draft and cancelled", () => {
    expect(
      getOrganizerKpis([
        { sold: 0, revenue: 0, status: "draft" },
        { sold: 0, revenue: 0, status: "cancelled" },
      ]).published,
    ).toBe(0);
  });
});

describe("filterOrganizerEvents", () => {
  it("with summaries, excludes cancelled from published but keeps it in all", () => {
    const summaries: Pick<OrganizerEventSummary, "status">[] = [
      { status: "published" },
      { status: "cancelled" },
      { status: "draft" },
    ];
    expect(filterOrganizerEvents(summaries, "published")).toEqual([{ status: "published" }]);
    expect(filterOrganizerEvents(summaries, "all")).toEqual(summaries);
  });
});

describe("getEventStatusChangeError", () => {
  const now = new Date("2026-01-01T00:00:00-05:00");
  const future = new Date("2026-06-01T00:00:00-05:00");
  const past = new Date("2025-01-01T00:00:00-05:00");

  it("allows draft -> published with a future date and at least one tier", () => {
    expect(
      getEventStatusChangeError({ status: "draft", startsAt: future, tierCount: 1 }, "published", now),
    ).toBeNull();
  });

  it("rejects draft -> published with a past date as past-date", () => {
    expect(
      getEventStatusChangeError({ status: "draft", startsAt: past, tierCount: 1 }, "published", now),
    ).toBe("past-date");
  });

  it("rejects draft -> published without tiers as no-tiers", () => {
    expect(
      getEventStatusChangeError({ status: "draft", startsAt: future, tierCount: 0 }, "published", now),
    ).toBe("no-tiers");
  });

  it("allows published -> draft always", () => {
    expect(
      getEventStatusChangeError({ status: "published", startsAt: past, tierCount: 0 }, "draft", now),
    ).toBeNull();
  });

  it("allows draft or published -> cancelled even with sales", () => {
    expect(
      getEventStatusChangeError({ status: "draft", startsAt: past, tierCount: 0 }, "cancelled", now),
    ).toBeNull();
    expect(
      getEventStatusChangeError({ status: "published", startsAt: future, tierCount: 3 }, "cancelled", now),
    ).toBeNull();
  });

  it("rejects any transition from cancelled as invalid-transition", () => {
    expect(
      getEventStatusChangeError({ status: "cancelled", startsAt: future, tierCount: 1 }, "draft", now),
    ).toBe("invalid-transition");
    expect(
      getEventStatusChangeError({ status: "cancelled", startsAt: future, tierCount: 1 }, "published", now),
    ).toBe("invalid-transition");
    expect(
      getEventStatusChangeError({ status: "cancelled", startsAt: future, tierCount: 1 }, "cancelled", now),
    ).toBe("invalid-transition");
  });

  it("rejects transitions to the same status as invalid-transition", () => {
    expect(
      getEventStatusChangeError({ status: "draft", startsAt: future, tierCount: 1 }, "draft", now),
    ).toBe("invalid-transition");
    expect(
      getEventStatusChangeError({ status: "published", startsAt: future, tierCount: 1 }, "published", now),
    ).toBe("invalid-transition");
  });
});

describe("toEventIsoDate", () => {
  it("builds a Lima ISO date", () => {
    expect(toEventIsoDate("2026-11-14", "21:00")).toBe("2026-11-14T21:00:00-05:00");
    expect(toEventIsoDate("2026-11-14", "")).toBe("2026-11-14T00:00:00-05:00");
    expect(toEventIsoDate("", "21:00")).toBeNull();
  });
});
