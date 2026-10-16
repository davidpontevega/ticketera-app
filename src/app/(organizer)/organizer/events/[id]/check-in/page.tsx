import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CheckInPanel } from "@/modules/organizer";
// Ruta directa: los servicios son server-only y el barrel llega al bundle cliente.
import { getCheckInStats } from "@/modules/organizer/services/organizer-check-in.service";
import { getEventForEdit } from "@/modules/organizer/services/organizer-event-write.service";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Check-in | Ticketera" };

export default async function CheckInPage({ params }: PageProps<"/organizer/events/[id]/check-in">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  // Reusa getEventForEdit para resolver el evento dentro del scope del viewer (notFound si es ajeno).
  const event = await getEventForEdit(parsed.data, viewer);
  if (!event) notFound();
  const stats = await getCheckInStats(parsed.data, viewer);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Check-in: {event.values.name}</h1>
      <CheckInPanel eventId={parsed.data} stats={stats} />
    </div>
  );
}
