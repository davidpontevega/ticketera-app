"use client";

import { useEffect } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsClient } from "@/hooks/use-is-client";
import { getEventHref, type EventEntity } from "@/modules/event";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import { useTicketSelectionStore } from "../store/ticket-selection.store";
import type { VenueLayout } from "../types/ticket.types";
import { getTicketLines } from "../utils/ticket.utils";
import { PurchaseSummary } from "./purchase-summary";
import { SeatPickerPanel } from "./seat-picker-panel";
import { TicketTierList } from "./ticket-tier-list";
import { VenueLegend } from "./venue-legend";
import { VenueMap } from "./venue-map";

export interface TicketSelectionProps {
  event: EventEntity;
  layout: VenueLayout;
}

function scrollToSeatMap() {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  document.getElementById("seat-map")?.scrollIntoView({ behavior, block: "start" });
}

export function TicketSelection({ event, layout }: TicketSelectionProps) {
  const {
    eventId,
    activeZoneId,
    quantities,
    seatIds,
    startSelection,
    selectZone,
    setQuantity,
    toggleSeat,
    setSeats,
  } = useTicketSelectionStore();
  const isClient = useIsClient();

  useEffect(() => {
    startSelection(event.id);
  }, [event.id, startSelection]);

  // El store se persiste en localStorage/sessionStorage: antes de hidratar (isClient) se renderiza vacio
  // igual que el HTML estatico, y se ignora la seleccion que sea de otro evento.
  const isCurrentEvent = isClient && eventId === event.id;
  const activeZone = isCurrentEvent
    ? layout.zones.find((zone) => zone.id === activeZoneId)
    : undefined;
  const lines = isCurrentEvent ? getTicketLines(layout, quantities, seatIds) : [];
  const activeSeatIds = activeZone ? (seatIds[activeZone.id] ?? []) : [];

  const handleSelectFromList = (zoneId: string) => {
    selectZone(zoneId);
    requestAnimationFrame(scrollToSeatMap);
  };

  return (
    <div className="grid items-start gap-6 pb-32 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:pb-0">
      <div className="flex min-w-0 flex-col gap-6">
        <Card id="seat-map" className="scroll-mt-24 sm:[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {activeZone?.seating === "numbered" ? "Elige tus asientos" : "Elige tu zona"}
            </CardTitle>
            <CardAction className="text-xs text-muted-foreground sm:text-sm">
              {activeZone ? activeZone.name : "Toca una zona del mapa"}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <VenueMap
              layout={layout}
              activeZoneId={activeZone?.id ?? null}
              selectedSeatIds={activeSeatIds}
              maxReached={activeSeatIds.length >= TICKET_MAX_PER_ZONE}
              onSelectZone={selectZone}
              onToggleSeat={toggleSeat}
              onBack={() => selectZone(null)}
            />
            {activeZone?.seating === "numbered" && (
              <SeatPickerPanel
                key={activeZone.id}
                zone={activeZone}
                selectedSeatIds={activeSeatIds}
                onSetSeats={(ids) => setSeats(activeZone.id, ids)}
                onRemoveSeat={(seatId) => toggleSeat(activeZone.id, seatId)}
              />
            )}
            <VenueLegend
              layout={layout}
              showSeatStates={layout.zones.some((zone) => zone.seating === "numbered")}
            />
          </CardContent>
        </Card>
        <TicketTierList
          layout={layout}
          activeZoneId={activeZone?.id ?? null}
          quantities={isCurrentEvent ? quantities : {}}
          seatIds={isCurrentEvent ? seatIds : {}}
          onSelectZone={handleSelectFromList}
          onQuantityChange={setQuantity}
        />
      </div>
      <PurchaseSummary lines={lines} checkoutHref={`${getEventHref(event.slug)}/checkout`} />
    </div>
  );
}
