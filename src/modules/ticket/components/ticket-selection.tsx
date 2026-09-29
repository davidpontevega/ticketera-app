"use client";

import { useEffect } from "react";

import type { EventEntity } from "@/modules/event";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import { useTicketSelectionStore } from "../store/ticket-selection.store";
import type { VenueLayout } from "../types/ticket.types";
import { getTicketLines } from "../utils/ticket.utils";
import { PurchaseSummary } from "./purchase-summary";
import { SeatMap } from "./seat-map";
import { TicketTierList } from "./ticket-tier-list";
import { ZoneMap } from "./zone-map";

export interface TicketSelectionProps {
  event: EventEntity;
  layout: VenueLayout;
}

function scrollToSeatMap() {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
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
  } = useTicketSelectionStore();

  useEffect(() => {
    startSelection(event.id);
  }, [event.id, startSelection]);

  // Mientras el store no apunte a este evento, se ignora la seleccion de otro evento.
  const isCurrentEvent = eventId === event.id;
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
        <ZoneMap layout={layout} activeZoneId={activeZone?.id ?? null} onSelectZone={selectZone} />
        {activeZone?.seating === "numbered" && (
          <SeatMap
            key={activeZone.id}
            zone={activeZone}
            selectedSeatIds={activeSeatIds}
            maxReached={activeSeatIds.length >= TICKET_MAX_PER_ZONE}
            onToggleSeat={(seatId) => toggleSeat(activeZone.id, seatId)}
          />
        )}
        <TicketTierList
          layout={layout}
          activeZoneId={activeZone?.id ?? null}
          quantities={isCurrentEvent ? quantities : {}}
          seatIds={isCurrentEvent ? seatIds : {}}
          onSelectZone={handleSelectFromList}
          onQuantityChange={setQuantity}
        />
      </div>
      <PurchaseSummary lines={lines} checkoutHref={`/events/${event.slug}/checkout`} />
    </div>
  );
}
