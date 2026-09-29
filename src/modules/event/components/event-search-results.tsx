import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import type { EventEntity } from "../types/event.types";
import { EventCard } from "./event-card";

export interface EventSearchResultsProps {
  events: readonly EventEntity[];
  onClear: () => void;
}

export function EventSearchResults({ events, onClear }: EventSearchResultsProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos eventos con esos filtros"
        description="Prueba quitando algun filtro o buscando otra ciudad."
        action={
          <Button type="button" size="lg" onClick={onClear} className="h-11 px-5">
            Limpiar filtros
          </Button>
        }
        titleAs="h2"
        className="max-w-none"
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} className="h-full" />
        </li>
      ))}
    </ul>
  );
}
