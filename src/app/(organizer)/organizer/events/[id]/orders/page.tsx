import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/shared/empty-state";
import { EventOrdersTable, RetryRefundsButton } from "@/modules/organizer";
// Ruta directa: los servicios son server-only y el barrel llega al bundle cliente.
import {
  getEventHeaderForOrders,
  listEventOrders,
} from "@/modules/organizer/services/organizer-refund.service";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Ordenes | Ticketera" };

export default async function EventOrdersPage({ params }: PageProps<"/organizer/events/[id]/orders">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const event = await getEventHeaderForOrders(parsed.data, viewer);
  if (!event) notFound();
  const orders = await listEventOrders(parsed.data, viewer);
  const hasPaid = orders.some((order) => order.status === "paid");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ordenes: {event.title}</h1>
      {event.status === "cancelled" && hasPaid && <RetryRefundsButton eventId={parsed.data} />}
      {orders.length === 0 ? (
        <EmptyState icon={Receipt} titleAs="h2" title="Sin ordenes" description="Aun no hay ordenes pagadas para este evento." />
      ) : (
        <EventOrdersTable eventId={parsed.data} orders={orders} />
      )}
    </div>
  );
}
