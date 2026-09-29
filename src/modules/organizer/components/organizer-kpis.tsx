import { CalendarCheck, Ticket, Wallet } from "lucide-react";

import { formatEventPrice } from "@/modules/event";

import type { OrganizerKpis as OrganizerKpisValues } from "../types/organizer.types";

export interface OrganizerKpisProps {
  kpis: OrganizerKpisValues;
}

const numberFormatter = new Intl.NumberFormat("es-PE");

export function OrganizerKpis({ kpis }: OrganizerKpisProps) {
  const items = [
    { icon: Ticket, label: "Entradas vendidas", value: numberFormatter.format(kpis.sold) },
    { icon: Wallet, label: "Ingresos", value: formatEventPrice(kpis.revenue) },
    { icon: CalendarCheck, label: "Eventos publicados", value: String(kpis.published) },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-3 lg:gap-5">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-2 rounded-2xl bg-background p-5 ring-1 ring-foreground/10"
        >
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            {label}
          </dt>
          <dd className="font-heading text-2xl font-bold tracking-tight tabular-nums lg:text-3xl">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
