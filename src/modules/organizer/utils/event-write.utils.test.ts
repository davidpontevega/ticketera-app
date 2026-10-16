import { describe, expect, it } from "vitest";

import type { EventFormValues } from "../types/organizer.types";
import {
  hasTiersChanged,
  slugify,
  type VenueSnapshot,
  toEventDbInput,
  toEventFormDateTime,
} from "./event-write.utils";
import { toEventIsoDate } from "./organizer.utils";

const values: EventFormValues = {
  name: "  Festival de Verano  ",
  category: "festivals",
  description: " Un dia completo de musica ",
  date: "2027-01-20",
  time: "21:30",
  venue: " Costa Verde ",
  city: "Lima",
  imageUrl: "data:image/png;base64,AAAA",
  venueId: "",
  tiers: [
    { id: "t1", name: " General ", price: "120.5", quantity: "500", zoneId: "" },
    { id: "t2", name: "", price: "", quantity: "", zoneId: "" },
  ],
};

describe("slugify", () => {
  it("lowercases, strips accents and symbols, collapses separators", () => {
    expect(slugify("Festival de Verano!")).toBe("festival-de-verano");
    expect(slugify("  Música   & Ñandú -- 2027 ")).toBe("musica-nandu-2027");
  });

  it("falls back to 'evento' when nothing valid remains", () => {
    expect(slugify("")).toBe("evento");
    expect(slugify("!!! ???")).toBe("evento");
  });
});

describe("toEventDbInput", () => {
  it("maps the form to db rows", () => {
    const { event, tiers } = toEventDbInput(values);
    expect(event).toMatchObject({
      title: "Festival de Verano",
      venueName: "Costa Verde",
      address: "Costa Verde",
      city: "Lima",
      latitude: "-12.0463731",
      longitude: "-77.0427934",
    });
    expect(event.startsAt).toEqual(new Date("2027-01-21T02:30:00.000Z"));
    expect(tiers).toEqual([
      { name: "General", price: "120.50", totalStock: 500, venueZoneId: null },
    ]);
    expect(event.venueId).toBeNull();
  });

  it("uses 0/0 for a city without coordinates and accepts an override", () => {
    expect(toEventDbInput({ ...values, city: "Tarapoto" }).event).toMatchObject({
      latitude: "0",
      longitude: "0",
    });
    expect(
      toEventDbInput(values, { latitude: "1", longitude: "2" }).event,
    ).toMatchObject({ latitude: "1", longitude: "2" });
  });
});

describe("toEventFormDateTime", () => {
  it("round-trips with toEventIsoDate (Lima time)", () => {
    for (const [date, time] of [
      ["2027-01-20", "21:30"],
      ["2027-01-20", "02:00"],
      ["2026-12-31", "23:59"],
    ]) {
      const iso = toEventIsoDate(date, time) as string;
      expect(toEventFormDateTime(new Date(iso))).toEqual({ date, time });
    }
  });
});

describe("hasTiersChanged", () => {
  const current = [
    { id: "a", name: "General", price: "120.00", totalStock: 500 },
    { id: "b", name: "VIP", price: "300.00", totalStock: 50 },
  ];
  const same = [
    { id: "a", name: "General", price: "120", quantity: "500", zoneId: "" },
    { id: "b", name: "VIP", price: "300", quantity: "50", zoneId: "" },
  ];

  it("is false for identical tiers", () => {
    expect(hasTiersChanged(current, same)).toBe(false);
  });

  it("detects name, price, quantity, id, add and remove", () => {
    expect(hasTiersChanged(current, [{ ...same[0], name: "Gen" }, same[1]])).toBe(true);
    expect(hasTiersChanged(current, [{ ...same[0], price: "121" }, same[1]])).toBe(true);
    expect(hasTiersChanged(current, [{ ...same[0], quantity: "501" }, same[1]])).toBe(true);
    expect(hasTiersChanged(current, [{ ...same[0], id: "z" }, same[1]])).toBe(true);
    expect(hasTiersChanged(current, [...same, { id: "c", name: "X", price: "1", quantity: "1", zoneId: "" }])).toBe(true);
    expect(hasTiersChanged(current, [same[0]])).toBe(true);
  });
});

describe("toEventDbInput with a venue", () => {
  const venue: VenueSnapshot = {
    id: "v1",
    name: "Teatro Central",
    address: "Av. Principal 123",
    city: "Cusco",
    latitude: "-13.5",
    longitude: "-71.9",
  };
  const withZones = {
    ...values,
    venueId: "v1",
    tiers: [{ id: "t1", name: "Platea", price: "80", quantity: "10", zoneId: "z1" }],
  };

  it("copies the venue snapshot, its coordinates and the zone ids", () => {
    const { event, tiers } = toEventDbInput(withZones, undefined, venue);
    expect(event).toMatchObject({
      venueId: "v1",
      venueName: "Teatro Central",
      address: "Av. Principal 123",
      city: "Cusco",
      latitude: "-13.5",
      longitude: "-71.9",
    });
    expect(tiers[0]).toMatchObject({ venueZoneId: "z1" });
  });

  it("falls back to the city coordinates, then to 0/0", () => {
    expect(
      toEventDbInput(withZones, undefined, { ...venue, latitude: null, longitude: null, city: "Lima" }).event,
    ).toMatchObject({ latitude: "-12.0463731", longitude: "-77.0427934" });
    expect(
      toEventDbInput(withZones, undefined, { ...venue, latitude: null, longitude: null, city: "Tarapoto" }).event,
    ).toMatchObject({ latitude: "0", longitude: "0" });
  });

  it("ignores the zone ids when there is no venue", () => {
    expect(toEventDbInput(withZones).tiers[0].venueZoneId).toBeNull();
  });
});

describe("hasTiersChanged with venue and zones", () => {
  const current = [{ id: "a", name: "Platea", price: "80.00", totalStock: 10, venueZoneId: "z1" }];
  const next = [{ id: "a", name: "Platea", price: "80", quantity: "10", zoneId: "z1" }];

  it("is false when venue and zone are the same", () => {
    expect(hasTiersChanged(current, next, { current: "v1", next: "v1" })).toBe(false);
  });

  it("detects a venue or zone change", () => {
    expect(hasTiersChanged(current, next, { current: "v1", next: "v2" })).toBe(true);
    expect(hasTiersChanged(current, next, { current: "v1", next: "" })).toBe(true);
    expect(hasTiersChanged(current, [{ ...next[0], zoneId: "z2" }], { current: "v1", next: "v1" })).toBe(true);
    expect(hasTiersChanged(current, [{ ...next[0], zoneId: "" }], { current: "v1", next: "v1" })).toBe(true);
  });
});
