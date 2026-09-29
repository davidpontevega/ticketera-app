"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatEventPrice } from "@/modules/event";

import type { TicketLine } from "../types/ticket.types";
import { formatTicketCount, getTicketTotals } from "../utils/ticket.utils";

export interface PurchaseSummaryProps {
  lines: readonly TicketLine[];
  checkoutHref: string;
}

function ContinueButton({ enabled, href }: { enabled: boolean; href: string }) {
  if (!enabled) {
    return (
      <Button type="button" size="lg" disabled className="h-13 rounded-xl px-6 text-base font-semibold">
        Continuar
      </Button>
    );
  }
  return (
    <Button
      size="lg"
      render={<Link href={href} />}
      nativeButton={false}
      className="h-13 rounded-xl px-6 text-base font-semibold"
    >
      Continuar
      <ArrowRight aria-hidden className="size-5" />
    </Button>
  );
}

export function PurchaseSummary({ lines, checkoutHref }: PurchaseSummaryProps) {
  const totals = getTicketTotals(lines);
  const hasLines = lines.length > 0;
  const total = formatEventPrice(totals.amount);
  const count = formatTicketCount(totals.quantity);

  return (
    <>
      {/* Desktop */}
      <aside
        aria-label="Resumen de la compra"
        className="sticky top-24 hidden flex-col gap-5 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-foreground/10 lg:flex"
      >
        <h2 className="text-lg font-semibold">Tu compra</h2>
        {hasLines ? (
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
        ) : (
          <p className="rounded-xl border-[1.5px] border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Todavia no elegiste entradas. Toca una zona o usa los botones +.
          </p>
        )}
        <div
          aria-live="polite"
          className="flex items-baseline justify-between border-t-[1.5px] border-dashed border-border pt-4"
        >
          <span className="font-medium">
            Total <span className="font-normal text-muted-foreground">({count})</span>
          </span>
          <span className="text-3xl font-bold tracking-tight tabular-nums">{total}</span>
        </div>
        <ContinueButton enabled={hasLines} href={checkoutHref} />
      </aside>

      {/* Mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-18px_rgba(15,23,42,0.35)] lg:hidden">
        <span aria-live="polite" className="flex flex-col">
          <span className="text-xs text-muted-foreground">Total · {count}</span>
          <span className="text-2xl font-bold tracking-tight tabular-nums">{total}</span>
        </span>
        <ContinueButton enabled={hasLines} href={checkoutHref} />
      </div>
    </>
  );
}
