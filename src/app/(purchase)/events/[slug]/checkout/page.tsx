import { EventCheckoutView, LocalEventCheckout } from "@/modules/catalog";
import { EVENTS_MOCK, getEventBySlug } from "@/modules/event";
import { getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function CheckoutPage({ params }: PageProps<"/events/[slug]/checkout">) {
  const { slug } = await params;
  const event = getEventBySlug(EVENTS_MOCK, slug);
  // Slug fuera del mock: puede ser un evento publicado desde el panel (vive en el navegador).
  if (!event) return <LocalEventCheckout slug={slug} />;

  return <EventCheckoutView event={event} layout={getVenueLayout(event)} />;
}
