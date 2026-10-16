import type { Metadata } from "next";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";
import { VenueList } from "@/modules/venue";
// Ruta directa: el servicio es server-only y el barrel llega al bundle cliente.
import { listVenues } from "@/modules/venue/services/venue.service";

export const metadata: Metadata = { title: "Recintos | Ticketera" };

export default async function VenuesPage() {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const venues = await listVenues(viewer);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <VenueList venues={venues} />
    </div>
  );
}
