export { HeroCarousel } from "./components/hero-carousel";
export type { HeroCarouselProps } from "./components/hero-carousel";
export { CategoryList } from "./components/category-list";
export { EventSearchBar } from "./components/event-search-bar";
export { UpcomingEvents } from "./components/upcoming-events";
export type { UpcomingEventsProps } from "./components/upcoming-events";
export { EventCard } from "./components/event-card";
export { EventAvailabilityBadge } from "./components/event-availability-badge";
export type { EventAvailabilityBadgeProps } from "./components/event-availability-badge";
export type { EventCardProps } from "./components/event-card";
export { TrendingSidebar } from "./components/trending-sidebar";
export type { TrendingSidebarProps } from "./components/trending-sidebar";
export { BestSellerEvents } from "./components/best-seller-events";
export type { BestSellerEventsProps } from "./components/best-seller-events";

export { EVENTS_MOCK } from "./mocks/event.mock";

export {
  filterEventsByCategory,
  getFeaturedEvents,
  getTrendingEvents,
  getBestSellerEvents,
  getEventBySlug,
  formatEventDate,
  formatEventPrice,
} from "./utils/event.utils";

export {
  EVENT_CATEGORIES,
  EVENT_AVAILABILITY_LABEL,
  EVENT_LOCALE,
  EVENT_CURRENCY,
} from "./constants/event.constants";

export type {
  EventCategory,
  EventAvailability,
  EventEntity,
  EventCategoryFilter,
  EventCategoryOption,
} from "./types/event.types";
