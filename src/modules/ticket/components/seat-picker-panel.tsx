"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { formatEventPrice } from "@/modules/event";

import { TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import type { VenueZone } from "../types/ticket.types";
import { findBestSeats } from "../utils/ticket.utils";

export interface SeatPickerPanelProps {
  zone: VenueZone;
  selectedSeatIds: readonly string[];
  onSetSeats: (seatIds: string[]) => void;
  onRemoveSeat: (seatId: string) => void;
}

export function SeatPickerPanel({
  zone,
  selectedSeatIds,
  onSetSeats,
  onRemoveSeat,
}: SeatPickerPanelProps) {
  const [quantity, setQuantity] = useState(2);
  const [notFound, setNotFound] = useState(false);
  const selected = zone.seats
    .filter((seat) => selectedSeatIds.includes(seat.id))
    .sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number);

  const pickBestSeats = () => {
    const best = findBestSeats(zone, quantity);
    setNotFound(best.length === 0);
    if (best.length > 0) onSetSeats(best);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {zone.name} · <span className="font-normal">{formatEventPrice(zone.price)} c/u</span>
        </p>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {selected.length} de {TICKET_MAX_PER_ZONE} asientos
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Mejores asientos</span>
        <QuantityStepper
          value={quantity}
          min={1}
          max={TICKET_MAX_PER_ZONE}
          label="mejores asientos"
          onChange={(value) => {
            setQuantity(value);
            setNotFound(false);
          }}
        />
        <Button type="button" onClick={pickBestSeats} className="h-10 px-4">
          <Sparkles aria-hidden />
          Elegir los mejores
        </Button>
      </div>
      {notFound && (
        <p role="status" className="text-sm text-destructive">
          No hay {quantity} asientos juntos disponibles en esta zona.
        </p>
      )}

      {selected.length > 0 ? (
        <ul aria-label="Asientos elegidos" className="flex flex-wrap gap-2">
          {selected.map((seat) => (
            <li key={seat.id}>
              <button
                type="button"
                aria-label={`Quitar asiento fila ${seat.row} numero ${seat.number}`}
                onClick={() => onRemoveSeat(seat.id)}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-foreground pr-2 pl-3 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {seat.row}
                {seat.number}
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Toca los asientos en el mapa o usa &quot;Elegir los mejores&quot;.
        </p>
      )}
    </div>
  );
}
