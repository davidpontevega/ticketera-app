"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { ORGANIZER_PATH } from "../constants/organizer.constants";
import {
  changeEventStatusSchema,
  deleteEventSchema,
  setEventFeaturedSchema,
} from "../schemas/event-admin.schema";
import { validateEventForm } from "../schemas/event-form.schema";
import {
  createEvent,
  updateEvent,
} from "../services/organizer-event-write.service";
import type { SaveEventActionState, SaveEventError, SaveEventInput } from "../types/event-write.types";
import {
  changeEventStatus,
  deleteEvent,
  setEventFeatured,
} from "../services/organizer-event-admin.service";
import type { EventAdminActionState } from "../types/organizer.types";

type FieldErrors = NonNullable<
  Extract<EventAdminActionState, { status: "error" }>["fieldErrors"]
>;

const RELEVANT_FIELDS = ["eventId", "status", "featured"] as const;

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors | undefined {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (RELEVANT_FIELDS as readonly string[]).includes(field)) {
      fieldErrors[field as (typeof RELEVANT_FIELDS)[number]] ??= issue.message;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

const STATUS_CHANGE_ERRORS = {
  "not-found": "No se encontro el evento o no tienes permiso",
  "invalid-transition": "Este evento no admite ese cambio de estado",
  "past-date": "No se puede publicar un evento con fecha pasada",
  "no-tiers": "Agrega al menos un tipo de entrada antes de publicar",
} as const;

const STATUS_SUCCESS_MESSAGES = {
  published: "Evento publicado",
  draft: "Evento despublicado",
  cancelled: "Evento cancelado",
} as const;

const DELETE_ERRORS = {
  "not-found": "No se encontro el evento o no tienes permiso",
  "has-orders": "Este evento tiene ventas: cancelalo en vez de eliminarlo",
} as const;

export async function changeEventStatusAction(
  prev: EventAdminActionState,
  formData: FormData,
): Promise<EventAdminActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = changeEventStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const result = await changeEventStatus(parsed.data, viewer);
  if (!result.ok) {
    return { status: "error", message: STATUS_CHANGE_ERRORS[result.error] };
  }

  revalidatePath(ORGANIZER_PATH);
  return { status: "success", message: STATUS_SUCCESS_MESSAGES[parsed.data.status] };
}

const FEATURED_ERRORS = {
  "not-found": "No se encontro el evento o no tienes permiso",
} as const;

export async function setEventFeaturedAction(
  prev: EventAdminActionState,
  formData: FormData,
): Promise<EventAdminActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = setEventFeaturedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const result = await setEventFeatured(parsed.data, viewer);
  if (!result.ok) {
    return { status: "error", message: FEATURED_ERRORS[result.error] };
  }

  revalidatePath(ORGANIZER_PATH);
  return {
    status: "success",
    message: parsed.data.featured ? "Evento destacado" : "Evento ya no destacado",
  };
}

export async function deleteEventAction(
  prev: EventAdminActionState,
  formData: FormData,
): Promise<EventAdminActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = deleteEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const result = await deleteEvent(parsed.data, viewer);
  if (!result.ok) {
    return { status: "error", message: DELETE_ERRORS[result.error] };
  }

  revalidatePath(ORGANIZER_PATH);
  return { status: "success", message: "Evento eliminado" };
}

const SAVE_ERRORS: Record<SaveEventError, string> = {
  "not-found": "No se encontro el evento o no tienes permiso",
  "tiers-locked": "Este evento tiene ventas: no se pueden cambiar tipos de entrada ni precios",
  "past-date": "Elige una fecha futura",
  "no-tiers": "Agrega al menos un tipo de entrada",
  "invalid-transition": "Este evento no admite ese cambio de estado",
  unknown: "No se pudo guardar, intenta de nuevo",
};

// Errores del servicio que corresponden a un campo del form.
const SAVE_ERROR_FIELDS: Partial<Record<SaveEventError, string>> = {
  "past-date": "date",
  "no-tiers": "tiers",
};

// Se valida en servidor aunque el cliente ya lo hizo. En editar se omite la regla de fecha futura
// (now = epoch): el servicio la aplica solo si corresponde (borrador o fecha cambiada, D3).
function validateInput(input: SaveEventInput, now?: Date): SaveEventActionState | null {
  const fieldErrors = validateEventForm(input.values, input.intent, now);
  return Object.keys(fieldErrors).length > 0
    ? { status: "error", message: "Revisa los datos", fieldErrors }
    : null;
}

function toSaveError(error: SaveEventError): SaveEventActionState {
  const field = SAVE_ERROR_FIELDS[error];
  const message = SAVE_ERRORS[error];
  return { status: "error", message, ...(field && { fieldErrors: { [field]: message } }) };
}

export async function createEventAction(input: SaveEventInput): Promise<SaveEventActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const invalid = validateInput(input);
  if (invalid) return invalid;

  const result = await createEvent(input, viewer);
  if (!result.ok) return toSaveError(result.error);

  revalidatePath(ORGANIZER_PATH);
  return { status: "success", eventId: result.eventId };
}

export async function updateEventAction(
  eventId: string,
  input: SaveEventInput,
): Promise<SaveEventActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  if (!z.uuid().safeParse(eventId).success) return toSaveError("not-found");
  const invalid = validateInput(input, new Date(0));
  if (invalid) return invalid;

  const result = await updateEvent(eventId, input, viewer);
  if (!result.ok) return toSaveError(result.error);

  revalidatePath(ORGANIZER_PATH);
  return { status: "success", eventId };
}
