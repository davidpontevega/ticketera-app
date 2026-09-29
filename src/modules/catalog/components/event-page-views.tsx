import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PurchaseHeader } from "@/components/shared/purchase-header";
import {
  EventDetailHero,
  EventDetailInfo,
  RelatedEvents,
  formatEventDate,
  getEventHref,
  type EventEntity,
} from "@/modules/event";
import { CheckoutForm, OrderConfirmation, type Order } from "@/modules/order";
import { TicketOffer, TicketSelection, ZonePriceList, type VenueLayout } from "@/modules/ticket";

// Contenido de las paginas de un evento. Lo usan las paginas prerenderizadas (eventos del mock) y
// los fallbacks cliente (eventos publicados desde el panel), para no duplicar la UI.

export interface EventDetailViewProps {
  event: EventEntity;
  layout: VenueLayout;
  relatedEvents: readonly EventEntity[];
}

export function EventDetailView({ event, layout, relatedEvents }: EventDetailViewProps) {
  const ticketsHref = `${getEventHref(event.slug)}/tickets`;
  return (
    <div className="pb-24 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <EventDetailHero event={event} ticketsHref={ticketsHref} />
        <div className="grid items-start gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:py-14">
          <div className="flex flex-col gap-8">
            <EventDetailInfo event={event} />
            <section aria-labelledby="event-zones-title" className="flex flex-col gap-2 lg:hidden">
              <h2 id="event-zones-title" className="font-heading text-xl font-bold tracking-tight">
                Entradas
              </h2>
              <ZonePriceList zones={layout.zones} />
            </section>
          </div>
          <TicketOffer
            layout={layout}
            priceFrom={event.priceFrom}
            ticketsHref={ticketsHref}
            isSoldOut={event.availability === "sold-out"}
          />
        </div>
      </div>
      <RelatedEvents events={relatedEvents} category={event.category} />
    </div>
  );
}

export interface EventTicketsViewProps {
  event: EventEntity;
  layout: VenueLayout;
}

export function EventTicketsView({ event, layout }: EventTicketsViewProps) {
  const eventHref = getEventHref(event.slug);
  return (
    <>
      <PurchaseHeader
        currentStep={1}
        title="Elige tus entradas"
        backHref={eventHref}
        backLabel="Volver al evento"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 lg:py-6">
        <Link
          href={eventHref}
          className="mb-4 hidden w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:flex"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al evento
        </Link>
        <div className="mb-4 flex items-center gap-3 lg:mb-7 lg:gap-4">
          <Image
            src={event.imageUrl}
            alt=""
            width={64}
            height={64}
            className="size-13 rounded-xl object-cover lg:size-16 lg:rounded-2xl"
          />
          <div className="flex min-w-0 flex-col">
            <h1 className="font-heading text-base font-semibold lg:text-2xl lg:font-bold lg:tracking-tight">
              {event.title}
            </h1>
            <p className="text-sm text-muted-foreground lg:text-[15px]">
              {formatEventDate(event.date)} · {event.venue}, {event.city}
            </p>
          </div>
        </div>
        <TicketSelection event={event} layout={layout} />
      </main>
    </>
  );
}

export interface EventCheckoutViewProps {
  event: EventEntity;
  layout: VenueLayout;
  onOrderPlaced?: (order: Order) => void;
}

export function EventCheckoutView({ event, layout, onOrderPlaced }: EventCheckoutViewProps) {
  return (
    <>
      <PurchaseHeader
        currentStep={2}
        title="Datos y pago"
        backHref={`${getEventHref(event.slug)}/tickets`}
        backLabel="Volver a entradas"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 lg:py-8">
        <CheckoutForm event={event} layout={layout} onOrderPlaced={onOrderPlaced} />
      </main>
    </>
  );
}

export function EventConfirmationView({ event }: { event: EventEntity }) {
  return (
    <>
      <PurchaseHeader currentStep={3} title="Confirmacion" backHref="/" backLabel="Ir al inicio" />
      <main className="w-full flex-1 px-4 py-8 md:px-6 lg:py-12">
        <OrderConfirmation event={event} />
      </main>
    </>
  );
}
