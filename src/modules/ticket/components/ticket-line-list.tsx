import { formatEventPrice } from "@/modules/event";

import type { TicketLine } from "../types/ticket.types";

export interface TicketLineListProps {
  lines: readonly TicketLine[];
}

export function TicketLineList({ lines }: TicketLineListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {lines.map((line) => (
        <li key={line.zoneId} className="flex flex-col gap-0.5">
          <span className="flex justify-between gap-3 text-[15px]">
            <span>
              {line.quantity} × {line.zoneName}
            </span>
            <span className="font-semibold tabular-nums">{formatEventPrice(line.amount)}</span>
          </span>
          {line.seatLabels.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Asientos {line.seatLabels.join(", ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
