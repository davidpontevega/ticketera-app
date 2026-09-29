import { Star } from "lucide-react";

import type { EventEntity } from "../types/event.types";
import { EventCard } from "./event-card";

export interface BestSellerEventsProps {
  events: readonly EventEntity[];
}

export function BestSellerEvents({ events }: BestSellerEventsProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="best-seller-events-title" className="py-8">
      <h2
        id="best-seller-events-title"
        className="flex items-center gap-2 font-heading text-2xl font-semibold"
      >
        <Star aria-hidden className="size-6 text-primary" />
        <span>
          Lo mas <span className="text-primary">vendido</span> esta semana
        </span>
      </h2>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} className="h-full" />
          </li>
        ))}
      </ol>
    </section>
  );
}
