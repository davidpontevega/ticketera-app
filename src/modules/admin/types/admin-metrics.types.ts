import type { UserRole } from "@/modules/user/types/user.types";

export interface MonthPoint {
  /** Mes calendario en America/Lima, formato YYYY-MM. */
  month: string;
  value: number;
}

export interface MetricSeries {
  /** Suma de la ventana completa. */
  total: number;
  /** Mes en curso (parcial). */
  current: number;
  previous: number;
  /** Variacion % vs mes anterior; null si el anterior es 0. */
  changePct: number | null;
  points: MonthPoint[];
}

export interface AdminMetrics {
  sold: MetricSeries;
  revenue: MetricSeries;
  platformFee: MetricSeries;
  newEvents: MetricSeries;
  newUsers: MetricSeries;
  events: { total: number; published: number; draft: number; cancelled: number };
  users: { total: number; byRole: Record<UserRole, number> };
}

type Count = string | number;

/** Filas ya agregadas por Postgres (maximo una por mes / estado / rol). Los numeric llegan como texto. */
export interface AdminMetricsRows {
  orderMonths: { month: string; revenue: string; fee: string }[];
  soldMonths: { month: string; value: Count }[];
  eventStatuses: { key: string; value: Count }[];
  eventMonths: { month: string; value: Count }[];
  userRoles: { key: string; value: Count }[];
  userMonths: { month: string; value: Count }[];
}
