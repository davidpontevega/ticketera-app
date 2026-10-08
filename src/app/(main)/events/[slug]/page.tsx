import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetailView } from "@/modules/catalog";
import { getCatalogEvent, listCatalogEvents } from "@/modules/catalog/services/catalog.service";
import { getRelatedEvents } from "@/modules/event";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const found = await getCatalogEvent((await params).slug);
  return found
    ? { title: `${found.event.title} | Ticketera`, description: found.event.description }
    : {};
}

export default async function EventDetailPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const found = await getCatalogEvent(slug);
  if (!found) notFound();

  const all = (await listCatalogEvents()).map(({ event }) => event);
  return (
    <EventDetailView
      event={found.event}
      layout={found.layout}
      relatedEvents={getRelatedEvents(all, found.event)}
    />
  );
}
