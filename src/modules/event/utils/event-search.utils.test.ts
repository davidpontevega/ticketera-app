import { describe, expect, it } from "vitest";

import { EVENT_SEARCH_DEFAULT } from "../constants/event.constants";
import { EVENTS_MOCK } from "../mocks/event.mock";
import type { EventEntity, EventSearchParams } from "../types/event.types";
import {
  countActiveFilters,
  getCategoryFilterOptions,
  getCityFilterOptions,
  getEventMonthKey,
  getEventSearchHref,
  getMonthFilterOptions,
  parseEventSearchParams,
  searchEvents,
  toEventSearchQueryString,
  toggleValue,
} from "./event-search.utils";

function params(overrides: Partial<EventSearchParams>): EventSearchParams {
  return { ...EVENT_SEARCH_DEFAULT, ...overrides };
}

function slugs(events: EventEntity[]): string[] {
  return events.map((event) => event.slug);
}

describe("parseEventSearchParams", () => {
  it("returns the defaults for an empty query string", () => {
    expect(parseEventSearchParams(new URLSearchParams())).toEqual(EVENT_SEARCH_DEFAULT);
  });

  it("parses every param", () => {
    const result = parseEventSearchParams(
      new URLSearchParams(
        "q=lima&categories=concerts,theater&cities=Lima,Cusco&month=2026-11&price=50-150&sort=price",
      ),
    );
    expect(result).toEqual({
      query: "lima",
      categories: ["concerts", "theater"],
      cities: ["Lima", "Cusco"],
      month: "2026-11",
      price: "50-150",
      sort: "price",
    });
  });

  it("ignores invalid values", () => {
    const result = parseEventSearchParams(
      new URLSearchParams(
        "categories=concerts,nope,,concerts&month=2026-13&price=cheap&sort=random",
      ),
    );
    expect(result).toEqual(params({ categories: ["concerts"] }));
  });
});

describe("toEventSearchQueryString", () => {
  it("omits defaults", () => {
    expect(toEventSearchQueryString(EVENT_SEARCH_DEFAULT)).toBe("");
    expect(toEventSearchQueryString(params({ query: "  " }))).toBe("");
  });

  it("round-trips with parseEventSearchParams", () => {
    const value = params({
      query: "rock",
      categories: ["festivals", "concerts"],
      cities: ["Lima"],
      month: "2027-03",
      price: "150-300",
      sort: "price",
    });
    expect(parseEventSearchParams(new URLSearchParams(toEventSearchQueryString(value)))).toEqual(
      value,
    );
  });
});

describe("getEventMonthKey", () => {
  it("uses Lima time", () => {
    // 30 nov 23:00 en Lima = 1 dic 04:00 UTC
    expect(getEventMonthKey("2026-11-30T23:00:00-05:00")).toBe("2026-11");
  });
});

