import { describe, expect, it } from "vitest";

import type { AdminMetricsRows } from "../types/admin-metrics.types";
import {
  changePct,
  fillMonths,
  recentMonths,
  round2,
  toAdminMetrics,
  windowStart,
} from "./admin-metrics.utils";

describe("recentMonths", () => {
  it("devuelve 6 meses ascendentes con el actual al final", () => {
    expect(recentMonths(new Date("2026-10-16T12:00:00Z"))).toEqual([
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
  });

  it("cruza el ano", () => {
    expect(recentMonths(new Date("2026-02-10T12:00:00Z"), 4)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("usa el mes calendario de Lima en el limite UTC", () => {
    expect(recentMonths(new Date("2026-11-01T04:59:00Z"), 1)).toEqual(["2026-10"]);
    expect(recentMonths(new Date("2026-11-01T05:00:00Z"), 1)).toEqual(["2026-11"]);
    expect(recentMonths(new Date("2026-10-31T23:00:00Z"), 1)).toEqual(["2026-10"]);
  });
});

describe("windowStart", () => {
  it("es medianoche de Lima del primer mes, en UTC", () => {
    expect(windowStart(["2026-05", "2026-06"])).toBe("2026-05-01 05:00:00");
  });
});

describe("fillMonths", () => {
  it("rellena huecos con 0", () => {
    expect(fillMonths(["2026-01", "2026-02"], [{ month: "2026-02", value: 3 }])).toEqual([
      { month: "2026-01", value: 0 },
      { month: "2026-02", value: 3 },
    ]);
  });
});

describe("changePct", () => {
  it("anterior 0 -> null", () => expect(changePct(5, 0)).toBeNull());
  it("caida negativa", () => expect(changePct(50, 100)).toBe(-50));
  it("redondea a 1 decimal", () => expect(changePct(2, 3)).toBe(-33.3));
});

describe("round2", () => {
  it("evita ruido de flotantes", () => expect(round2(0.1 + 0.2)).toBe(0.3));
});

const NOW = new Date("2026-10-16T12:00:00Z");
const empty: AdminMetricsRows = {
  orderMonths: [], soldMonths: [], eventStatuses: [], eventMonths: [], userRoles: [], userMonths: [],
};

describe("toAdminMetrics", () => {
  it("base vacia -> ceros y 6 puntos", () => {
    const m = toAdminMetrics(empty, NOW);
    expect(m.revenue.points).toHaveLength(6);
    expect(m.revenue.total).toBe(0);
    expect(m.revenue.changePct).toBeNull();
    expect(m.users.total).toBe(0);
    expect(m.events.total).toBe(0);
  });

  it("mapea series, estados de eventos y roles", () => {
    const m = toAdminMetrics(
      {
        orderMonths: [
          { month: "2026-09", revenue: "0.1", fee: "0" },
          { month: "2026-10", revenue: "0.2", fee: "0.05" },
        ],
        soldMonths: [{ month: "2026-10", value: "7" }],
        eventStatuses: [
          { key: "published", value: 2 },
          { key: "draft", value: "1" },
          { key: "cancelled", value: 1 },
        ],
        eventMonths: [],
        userRoles: [{ key: "customer", value: 5 }, { key: "organizer", value: "2" }],
        userMonths: [],
      },
      NOW,
    );
    expect(m.revenue.total).toBe(0.3);
    expect(m.revenue.changePct).toBe(100);
    expect(m.platformFee.current).toBe(0.05);
    expect(m.sold.current).toBe(7);
    expect(m.events).toEqual({ total: 4, published: 2, draft: 1, cancelled: 1 });
    expect(m.users.total).toBe(7);
    expect(Object.values(m.users.byRole).reduce((a, b) => a + b, 0)).toBe(m.users.total);
  });
});
