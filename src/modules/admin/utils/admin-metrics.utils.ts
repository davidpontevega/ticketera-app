import type { UserRole } from "@/modules/user/types/user.types";

import type {
  AdminMetrics,
  AdminMetricsRows,
  MetricSeries,
  MonthPoint,
} from "../types/admin-metrics.types";

export const TREND_MONTHS = 6;
// Lima es UTC-5 todo el ano (sin horario de verano).
const LIMA_UTC_OFFSET_HOURS = 5;

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Claves YYYY-MM de los ultimos n meses calendario de Lima, ascendente, el mes de `now` al final. */
export function recentMonths(now: Date, n: number = TREND_MONTHS): string[] {
  const lima = new Date(now.getTime() - LIMA_UTC_OFFSET_HOURS * 3_600_000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth() - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Inicio (UTC, sin zona) del primer mes de la ventana: 00:00 Lima = 05:00 UTC. */
export function windowStart(months: readonly string[]): string {
  return `${months[0]}-01 0${LIMA_UTC_OFFSET_HOURS}:00:00`;
}

export function fillMonths(
  months: readonly string[],
  rows: readonly MonthPoint[],
): MonthPoint[] {
  const byMonth = new Map(rows.map((row) => [row.month, row.value]));
  return months.map((month) => ({ month, value: byMonth.get(month) ?? 0 }));
}

export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function toSeries(
  months: readonly string[],
  rows: readonly MonthPoint[],
  fix: (value: number) => number = (value) => value,
): MetricSeries {
  const points = fillMonths(months, rows).map((p) => ({ ...p, value: fix(p.value) }));
  const current = points.at(-1)?.value ?? 0;
  const previous = points.at(-2)?.value ?? 0;
  return {
    total: fix(points.reduce((sum, p) => sum + p.value, 0)),
    current,
    previous,
    changePct: changePct(current, previous),
    points,
  };
}

const ROLES: UserRole[] = ["super_admin", "admin", "organizer", "customer"];

export function toAdminMetrics(rows: AdminMetricsRows, now: Date = new Date()): AdminMetrics {
  const months = recentMonths(now);
  const counts = (source: { month: string; value: string | number }[]) =>
    source.map((r) => ({ month: r.month, value: Number(r.value) }));
  const money = (pick: "revenue" | "fee") =>
    toSeries(
      months,
      rows.orderMonths.map((r) => ({ month: r.month, value: Number(r[pick]) })),
      round2,
    );
  const count = (key: string, list: { key: string; value: string | number }[]) =>
    Number(list.find((row) => row.key === key)?.value ?? 0);

  const byRole = Object.fromEntries(
    ROLES.map((role) => [role, count(role, rows.userRoles)]),
  ) as Record<UserRole, number>;
  const draft = count("draft", rows.eventStatuses);
  const published = count("published", rows.eventStatuses);
  const cancelled = count("cancelled", rows.eventStatuses);

  return {
    sold: toSeries(months, counts(rows.soldMonths)),
    revenue: money("revenue"),
    platformFee: money("fee"),
    newEvents: toSeries(months, counts(rows.eventMonths)),
    newUsers: toSeries(months, counts(rows.userMonths)),
    events: { total: draft + published + cancelled, published, draft, cancelled },
    users: { total: ROLES.reduce((sum, role) => sum + byRole[role], 0), byRole },
  };
}

const monthFormatter = new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" });

/** "2026-05" -> "may". */
export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1))).replace(".", "").toLowerCase();
}
