import { formatEventPrice } from "@/modules/event";
import { USER_ROLE_LABELS } from "@/modules/user/constants/user.constants";
import type { UserRole } from "@/modules/user/types/user.types";

import { formatChange } from "../components/admin-trend-chart";
import type { AdminMetrics, MetricSeries } from "../types/admin-metrics.types";

export type ReportRow = [label: string, value: string];

export interface ReportSection {
  title: string;
  rows: ReportRow[];
}

export interface AdminReport {
  title: string;
  generatedLabel: string;
  sections: ReportSection[];
}

const numberFormatter = new Intl.NumberFormat("es-PE");
const TIME_ZONE = "America/Lima";
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const limaDate = (now: Date) => dateFormatter.format(now);

export function reportFileName(now: Date): string {
  return `ticketera-dashboard-${limaDate(now)}.pdf`;
}

const withChange = (value: string, series: MetricSeries) =>
  `${value} (vs mes anterior: ${formatChange(series.changePct)})`;

function trendSection(title: string, series: MetricSeries, format: (n: number) => string): ReportSection {
  return {
    title: `Tendencia: ${title}`,
    rows: series.points.length
      ? series.points.map((p): ReportRow => [p.month, format(p.value)])
      : [["Sin datos", "-"]],
  };
}

export function buildAdminReport(metrics: AdminMetrics, now: Date): AdminReport {
  const { sold, revenue, platformFee, newEvents, newUsers, events, users } = metrics;
  return {
    title: "Resumen global de la plataforma",
    generatedLabel: `Generado el ${limaDate(now)} a las ${timeFormatter.format(now)} (hora de Lima)`,
    sections: [
      {
        title: "Indicadores",
        rows: [
          ["Entradas vendidas", withChange(numberFormatter.format(sold.total), sold)],
          ["Ingresos", withChange(formatEventPrice(revenue.total), revenue)],
          ["Comision de plataforma", withChange(formatEventPrice(platformFee.total), platformFee)],
          ["Eventos publicados", withChange(`${events.published} de ${events.total}`, newEvents)],
          ["Usuarios activos", withChange(numberFormatter.format(users.total), newUsers)],
        ],
      },
      {
        title: "Eventos por estado",
        rows: [
          ["Publicados", String(events.published)],
          ["Borrador", String(events.draft)],
          ["Cancelados", String(events.cancelled)],
        ],
      },
      {
        title: "Usuarios por rol",
        rows: (Object.keys(users.byRole) as UserRole[]).map((role): ReportRow => [
          USER_ROLE_LABELS[role],
          String(users.byRole[role]),
        ]),
      },
      trendSection("Ingresos", revenue, formatEventPrice),
      trendSection("Comision de plataforma", platformFee, formatEventPrice),
      trendSection("Entradas vendidas", sold, (n) => numberFormatter.format(n)),
      trendSection("Usuarios nuevos", newUsers, (n) => numberFormatter.format(n)),
      trendSection("Eventos nuevos", newEvents, (n) => numberFormatter.format(n)),
    ],
  };
}
