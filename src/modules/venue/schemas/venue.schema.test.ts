import { describe, expect, it } from "vitest";

import { venueSchema, zoneSchema } from "./venue.schema";

const VENUE = { name: "  Estadio  ", address: "Av. Principal 123", city: "Lima" };

describe("venueSchema", () => {
  it("recorta espacios y deja coordenadas en null si faltan", () => {
    expect(venueSchema.parse(VENUE)).toEqual({
      name: "Estadio",
      address: "Av. Principal 123",
      city: "Lima",
      latitude: null,
      longitude: null,
    });
  });

  it.each([
    { name: "a" },
    { name: "x".repeat(121) },
    { address: "a" },
    { address: "x".repeat(201) },
    { city: "a" },
    { city: "x".repeat(81) },
  ])("rechaza largos invalidos %o", (patch) => {
    expect(venueSchema.safeParse({ ...VENUE, ...patch }).success).toBe(false);
  });

  it("acepta ambas coordenadas validas", () => {
    const parsed = venueSchema.parse({ ...VENUE, latitude: "-12.0464", longitude: "-77.0428" });
    expect(parsed).toMatchObject({ latitude: "-12.0464", longitude: "-77.0428" });
  });

  it.each([
    { latitude: "-12.04" },
    { longitude: "-77.04" },
    { latitude: "91", longitude: "0" },
    { latitude: "0", longitude: "181" },
    { latitude: "abc", longitude: "0" },
  ])("rechaza coordenadas incompletas o fuera de rango %o", (coords) => {
    expect(venueSchema.safeParse({ ...VENUE, ...coords }).success).toBe(false);
  });

  it("trata coordenadas vacias como ausentes", () => {
    expect(venueSchema.safeParse({ ...VENUE, latitude: "", longitude: "" }).success).toBe(true);
  });
});

describe("zoneSchema", () => {
  it("numerada: convierte strings a numeros", () => {
    expect(zoneSchema.parse({ name: "Platea", kind: "numbered", rows: "10", seatsPerRow: "20" })).toEqual({
      name: "Platea",
      kind: "numbered",
      rows: 10,
      seatsPerRow: 20,
    });
  });

  it.each([
    { rows: "0", seatsPerRow: "10" },
    { rows: "27", seatsPerRow: "10" },
    { rows: "10", seatsPerRow: "41" },
    { rows: "10", seatsPerRow: "0" },
    { rows: "abc", seatsPerRow: "10" },
    { rows: "1.5", seatsPerRow: "10" },
    { rows: "10" },
  ])("numerada rechaza %o", (grid) => {
    expect(zoneSchema.safeParse({ name: "Z", kind: "numbered", ...grid }).success).toBe(false);
  });

  it("numerada acepta limites 26x40", () => {
    expect(zoneSchema.safeParse({ name: "Z", kind: "numbered", rows: "26", seatsPerRow: "40" }).success).toBe(true);
  });

  it("general: capacidad 1..100000", () => {
    expect(zoneSchema.parse({ name: "GA", kind: "general", capacity: "300" })).toMatchObject({ capacity: 300 });
    expect(zoneSchema.safeParse({ name: "GA", kind: "general", capacity: "100000" }).success).toBe(true);
    for (const capacity of ["0", "100001", undefined]) {
      expect(zoneSchema.safeParse({ name: "GA", kind: "general", capacity }).success).toBe(false);
    }
  });

  it("rechaza nombre vacio", () => {
    expect(zoneSchema.safeParse({ name: "  ", kind: "general", capacity: "10" }).success).toBe(false);
  });
});
