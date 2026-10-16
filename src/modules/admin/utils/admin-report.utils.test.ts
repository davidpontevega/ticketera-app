import { describe, expect, it } from "vitest";

import { formatEventPrice } from "@/modules/event";

import type { AdminMetrics, MetricSeries } from "../types/admin-metrics.types";
import { buildAdminReport, reportFileName } from "./admin-report.utils";

const series = (total: number, points: number[] = [], changePct: number | null = null): MetricSeries => ({
  total,
  current: points.at(-1) ?? 0,
  previous: points.at(-2) ?? 0,
  changePct,
  points: points.map((value, i) => ({ month: `2026-0${i + 1}`, value })),
});

const metrics: AdminMetrics = {
  sold: series(1500, [500, 1000], 100),
  revenue: series(1234.5, [200, 1034.5], 417.3),
  platformFee: series(100, [40, 60], 50),
  newEvents: series(3, [1, 2], 100),
  newUsers: series(7, [3, 4], 33.3),
  events: { total: 10, published: 6, draft: 3, cancelled: 1 },
  users: { total: 20, byRole: { super_admin: 1, admin: 2, organizer: 5, customer: 12 } },
};

const empty: AdminMetrics = {
  sold: series(0),
  revenue: series(0),
  platformFee: series(0),
  newEvents: series(0),
  newUsers: series(0),
  events: { total: 0, published: 0, draft: 0, cancelled: 0 },
  users: { total: 0, byRole: { super_admin: 0, admin: 0, organizer: 0, customer: 0 } },
};

describe("buildAdminReport", () => {
  it("usa fecha y hora de Lima", () => {
    expect(buildAdminReport(metrics, new Date("2026-10-12T19:05:00Z")).generatedLabel).toContain("2026-10-12 a las 14:05");
    expect(buildAdminReport(metrics, new Date("2026-11-01T03:00:00Z")).generatedLabel).toContain("2026-10-31 a las 22:00");
  });

  it("arma KPIs una sola vez con el formato de pantalla", () => {
    const { sections } = buildAdminReport(metrics, new Date());
    const kpis = sections[0].rows;
    expect(kpis.map(([l]) => l)).toEqual([
      "Entradas vendidas",
      "Ingresos",
      "Comision de plataforma",
      "Eventos publicados",
      "Usuarios activos",
    ]);
    expect(kpis[1][1]).toContain(formatEventPrice(1234.5));
    expect(kpis[3][1]).toContain("6 de 10");
    const labels = sections.flatMap((s) => s.rows.map(([l]) => l));
    expect(labels.filter((l) => l === "Ingresos")).toHaveLength(1);
  });

  it("incluye tablas mensuales y estados/roles", () => {
    const titles = buildAdminReport(metrics, new Date()).sections.map((s) => s.title);
    expect(titles).toEqual([
      "Indicadores",
      "Eventos por estado",
      "Usuarios por rol",
      "Tendencia: Ingresos",
      "Tendencia: Comision de plataforma",
      "Tendencia: Entradas vendidas",
      "Tendencia: Usuarios nuevos",
      "Tendencia: Eventos nuevos",
    ]);
  });

  it("soporta metricas vacias", () => {
    const { sections } = buildAdminReport(empty, new Date());
    expect(sections[0].rows[0][1]).toContain("0");
    expect(sections[3].rows).toEqual([["Sin datos", "-"]]);
  });
});

describe("reportFileName", () => {
  it("usa la fecha de Lima", () => {
    expect(reportFileName(new Date("2026-11-01T03:00:00Z"))).toBe("ticketera-dashboard-2026-10-31.pdf");
  });
});
