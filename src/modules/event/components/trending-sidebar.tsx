import type { JSX } from "react";
import Image from "next/image";

import type { EventEntity } from "../types/event.types";
import { formatEventDate } from "../utils/event.utils";

export interface TrendingSidebarProps {
  events: readonly EventEntity[];
}

export function TrendingSidebar({ events }: TrendingSidebarProps): JSX.Element | null {
  if (events.length === 0) return null;

  return (
    <aside
      aria-labelledby="trending-sidebar-title"
      className="flex h-80 flex-col rounded-xl border bg-card p-4 md:h-[420px]"
    >
      <h2 id="trending-sidebar-title" className="font-heading text-xl font-semibold">
        Nuestras <span className="text-primary">Tendencias</span>
      </h2>
      <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {events.map((event) => (
          <li key={event.id}>
            <a
              href="#upcoming-events"
              className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative size-16 shrink-0">
                <Image
                  src={event.imageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="rounded-lg object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-medium">{event.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatEventDate(event.date)}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
