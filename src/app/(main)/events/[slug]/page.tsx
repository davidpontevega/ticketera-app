import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  EVENTS_MOCK,
  EventDetailHero,
  EventDetailInfo,
  RelatedEvents,
  getEventBySlug,
  getEventHref,
  getRelatedEvents,
} from "@/modules/event";
import { TicketOffer, ZonePriceList, getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const event = getEventBySlug(EVENTS_MOCK, (await params).slug);
  return event ? { title: `${event.title} | Ticketera`, description: event.description } : {};
}

export default async function EventDetailPage({ params }: PageProps<"/events/[slug]">) {
  const event = getEventBySlug(EVENTS_MOCK, (await params).slug);
  if (!event) notFound();

  const layout = getVenueLayout(event);
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
      <RelatedEvents events={getRelatedEvents(EVENTS_MOCK, event)} category={event.category} />
    </div>
  );
}
