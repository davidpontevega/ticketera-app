import Image from "next/image";

import { cn } from "@/lib/utils";
import { formatEventDate } from "@/modules/event";
import { formatTicketCount } from "@/modules/ticket";

import type { Order } from "../types/order.types";

export interface OrderListProps {
  orders: readonly Order[];
  selectedNumber: string | null;
  onSelect: (orderNumber: string) => void;
}

export function OrderList({ orders, selectedNumber, onSelect }: OrderListProps) {
  return (
    <ul
      aria-label="Pedidos"
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
    >
      {orders.map((order) => {
        const isSelected = order.number === selectedNumber;
        const quantity = order.lines.reduce((total, line) => total + line.quantity, 0);
        const zones = order.lines.map((line) => line.zoneName).join(", ");
        return (
          <li key={order.number} className="w-72 shrink-0 snap-start lg:w-auto">
            <button
              type="button"
              aria-current={isSelected ? "true" : undefined}
              onClick={() => onSelect(order.number)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                isSelected ? "ring-2 ring-primary" : "ring-foreground/10 hover:shadow-md",
              )}
            >
              <Image
                src={order.event.imageUrl}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-xl object-cover"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-[15px] leading-snug font-semibold">
                  {order.event.title}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {formatEventDate(order.event.date)} · {order.event.city}
                </span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {formatTicketCount(quantity)} · {zones}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
