import { describe, expect, it } from "vitest";

import { EVENT_CATEGORIES, EVENT_FILTERS_DEFAULT } from "../constants/event.constants";
import { EVENTS_MOCK } from "../mocks/event.mock";
import type { EventEntity, EventFilters } from "../types/event.types";
import {
  filterEvents,
  filterEventsByCategory,
  formatDateRangeLabel,
  formatEventDate,
  formatEventDateBadge,
  formatEventLongDate,
  formatEventMinAge,
  formatEventTime,
  formatEventPrice,
  getBestSellerEvents,
  getEventBySlug,
  getEventCategoryOption,
  getEventHref,
  getEventMapsUrl,
  getFeaturedEvents,
  getRelatedEvents,
  getTrendingEvents,
} from "./event.utils";

describe("filterEventsByCategory", () => {
  it("returns all events for 'all'", () => {
    expect(filterEventsByCategory(EVENTS_MOCK, "all")).toHaveLength(EVENTS_MOCK.length);
  });

  it("returns only events of the given category", () => {
    const result = filterEventsByCategory(EVENTS_MOCK, "concerts");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((event) => event.category === "concerts")).toBe(true);
  });

  it("returns an empty array for a category with no events", () => {
    const noResultsMock = EVENTS_MOCK.filter((event) => event.category !== "family");
    expect(filterEventsByCategory(noResultsMock, "family")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...EVENTS_MOCK];
    const snapshot = [...input];
    filterEventsByCategory(input, "sports");
    expect(input).toEqual(snapshot);
  });
});

describe("getFeaturedEvents", () => {
  it("returns only featured events", () => {
    const result = getFeaturedEvents(EVENTS_MOCK);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((event) => event.isFeatured)).toBe(true);
  });
});

describe("getTrendingEvents", () => {
  it("returns only trending events", () => {
    const result = getTrendingEvents(EVENTS_MOCK);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((event) => event.isTrending)).toBe(true);
  });

  it("returns an empty array when no event is trending", () => {
    const noTrendingMock = EVENTS_MOCK.map((event) => ({ ...event, isTrending: false }));
    expect(getTrendingEvents(noTrendingMock)).toEqual([]);
  });
});

describe("getBestSellerEvents", () => {
  it("returns only best-seller events", () => {
    const result = getBestSellerEvents(EVENTS_MOCK);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((event) => event.isBestSeller)).toBe(true);
  });

  it("returns an empty array when no event is a best seller", () => {
    const noBestSellerMock = EVENTS_MOCK.map((event) => ({ ...event, isBestSeller: false }));
    expect(getBestSellerEvents(noBestSellerMock)).toEqual([]);
  });
});

describe("formatEventPrice", () => {
  it("formats a whole number as PEN currency without decimals", () => {
    const result = formatEventPrice(45);
    expect(result).toContain("S/");
    expect(result).toContain("45");
    expect(result).not.toContain(".00");
  });
});

describe("formatEventDate", () => {
  it("includes the day and month", () => {
    const result = formatEventDate("2026-11-14T21:00:00-05:00");
    expect(result).toMatch(/\d{2}/);
    expect(result.toLowerCase()).toMatch(/nov/);
  });

  it("uses Lima time regardless of the runtime timezone", () => {
    // 21:00 en Lima = 02:00 UTC del dia siguiente
    const result = formatEventDate("2026-11-14T21:00:00-05:00");
    expect(result).toMatch(/14/);
    expect(result).toMatch(/09:00|21:00/);
  });
});

describe("formatEventLongDate", () => {
  it("formats weekday, day and month in Lima time", () => {
    expect(formatEventLongDate("2026-11-14T21:00:00-05:00")).toBe("sábado, 14 de noviembre");
    expect(formatEventLongDate("2026-11-14T23:30:00-05:00")).toBe("sábado, 14 de noviembre");
  });
});

describe("formatEventTime", () => {
  it("formats a 24h time in Lima time", () => {
    expect(formatEventTime("2026-11-14T21:00:00-05:00")).toBe("21:00");
    expect(formatEventTime("2026-11-14T09:05:00-05:00")).toBe("09:05");
  });
});

describe("formatEventMinAge", () => {
  it("returns an age label or 'Todo publico'", () => {
    expect(formatEventMinAge(18)).toBe("+18 años");
    expect(formatEventMinAge(null)).toBe("Todo publico");
  });
});

