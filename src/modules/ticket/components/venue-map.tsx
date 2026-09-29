"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ArrowLeft, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENT_AVAILABILITY_LABEL, formatEventPrice } from "@/modules/event";

import type { Seat, VenueLayout, VenueZone } from "../types/ticket.types";
import { getAvailableSeatCount } from "../utils/ticket.utils";
import { getShapeCenter, getShapePath } from "../utils/venue-geometry";

export interface VenueMapProps {
  layout: VenueLayout;
  activeZoneId: string | null;
  selectedSeatIds: readonly string[]; // asientos elegidos de la zona activa
  maxReached: boolean;
  onSelectZone: (zoneId: string) => void;
  onToggleSeat: (zoneId: string, seatId: string) => void;
  onBack: () => void;
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

const SEAT_RADIUS = 5.5;
const ZOOM_ANIMATION_MS = 300;
const RESIZE_SETTLE_MS = 80; // la libreria de zoom mide el contenedor con ResizeObserver (asincrono)
const HATCH_ID = "venue-sold-out-hatch";
const OCCUPIED_FILL = "#CBD5E1";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getZoneStatusText(zone: VenueZone): string {
  if (zone.availability === "sold-out") return EVENT_AVAILABILITY_LABEL["sold-out"];
  if (zone.seating === "numbered") return `${getAvailableSeatCount(zone)} asientos libres`;
  if (zone.remaining !== undefined) return `${zone.remaining} disponibles`;
  return EVENT_AVAILABILITY_LABEL[zone.availability];
}

function getZoneLabel(zone: VenueZone): string {
  return `${zone.name}, ${formatEventPrice(zone.price)}, ${getZoneStatusText(zone)}`;
}

function getSeatLabel(seat: Seat, zone: VenueZone): string {
  return `Fila ${seat.row}, asiento ${seat.number}, ${formatEventPrice(zone.price)}${
    seat.status === "occupied" ? ", ocupado" : ""
  }`;
}

// Vecino para navegar con flechas: izquierda/derecha en la fila, arriba/abajo cambia de fila.
function getNeighborSeat(seats: readonly Seat[], current: Seat, key: string): Seat | undefined {
  const rows = [...new Set(seats.map((seat) => seat.row))];
  const rowIndex = rows.indexOf(current.row);
  const inRow = (row: string) =>
    seats.filter((seat) => seat.row === row).sort((a, b) => a.number - b.number);
  if (key === "ArrowRight" || key === "ArrowLeft") {
    const row = inRow(current.row);
    const index = row.findIndex((seat) => seat.id === current.id);
    return row[index + (key === "ArrowRight" ? 1 : -1)];
  }
  const targetRow = rows[rowIndex + (key === "ArrowDown" ? 1 : -1)];
  if (!targetRow) return undefined;
  const row = inRow(targetRow);
  return row.find((seat) => seat.number === current.number) ?? row[row.length - 1];
}

export function VenueMap({
  layout,
  activeZoneId,
  selectedSeatIds,
  maxReached,
  onSelectZone,
  onToggleSeat,
  onBack,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);

  const activeZone = layout.zones.find(
    (zone) => zone.id === activeZoneId && zone.seating === "numbered",
  );
  const selected = new Set(selectedSeatIds);
  const rovingSeatId =
    activeZone?.seats.find((seat) => seat.id === focusedSeatId)?.id ??
    activeZone?.seats.find((seat) => seat.status === "available")?.id ??
    activeZone?.seats[0]?.id;

  // Zoom a la seccion numerada activa; vuelta a la vista general sin seccion activa. Se espera
  // un momento: en mobile el contenedor cambia de alto al activar una seccion y el zoom tiene
  // que calcularse con el tamaño nuevo.
  const activeZoneKey = activeZone?.id ?? null;
  useEffect(() => {
    const timeout = setTimeout(() => {
      const controls = transformRef.current;
      if (!controls) return;
      const animationTime = prefersReducedMotion() ? 0 : ZOOM_ANIMATION_MS;
      if (activeZoneKey) {
        void controls.zoomToElement(`venue-zone-${activeZoneKey}`, { maxScale: 4, animationTime });
      } else {
        void controls.resetTransform(animationTime);
      }
    }, RESIZE_SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [activeZoneKey]);

  const showTooltipAtPointer = (event: MouseEvent, text: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, text });
  };

  const showTooltipAtElement = (event: FocusEvent<Element>, text: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: target.left + target.width / 2 - rect.left, y: target.top - rect.top, text });
  };

  const hideTooltip = () => setTooltip(null);

  const handleZoneKeyDown = (event: KeyboardEvent<SVGGElement>, zone: VenueZone) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (zone.availability !== "sold-out") onSelectZone(zone.id);
  };

  const handleSeatKeyDown = (event: KeyboardEvent<SVGGElement>, seat: Seat, zone: VenueZone) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (seat.status === "available" && (!maxReached || selected.has(seat.id))) {
        onToggleSeat(zone.id, seat.id);
      }
      return;
    }
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const next = getNeighborSeat(zone.seats, seat, event.key);
    if (!next) return;
    setFocusedSeatId(next.id);
    document.getElementById(`venue-seat-${next.id}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative overflow-hidden rounded-xl bg-muted">
        <TransformWrapper
          ref={transformRef}
          minScale={1}
          maxScale={6}
          centerOnInit
          doubleClick={{ disabled: true }}
          onPanningStart={hideTooltip}
        >
          <TransformComponent
            wrapperClass={cn("!w-full sm:!h-auto", activeZone ? "!h-[440px]" : "!h-auto")}
            contentClass="!w-full !h-full items-center"
          >
            <svg
              viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
              className="h-auto w-full select-none"
              role="group"
              aria-label="Mapa del recinto"
            >
              <defs>
                <pattern
                  id={HATCH_ID}
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="10" height="10" fill="#E2E8F0" />
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#94A3B8" strokeWidth="3" />
                </pattern>
              </defs>

              <g aria-hidden>
                <path d={getShapePath(layout.stage.shape)} className="fill-foreground" />
                <text
                  {...getShapeCenter(layout.stage.shape)}
                  dy="0.35em"
                  textAnchor="middle"
                  className="fill-background text-[18px] font-bold tracking-[0.2em] uppercase"
                >
                  {layout.stage.label}
                </text>
              </g>

              {layout.zones.map((zone) => {
                const isSoldOut = zone.availability === "sold-out";
                const isActive = zone.id === activeZoneId;
                const isDimmed = Boolean(activeZone) && !isActive;
                const isHovered = zone.id === hoveredZoneId;
                const center = getShapeCenter(zone.shape);
                const zoneLabel = getZoneLabel(zone);
                const showSeats = isActive && zone.seating === "numbered";
                return (
                  <g
                    key={zone.id}
                    id={`venue-zone-${zone.id}`}
                    role="button"
                    tabIndex={isSoldOut ? -1 : 0}
                    aria-label={zoneLabel}
                    aria-pressed={isActive}
                    aria-disabled={isSoldOut || undefined}
                    onClick={() => !isSoldOut && onSelectZone(zone.id)}
                    onKeyDown={(event) => handleZoneKeyDown(event, zone)}
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseMove={(event) => !showSeats && showTooltipAtPointer(event, zoneLabel)}
                    onMouseLeave={() => {
                      setHoveredZoneId(null);
                      hideTooltip();
                    }}
                    onFocus={(event) => {
                      if (event.target !== event.currentTarget) return;
                      setHoveredZoneId(zone.id);
                      showTooltipAtElement(event, zoneLabel);
                    }}
                    onBlur={() => {
                      setHoveredZoneId(null);
                      hideTooltip();
                    }}
                    className={cn(
                      "outline-none transition-opacity duration-200",
                      isSoldOut ? "cursor-not-allowed" : "cursor-pointer",
                      isDimmed && "opacity-35",
                    )}
                  >
                    <path
                      d={getShapePath(zone.shape)}
                      fill={isSoldOut ? `url(#${HATCH_ID})` : zone.fillColor}
                      fillOpacity={showSeats ? 0.18 : 1}
                      className={cn(
                        "stroke-[3] transition-[stroke] duration-150",
                        isActive || (isHovered && !isSoldOut)
                          ? "stroke-foreground"
                          : "stroke-background",
                      )}
                    />
                    {!showSeats && (
                      <text
                        x={center.x}
                        y={center.y}
                        textAnchor="middle"
                        aria-hidden
                        fill={isSoldOut ? "#475569" : zone.labelColor}
                        className="pointer-events-none"
                      >
                        <tspan
                          x={center.x}
                          dy="-0.2em"
                          className="text-[28px] font-semibold sm:text-[17px]"
                        >
                          {zone.shortName}
                        </tspan>
                        <tspan x={center.x} dy="1.3em" className="text-[14px] max-sm:hidden">
                          {isSoldOut ? "Agotado" : `desde ${formatEventPrice(zone.price)}`}
                        </tspan>
                      </text>
                    )}
                  </g>
                );
              })}
              {activeZone && (
                <g role="group" aria-label={`Asientos de ${activeZone.name}`}>
                  {activeZone.seats.map((seat) => {
                    const isSelected = selected.has(seat.id);
                    const isOccupied = seat.status === "occupied";
                    const isDisabled = isOccupied || (maxReached && !isSelected);
                    const seatLabel = getSeatLabel(seat, activeZone);
                    return (
                      <g
                        key={seat.id}
                        id={`venue-seat-${seat.id}`}
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-disabled={isDisabled || undefined}
                        aria-label={seatLabel}
                        tabIndex={seat.id === rovingSeatId ? 0 : -1}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isDisabled) onToggleSeat(activeZone.id, seat.id);
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          handleSeatKeyDown(event, seat, activeZone);
                        }}
                        onMouseMove={(event) => {
                          event.stopPropagation();
                          showTooltipAtPointer(event, seatLabel);
                        }}
                        onFocus={(event) => {
                          event.stopPropagation();
                          setFocusedSeatId(seat.id);
                          showTooltipAtElement(event, seatLabel);
                        }}
                        className={cn(
                          "group/seat outline-none",
                          isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                        )}
                      >
                        <circle
                          cx={seat.x}
                          cy={seat.y}
                          r={SEAT_RADIUS}
                          fill={
                            isSelected
                              ? "#0F172A"
                              : isOccupied
                                ? OCCUPIED_FILL
                                : activeZone.fillColor
                          }
                          className={cn(
                            "stroke-transparent stroke-[2.5] group-focus-visible/seat:stroke-ring",
                            !isSelected && !isOccupied && maxReached && "opacity-35",
                            !isDisabled && !isSelected && "group-hover/seat:stroke-foreground",
                          )}
                        />
                        {isSelected && (
                          <path
                            d={`M ${seat.x - 2.6} ${seat.y} l 1.8 1.9 l 3.4 -3.8`}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="pointer-events-none"
                          />
                        )}
                        {isOccupied && (
                          <path
                            d={`M ${seat.x - 2} ${seat.y - 2} l 4 4 m 0 -4 l -4 4`}
                            stroke="#64748B"
                            strokeWidth={1.2}
                            strokeLinecap="round"
                            className="pointer-events-none"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          </TransformComponent>
        </TransformWrapper>

        {tooltip && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text.replace(/, /g, " · ")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {activeZone ? (
          <Button type="button" variant="outline" onClick={onBack} className="h-9">
            <ArrowLeft aria-hidden />
            Volver al mapa
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground sm:text-sm">
            Toca una zona para elegirla. Pellizca o usa la rueda para acercar.
          </span>
        )}
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Acercar"
            onClick={() => void transformRef.current?.zoomIn()}
          >
            <ZoomIn aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Alejar"
            onClick={() => void transformRef.current?.zoomOut()}
          >
            <ZoomOut aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Restablecer zoom"
            onClick={() => void transformRef.current?.resetTransform()}
          >
            <RotateCcw aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
