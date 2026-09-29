import { describe, expect, it } from "vitest";

import { ORGANIZER_EVENTS_MOCK } from "../mocks/organizer.mock";
import type { EventFormValues } from "../types/organizer.types";
import {
  createEventFormValues,
  toEventFormValues,
  toOrganizerEvent,
  validateEventForm,
} from "./event-form.schema";

const NOW = new Date("2026-09-29T12:00:00-05:00");

const validValues: EventFormValues = {
  name: "Festival de Verano",
  category: "festivals",
  description: "Un dia completo de musica en vivo frente al mar con bandas nacionales.",
  date: "2027-01-20",
  time: "16:00",
  venue: "Costa Verde",
  city: "Lima",
  imageUrl: "data:image/png;base64,AAAA",
  tiers: [{ id: "t1", name: "General", price: "120", quantity: "500" }],
};

describe("validateEventForm", () => {
  it("accepts a complete form for publishing", () => {
    expect(validateEventForm(validValues, "publish", NOW)).toEqual({});
  });

  it("only requires the name for a draft", () => {
    expect(validateEventForm(createEventFormValues(), "draft", NOW)).toEqual({
      name: "Ingresa el nombre del evento (minimo 3 caracteres)",
    });
    expect(
      validateEventForm({ ...createEventFormValues(), name: "Mi evento" }, "draft", NOW),
    ).toEqual({});
  });

  it("requires every field and every tier to publish", () => {
    const empty = createEventFormValues();
    const errors = validateEventForm(empty, "publish", NOW);
    expect(Object.keys(errors).sort()).toEqual(
      [
        "city",
        "date",
        "description",
        "imageUrl",
        "name",
        "time",
        "venue",
        "tiers.0.name",
        "tiers.0.price",
        "tiers.0.quantity",
        "tiers.1.name",
        "tiers.1.price",
        "tiers.1.quantity",
      ].sort(),
    );
  });

  it("validates tier values", () => {
    const errors = validateEventForm(
      { ...validValues, tiers: [{ id: "t1", name: "VIP", price: "0", quantity: "1.5" }] },
      "publish",
      NOW,
    );
    expect(errors["tiers.0.price"]).toBe("Ingresa un precio mayor a 0");
    expect(errors["tiers.0.quantity"]).toBe("Ingresa una cantidad mayor a 0");
    expect(validateEventForm({ ...validValues, tiers: [] }, "publish", NOW).tiers).toBe(
      "Agrega al menos un tipo de entrada",
    );
  });

  it("requires a future date", () => {
    expect(
      validateEventForm({ ...validValues, date: "2026-09-29", time: "10:00" }, "publish", NOW).date,
    ).toBe("Elige una fecha futura");
    expect(
      validateEventForm({ ...validValues, date: "2026-09-29", time: "20:00" }, "publish", NOW),
    ).toEqual({});
  });
});

describe("toOrganizerEvent / toEventFormValues", () => {
  it("parses the form and round-trips", () => {
    const event = toOrganizerEvent(validValues, {
      status: "published",
      ownerEmail: "maria@example.com",
    });
    expect(event).toMatchObject({
      status: "published",
      ownerEmail: "maria@example.com",
      catalogSlug: null,
      tiers: [{ id: "t1", name: "General", price: 120, quantity: 500, sold: 0 }],
    });
    expect(event.id).toMatch(/^evt-/);
    expect(toEventFormValues(event)).toEqual(validValues);
  });

  it("keeps id and sales when editing", () => {
    const previous = ORGANIZER_EVENTS_MOCK[0];
    const edited = toOrganizerEvent(toEventFormValues(previous), {
      status: "published",
      ownerEmail: "maria@example.com",
      previous,
    });
    expect(edited.id).toBe(previous.id);
    expect(edited.catalogSlug).toBe(previous.catalogSlug);
    expect(edited.tiers.map((tier) => tier.sold)).toEqual(previous.tiers.map((tier) => tier.sold));
  });
});
