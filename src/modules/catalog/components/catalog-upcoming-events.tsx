"use client";

import { UpcomingEvents } from "@/modules/event";

import { useCatalogEvents } from "../hooks/use-catalog-events";

// "Proximos eventos" de la landing con los eventos publicados desde el panel.
export function CatalogUpcomingEvents() {
  return <UpcomingEvents events={useCatalogEvents()} />;
}
