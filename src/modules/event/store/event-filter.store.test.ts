import { beforeEach, describe, expect, it } from "vitest";

import { EVENT_FILTERS_DEFAULT } from "../constants/event.constants";
import { useEventFilterStore } from "./event-filter.store";

describe("useEventFilterStore", () => {
  beforeEach(() => {
    useEventFilterStore.setState(EVENT_FILTERS_DEFAULT);
  });

  it("setQuery updates only query", () => {
    useEventFilterStore.getState().setQuery("opera");
    const state = useEventFilterStore.getState();
    expect(state.query).toBe("opera");
    expect(state.category).toBe(EVENT_FILTERS_DEFAULT.category);
    expect(state.dateRange).toBe(EVENT_FILTERS_DEFAULT.dateRange);
    expect(state.priceRange).toEqual(EVENT_FILTERS_DEFAULT.priceRange);
  });

  it("setCategory updates only category", () => {
    useEventFilterStore.getState().setCategory("sports");
    const state = useEventFilterStore.getState();
    expect(state.category).toBe("sports");
    expect(state.query).toBe(EVENT_FILTERS_DEFAULT.query);
    expect(state.dateRange).toBe(EVENT_FILTERS_DEFAULT.dateRange);
    expect(state.priceRange).toEqual(EVENT_FILTERS_DEFAULT.priceRange);
  });

  it("setDateRange updates only dateRange", () => {
    const range = { from: new Date(2026, 10, 14), to: new Date(2026, 10, 20) };
    useEventFilterStore.getState().setDateRange(range);
    const state = useEventFilterStore.getState();
    expect(state.dateRange).toEqual(range);
    expect(state.query).toBe(EVENT_FILTERS_DEFAULT.query);
    expect(state.category).toBe(EVENT_FILTERS_DEFAULT.category);
    expect(state.priceRange).toEqual(EVENT_FILTERS_DEFAULT.priceRange);
  });

  it("setPriceRange updates only priceRange", () => {
    useEventFilterStore.getState().setPriceRange([50, 200]);
    const state = useEventFilterStore.getState();
    expect(state.priceRange).toEqual([50, 200]);
    expect(state.query).toBe(EVENT_FILTERS_DEFAULT.query);
    expect(state.category).toBe(EVENT_FILTERS_DEFAULT.category);
    expect(state.dateRange).toBe(EVENT_FILTERS_DEFAULT.dateRange);
  });

  it("reset restores EVENT_FILTERS_DEFAULT", () => {
    const store = useEventFilterStore.getState();
    store.setQuery("test");
    store.setCategory("cinema");
    store.setDateRange({ from: new Date(2026, 10, 14) });
    store.setPriceRange([10, 100]);

    useEventFilterStore.getState().reset();

    const state = useEventFilterStore.getState();
    expect(state.query).toBe(EVENT_FILTERS_DEFAULT.query);
    expect(state.category).toBe(EVENT_FILTERS_DEFAULT.category);
    expect(state.dateRange).toBe(EVENT_FILTERS_DEFAULT.dateRange);
    expect(state.priceRange).toEqual(EVENT_FILTERS_DEFAULT.priceRange);
  });
});
