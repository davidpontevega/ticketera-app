"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { getRelatedEvents } from "@/modules/event";
import { useOrganizerStore } from "@/modules/organizer";

import { useCatalogEvents } from "../hooks/use-catalog-events";
import {
  applyOrderToOrganizerEvent,
  findOrganizerEventBySlug,
  getOrganizerVenueLayout,
  toCatalogEvent,
} from "../utils/catalog.utils";
import {
  EventCheckoutView,
  EventConfirmationView,
  EventDetailView,
  EventTicketsView,
} from "./event-page-views";

// Fallbacks cliente de las paginas de un evento cuyo slug no esta en el mock: el evento se busca
// entre los publicados desde el panel (localStorage), que el servidor no puede leer.

export interface LocalEventPageProps {
  slug: string;
}

function useLocalEvent(slug: string) {
  const isClient = useIsClient();
  const organizerEvents = useOrganizerStore((state) => state.events);
  const organizerEvent = isClient ? findOrganizerEventBySlug(organizerEvents, slug) : undefined;
  return {
    isClient,
    organizerEvent,
    event: organizerEvent && toCatalogEvent(organizerEvent),
    layout: organizerEvent && getOrganizerVenueLayout(organizerEvent),
  };
}

function LocalEventLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <div aria-busy className="h-96 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}

function LocalEventNotFound() {
  return (
    <main className="w-full flex-1 px-4 py-12 md:px-6 lg:py-20">
      <EmptyState
        icon={SearchX}
        title="No encontramos este evento"
        description="Puede que el enlace este mal escrito o que el evento ya no este publicado."
        action={
          <Button
            size="lg"
            render={<Link href="/events" />}
            nativeButton={false}
            className="h-11 px-5"
          >
            Explorar eventos
          </Button>
        }
      />
    </main>
  );
}

export function LocalEventDetail({ slug }: LocalEventPageProps) {
  const { isClient, event, layout } = useLocalEvent(slug);
  const catalogEvents = useCatalogEvents();
  if (!isClient) return <LocalEventLoading />;
  if (!event || !layout) return <LocalEventNotFound />;
  return (
    <EventDetailView
      event={event}
      layout={layout}
      relatedEvents={getRelatedEvents(catalogEvents, event)}
    />
  );
}

export function LocalEventTickets({ slug }: LocalEventPageProps) {
  const { isClient, event, layout } = useLocalEvent(slug);
  if (!isClient) return <LocalEventLoading />;
  if (!event || !layout) return <LocalEventNotFound />;
  return <EventTicketsView event={event} layout={layout} />;
}

export function LocalEventCheckout({ slug }: LocalEventPageProps) {
  const { isClient, organizerEvent, event, layout } = useLocalEvent(slug);
  const saveEvent = useOrganizerStore((state) => state.saveEvent);
  if (!isClient) return <LocalEventLoading />;
  if (!organizerEvent || !event || !layout) return <LocalEventNotFound />;
  return (
    <EventCheckoutView
      event={event}
      layout={layout}
      // Ventas reales en el panel: la compra suma a `sold` de cada tipo de entrada.
      onOrderPlaced={(order) => saveEvent(applyOrderToOrganizerEvent(organizerEvent, order.lines))}
    />
  );
}

export function LocalEventConfirmation({ slug }: LocalEventPageProps) {
  const { isClient, event } = useLocalEvent(slug);
  if (!isClient) return <LocalEventLoading />;
  if (!event) return <LocalEventNotFound />;
  return <EventConfirmationView event={event} />;
}