describe("searchEvents", () => {
  it("returns every event sorted by date by default", () => {
    const result = searchEvents(EVENTS_MOCK, EVENT_SEARCH_DEFAULT);
    expect(result).toHaveLength(EVENTS_MOCK.length);
    const dates = result.map((event) => Date.parse(event.date));
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("matches text ignoring case and accents", () => {
    expect(slugs(searchEvents(EVENTS_MOCK, params({ query: "ÓPERA" })))).toEqual([
      "el-fantasma-de-la-opera",
    ]);
    expect(searchEvents(EVENTS_MOCK, params({ query: "cusco" }))).toHaveLength(1);
  });

  it("uses OR inside a group and AND between groups", () => {
    const either = searchEvents(EVENTS_MOCK, params({ categories: ["concerts", "theater"] }));
    expect(either.every((event) => ["concerts", "theater"].includes(event.category))).toBe(true);
    expect(either).toHaveLength(4);
    const both = searchEvents(
      EVENTS_MOCK,
      params({ categories: ["theater"], cities: ["Arequipa"] }),
    );
    expect(slugs(both)).toEqual(["romeo-y-julieta"]);
  });

  it("filters by month", () => {
    const result = searchEvents(EVENTS_MOCK, params({ month: "2026-12" }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((event) => getEventMonthKey(event.date) === "2026-12")).toBe(true);
  });

  it("filters by price bucket with exclusive min and inclusive max", () => {
    const upTo50 = searchEvents(EVENTS_MOCK, params({ price: "up-to-50" }));
    expect(upTo50.every((event) => event.priceFrom <= 50)).toBe(true);
    const mid = searchEvents(EVENTS_MOCK, params({ price: "50-150" }));
    expect(mid.every((event) => event.priceFrom > 50 && event.priceFrom <= 150)).toBe(true);
    expect(mid.some((event) => event.priceFrom === 150)).toBe(true);
    const high = searchEvents(EVENTS_MOCK, params({ price: "150-300" }));
    expect(high.some((event) => event.priceFrom === 150)).toBe(false);
    const over = searchEvents(EVENTS_MOCK, params({ price: "over-300" }));
    expect(over.every((event) => event.priceFrom > 300)).toBe(true);
    expect(upTo50.length + mid.length + high.length + over.length).toBe(EVENTS_MOCK.length);
  });

  it("sorts by price and breaks ties by date", () => {
    const tied: EventEntity[] = [
      {
        ...EVENTS_MOCK[0],
        id: "a",
        slug: "late",
        priceFrom: 10,
        date: "2026-12-01T20:00:00-05:00",
      },
      {
        ...EVENTS_MOCK[0],
        id: "b",
        slug: "early",
        priceFrom: 10,
        date: "2026-10-01T20:00:00-05:00",
      },
      {
        ...EVENTS_MOCK[0],
        id: "c",
        slug: "cheapest",
        priceFrom: 5,
        date: "2027-01-01T20:00:00-05:00",
      },
    ];
    expect(slugs(searchEvents(tied, params({ sort: "price" })))).toEqual([
      "cheapest",
      "early",
      "late",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [...EVENTS_MOCK];
    const snapshot = [...input];
    searchEvents(input, params({ sort: "price" }));
    expect(input).toEqual(snapshot);
  });
});

describe("filter options", () => {
  it("lists the 10 categories with counts that add up to every event", () => {
    const options = getCategoryFilterOptions(EVENTS_MOCK);
    expect(options).toHaveLength(10);
    expect(options.reduce((total, option) => total + option.count, 0)).toBe(EVENTS_MOCK.length);
    expect(options.find((option) => option.value === "concerts")).toEqual({
      value: "concerts",
      label: "Conciertos",
      count: 2,
    });
  });

  it("lists cities alphabetically", () => {
    const cities = getCityFilterOptions(EVENTS_MOCK).map((option) => option.value);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b, "es")));
    expect(cities).toContain("Lima");
  });

  it("lists months in order with a readable label", () => {
    const months = getMonthFilterOptions(EVENTS_MOCK);
    const keys = months.map((option) => option.value);
    expect(keys).toEqual([...keys].sort());
    expect(months.find((option) => option.value === "2026-11")?.label).toBe("Noviembre 2026");
  });
});

describe("getEventSearchHref", () => {
  it("builds /events links with filters", () => {
    expect(getEventSearchHref()).toBe("/events");
    expect(getEventSearchHref({ categories: ["theater"] })).toBe("/events?categories=theater");
  });
});

describe("countActiveFilters", () => {
  it("counts panel filters but not text or sort", () => {
    expect(countActiveFilters(params({ query: "x", sort: "price" }))).toBe(0);
    expect(
      countActiveFilters(
        params({
          categories: ["concerts", "sports"],
          cities: ["Lima"],
          month: "2026-11",
          price: "50-150",
        }),
      ),
    ).toBe(5);
  });
});

describe("toggleValue", () => {
  it("adds and removes a value without mutating", () => {
    const values = ["a"];
    expect(toggleValue(values, "b")).toEqual(["a", "b"]);
    expect(toggleValue(values, "a")).toEqual([]);
    expect(values).toEqual(["a"]);
  });
});
