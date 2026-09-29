import { cn } from "@/lib/utils";
import { EVENT_AVAILABILITY_LABEL, formatEventPrice } from "@/modules/event";

import { SEAT_STATUS_LABEL } from "../constants/ticket.constants";
import type { VenueLayout } from "../types/ticket.types";

export interface VenueLegendProps {
  layout: VenueLayout;
  showSeatStates: boolean; // solo tiene sentido si hay zonas numeradas
}

const HATCH_STYLE = {
  backgroundImage: "repeating-linear-gradient(45deg, #94A3B8 0 2px, #E2E8F0 2px 6px)",
};

export function VenueLegend({ layout, showSeatStates }: VenueLegendProps) {
  const seatStates = [
    { label: SEAT_STATUS_LABEL.available, className: "bg-primary" },
    { label: SEAT_STATUS_LABEL.selected, className: "bg-foreground" },
    { label: SEAT_STATUS_LABEL.occupied, className: "bg-[#CBD5E1]" },
  ];

  return (
    <div className="flex flex-col gap-3 text-xs sm:text-sm">
      <ul aria-label="Precios por zona" className="flex flex-wrap gap-x-5 gap-y-2">
        {layout.zones.map((zone) => {
          const isSoldOut = zone.availability === "sold-out";
          return (
            <li key={zone.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded"
                style={isSoldOut ? HATCH_STYLE : { backgroundColor: zone.fillColor }}
              />
              <span className={cn(isSoldOut && "text-muted-foreground")}>{zone.name}</span>
              <span className={cn("font-semibold", isSoldOut && "text-muted-foreground")}>
                {isSoldOut ? EVENT_AVAILABILITY_LABEL["sold-out"] : formatEventPrice(zone.price)}
              </span>
            </li>
          );
        })}
      </ul>
      {showSeatStates && (
        <ul
          aria-label="Estados de asiento"
          className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground"
        >
          {seatStates.map((state) => (
            <li key={state.label} className="flex items-center gap-2">
              <span aria-hidden className={cn("size-3 rounded-full", state.className)} />
              {state.label}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded" style={HATCH_STYLE} />
            {EVENT_AVAILABILITY_LABEL["sold-out"]}
          </li>
        </ul>
      )}
    </div>
  );
}
