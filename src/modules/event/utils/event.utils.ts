import { endOfDay, startOfDay } from "date-fns";

import {
  EVENT_CATEGORIES,
  EVENT_CURRENCY,
  EVENT_LOCALE,
  EVENT_TIME_ZONE,
} from "../constants/event.constants";
import type {
  EventCategory,
  EventCategoryFilter,
  EventCategoryOption,
  EventDateRange,
  EventEntity,
  EventFilters,
  EventPriceRange,
} from "../types/event.types";

export function filterEventsByCategory(
  events: readonly EventEntity[],
  category: EventCategoryFilter,
): EventEntity[] {
  if (category === "all") return [...events];
  return events.filter((event) => event.category === category);
}

export function getFeaturedEvents(events: readonly EventEntity[]): EventEntity[] {
  return events.filter((event) => event.isFeatured);
}

export function getTrendingEvents(events: readonly EventEntity[]): EventEntity[] {
  return events.filter((event) => event.isTrending);
}

export function getBestSellerEvents(events: readonly EventEntity[]): EventEntity[] {
  return events.filter((event) => event.isBestSeller);
}

export function getEventHref(slug: string): string {
  return `/events/${slug}`;
}

export function getEventBySlug(
  events: readonly EventEntity[],
  slug: string,
): EventEntity | undefined {
  return events.find((event) => event.slug === slug);
}

export function getEventCategoryOption(category: EventCategory): EventCategoryOption {
  const option = EVENT_CATEGORIES.find((item) => item.id === category);
  if (!option) {
    throw new Error(`No EventCategoryOption found for category "${category}"`);
  }
  return option;
}

// ponytail: Intl output can insert different unicode space chars (narrow
// no-break space, non-breaking space, etc.) depending on the runtime's ICU
// version, causing SSR/CSR hydration mismatches. Normalize all whitespace to
// a plain " " so the string is deterministic across environments.
function normalizeSpaces(value: string): string {
  return value.replace(/[^\S\n]+/gu, " ").trim();
}

export interface EventDateBadgeParts {
  month: string;
  day: string;
}

export function formatEventDateBadge(isoDate: string): EventDateBadgeParts {
  const date = new Date(isoDate);
  const month = normalizeSpaces(
    new Intl.DateTimeFormat(EVENT_LOCALE, { month: "short", timeZone: EVENT_TIME_ZONE }).format(date),
  )
    .replace(/\.$/, "")
    .toLowerCase();
  const day = normalizeSpaces(
    new Intl.DateTimeFormat(EVENT_LOCALE, { day: "numeric", timeZone: EVENT_TIME_ZONE }).format(date),
  );
  return { month, day };
}

export function formatEventDate(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat(EVENT_LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(isoDate));
  return normalizeSpaces(formatted);
}

export function formatEventLongDate(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat(EVENT_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(isoDate));
  return normalizeSpaces(formatted);
}

export function formatEventTime(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat(EVENT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(isoDate));
  return normalizeSpaces(formatted);
}

export function formatEventMinAge(minAge: number | null): string {
  return minAge === null ? "Todo publico" : `+${minAge} años`;
}

export function getRelatedEvents(
  events: readonly EventEntity[],
  event: EventEntity,
  limit = 4,
): EventEntity[] {
  const others = events.filter((item) => item.id !== event.id);
  const sameCategory = others.filter((item) => item.category === event.category);
  const otherCategories = others.filter((item) => item.category !== event.category);
  return [...sameCategory, ...otherCategories].slice(0, limit);
}

export function getEventMapsUrl(event: EventEntity): string {
  const query = encodeURIComponent(`${event.venue}, ${event.address}, ${event.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function formatEventPrice(amount: number): string {
  const formatted = new Intl.NumberFormat(EVENT_LOCALE, {
    style: "currency",
    currency: EVENT_CURRENCY,
    minimumFractionDigits: 0,
  }).format(amount);
  return normalizeSpaces(formatted);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function matchesQuery(event: EventEntity, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === "") return true;
  return [event.title, event.venue, event.city].some((field) =>
    normalizeText(field).includes(normalizedQuery),
  );
}

function matchesDateRange(event: EventEntity, dateRange: EventDateRange | undefined): boolean {
  if (!dateRange?.from) return true;
  const date = new Date(event.date);
  const start = startOfDay(dateRange.from);
  const end = endOfDay(dateRange.to ?? dateRange.from);
  return date >= start && date <= end;
}

function matchesPriceRange(event: EventEntity, priceRange: EventPriceRange): boolean {
  const [min, max] = priceRange;
  return event.priceFrom >= min && event.priceFrom <= max;
}

export function filterEvents(
  events: readonly EventEntity[],
  filters: EventFilters,
): EventEntity[] {
  return filterEventsByCategory(events, filters.category).filter(
    (event) =>
      matchesQuery(event, filters.query) &&
      matchesDateRange(event, filters.dateRange) &&
      matchesPriceRange(event, filters.priceRange),
  );
}

const dateRangeFormatter = new Intl.DateTimeFormat(EVENT_LOCALE, {
  day: "numeric",
  month: "short",
});

export function formatDateRangeLabel(range: EventDateRange | undefined): string {
  if (!range?.from) return "Cualquier fecha";
  const from = dateRangeFormatter.format(range.from);
  if (!range.to || startOfDay(range.to).getTime() === startOfDay(range.from).getTime()) {
    return from;
  }
  return `${from} – ${dateRangeFormatter.format(range.to)}`;
}
