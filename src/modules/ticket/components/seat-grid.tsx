"use client";

import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Seat, VenueZone } from "../types/ticket.types";

export interface SeatGridProps {
  zone: VenueZone;
  selectedSeatIds: readonly string[];
  maxReached: boolean;
  onToggleSeat: (seatId: string) => void;
}

const SEAT_STEP = 28;
const SEAT_RADIUS = 10;
const ROW_LABEL_WIDTH = 28;
const FRONT_HEIGHT = 44;

function groupSeatsByRow(seats: readonly Seat[]): [string, Seat[]][] {
  const rows = new Map<string, Seat[]>();
  for (const seat of seats) {
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
  }
  return [...rows.entries()];
}

export function SeatGrid({ zone, selectedSeatIds, maxReached, onToggleSeat }: SeatGridProps) {
  const rows = groupSeatsByRow(zone.seats);
  const seatsPerRow = Math.max(0, ...zone.seats.map((seat) => seat.number));
  const width = ROW_LABEL_WIDTH * 2 + seatsPerRow * SEAT_STEP;
  const height = FRONT_HEIGHT + rows.length * SEAT_STEP;
  const selected = new Set(selectedSeatIds);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full min-w-[560px] select-none sm:h-full sm:min-w-0"
      role="group"
      aria-label={`Asientos de ${zone.name}`}
    >
      <rect
        x={ROW_LABEL_WIDTH}
        y={4}
        width={seatsPerRow * SEAT_STEP}
        height={24}
        rx={8}
        className="fill-foreground"
      />
      <text
        x={width / 2}
        y={20}
        textAnchor="middle"
        className="fill-background text-[10px] font-bold tracking-[0.16em]"
      >
        HACIA EL ESCENARIO
      </text>

      {rows.map(([row, seats], rowIndex) => {
        const cy = FRONT_HEIGHT + rowIndex * SEAT_STEP + SEAT_STEP / 2;
        return (
          <g key={row}>
            {[ROW_LABEL_WIDTH / 2, width - ROW_LABEL_WIDTH / 2].map((x) => (
              <text
                key={x}
                x={x}
                y={cy + 4}
                textAnchor="middle"
                aria-hidden
                className="fill-muted-foreground text-[11px] font-medium"
              >
                {row}
              </text>
            ))}
            {seats.map((seat) => {
              const isSelected = selected.has(seat.id);
              const isOccupied = seat.status === "occupied";
              const isDisabled = isOccupied || (maxReached && !isSelected);
              const cx = ROW_LABEL_WIDTH + (seat.number - 1) * SEAT_STEP + SEAT_STEP / 2;
              const toggle = () => {
                if (!isDisabled) onToggleSeat(seat.id);
              };
              const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                toggle();
              };
              return (
                <g
                  key={seat.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled || undefined}
                  aria-label={`Fila ${seat.row}, asiento ${seat.number}${isOccupied ? ", ocupado" : ""}`}
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={toggle}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "group outline-none",
                    isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                >
                  <title>{`Fila ${seat.row}, asiento ${seat.number}`}</title>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={SEAT_RADIUS}
                    className={cn(
                      "stroke-transparent stroke-[3] transition-opacity duration-150 group-focus-visible:stroke-ring",
                      isSelected && "fill-foreground",
                      !isSelected && isOccupied && "fill-border",
                      !isSelected && !isOccupied && zone.seatClassName,
                      !isSelected && !isOccupied && maxReached && "opacity-40",
                      !isDisabled && !isSelected && "group-hover:opacity-70",
                    )}
                  />
                  {isSelected && (
                    <Check
                      x={cx - 6}
                      y={cy - 6}
                      width={12}
                      height={12}
                      strokeWidth={3}
                      className="pointer-events-none text-background"
                      aria-hidden
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
