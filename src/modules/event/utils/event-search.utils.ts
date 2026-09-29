import {
  EVENT_CATEGORIES,
  EVENT_LOCALE,
  EVENT_PRICE_BUCKETS,
  EVENT_SEARCH_DEFAULT,
  EVENT_SORT_OPTIONS,
  EVENT_TIME_ZONE,
} from "../constants/event.constants";
import type {
  EventCategory,
  EventEntity,
  EventFilterOption,
  EventPriceBucket,
  EventSearchParams,
  EventSortOption,
} from "../types/event.types";
import { matchesQuery } from "./event.utils";

const LIST_SEPARATOR = ",";
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: EVENT_TIME_ZONE,
});

const monthLabelFormatter = new Intl.DateTimeFormat(EVENT_LOCALE, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// "2026-11" segun la fecha del evento en hora de Lima.
export function getEventMonthKey(isoDate: string): string {
  return monthKeyFormatter.format(new Date(isoDate)).slice(0, 7);
}

// "2026-11" -> "Noviembre 2026"
function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const label = monthLabelFormatter
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .replace(/\s+de\s+/, " ")
    .replace(/[^\S\n]+/gu, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(LIST_SEPARATOR)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function isCategory(value: string): value is EventCategory {
  return EVENT_CATEGORIES.some((category) => category.id === value);
}

function isPriceBucket(value: string | null): value is EventPriceBucket {
  return EVENT_PRICE_BUCKETS.some((bucket) => bucket.value === value);
}

function isSortOption(value: string | null): value is EventSortOption {
  return EVENT_SORT_OPTIONS.some((option) => option.value === value);
}

// Lee los filtros de la URL. Los valores invalidos se ignoran (quedan en su default).
export function parseEventSearchParams(params: URLSearchParams): EventSearchParams {
  const month = params.get("month");
  const price = params.get("price");
  const sort = params.get("sort");
  return {
    query: params.get("q")?.trim() ?? "",
    categories: parseList(params.get("categories")).filter(isCategory),
    cities: parseList(params.get("cities")),
    month: month && MONTH_KEY_PATTERN.test(month) ? month : null,
    price: isPriceBucket(price) ? price : null,
    sort: isSortOption(sort) ? sort : EVENT_SEARCH_DEFAULT.sort,
  };
}

// Inverso de parseEventSearchParams. No escribe los defaults: "" si no hay filtros.
export function toEventSearchQueryString(params: EventSearchParams): string {
  const search = new URLSearchParams();
  if (params.query.trim()) search.set("q", params.query.trim());
  if (params.categories.length) search.set("categories", params.categories.join(LIST_SEPARATOR));
  if (params.cities.length) search.set("cities", params.cities.join(LIST_SEPARATOR));
  if (params.month) search.set("month", params.month);
  if (params.price) search.set("price", params.price);
  if (params.sort !== EVENT_SEARCH_DEFAULT.sort) search.set("sort", params.sort);
  return search.toString();
}

function matchesPriceBucket(event: EventEntity, price: EventPriceBucket | null): boolean {
  const bucket = EVENT_PRICE_BUCKETS.find((item) => item.value === price);
  if (!bucket) return true;
  return event.priceFrom > bucket.min && event.priceFrom <= bucket.max;
}

function compareEvents(sort: EventSortOption) {
  return (a: EventEntity, b: EventEntity) => {
    const byDate = Date.parse(a.date) - Date.parse(b.date);
    if (sort === "price") return a.priceFrom - b.priceFrom || byDate;
    return byDate;
  };
}

// AND entre grupos de filtros, OR dentro de cada grupo. No muta el input.
export function searchEvents(
  events: readonly EventEntity[],
  params: EventSearchParams,
): EventEntity[] {
  return events
    .filter(
      (event) =>
        matchesQuery(event, params.query) &&
        (params.categories.length === 0 || params.categories.includes(event.category)) &&
        (params.cities.length === 0 || params.cities.includes(event.city)) &&
        (params.month === null || getEventMonthKey(event.date) === params.month) &&
        matchesPriceBucket(event, params.price),
    )
    .sort(compareEvents(params.sort));
}

function countBy(events: readonly EventEntity[], getKey: (event: EventEntity) => string) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = getKey(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function getCategoryFilterOptions(events: readonly EventEntity[]): EventFilterOption[] {
  const counts = countBy(events, (event) => event.category);
  return EVENT_CATEGORIES.map(({ id, label }) => ({
    value: id,
    label,
    count: counts.get(id) ?? 0,
  }));
}

export function getCityFilterOptions(events: readonly EventEntity[]): EventFilterOption[] {
  const counts = countBy(events, (event) => event.city);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, EVENT_LOCALE))
    .map(([city, count]) => ({ value: city, label: city, count }));
}

export function getMonthFilterOptions(events: readonly EventEntity[]): EventFilterOption[] {
  const counts = countBy(events, (event) => getEventMonthKey(event.date));
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ value: month, label: formatMonthKey(month), count }));
}

// Filtros activos del panel (sin texto ni orden): para el badge del boton "Filtros" en mobile.
export function countActiveFilters(params: EventSearchParams): number {
  return (
    params.categories.length +
    params.cities.length +
    (params.month ? 1 : 0) +
    (params.price ? 1 : 0)
  );
}

export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export const EVENT_SEARCH_PATH = "/events";

// Link a /events con filtros, ej. getEventSearchHref({ categories: ["theater"] }).
export function getEventSearchHref(overrides: Partial<EventSearchParams> = {}): string {
  const queryString = toEventSearchQueryString({ ...EVENT_SEARCH_DEFAULT, ...overrides });
  return queryString ? `${EVENT_SEARCH_PATH}?${queryString}` : EVENT_SEARCH_PATH;
}
