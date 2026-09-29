import { EventConfirmationView, LocalEventConfirmation } from "@/modules/catalog";
import { EVENTS_MOCK, getEventBySlug } from "@/modules/event";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function ConfirmationPage({
  params,
}: PageProps<"/events/[slug]/confirmation">) {
  const { slug } = await params;
  const event = getEventBySlug(EVENTS_MOCK, slug);
  // Slug fuera del mock: puede ser un evento publicado desde el panel (vive en el navegador).
  if (!event) return <LocalEventConfirmation slug={slug} />;

  return <EventConfirmationView event={event} />;
}
