"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEventDate, formatEventPrice, type EventEntity } from "@/modules/event";
import {
  TicketLineList,
  formatTicketCount,
  getTicketTotals,
  type TicketLine,
} from "@/modules/ticket";

export interface CheckoutSummaryProps {
  event: EventEntity;
  lines: readonly TicketLine[];
  ticketsHref: string;
  isExpired: boolean;
  hint?: string; // ej. "Acepta los terminos para continuar."
}

function PayButton({
  total,
  isExpired,
  className,
}: {
  total: string;
  isExpired: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={isExpired}
      className={cn("h-13 rounded-xl px-6 text-base font-semibold", className)}
    >
      <Lock aria-hidden className="size-4" />
      Pagar {total}
    </Button>
  );
}

function PayHint({
  hint,
  isExpired,
  ticketsHref,
}: {
  hint?: string;
  isExpired: boolean;
  ticketsHref: string;
}) {
  if (isExpired) {
    return (
      <Link
        href={ticketsHref}
        className="text-center text-sm font-semibold text-primary hover:underline"
      >
        Volver a elegir entradas
      </Link>
    );
  }
  if (!hint) return null;
  return <span className="text-center text-xs text-muted-foreground">{hint}</span>;
}

// Desktop: aside sticky. Mobile: barra fija abajo con el boton de pago.
export function CheckoutSummary({
  event,
  lines,
  ticketsHref,
  isExpired,
  hint,
}: CheckoutSummaryProps) {
  const total = formatEventPrice(getTicketTotals(lines).amount);

  return (
    <>
      <aside
        aria-label="Resumen de la compra"
        className="sticky top-24 hidden flex-col gap-5 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-foreground/10 lg:flex"
      >
        <div className="flex items-center gap-3.5">
          <Image
            src={event.imageUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-xl object-cover"
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{event.title}</span>
            <span className="text-[13px] text-muted-foreground">
              {formatEventDate(event.date)} · {event.venue}, {event.city}
            </span>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <TicketLineList lines={lines} />
        </div>
        <Link
          href={ticketsHref}
          className="w-fit text-sm font-semibold text-primary hover:underline"
        >
          Cambiar entradas
        </Link>
        <div className="flex items-baseline justify-between border-t-[1.5px] border-dashed border-border pt-4">
          <span className="font-medium">Total</span>
          <span className="text-3xl font-bold tracking-tight tabular-nums">{total}</span>
        </div>
        <PayButton total={total} isExpired={isExpired} />
        <PayHint hint={hint} isExpired={isExpired} ticketsHref={ticketsHref} />
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-1.5 border-t border-border bg-background px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-18px_rgba(15,23,42,0.35)] lg:hidden">
        <PayButton total={total} isExpired={isExpired} className="w-full" />
        <PayHint hint={hint} isExpired={isExpired} ticketsHref={ticketsHref} />
      </div>
    </>
  );
}

// Mobile: resumen plegable arriba del formulario.
export function CheckoutSummaryToggle({
  event,
  lines,
  ticketsHref,
}: Omit<CheckoutSummaryProps, "isExpired" | "hint">) {
  const [isOpen, setIsOpen] = useState(false);
  const totals = getTicketTotals(lines);

  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="checkout-summary-details"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center gap-3 p-3.5 text-left"
      >
        <Image
          src={event.imageUrl}
          alt=""
          width={44}
          height={44}
          className="size-11 rounded-lg object-cover"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{event.title}</span>
          <span className="text-[13px] text-muted-foreground">
            {formatTicketCount(totals.quantity)} · {formatEventPrice(totals.amount)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
        <span className="sr-only">{isOpen ? "Ocultar resumen" : "Ver resumen"}</span>
      </button>
      {isOpen && (
        <div
          id="checkout-summary-details"
          className="flex flex-col gap-3 border-t border-border p-3.5"
        >
          <span className="text-[13px] text-muted-foreground">
            {formatEventDate(event.date)} · {event.venue}
          </span>
          <TicketLineList lines={lines} />
          <Link
            href={ticketsHref}
            className="w-fit text-sm font-semibold text-primary hover:underline"
          >
            Cambiar entradas
          </Link>
        </div>
      )}
    </section>
  );
}
