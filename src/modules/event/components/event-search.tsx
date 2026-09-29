"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { EVENT_SEARCH_DEFAULT } from "../constants/event.constants";
import type { EventEntity, EventSearchParams } from "../types/event.types";
import {
  getCategoryFilterOptions,
  getCityFilterOptions,
  getEventSearchHref,
  getMonthFilterOptions,
  parseEventSearchParams,
  searchEvents,
} from "../utils/event-search.utils";
import { EventSearchFilters } from "./event-search-filters";
import { EventSearchForm } from "./event-search-form";
import { EventSearchResults } from "./event-search-results";
import { EventSearchToolbar } from "./event-search-toolbar";

export interface EventSearchProps {
  events: readonly EventEntity[];
}

// Los filtros viven en la URL: se leen con useSearchParams y se escriben con router.replace.
export function EventSearch({ events }: EventSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = parseEventSearchParams(new URLSearchParams(searchParams.toString()));
  const results = searchEvents(events, params);
  const categoryOptions = getCategoryFilterOptions(events);
  const cityOptions = getCityFilterOptions(events);
  const monthOptions = getMonthFilterOptions(events);

  const updateParams = (next: EventSearchParams) => {
    router.replace(getEventSearchHref(next), { scroll: false });
  };
  const clearFilters = () => updateParams({ ...EVENT_SEARCH_DEFAULT, sort: params.sort });

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-4 lg:gap-5">
        <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">
          Explora eventos
        </h1>
        <EventSearchForm
          key={params.query}
          defaultQuery={params.query}
          onSubmit={(query) => updateParams({ ...params, query })}
        />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          aria-label="Filtros"
          className="sticky top-24 hidden flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:flex"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Filtros</h2>
            <button
              type="button"
              onClick={() =>
                updateParams({ ...params, categories: [], cities: [], month: null, price: null })
              }
              className="cursor-pointer text-sm font-semibold text-primary hover:underline"
            >
              Limpiar
            </button>
          </div>
          <EventSearchFilters
            params={params}
            categoryOptions={categoryOptions}
            cityOptions={cityOptions}
            monthOptions={monthOptions}
            onChange={updateParams}
            idPrefix="filter"
          />
        </aside>

        <section aria-label="Resultados" className="flex min-w-0 flex-col gap-5">
          <EventSearchToolbar
            params={params}
            resultCount={results.length}
            categoryOptions={categoryOptions}
            cityOptions={cityOptions}
            monthOptions={monthOptions}
            onChange={updateParams}
            onClearFilters={clearFilters}
          />
          <EventSearchResults events={results} onClear={clearFilters} />
        </section>
      </div>
    </div>
  );
}
