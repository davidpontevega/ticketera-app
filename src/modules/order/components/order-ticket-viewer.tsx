"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
} from "lucide-react";

import { DecorativeQr } from "@/components/shared/decorative-qr";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEventDateBadge, formatEventLongDate, formatEventTime } from "@/modules/event";

import type { Order } from "../types/order.types";
import { downloadEventCalendar, getOrderTickets } from "../utils/order.utils";

export interface OrderTicketViewerProps {
  order: Order;
  isPast: boolean;
}

export function OrderTicketViewer({ order, isPast }: OrderTicketViewerProps) {
  const [ticketIndex, setTicketIndex] = useState(0);
  const tickets = getOrderTickets(order);
  const ticket = tickets[Math.min(ticketIndex, tickets.length - 1)];
  const { event } = order;
  const badge = formatEventDateBadge(event.date);
  const facts = [
    { icon: CalendarDays, label: formatEventLongDate(event.date) },
    { icon: Clock, label: formatEventTime(event.date) },
    { icon: MapPin, label: `${event.venue}, ${event.city}` },
  ];
  const details = [
    {
      label: ticket.seatLabel ? "Zona · Asiento" : "Zona",
      value: ticket.seatLabel ? `${ticket.zoneName} · ${ticket.seatLabel}` : ticket.zoneName,
    },
    { label: "Titular", value: order.buyer.fullName },
    { label: "Codigo", value: ticket.code },
    {
      label: "Estado",
      value: isPast ? "Finalizado" : "Valida",
      className: isPast ? "text-muted-foreground" : "text-success",
    },
  ];

  return (
    <article
      aria-label={`Entrada de ${event.title}`}
      className="overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="flex flex-col">
        <div className="relative h-44 sm:h-56">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={cn("object-cover", isPast && "grayscale")}
          />
          <span className="absolute top-3 left-3 flex w-14 flex-col items-center rounded-xl bg-card py-1.5 leading-none shadow-md">
            <span className="text-[11px] font-bold tracking-wider text-primary uppercase">
              {badge.month}
            </span>
            <span className="text-xl font-bold">{badge.day}</span>
          </span>
        </div>
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            {event.title}
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {facts.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t-2 border-dashed border-border p-5 sm:p-6 lg:border-t-0 lg:border-l-2">
        <div className="flex justify-center">
          <DecorativeQr
            seed={ticket.code}
            className={cn("size-44 rounded-xl p-2 ring-1 ring-border", isPast && "opacity-40")}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Entrada anterior"
            disabled={ticket.index === 1}
            onClick={() => setTicketIndex(ticket.index - 2)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span aria-live="polite" className="text-sm font-semibold">
            Entrada {ticket.index} de {ticket.total}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Entrada siguiente"
            disabled={ticket.index === ticket.total}
            onClick={() => setTicketIndex(ticket.index)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
          {details.map(({ label, value, className }) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn("truncate text-sm font-semibold", className)}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.print()}
            className="h-11"
          >
            <Download aria-hidden />
            Descargar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPast}
            onClick={() => downloadEventCalendar(event)}
            className="h-11"
          >
            <CalendarPlus aria-hidden />
            Agregar al calendario
          </Button>
        </div>
      </div>
    </article>
  );
}
