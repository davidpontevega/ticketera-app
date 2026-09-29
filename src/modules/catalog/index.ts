export { CatalogUpcomingEvents } from "./components/catalog-upcoming-events";
export { CatalogEventSearch } from "./components/catalog-event-search";
export {
  EventCheckoutView,
  EventConfirmationView,
  EventDetailView,
  EventTicketsView,
} from "./components/event-page-views";
export type {
  EventCheckoutViewProps,
  EventDetailViewProps,
  EventTicketsViewProps,
} from "./components/event-page-views";
export {
  LocalEventCheckout,
  LocalEventConfirmation,
  LocalEventDetail,
  LocalEventTickets,
} from "./components/local-event-pages";
export type { LocalEventPageProps } from "./components/local-event-pages";

export { useCatalogEvents } from "./hooks/use-catalog-events";

export {
  applyOrderToOrganizerEvent,
  findOrganizerEventBySlug,
  getOrganizerVenueLayout,
  getPublishedCatalogEvents,
  slugify,
  toCatalogEvent,
} from "./utils/catalog.utils";
