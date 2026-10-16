import { CalendarCheck, Percent, Ticket, Users, Wallet } from "lucide-react";

import { formatEventPrice } from "@/modules/event";

import type { AdminMetrics } from "../types/admin-metrics.types";
import { formatChange } from "./admin-trend-chart";

export interface AdminKpisProps {
  metrics: AdminMetrics;
}

const numberFormatter = new Intl.NumberFormat("es-PE");

export function AdminKpis({ metrics }: AdminKpisProps) {
  const items = [
    { icon: Ticket, label: "Entradas vendidas", value: numberFormatter.format(metrics.sold.total), change: metrics.sold.changePct },
    { icon: Wallet, label: "Ingresos", value: formatEventPrice(metrics.revenue.total), change: metrics.revenue.changePct },
    { icon: Percent, label: "Comision de plataforma", value: formatEventPrice(metrics.platformFee.total), change: metrics.platformFee.changePct },
    { icon: CalendarCheck, label: "Eventos publicados", value: `${metrics.events.published} de ${metrics.events.total}`, change: metrics.newEvents.changePct },
    { icon: Users, label: "Usuarios activos", value: numberFormatter.format(metrics.users.total), change: metrics.newUsers.changePct },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
      {items.map(({ icon: Icon, label, value, change }) => (
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
          <dd className="font-heading text-2xl font-bold tracking-tight tabular-nums">{value}</dd>
          <dd className="text-xs text-muted-foreground">vs mes anterior: {formatChange(change)}</dd>
        </div>
      ))}
    </dl>
  );
}
