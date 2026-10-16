import { describe, expect, it } from "vitest";

import type { EventFormValues } from "../types/organizer.types";
import { createEventFormValues, EVENT_IMAGE_MAX_LENGTH, validateEventForm } from "./event-form.schema";

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
  venueId: "",
  tiers: [{ id: "t1", name: "General", price: "120", quantity: "500", zoneId: "" }],
};

describe("validateEventForm", () => {
  it("accepts a complete form for publishing", () => {
    expect(validateEventForm(validValues, "publish", NOW)).toEqual({});
  });

  it("requires name, date and time for a draft", () => {
    expect(validateEventForm(createEventFormValues(), "draft", NOW)).toEqual({
      name: "Ingresa el nombre del evento (minimo 3 caracteres)",
      date: "Elige la fecha",
      time: "Elige la hora de inicio",
    });
    expect(
      validateEventForm(
        { ...createEventFormValues(), name: "Mi evento", date: "2020-01-01", time: "10:00" },
        "draft",
        NOW,
      ),
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
      { ...validValues, tiers: [{ id: "t1", name: "VIP", price: "0", quantity: "1.5", zoneId: "" }] },
      "publish",
      NOW,
    );
    expect(errors["tiers.0.price"]).toBe("Ingresa un precio mayor a 0");
    expect(errors["tiers.0.quantity"]).toBe("Ingresa una cantidad mayor a 0");
    expect(validateEventForm({ ...validValues, tiers: [] }, "publish", NOW).tiers).toBe(
      "Agrega al menos un tipo de entrada",
    );
  });

  it("caps price and quantity", () => {
    const check = (price: string, quantity: string) =>
      validateEventForm(
        { ...validValues, tiers: [{ id: "t1", name: "VIP", price, quantity, zoneId: "" }] },
        "publish",
        NOW,
      );
    expect(check("99999999.99", "2147483647")).toEqual({});
    expect(check("100000000", "1")["tiers.0.price"]).toBe("El precio es demasiado alto");
    expect(check("10", "2147483648")["tiers.0.quantity"]).toBe("La cantidad es demasiado alta");
  });

  it("requires a future date", () => {
    expect(
      validateEventForm({ ...validValues, date: "2026-09-29", time: "10:00" }, "publish", NOW).date,
    ).toBe("Elige una fecha futura");
    expect(
      validateEventForm({ ...validValues, date: "2026-09-29", time: "20:00" }, "publish", NOW),
    ).toEqual({});
  });

  it("validates the cover format and size on the server", () => {
    const check = (imageUrl: string, mode: "draft" | "publish" = "publish") =>
      validateEventForm({ ...validValues, imageUrl }, mode, NOW).imageUrl;
    expect(check("https://images.unsplash.com/a.jpg")).toBeUndefined();
    expect(check("data:image/jpeg;base64,AAAA")).toBeUndefined();
    expect(check("data:image/gif;base64,AAAA")).toBe("Formato de imagen no valido");
    expect(check("https://evil.example.com/a.jpg")).toBe("Formato de imagen no valido");
    expect(check("https://images.unsplash.com.evil.com/a.jpg")).toBe("Formato de imagen no valido");
    expect(check("http://images.unsplash.com/a.jpg")).toBe("Formato de imagen no valido");
    expect(check("javascript:alert(1)")).toBe("Formato de imagen no valido");
    expect(check("data:text/html;base64,AAAA")).toBe("Formato de imagen no valido");
    expect(check("https://images.unsplash.com")).toBe("Formato de imagen no valido");
    // anclaje: espacio, salto de linea, caracter nulo y basura tras el data URL
    expect(check("https://images.unsplash.com/a b")).toBe("Formato de imagen no valido");
    expect(check("https://images.unsplash.com/a\nX")).toBe("Formato de imagen no valido");
    expect(check("https://images.unsplash.com/a\u0000")).toBe("Formato de imagen no valido");
    expect(check("data:image/png;base64,AAAA<script>")).toBe("Formato de imagen no valido");
    expect(check("data:image/png;base64,")).toBe("Formato de imagen no valido");
    expect(
      check("https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1200&q=80"),
    ).toBeUndefined();
    expect(check("data:image/png;base64,iVBORw0KGgo=")).toBeUndefined();
    expect(check("data:image/png;base64," + "A".repeat(EVENT_IMAGE_MAX_LENGTH))).toBe(
      "La imagen es demasiado pesada",
    );
    expect(check("", "draft")).toBeUndefined();
    expect(check("")).toBe("Sube una imagen de portada");
    expect(check("data:image/gif;base64,AAAA", "draft")).toBe("Formato de imagen no valido");
  });
});

describe("validateEventForm with a venue", () => {
  const VENUE_ID = "11111111-1111-4111-8111-111111111111";
  const withVenue = (tiers: EventFormValues["tiers"], venue = "", city = ""): EventFormValues => ({
    ...validValues,
    venue,
    city,
    venueId: VENUE_ID,
    tiers,
  });
  const tier = (id: string, zoneId: string, quantity = "10") => ({
    id,
    name: `Tipo ${id}`,
    price: "10",
    quantity,
    zoneId,
  });

  it("does not require the free-text venue and city", () => {
    expect(validateEventForm(withVenue([tier("a", "z1")]), "publish", NOW)).toEqual({});
  });

  it("requires a zone per tier and rejects repeated zones", () => {
    const errors = validateEventForm(
      withVenue([tier("a", ""), tier("b", "z1"), tier("c", "z1")]),
      "publish",
      NOW,
    );
    expect(errors["tiers.0.zoneId"]).toBe("Elige la zona del recinto");
    expect(errors["tiers.1.zoneId"]).toBeUndefined();
    expect(errors["tiers.2.zoneId"]).toBe("Esta zona ya tiene un tipo de entrada");
  });

  it("caps general zones to their capacity", () => {
    const zones = { z1: { kind: "general" as const, capacity: 300 } };
    expect(
      validateEventForm(withVenue([tier("a", "z1", "301")]), "publish", NOW, zones)["tiers.0.quantity"],
    ).toBe("La zona admite hasta 300 entradas");
    expect(validateEventForm(withVenue([tier("a", "z1", "300")]), "publish", NOW, zones)).toEqual({});
  });

  it("ignores blank tier rows and still requires the zone in drafts", () => {
    const blank = { id: "x", name: "", price: "", quantity: "", zoneId: "" };
    expect(validateEventForm(withVenue([blank]), "draft", NOW)).toEqual({});
    expect(validateEventForm(withVenue([tier("a", "")]), "draft", NOW)["tiers.0.zoneId"]).toBeTruthy();
  });

  it("keeps requiring venue and city without a venue", () => {
    const errors = validateEventForm({ ...validValues, venue: "", city: "" }, "publish", NOW);
    expect(errors.venue).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });
});
