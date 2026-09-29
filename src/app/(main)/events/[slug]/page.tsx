import type { Metadata } from "next";

import { EventDetailView, LocalEventDetail } from "@/modules/catalog";
import { EVENTS_MOCK, getEventBySlug, getRelatedEvents } from "@/modules/event";
import { getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const event = getEventBySlug(EVENTS_MOCK, (await params).slug);
  return event ? { title: `${event.title} | Ticketera`, description: event.description } : {};
}

export default async function EventDetailPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = getEventBySlug(EVENTS_MOCK, slug);
  // Slug fuera del mock: puede ser un evento publicado desde el panel (vive en el navegador).
  if (!event) return <LocalEventDetail slug={slug} />;

  return (
    <EventDetailView
      event={event}
      layout={getVenueLayout(event)}
      relatedEvents={getRelatedEvents(EVENTS_MOCK, event)}
    />
  );
}
