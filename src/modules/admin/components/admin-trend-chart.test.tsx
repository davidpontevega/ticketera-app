import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MetricSeries } from "../types/admin-metrics.types";
import { AdminTrendChart } from "./admin-trend-chart";

function makeSeries(values: number[]): MetricSeries {
  return {
    total: values.reduce((a, b) => a + b, 0),
    current: values.at(-1) ?? 0,
    previous: values.at(-2) ?? 0,
    changePct: null,
    points: values.map((value, i) => ({ month: `2026-0${i + 1}`, value })),
  };
}

afterEach(cleanup);

describe("AdminTrendChart", () => {
  it("expone un item accesible por mes y marca el mes en curso", () => {
    render(<AdminTrendChart title="Entradas" series={makeSeries([1, 2, 4])} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByLabelText("mar (mes en curso): 4")).not.toBeNull();
    expect(screen.queryByText(/vs mes anterior: —/)).not.toBeNull();
  });

  it("altura relativa al maximo", () => {
    render(<AdminTrendChart title="Entradas" series={makeSeries([2, 4])} />);

    const heights = screen.getAllByTestId("trend-bar").map((el) => (el as HTMLElement).style.height);
    expect(heights).toEqual(["50%", "100%"]);
  });

  it("serie en 0 no produce NaN", () => {
    render(<AdminTrendChart title="Entradas" series={makeSeries([0, 0, 0])} />);

    const heights = screen.getAllByTestId("trend-bar").map((el) => (el as HTMLElement).style.height);
    expect(heights).toEqual(["0%", "0%", "0%"]);
  });
});
