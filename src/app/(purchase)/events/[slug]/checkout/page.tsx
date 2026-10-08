import { notFound } from "next/navigation";

import { EventCheckoutView } from "@/modules/catalog";
import { getCatalogEvent } from "@/modules/catalog/services/catalog.service";

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/events/[slug]/checkout">) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const found = await getCatalogEvent(slug);
  if (!found) notFound();

  return (
    <EventCheckoutView
      event={found.event}
      layout={found.layout}
      paymentCancelled={payment === "cancelled"}
    />
  );
}
