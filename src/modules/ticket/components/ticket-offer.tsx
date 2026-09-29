import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENT_AVAILABILITY_LABEL, formatEventPrice } from "@/modules/event";

import type { VenueLayout } from "../types/ticket.types";
import { ZonePriceList } from "./zone-price-list";

export interface TicketOfferProps {
  layout: VenueLayout;
  priceFrom: number;
  ticketsHref: string;
  isSoldOut: boolean;
}

function OfferButton({ href, isSoldOut, label }: { href: string; isSoldOut: boolean; label: string }) {
  const className = "h-13 rounded-xl px-6 text-base font-semibold";
  if (isSoldOut) {
    return (
      <Button type="button" size="lg" disabled className={className}>
        {EVENT_AVAILABILITY_LABEL["sold-out"]}
      </Button>
    );
  }
  return (
    <Button size="lg" render={<Link href={href} />} nativeButton={false} className={className}>
      {label}
      <ArrowRight aria-hidden className="size-5" />
    </Button>
  );
}

export function TicketOffer({ layout, priceFrom, ticketsHref, isSoldOut }: TicketOfferProps) {
  const price = formatEventPrice(priceFrom);

  return (
    <>
      {/* Desktop */}
      <aside
        aria-label="Entradas"
        className="sticky top-24 hidden flex-col gap-5 rounded-2xl bg-card p-7 shadow-xl ring-1 ring-foreground/10 lg:flex"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">Entradas desde</span>
          <span className="text-3xl font-bold tracking-tight text-cta">{price}</span>
        </div>
        <ZonePriceList zones={layout.zones} />
        <OfferButton href={ticketsHref} isSoldOut={isSoldOut} label="Elegir entradas" />
        <p className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Pago seguro · Entrada digital con QR
        </p>
      </aside>

      {/* Mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-18px_rgba(15,23,42,0.35)] lg:hidden">
        <span className="flex flex-col">
          <span className="text-xs text-muted-foreground">Desde</span>
          <span className="text-2xl font-bold tracking-tight text-cta">{price}</span>
        </span>
        <OfferButton href={ticketsHref} isSoldOut={isSoldOut} label="Comprar entradas" />
      </div>
    </>
  );
}
