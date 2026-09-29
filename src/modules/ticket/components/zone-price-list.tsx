import { cn } from "@/lib/utils";
import { EVENT_AVAILABILITY_LABEL, EventAvailabilityBadge, formatEventPrice } from "@/modules/event";

import type { VenueZone } from "../types/ticket.types";

export interface ZonePriceListProps {
  zones: readonly VenueZone[];
  className?: string;
}

export function ZonePriceList({ zones, className }: ZonePriceListProps) {
  return (
    <ul className={cn("flex flex-col border-t border-border", className)}>
      {zones.map((zone) => {
        const isSoldOut = zone.availability === "sold-out";
        return (
          <li
            key={zone.id}
            className="flex min-h-14 items-center justify-between gap-3 border-b border-border"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className={cn("size-3 shrink-0 rounded", isSoldOut ? "bg-border" : zone.colorClassName)}
              />
              <span
                className={cn("text-[15px] font-medium", isSoldOut && "text-muted-foreground")}
              >
                {zone.name}
              </span>
              {zone.availability === "few-left" && <EventAvailabilityBadge availability="few-left" />}
            </span>
            <span
              className={cn(
                "shrink-0 text-[15px] font-semibold",
                isSoldOut && "text-sm text-muted-foreground",
              )}
            >
              {isSoldOut ? EVENT_AVAILABILITY_LABEL["sold-out"] : formatEventPrice(zone.price)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
