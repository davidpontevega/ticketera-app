import { Suspense } from "react";
import type { Metadata } from "next";

import { EventForm } from "@/modules/organizer";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Crear evento | Ticketera" };

export default async function NewEventPage() {
  await requireRole(ORGANIZER_AREA_ROLES);

  // EventForm lee ?draft= con useSearchParams
  return (
    <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-3xl bg-background" />}>
      <EventForm />
    </Suspense>
  );
}
