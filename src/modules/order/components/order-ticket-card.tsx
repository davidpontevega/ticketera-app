import Image from "next/image";

import { DecorativeQr } from "@/components/shared/decorative-qr";
import { cn } from "@/lib/utils";
import {
  formatEventLongDate,
  formatEventPrice,
  getEventCategoryOption,
  type EventEntity,
} from "@/modules/event";

import type { Order } from "../types/order.types";

export interface OrderTicketCardProps {
  event: EventEntity;
  order: Order;
}

export function OrderTicketCard({ event, order }: OrderTicketCardProps) {
  const category = getEventCategoryOption(event.category);
  const quantity = order.lines.reduce((total, line) => total + line.quantity, 0);
  const zones = order.lines.map((line) => line.zoneName).join(", ");
  const details = [
    { label: "Zona", value: zones },
    { label: "Entradas", value: String(quantity) },
    { label: "Total pagado", value: formatEventPrice(order.total) },
  ];

  return (
    <article className="grid overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 md:grid-cols-[200px_minmax(0,1fr)_220px]">
      <div className="relative h-40 md:h-auto">
        <Image
          src={event.imageUrl}
          alt=""
          fill
          sizes="(min-width: 768px) 200px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-2 p-5 md:p-6">
        <span
          className={cn("text-xs font-semibold tracking-wide uppercase", category.labelClassName)}
        >
          {category.label}
        </span>
        <h2 className="font-heading text-xl font-bold tracking-tight">{event.title}</h2>
        <p className="text-sm text-muted-foreground">
          {formatEventLongDate(event.date)} · {event.venue}, {event.city}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-3">
          {details.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-t-2 border-dashed border-border p-5 md:border-t-0 md:border-l-2">
        <DecorativeQr seed={order.number} className="size-32 rounded-lg p-1.5" />
        <span className="text-xs text-muted-foreground">Entrada 1 de {quantity}</span>
      </div>
    </article>
  );
}
