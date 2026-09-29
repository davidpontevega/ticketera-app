"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { EVENT_PRICE_BUCKETS, EVENT_SORT_OPTIONS } from "../constants/event.constants";
import type {
  EventCategory,
  EventFilterOption,
  EventSearchParams,
  EventSortOption,
} from "../types/event.types";
import { countActiveFilters, toggleValue } from "../utils/event-search.utils";
import { EventSearchFilters } from "./event-search-filters";

export interface EventSearchToolbarProps {
  params: EventSearchParams;
  resultCount: number;
  categoryOptions: readonly EventFilterOption[];
  cityOptions: readonly EventFilterOption[];
  monthOptions: readonly EventFilterOption[];
  onChange: (params: EventSearchParams) => void;
  onClearFilters: () => void;
}

interface ActiveFilterChip {
  key: string;
  label: string;
  remove: () => EventSearchParams;
}

function formatResultCount(count: number): string {
  return count === 1 ? "1 evento" : `${count} eventos`;
}

function getActiveFilterChips(
  params: EventSearchParams,
  categoryOptions: readonly EventFilterOption[],
  monthOptions: readonly EventFilterOption[],
): ActiveFilterChip[] {
  const labelOf = (options: readonly EventFilterOption[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const price = EVENT_PRICE_BUCKETS.find((bucket) => bucket.value === params.price);

  return [
    ...params.categories.map((category) => ({
      key: `category-${category}`,
      label: labelOf(categoryOptions, category),
      remove: () => ({ ...params, categories: toggleValue(params.categories, category) }),
    })),
    ...params.cities.map((city) => ({
      key: `city-${city}`,
      label: city,
      remove: () => ({ ...params, cities: toggleValue(params.cities, city) }),
    })),
    ...(params.month
      ? [
          {
            key: "month",
            label: labelOf(monthOptions, params.month),
            remove: () => ({ ...params, month: null }),
          },
        ]
      : []),
    ...(price
      ? [{ key: "price", label: price.label, remove: () => ({ ...params, price: null }) }]
      : []),
  ];
}

function SortToggle({
  value,
  onValueChange,
}: {
  value: EventSortOption;
  onValueChange: (value: EventSortOption) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Ordenar por"
      value={[value]}
      onValueChange={(values) => {
        const next = values[0] as EventSortOption | undefined;
        if (next) onValueChange(next);
      }}
      variant="outline"
      spacing={0}
      className="shrink-0 bg-card"
    >
      {EVENT_SORT_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-9 px-3 data-pressed:bg-foreground data-pressed:text-background"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function EventSearchToolbar({
  params,
  resultCount,
  categoryOptions,
  cityOptions,
  monthOptions,
  onChange,
  onClearFilters,
}: EventSearchToolbarProps) {
  const chips = getActiveFilterChips(params, categoryOptions, monthOptions);
  const panelFilterCount = countActiveFilters({ ...params, categories: [] });
  const resultLabel = formatResultCount(resultCount);

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: panel de filtros + orden + chips de categorias */}
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger
            render={<Button type="button" variant="outline" className="h-9 gap-2 bg-card px-3" />}
          >
            <SlidersHorizontal aria-hidden />
            Filtros
            {panelFilterCount > 0 && (
              <Badge className="h-5 min-w-5 rounded-full px-1.5">{panelFilterCount}</Badge>
            )}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] gap-0 rounded-t-2xl">
            <SheetHeader className="border-b border-border">
              <SheetTitle className="text-lg">Filtros</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <EventSearchFilters
                params={params}
                cityOptions={cityOptions}
                monthOptions={monthOptions}
                onChange={onChange}
                idPrefix="mobile-filter"
              />
            </div>
            <SheetFooter className="flex-row border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 flex-1"
                onClick={() => onChange({ ...params, cities: [], month: null, price: null })}
              >
                Limpiar
              </Button>
              <SheetClose render={<Button type="button" size="lg" className="h-11 flex-1" />}>
                Ver {resultLabel}
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <SortToggle value={params.sort} onValueChange={(sort) => onChange({ ...params, sort })} />
      </div>

      <nav aria-label="Categorias" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
        <ul className="flex w-max gap-2">
          {categoryOptions.map((option) => {
            const category = option.value as EventCategory;
            const isPressed = params.categories.includes(category);
            return (
              <li key={option.value}>
                <button
                  type="button"
                  aria-pressed={isPressed}
                  onClick={() =>
                    onChange({
                      ...params,
                      categories: toggleValue(params.categories, category),
                    })
                  }
                  className={cn(
                    "h-9 cursor-pointer rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isPressed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Contador, chips activos y orden (desktop) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="mr-1 text-[15px] font-semibold">
            {resultLabel}
          </p>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`Quitar filtro ${chip.label}`}
              onClick={() => onChange(chip.remove())}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary/10 pr-2 pl-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span>{chip.label}</span>
              <X aria-hidden className="size-3.5" />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpiar todo
            </button>
          )}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <span className="text-sm text-muted-foreground">Ordenar por</span>
          <SortToggle value={params.sort} onValueChange={(sort) => onChange({ ...params, sort })} />
        </div>
      </div>
    </div>
  );
}
