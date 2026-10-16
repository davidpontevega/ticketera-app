"use client";

import { useMemo, useState } from "react";

import { VenueMap } from "@/modules/ticket/components/venue-map";
import { buildVenueLayoutFromVenueZones } from "@/modules/ticket/utils/tier-layout.utils";

import type { VenueZoneDto } from "../types/venue.types";
import { generateSeatGrid } from "../utils/venue.utils";

export interface VenuePreviewProps {
  venueName: string;
  zones: readonly VenueZoneDto[];
}

const noop = () => {};

// Mismo mapa de la compra, solo lectura (precio 0: el recinto no tiene precios).
export function VenuePreview({ venueName, zones }: VenuePreviewProps) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const layout = useMemo(
    () =>
      buildVenueLayoutFromVenueZones(
        venueName,
        zones.map((zone) => ({
          tier: { id: zone.id, name: zone.name, price: 0, totalStock: zone.capacity },
          kind: zone.kind,
          seats: zone.kind === "numbered" ? generateSeatGrid(zone.rows, zone.seatsPerRow) : [],
        })),
      ),
    [venueName, zones],
  );

  return (
    <section aria-label={`Vista previa del mapa de ${venueName}`}>
      <VenueMap
        layout={layout}
        activeZoneId={activeZoneId}
        selectedSeatIds={[]}
        maxReached={false}
        onSelectZone={setActiveZoneId}
        onToggleSeat={noop}
        onBack={() => setActiveZoneId(null)}
      />
    </section>
  );
}
