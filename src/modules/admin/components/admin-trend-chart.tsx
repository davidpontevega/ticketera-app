import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { MetricSeries } from "../types/admin-metrics.types";
import { formatMonthLabel } from "../utils/admin-metrics.utils";

export interface AdminTrendChartProps {
  title: string;
  series: MetricSeries;
  formatValue?: (value: number) => string;
}

const defaultFormat = (value: number) => String(value);

export function formatChange(changePct: number | null): string {
  if (changePct === null) return "—";
  return `${changePct > 0 ? "+" : ""}${changePct}%`;
}

// Barras CSS sin libreria: la altura es proporcional al maximo de la serie (0 si todo es 0).
export function AdminTrendChart({ title, series, formatValue = defaultFormat }: AdminTrendChartProps) {
  const max = Math.max(...series.points.map((p) => p.value), 0);
  const lastIndex = series.points.length - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            vs mes anterior: {formatChange(series.changePct)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex h-40 items-end gap-2">
          {series.points.map((point, index) => {
            const height = max > 0 ? (point.value / max) * 100 : 0;
            const label = formatMonthLabel(point.month);
            return (
              <li
                key={point.month}
                aria-label={`${label}${index === lastIndex ? " (mes en curso)" : ""}: ${formatValue(point.value)}`}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div
                  data-testid="trend-bar"
                  aria-hidden
                  className="w-full rounded-t-md bg-primary/70"
                  style={{ height: `${height}%`, minHeight: point.value > 0 ? 4 : 0 }}
                />
                <span aria-hidden className="text-xs text-muted-foreground">
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
