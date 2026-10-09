import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EventForm } from "@/modules/organizer";
// Ruta directa: el servicio es server-only y el barrel llega al bundle cliente.
import { getEventForEdit } from "@/modules/organizer/services/organizer-event-write.service";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Editar evento | Ticketera" };

export default async function EditEventPage({ params }: PageProps<"/organizer/events/[id]/edit">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const event = await getEventForEdit(parsed.data, viewer);
  if (!event) notFound();

  return (
    <EventForm
      eventId={parsed.data}
      status={event.status}
      initialValues={event.values}
      tiersLocked={event.hasOrders}
    />
  );
}
