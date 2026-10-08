import { notFound } from "next/navigation";

import { EventConfirmationView } from "@/modules/catalog";
import { getCatalogEvent } from "@/modules/catalog/services/catalog.service";
import type { OrderRecord } from "@/modules/order";
// Ruta directa: el barrel arrastraria `stripe`/`server-only` al bundle cliente.
import { syncOrderWithSession } from "@/modules/order/services/checkout.service";

export default async function ConfirmationPage({
  params,
  searchParams,
}: PageProps<"/events/[slug]/confirmation">) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  const found = await getCatalogEvent(slug);
  if (!found) notFound();

  let order: OrderRecord | null = null;
  if (typeof session_id === "string" && session_id) {
    try {
      order = await syncOrderWithSession(session_id);
    } catch (error) {
      // Id invalido o Stripe caido: se muestra "no encontramos tu compra".
      console.error(error);
    }
  }
  return <EventConfirmationView event={found.event} order={order} />;
}
