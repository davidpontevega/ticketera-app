"use client";

import { EventSearch } from "@/modules/event";

import { useCatalogEvents } from "../hooks/use-catalog-events";

// Busqueda /events sobre el catalogo combinado (mock + eventos publicados desde el panel).
export function CatalogEventSearch() {
  return <EventSearch events={useCatalogEvents()} />;
}
