import { z } from "zod";

import { EVENT_CATEGORIES } from "@/modules/event";
import type { VenueZoneKind } from "@/modules/venue/types/venue.types";

import type {
  EventFormErrors,
  EventFormMode,
  EventFormTier,
  EventFormValues,
} from "../types/organizer.types";
import { createId, toEventIsoDate } from "../utils/organizer.utils";

const categoryIds = EVENT_CATEGORIES.map((category) => category.id) as [string, ...string[]];

const nameSchema = z.string().trim().min(3, "Ingresa el nombre del evento (minimo 3 caracteres)");

const tierSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del tipo"),
  price: z
    .string()
    .refine((value) => Number(value) > 0, "Ingresa un precio mayor a 0")
    .refine((value) => Number(value) <= 99_999_999.99, "El precio es demasiado alto"),
  quantity: z
    .string()
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
      "Ingresa una cantidad mayor a 0",
    )
    .refine((value) => Number(value) <= 2_147_483_647, "La cantidad es demasiado alta"),
});

// Portada: data URL jpeg/png (subida) o https de images.unsplash.com (unico host de next.config.ts),
// con tope de largo (la action la valida en servidor).
export const EVENT_IMAGE_MAX_LENGTH = 700_000;
// Anclado con $: sin espacios ni caracteres de control en la URL, y solo base64 valido en el data URL.
const IMAGE_URL_PATTERN =
  /^(?:data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}|https:\/\/images\.unsplash\.com\/[^\s\u0000-\u001f\u007f]*)$/;
const imageFormatSchema = z
  .string()
  .max(EVENT_IMAGE_MAX_LENGTH, "La imagen es demasiado pesada")
  .refine((value) => value === "" || IMAGE_URL_PATTERN.test(value), "Formato de imagen no valido");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora de inicio");

const publishSchema = z.object({
  name: nameSchema,
  category: z.enum(categoryIds, "Elige una categoria"),
  description: z.string().trim().min(20, "Describe el evento en al menos 20 caracteres"),
  date: dateSchema,
  time: timeSchema,
  venue: z.string().trim().min(2, "Ingresa el lugar"),
  city: z.string().trim().min(2, "Ingresa la ciudad"),
  imageUrl: z.string().min(1, "Sube una imagen de portada").pipe(imageFormatSchema),
  tiers: z.array(tierSchema).min(1, "Agrega al menos un tipo de entrada"),
});

// Con recinto, lugar y ciudad salen del recinto (el servidor los copia).
const publishVenueSchema = publishSchema.extend({ venue: z.string(), city: z.string() });

// events.starts_at es NOT NULL: el borrador tambien exige fecha y hora.
const draftSchema = z.object({
  name: nameSchema,
  category: z.enum(categoryIds, "Elige una categoria"),
  date: dateSchema,
  time: timeSchema,
  imageUrl: imageFormatSchema,
});

export function createEmptyTier(): EventFormTier {
  return { id: createId("tier"), name: "", price: "", quantity: "", zoneId: "" };
}

export const EVENT_FORM_DEFAULT: EventFormValues = {
  name: "",
  category: "concerts",
  description: "",
  date: "",
  time: "",
  venue: "",
  city: "",
  imageUrl: "",
  venueId: "",
  tiers: [],
};

export function createEventFormValues(): EventFormValues {
  return { ...EVENT_FORM_DEFAULT, tiers: [createEmptyTier(), createEmptyTier()] };
}

export type ZoneLimits = Readonly<Record<string, { kind: VenueZoneKind; capacity: number }>>;

// Con recinto: cada tipo lleva una zona distinta (y, en zonas generales, no excede su capacidad).
// El servidor lo vuelve a validar y fija el stock de zonas numeradas.
function validateVenueTiers(values: EventFormValues, zones?: ZoneLimits): EventFormErrors {
  const errors: EventFormErrors = {};
  const used = new Set<string>();
  values.tiers.forEach((tier, index) => {
    if (!tier.name.trim() && !tier.price.trim() && !tier.quantity.trim()) return;
    const key = `tiers.${index}.zoneId`;
    if (!tier.zoneId) errors[key] = "Elige la zona del recinto";
    else if (used.has(tier.zoneId)) errors[key] = "Esta zona ya tiene un tipo de entrada";
    else {
      used.add(tier.zoneId);
      const zone = zones?.[tier.zoneId];
      if (zone?.kind === "general" && Number(tier.quantity) > zone.capacity) {
        errors[`tiers.${index}.quantity`] = `La zona admite hasta ${zone.capacity} entradas`;
      }
    }
  });
  return errors;
}

// Borrador: nombre, fecha y hora. Publicar: todo, con la fecha en el futuro. Errores por campo
// ("name", "tiers.0.price", ...), primer mensaje de cada uno.
export function validateEventForm(
  values: EventFormValues,
  mode: EventFormMode,
  now: Date = new Date(),
  zones?: ZoneLimits,
): EventFormErrors {
  const schema = mode === "draft" ? draftSchema : values.venueId ? publishVenueSchema : publishSchema;
  const result = schema.safeParse(values);
  const errors: EventFormErrors = values.venueId ? validateVenueTiers(values, zones) : {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors[issue.path.join(".")] ??= issue.message;
    }
  }
  if (mode === "publish" && !errors.date && !errors.time) {
    const iso = toEventIsoDate(values.date, values.time);
    if (iso && Date.parse(iso) <= now.getTime()) errors.date = "Elige una fecha futura";
  }
  return errors;
}
