"use client";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EVENT_AVAILABILITY_LABEL, formatEventPrice } from "@/modules/event";

import type { VenueLayout } from "../types/ticket.types";

export interface ZoneMapProps {
  layout: VenueLayout;
  activeZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

export function ZoneMap({ layout, activeZoneId, onSelectZone }: ZoneMapProps) {
  return (
    <Card className="sm:[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Elige tu zona</CardTitle>
        <CardAction className="text-xs text-muted-foreground sm:text-sm">
          Toca una zona<span className="hidden sm:inline"> del mapa</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className="grid h-72 gap-2 rounded-xl bg-muted p-3 sm:h-96 sm:gap-2.5 sm:p-5"
          style={{
            gridTemplateColumns: layout.gridTemplateColumns,
            gridTemplateRows: layout.gridTemplateRows,
          }}
        >
          <span
            className="flex items-center justify-center rounded-lg bg-foreground text-[10px] font-bold uppercase tracking-[0.16em] text-background sm:text-xs"
            style={{ gridColumn: layout.stageArea.column, gridRow: layout.stageArea.row }}
          >
            {layout.stageLabel}
          </span>
          {layout.zones.map((zone) => {
            const isSoldOut = zone.availability === "sold-out";
            const isActive = zone.id === activeZoneId;
            const status = isSoldOut
              ? EVENT_AVAILABILITY_LABEL["sold-out"]
              : formatEventPrice(zone.price);
            return (
              <button
                key={zone.id}
                type="button"
                aria-pressed={isActive}
                aria-label={`${zone.name}, ${status}`}
                disabled={isSoldOut}
                onClick={() => onSelectZone(zone.id)}
                style={{ gridColumn: zone.area.column, gridRow: zone.area.row }}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSoldOut
                    ? "cursor-not-allowed bg-border text-muted-foreground"
                    : cn(zone.colorClassName, "hover:brightness-95"),
                  isActive && "ring-3 ring-foreground ring-inset",
                )}
              >
                <span className="text-xs font-semibold leading-tight sm:text-[15px]">
                  <span className="sm:hidden">{zone.shortName}</span>
                  <span className="hidden sm:inline">{zone.name}</span>
                </span>
                <span className="text-[11px] sm:text-[13px]">{status}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
