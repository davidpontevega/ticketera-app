import { describe, expect, it } from "vitest";

import type { ZoneShape } from "../types/ticket.types";
import { getShapeBounds, getShapeCenter, getShapePath, layoutSeats } from "./venue-geometry";

const arc: ZoneShape = {
  kind: "arc",
  cx: 500,
  cy: 300,
  innerRadius: 200,
  outerRadius: 300,
  startAngle: 150,
  endAngle: 210,
};
const rect: ZoneShape = { kind: "rect", x: 100, y: 50, width: 200, height: 100, radius: 12 };

function isInside(point: { x: number; y: number }, bounds: ReturnType<typeof getShapeBounds>) {
  return (
    point.x >= bounds.x - 0.01 &&
    point.x <= bounds.x + bounds.width + 0.01 &&
    point.y >= bounds.y - 0.01 &&
    point.y <= bounds.y + bounds.height + 0.01
  );
}

describe("getShapePath", () => {
  it("builds closed paths for arcs and rects", () => {
    for (const shape of [arc, rect]) {
      const path = getShapePath(shape);
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith("Z")).toBe(true);
    }
    expect(getShapePath(arc)).toContain("A 300 300");
  });
});

describe("getShapeBounds / getShapeCenter", () => {
  it("returns the rect bounds and center", () => {
    expect(getShapeBounds(rect)).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    expect(getShapeCenter(rect)).toEqual({ x: 200, y: 100 });
  });

  it("keeps the arc center inside its bounds, on the left of the arc center", () => {
    const bounds = getShapeBounds(arc);
    const center = getShapeCenter(arc);
    expect(isInside(center, bounds)).toBe(true);
    expect(center.x).toBeLessThan(500);
    expect(bounds.x).toBeCloseTo(500 - 300, 0);
  });
});

describe("layoutSeats", () => {
  it("returns rows x seatsPerRow positions inside the shape", () => {
    for (const shape of [arc, rect]) {
      const seats = layoutSeats(shape, 4, 10);
      const bounds = getShapeBounds(shape);
      expect(seats).toHaveLength(40);
      expect(seats.every((seat) => isInside(seat, bounds))).toBe(true);
    }
  });

  it("puts the first row closer to the arc center than the last one", () => {
    const seats = layoutSeats(arc, 5, 8);
    const distance = (seat: { x: number; y: number }) => Math.hypot(seat.x - 500, seat.y - 300);
    const firstRow = seats.filter((seat) => seat.row === 0);
    const lastRow = seats.filter((seat) => seat.row === 4);
    expect(Math.max(...firstRow.map(distance))).toBeLessThan(Math.min(...lastRow.map(distance)));
  });

  it("puts fewer seats in short inner rows so they do not overlap", () => {
    const fan: ZoneShape = {
      ...arc,
      innerRadius: 100,
      outerRadius: 350,
      startAngle: 55,
      endAngle: 125,
    };
    const seats = layoutSeats(fan, 12, 20);
    const perRow = (row: number) => seats.filter((seat) => seat.row === row).length;
    expect(perRow(0)).toBeLessThan(perRow(11));
    expect(perRow(11)).toBe(20);
    const firstRow = seats.filter((seat) => seat.row === 0);
    for (let index = 1; index < firstRow.length; index += 1) {
      const gap = Math.hypot(
        firstRow[index].x - firstRow[index - 1].x,
        firstRow[index].y - firstRow[index - 1].y,
      );
      expect(gap).toBeGreaterThanOrEqual(13.5);
    }
  });

  it("numbers the seats of each row from 1", () => {
    const numbers = layoutSeats(rect, 2, 3).map((seat) => `${seat.row}-${seat.number}`);
    expect(numbers).toEqual(["0-1", "0-2", "0-3", "1-1", "1-2", "1-3"]);
  });
});
