"use client";

import { useShallow } from "zustand/react/shallow";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EVENT_CATEGORIES } from "../constants/event.constants";
import { useEventFilterStore } from "../store/event-filter.store";
import type { EventCategoryFilter, EventEntity } from "../types/event.types";
import { filterEvents } from "../utils/event.utils";
import { EventCard } from "./event-card";

export interface UpcomingEventsProps {
  events: readonly EventEntity[];
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  const filters = useEventFilterStore(
    useShallow((state) => ({
      query: state.query,
      category: state.category,
      dateRange: state.dateRange,
      priceRange: state.priceRange,
    })),
  );
  const setCategory = useEventFilterStore((state) => state.setCategory);
  const filteredEvents = filterEvents(events, filters);

  return (
    <section id="upcoming-events" className="scroll-mt-40 py-12">
      <h2 className="font-heading text-2xl font-semibold">Proximos eventos</h2>
      <Tabs
        value={filters.category}
        onValueChange={(value) => setCategory(value as EventCategoryFilter)}
        className="mt-6"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="px-3 text-xs data-active:text-primary">
            Todos
          </TabsTrigger>
          {EVENT_CATEGORIES.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="gap-1 px-3 text-xs data-active:text-primary"
            >
              <Icon />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filters.category}>
          {filteredEvents.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-muted-foreground">
              No encontramos eventos con esos filtros.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