describe("getRelatedEvents", () => {
  const badBunny = getEventBySlug(EVENTS_MOCK, "bad-bunny-world-tour")!;

  it("puts events of the same category first and excludes the current event", () => {
    const result = getRelatedEvents(EVENTS_MOCK, badBunny);
    expect(result).toHaveLength(4);
    expect(result.some((event) => event.id === badBunny.id)).toBe(false);
    expect(result[0].category).toBe("concerts");
    expect(result.slice(1).every((event) => event.category !== "concerts")).toBe(true);
  });

  it("respects the limit and does not mutate the input", () => {
    const input = [...EVENTS_MOCK];
    const snapshot = [...input];
    expect(getRelatedEvents(input, badBunny, 2)).toHaveLength(2);
    expect(input).toEqual(snapshot);
  });
});

describe("getEventMapsUrl", () => {
  it("builds an encoded Google Maps search url", () => {
    const badBunny = getEventBySlug(EVENTS_MOCK, "bad-bunny-world-tour")!;
    const url = getEventMapsUrl(badBunny);
    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(decodeURIComponent(url.split("query=")[1])).toBe(
      "Estadio Nacional, Av. Jose Diaz s/n, Cercado de Lima, Lima",
    );
  });
});

function isoAtMidday(year: number, month: number, day: number): string {
  return new Date(year, month, day, 12).toISOString();
}

describe("formatEventDateBadge", () => {
  it("returns the day and a short lowercase month with no trailing dot", () => {
    const result = formatEventDateBadge("2026-11-14T21:00:00-05:00");
    expect(result.day).toBe("14");
    expect(result.month).toMatch(/^nov/);
    expect(result.month.endsWith(".")).toBe(false);
  });
});

const filterFixtureEvents: EventEntity[] = [
  {
    id: "f1",
    slug: "el-fantasma-de-la-opera-fixture",
    title: "El Fantasma de la Ópera",
    category: "concerts",
    date: isoAtMidday(2026, 10, 14), // 14 nov
    venue: "Teatro Nacional",
    city: "Lima",
    priceFrom: 100,
    imageUrl: "https://images.unsplash.com/photo-1?q=80&w=1200&auto=format&fit=crop",
    availability: "available",
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    description: "",
    address: "",
    doorsOpen: "2026-01-01T00:00:00-05:00",
    minAge: null,
  },
  {
    id: "f2",
    slug: "final-de-futbol-fixture",
    title: "Final de Futbol",
    category: "sports",
    date: isoAtMidday(2026, 10, 20), // 20 nov
    venue: "Estadio Monumental",
    city: "Arequipa",
    priceFrom: 200,
    imageUrl: "https://images.unsplash.com/photo-2?q=80&w=1200&auto=format&fit=crop",
    availability: "available",
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    description: "",
    address: "",
    doorsOpen: "2026-01-01T00:00:00-05:00",
    minAge: null,
  },
  {
    id: "f3",
    slug: "teatro-clasico-fixture",
    title: "Teatro Clasico",
    category: "theater",
    date: isoAtMidday(2026, 10, 25), // 25 nov, fuera de rango
    venue: "Teatro Municipal",
    city: "Cusco",
    priceFrom: 50,
    imageUrl: "https://images.unsplash.com/photo-3?q=80&w=1200&auto=format&fit=crop",
    availability: "available",
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    description: "",
    address: "",
    doorsOpen: "2026-01-01T00:00:00-05:00",
    minAge: null,
  },
];

