import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { EventEntity } from "../types/event.types";
import { EventCard } from "./event-card";

export interface RelatedEventsProps {
  events: readonly EventEntity[];
}

export function RelatedEvents({ events }: RelatedEventsProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-events-title" className="bg-muted py-8 lg:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 md:px-6 lg:gap-7">
        <div className="flex items-end justify-between gap-4">
          <h2
            id="related-events-title"
            className="font-heading text-xl font-bold tracking-tight lg:text-3xl"
          >
            Tambien te puede interesar
          </h2>
          <Link
            href="/#upcoming-events"
            className="hidden items-center gap-1.5 text-[15px] font-semibold text-primary hover:underline sm:flex"
          >
            Ver mas eventos
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
          {events.map((event) => (
            <li key={event.id} className="w-64 shrink-0 snap-start lg:w-auto">
              <EventCard event={event} className="h-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
