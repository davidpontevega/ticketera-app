import { create } from "zustand";

import { EVENT_FILTERS_DEFAULT } from "../constants/event.constants";
import type {
  EventCategoryFilter,
  EventDateRange,
  EventFilters,
  EventPriceRange,
} from "../types/event.types";

export interface EventFilterState extends EventFilters {
  setQuery: (query: string) => void;
  setCategory: (category: EventCategoryFilter) => void;
  setDateRange: (range: EventDateRange | undefined) => void;
  setPriceRange: (range: EventPriceRange) => void;
  reset: () => void;
}

export const useEventFilterStore = create<EventFilterState>()((set) => ({
  ...EVENT_FILTERS_DEFAULT,
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  setDateRange: (dateRange) => set({ dateRange }),
  setPriceRange: (priceRange) => set({ priceRange }),
  reset: () => set(EVENT_FILTERS_DEFAULT),
}));
