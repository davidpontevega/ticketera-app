import { EventTicketsView, LocalEventTickets } from "@/modules/catalog";
import { EVENTS_MOCK, getEventBySlug } from "@/modules/event";
import { getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function TicketsPage({ params }: PageProps<"/events/[slug]/tickets">) {
  const { slug } = await params;
  const event = getEventBySlug(EVENTS_MOCK, slug);
  // Slug fuera del mock: puede ser un evento publicado desde el panel (vive en el navegador).
  if (!event) return <LocalEventTickets slug={slug} />;

  return <EventTicketsView event={event} layout={getVenueLayout(event)} />;
}
