import type { Metadata } from "next";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";
import { VenueForm } from "@/modules/venue";

export const metadata: Metadata = { title: "Nuevo recinto | Ticketera" };

export default async function NewVenuePage() {
  await requireRole(ORGANIZER_AREA_ROLES);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Nuevo recinto</h1>
      <VenueForm />
    </div>
  );
}
