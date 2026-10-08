import { notFound } from "next/navigation";

import { EventTicketsView } from "@/modules/catalog";
import { getCatalogEvent } from "@/modules/catalog/services/catalog.service";

export default async function TicketsPage({ params }: PageProps<"/events/[slug]/tickets">) {
  const { slug } = await params;
  const found = await getCatalogEvent(slug);
  if (!found) notFound();

  return <EventTicketsView event={found.event} layout={found.layout} />;
}
