"use client";

import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EVENT_AVAILABILITY_LABEL,
  EventAvailabilityBadge,
  formatEventPrice,
} from "@/modules/event";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import type { VenueLayout } from "../types/ticket.types";
import { formatTicketCount } from "../utils/ticket.utils";

export interface TicketTierListProps {
  layout: VenueLayout;
  activeZoneId: string | null;
  quantities: Readonly<Record<string, number>>;
  seatIds: Readonly<Record<string, readonly string[]>>;
  onSelectZone: (zoneId: string) => void;
  onQuantityChange: (zoneId: string, quantity: number) => void;
}

export function TicketTierList({
  layout,
  activeZoneId,
  quantities,
  seatIds,
  onSelectZone,
  onQuantityChange,
}: TicketTierListProps) {
  return (
    <Card className="sm:[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Entradas</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {layout.zones.map((zone) => {
            const isSoldOut = zone.availability === "sold-out";
            const selectedSeats = seatIds[zone.id]?.length ?? 0;
            return (
              <li
                key={zone.id}
                className={cn(
                  "-mx-2 flex min-h-18 items-center gap-3 rounded-lg border-t border-border px-2 py-2 first:border-t-0",
                  zone.id === activeZoneId && "bg-primary/5",
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 rounded", isSoldOut && "bg-border")}
                  style={isSoldOut ? undefined : { backgroundColor: zone.fillColor }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {zone.name}
                    {zone.availability === "few-left" && (
                      <EventAvailabilityBadge availability="few-left" />
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatEventPrice(zone.price)} c/u
                    {zone.seating === "numbered" && " · Numerada"}
                    {!isSoldOut && zone.remaining !== undefined && ` · Quedan ${zone.remaining}`}
                  </span>
                </span>

                {isSoldOut && (
                  <span className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
                    {EVENT_AVAILABILITY_LABEL["sold-out"]}
                  </span>
                )}
                {!isSoldOut && zone.seating === "general" && (
                  <QuantityStepper
                    value={quantities[zone.id] ?? 0}
                    max={Math.min(TICKET_MAX_PER_ZONE, zone.remaining ?? TICKET_MAX_PER_ZONE)}
                    label={zone.name}
                    onChange={(quantity) => onQuantityChange(zone.id, quantity)}
                  />
                )}
                {!isSoldOut && zone.seating === "numbered" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 px-3"
                    onClick={() => onSelectZone(zone.id)}
                  >
                    {selectedSeats > 0 ? formatTicketCount(selectedSeats) : "Elegir asientos"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter className="border-t border-border text-xs text-muted-foreground sm:text-sm">
        Maximo {TICKET_MAX_PER_ZONE} entradas por zona.
      </CardFooter>
    </Card>
  );
}
