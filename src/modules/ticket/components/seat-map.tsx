"use client";

import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEventPrice } from "@/modules/event";

import { SEAT_STATUS_LABEL, TICKET_MAX_PER_ZONE } from "../constants/ticket.constants";
import { SeatGrid, type SeatGridProps } from "./seat-grid";

export type SeatMapProps = SeatGridProps;

export function SeatMap(props: SeatMapProps) {
  const { zone, selectedSeatIds, maxReached } = props;
  const legend = [
    { label: SEAT_STATUS_LABEL.available, className: zone.seatClassName },
    { label: SEAT_STATUS_LABEL.selected, className: "fill-foreground" },
    { label: SEAT_STATUS_LABEL.occupied, className: "fill-border" },
  ];

  return (
    <Card id="seat-map" className="scroll-mt-24 sm:[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Elige tus asientos</CardTitle>
        <p className="text-sm text-muted-foreground">
          {zone.name} · {formatEventPrice(zone.price)} c/u
        </p>
        <CardAction
          aria-live="polite"
          className={cn("text-sm font-medium", maxReached ? "text-foreground" : "text-muted-foreground")}
        >
          {selectedSeatIds.length} de {TICKET_MAX_PER_ZONE}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TransformWrapper minScale={1} maxScale={4} centerOnInit doubleClick={{ disabled: true }}>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent
                wrapperClass="!w-full !h-96 cursor-grab rounded-xl bg-muted active:cursor-grabbing"
                contentClass="!min-w-full !h-full items-center justify-center p-4"
              >
                <SeatGrid {...props} />
              </TransformComponent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                  {legend.map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                        <circle cx={6} cy={6} r={6} className={item.className} />
                      </svg>
                      {item.label}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="icon-lg" aria-label="Acercar" onClick={() => zoomIn()}>
                    <ZoomIn aria-hidden />
                  </Button>
                  <Button type="button" variant="outline" size="icon-lg" aria-label="Alejar" onClick={() => zoomOut()}>
                    <ZoomOut aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Restablecer zoom"
                    onClick={() => resetTransform()}
                  >
                    <RotateCcw aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TransformWrapper>

        <p className="text-xs text-muted-foreground">
          {maxReached
            ? `Maximo ${TICKET_MAX_PER_ZONE} entradas por zona.`
            : "Usa los botones, la rueda del mouse o pellizca para hacer zoom. Arrastra para moverte."}
        </p>
      </CardContent>
    </Card>
  );
}
