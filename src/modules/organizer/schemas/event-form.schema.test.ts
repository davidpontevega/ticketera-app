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
  tiers: [{ id: "t1", name: "General", price: "120", quantity: "500" }],
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

  it("caps price and quantity", () => {
    const check = (price: string, quantity: string) =>
      validateEventForm(
        { ...validValues, tiers: [{ id: "t1", name: "VIP", price, quantity }] },
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
