import { describe, expect, it } from "vitest";

import { generateSeatGrid, getZoneDimensions, rowLabelAt, summarizeZone } from "./venue.utils";

describe("rowLabelAt", () => {
  it("mapea 0 a A y 25 a Z", () => {
    expect(rowLabelAt(0)).toBe("A");
    expect(rowLabelAt(25)).toBe("Z");
  });

  it.each([-1, 26, 1.5])("lanza fuera de rango (%s)", (index) => {
    expect(() => rowLabelAt(index)).toThrow(RangeError);
  });
});

describe("generateSeatGrid", () => {
  it("genera filas x asientos con filas consecutivas y numeros 1..n", () => {
    const seats = generateSeatGrid(2, 3);
    expect(seats.map((s) => `${s.rowLabel}${s.seatNumber}`)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
  });

  it("limite 26x40 sin duplicados", () => {
    const seats = generateSeatGrid(26, 40);
    expect(seats).toHaveLength(1040);
    expect(new Set(seats.map((s) => `${s.rowLabel}-${s.seatNumber}`)).size).toBe(1040);
  });

  it("27 filas lanza", () => {
    expect(() => generateSeatGrid(27, 1)).toThrow();
  });
});

describe("summarizeZone", () => {
  it("general usa capacity; numerada usa seatCount", () => {
    expect(summarizeZone({ kind: "general", capacity: 300, seatCount: 0 })).toBe(300);
    expect(summarizeZone({ kind: "numbered", capacity: null, seatCount: 200 })).toBe(200);
  });
});

describe("getZoneDimensions", () => {
  it("ida y vuelta con generateSeatGrid", () => {
    expect(getZoneDimensions(generateSeatGrid(10, 20))).toEqual({ rows: 10, seatsPerRow: 20 });
    expect(getZoneDimensions([])).toEqual({ rows: 0, seatsPerRow: 0 });
  });
});
