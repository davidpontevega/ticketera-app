import { z } from "zod";

import { EVENT_CATEGORIES } from "@/modules/event";

import type {
  EventFormErrors,
  EventFormMode,
  EventFormTier,
  EventFormValues,
  OrganizerEvent,
  OrganizerEventStatus,
} from "../types/organizer.types";
import { createId, toEventIsoDate } from "../utils/organizer.utils";

const categoryIds = EVENT_CATEGORIES.map((category) => category.id) as [string, ...string[]];

const nameSchema = z.string().trim().min(3, "Ingresa el nombre del evento (minimo 3 caracteres)");

const tierSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del tipo"),
  price: z.string().refine((value) => Number(value) > 0, "Ingresa un precio mayor a 0"),
  quantity: z
    .string()
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
      "Ingresa una cantidad mayor a 0",
    ),
});

const publishSchema = z.object({
  name: nameSchema,
  category: z.enum(categoryIds, "Elige una categoria"),
  description: z.string().trim().min(20, "Describe el evento en al menos 20 caracteres"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora de inicio"),
  venue: z.string().trim().min(2, "Ingresa el lugar"),
  city: z.string().trim().min(2, "Ingresa la ciudad"),
  imageUrl: z.string().min(1, "Sube una imagen de portada"),
  tiers: z.array(tierSchema).min(1, "Agrega al menos un tipo de entrada"),
});

const draftSchema = z.object({ name: nameSchema });

export function createEmptyTier(): EventFormTier {
  return { id: createId("tier"), name: "", price: "", quantity: "" };
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
  tiers: [],
};

export function createEventFormValues(): EventFormValues {
  return { ...EVENT_FORM_DEFAULT, tiers: [createEmptyTier(), createEmptyTier()] };
}

// Borrador: solo el nombre. Publicar: todo, con la fecha en el futuro. Errores por campo
// ("name", "tiers.0.price", ...), primer mensaje de cada uno.
export function validateEventForm(
  values: EventFormValues,
  mode: EventFormMode,
  now: Date = new Date(),
): EventFormErrors {
  const result = (mode === "draft" ? draftSchema : publishSchema).safeParse(values);
  const errors: EventFormErrors = {};
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

interface ToOrganizerEventOptions {
  status: OrganizerEventStatus;
  ownerEmail: string;
  previous?: OrganizerEvent; // al editar: conserva id, ventas y datos de catalogo
}

export function toOrganizerEvent(
  values: EventFormValues,
  { status, ownerEmail, previous }: ToOrganizerEventOptions,
): OrganizerEvent {
  const soldByTier = new Map(previous?.tiers.map((tier) => [tier.id, tier.sold]));
  return {
    id: previous?.id ?? createId("evt"),
    status,
    ownerEmail,
    catalogSlug: previous?.catalogSlug ?? null,
    name: values.name.trim(),
    category: values.category,
    description: values.description.trim(),
    date: values.date,
    time: values.time,
    venue: values.venue.trim(),
    city: values.city.trim(),
    imageUrl: values.imageUrl,
    tiers: values.tiers.map((tier) => ({
      id: tier.id,
      name: tier.name.trim(),
      price: Number(tier.price) || 0,
      quantity: Math.max(0, Math.trunc(Number(tier.quantity) || 0)),
      sold: soldByTier.get(tier.id) ?? 0,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function toEventFormValues(event: OrganizerEvent): EventFormValues {
  return {
    name: event.name,
    category: event.category,
    description: event.description,
    date: event.date,
    time: event.time,
    venue: event.venue,
    city: event.city,
    imageUrl: event.imageUrl,
    tiers: event.tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price ? String(tier.price) : "",
      quantity: tier.quantity ? String(tier.quantity) : "",
    })),
  };
}
