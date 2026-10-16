import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";
import { VenueForm, VenueZoneEditor } from "@/modules/venue";
// Ruta directa: el servicio es server-only y el barrel llega al bundle cliente.
import { getVenueForEdit } from "@/modules/venue/services/venue.service";

export const metadata: Metadata = { title: "Editar recinto | Ticketera" };

export default async function EditVenuePage({ params }: PageProps<"/organizer/venues/[id]">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const { id } = await params;

  const venue = await getVenueForEdit(id, viewer); // null: id no uuid, inexistente o ajeno
  if (!venue) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="font-heading text-3xl font-bold tracking-tight">{venue.name}</h1>
      <VenueForm venue={venue} />
      <VenueZoneEditor venue={venue} />
    </div>
  );
}
