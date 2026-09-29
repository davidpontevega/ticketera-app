"use client";

import { useMemo } from "react";

import { useIsClient } from "@/hooks/use-is-client";
import { EVENTS_MOCK, type EventEntity } from "@/modules/event";
import { useOrganizerStore } from "@/modules/organizer";

import { getPublishedCatalogEvents } from "../utils/catalog.utils";

// Catalogo publico: eventos del mock + los publicados desde el panel en este navegador.
// Antes de hidratar solo el mock, para que el HTML del servidor y el primer render coincidan.
export function useCatalogEvents(): readonly EventEntity[] {
  const isClient = useIsClient();
  const organizerEvents = useOrganizerStore((state) => state.events);
  return useMemo(
    () =>
      isClient ? [...EVENTS_MOCK, ...getPublishedCatalogEvents(organizerEvents)] : EVENTS_MOCK,
    [isClient, organizerEvents],
  );
}
