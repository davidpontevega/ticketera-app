"use client";

import { ChevronDown, Search } from "lucide-react";
import { es } from "react-day-picker/locale";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

import { EVENT_PRICE_RANGE, EVENT_PRICE_STEP } from "../constants/event.constants";
import { useEventFilterStore } from "../store/event-filter.store";
import { formatDateRangeLabel, formatEventPrice } from "../utils/event.utils";

function FilterFieldLabel({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-sm font-medium">
        <span className="max-w-[140px] truncate">{value}</span>
        <ChevronDown aria-hidden className="size-4" />
      </span>
    </>
  );
}

export function EventSearchBar() {
  const { query, dateRange, priceRange } = useEventFilterStore(
    useShallow((state) => ({
      query: state.query,
      dateRange: state.dateRange,
      priceRange: state.priceRange,
    })),
  );
  const setQuery = useEventFilterStore((state) => state.setQuery);
  const setDateRange = useEventFilterStore((state) => state.setDateRange);
  const setPriceRange = useEventFilterStore((state) => state.setPriceRange);
  const reset = useEventFilterStore((state) => state.reset);

  const [minPrice, maxPrice] = priceRange;

  return (
    <div className="sticky top-16 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-3 md:px-6">
        <div className="flex flex-1 flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm md:flex-row md:items-center md:gap-2 md:rounded-full md:pl-2">
          <form onSubmit={(e) => e.preventDefault()} className="md:flex-1">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca tu proximo evento"
                aria-label="Buscar eventos"
                className="border-0 bg-transparent pl-8 shadow-none"
              />
            </div>
          </form>

          <Separator orientation="vertical" className="hidden h-8 self-center md:block" />

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-auto flex-1 flex-col items-start gap-0 px-3 py-1 md:flex-none"
                  />
                }
              >
                <FilterFieldLabel label="Fecha" value={formatDateRangeLabel(dateRange)} />
              </PopoverTrigger>
              <PopoverContent className="w-auto">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={es}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="hidden h-8 self-center md:block" />

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-auto flex-1 flex-col items-start gap-0 px-3 py-1 md:flex-none"
                  />
                }
              >
                <FilterFieldLabel
                  label="Precio"
                  value={`${formatEventPrice(minPrice)} – ${formatEventPrice(maxPrice)}`}
                />
              </PopoverTrigger>
              <PopoverContent>
                <Slider
                  min={EVENT_PRICE_RANGE[0]}
                  max={EVENT_PRICE_RANGE[1]}
                  step={EVENT_PRICE_STEP}
                  value={priceRange}
                  onValueChange={(value) => {
                    if (Array.isArray(value) && value.length === 2) {
                      setPriceRange([value[0], value[1]]);
                    }
                  }}
                  aria-label="Rango de precio"
                />
              </PopoverContent>
            </Popover>

            <Button
              size="icon-lg"
              className="shrink-0 rounded-full"
              aria-label="Ver resultados"
              render={<a href="#upcoming-events" />}
              nativeButton={false}
            >
              <Search aria-hidden />
            </Button>
          </div>
        </div>

        <Button
          variant="link"
          size="xs"
          onClick={reset}
          className="self-end text-muted-foreground md:self-auto"
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
