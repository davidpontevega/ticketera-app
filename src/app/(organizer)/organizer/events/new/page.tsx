import type { Metadata } from "next";

import { EventForm } from "@/modules/organizer";
// Ruta directa: el servicio es server-only.
import { listVenueOptions } from "@/modules/venue/services/venue.service";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Crear evento | Ticketera" };

export default async function NewEventPage() {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  return <EventForm venueOptions={await listVenueOptions(viewer)} />;
}
