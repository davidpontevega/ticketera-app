import type { Metadata } from "next";

import { EventForm } from "@/modules/organizer";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Crear evento | Ticketera" };

export default async function NewEventPage() {
  await requireRole(ORGANIZER_AREA_ROLES);

  return <EventForm />;
}