describe("filterEvents", () => {
  it("returns all events for EVENT_FILTERS_DEFAULT and does not mutate the input", () => {
    const input = [...EVENTS_MOCK];
    const snapshot = [...input];
    const result = filterEvents(input, EVENT_FILTERS_DEFAULT);
    expect(result).toHaveLength(EVENTS_MOCK.length);
    expect(input).toEqual(snapshot);
  });

  it("query matches title, venue and city, ignoring case, accents and surrounding spaces", () => {
    const base: EventFilters = { ...EVENT_FILTERS_DEFAULT };

    expect(
      filterEvents(filterFixtureEvents, { ...base, query: "  ÓPERA  " }).map((e) => e.id),
    ).toEqual(["f1"]);
    expect(
      filterEvents(filterFixtureEvents, { ...base, query: "teatro nacional" }).map((e) => e.id),
    ).toEqual(["f1"]);
    expect(
      filterEvents(filterFixtureEvents, { ...base, query: "arequipa" }).map((e) => e.id),
    ).toEqual(["f2"]);
  });

  it("dateRange includes the from day and the to day, inclusive", () => {
    const base: EventFilters = { ...EVENT_FILTERS_DEFAULT };
    const from = new Date(2026, 10, 14);
    const to = new Date(2026, 10, 20);

    const result = filterEvents(filterFixtureEvents, { ...base, dateRange: { from, to } });
    expect(result.map((e) => e.id).sort()).toEqual(["f1", "f2"]);
  });

  it("dateRange with only from filters to that single day", () => {
    const base: EventFilters = { ...EVENT_FILTERS_DEFAULT };
    const from = new Date(2026, 10, 14);

    const result = filterEvents(filterFixtureEvents, { ...base, dateRange: { from } });
    expect(result.map((e) => e.id)).toEqual(["f1"]);
  });

  it("dateRange with from undefined does not filter", () => {
    const base: EventFilters = { ...EVENT_FILTERS_DEFAULT };

    const result = filterEvents(filterFixtureEvents, {
      ...base,
      dateRange: { from: undefined },
    });
    expect(result).toHaveLength(filterFixtureEvents.length);
  });

  it("priceRange is inclusive on both extremes", () => {
    const base: EventFilters = { ...EVENT_FILTERS_DEFAULT };

    expect(
      filterEvents(filterFixtureEvents, { ...base, priceRange: [100, 100] }).map((e) => e.id),
    ).toEqual(["f1"]);
    expect(
      filterEvents(filterFixtureEvents, { ...base, priceRange: [50, 200] }).map((e) => e.id),
    ).toHaveLength(3);
  });

  it("combines category, query and priceRange with AND", () => {
    const result = filterEvents(filterFixtureEvents, {
      query: "final",
      category: "sports",
      dateRange: undefined,
      priceRange: [150, 250],
    });
    expect(result.map((e) => e.id)).toEqual(["f2"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterEvents(filterFixtureEvents, {
      query: "no existe",
      category: "all",
      dateRange: undefined,
      priceRange: EVENT_FILTERS_DEFAULT.priceRange,
    });
    expect(result).toEqual([]);
  });
});

describe("getEventCategoryOption", () => {
  it("returns the correct option for a known id", () => {
    expect(getEventCategoryOption("concerts").label).toBe("Conciertos");
  });

  it("resolves without throwing for every EVENT_CATEGORIES id", () => {
    for (const category of EVENT_CATEGORIES.map((c) => c.id)) {
      expect(() => getEventCategoryOption(category)).not.toThrow();
    }
  });

  it("resolves without throwing for every category used in EVENTS_MOCK", () => {
    for (const category of EVENTS_MOCK.map((e) => e.category)) {
      expect(() => getEventCategoryOption(category)).not.toThrow();
    }
  });

  it("gives every category a bg-[#...] and text-[#...] color, with no repeated colors", () => {
    for (const option of EVENT_CATEGORIES) {
      expect(option.bgClassName).toMatch(/^bg-\[#/);
      expect(option.textClassName).toMatch(/^text-\[#/);
    }
    expect(new Set(EVENT_CATEGORIES.map((c) => c.bgClassName)).size).toBe(EVENT_CATEGORIES.length);
    expect(new Set(EVENT_CATEGORIES.map((c) => c.textClassName)).size).toBe(
      EVENT_CATEGORIES.length,
    );
  });
});

describe("formatDateRangeLabel", () => {
  it("returns 'Cualquier fecha' when there is no range", () => {
    expect(formatDateRangeLabel(undefined)).toBe("Cualquier fecha");
    expect(formatDateRangeLabel({ from: undefined })).toBe("Cualquier fecha");
  });

  it("returns a single short day when only from is set", () => {
    const result = formatDateRangeLabel({ from: new Date(2026, 10, 14) });
    expect(result).toContain("14");
    expect(result.toLowerCase()).toMatch(/nov/);
  });

  it("returns a single short day when from and to are the same day", () => {
    const result = formatDateRangeLabel({
      from: new Date(2026, 10, 14, 8),
      to: new Date(2026, 10, 14, 20),
    });
    expect(result).toContain("14");
    expect(result).not.toContain("–");
  });

  it("returns both days when the range spans more than one day", () => {
    const result = formatDateRangeLabel({
      from: new Date(2026, 10, 14),
      to: new Date(2026, 10, 20),
    });
    expect(result).toContain("14");
    expect(result).toContain("20");
    expect(result).toContain("–");
  });
});

describe("getEventHref", () => {
  it("builds the event detail path", () => {
    expect(getEventHref("bad-bunny-world-tour")).toBe("/events/bad-bunny-world-tour");
  });
});

describe("getEventBySlug", () => {
  it("returns the event with the given slug", () => {
    expect(getEventBySlug(EVENTS_MOCK, "bad-bunny-world-tour")?.id).toBe("1");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getEventBySlug(EVENTS_MOCK, "no-existe")).toBeUndefined();
  });
});
