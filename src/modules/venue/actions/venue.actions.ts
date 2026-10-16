"use server";

import { revalidatePath } from "next/cache";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { venueIdSchema, venueSchema, zoneSchema } from "../schemas/venue.schema";
import {
  createVenue,
  createZone,
  deleteVenue,
  deleteZone,
  updateVenue,
  updateZone,
} from "../services/venue-write.service";
import type { VenueActionState, VenueError, VenueInput, VenueZoneInput } from "../types/venue.types";

const VENUES_PATH = "/organizer/venues";

const ERRORS: Record<VenueError, string> = {
  "not-found": "No se encontro el recinto o no tienes permiso",
  "zone-locked": "La usa un evento: solo se puede cambiar el nombre",
  "in-use": "Este recinto lo usa un evento",
  limit: "Alcanzaste el maximo de zonas por recinto",
  unknown: "No se pudo guardar, intenta de nuevo",
};

const failure = (error: VenueError): VenueActionState => ({ status: "error", message: ERRORS[error] });

function invalid(issues: { path: PropertyKey[]; message: string }[]): VenueActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") fieldErrors[field] ??= issue.message;
  }
  return { status: "error", message: "Revisa los datos", fieldErrors };
}

// Errores inesperados: detalle al log, mensaje generico al cliente.
async function run(
  work: () => Promise<{ ok: true; data: unknown } | { ok: false; error: VenueError }>,
): Promise<VenueActionState> {
  try {
    const result = await work();
    if (!result.ok) return failure(result.error);
    revalidatePath(VENUES_PATH);
    const id = (result.data as { id?: string } | undefined)?.id;
    return { status: "success", ...(id && { id }) };
  } catch (error) {
    console.error("venue action failed", error);
    return failure("unknown");
  }
}

export async function createVenueAction(input: VenueInput): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return run(() => createVenue(parsed.data, viewer));
}

export async function updateVenueAction(id: string, input: VenueInput): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!venueIdSchema.safeParse(id).success) return failure("not-found");
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return run(() => updateVenue(id, parsed.data, viewer));
}

export async function deleteVenueAction(id: string): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!venueIdSchema.safeParse(id).success) return failure("not-found");
  return run(() => deleteVenue(id, viewer));
}

export async function createZoneAction(venueId: string, input: VenueZoneInput): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!venueIdSchema.safeParse(venueId).success) return failure("not-found");
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return run(() => createZone(venueId, parsed.data, viewer));
}

export async function updateZoneAction(zoneId: string, input: VenueZoneInput): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!venueIdSchema.safeParse(zoneId).success) return failure("not-found");
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return run(() => updateZone(zoneId, parsed.data, viewer));
}

export async function deleteZoneAction(zoneId: string): Promise<VenueActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!venueIdSchema.safeParse(zoneId).success) return failure("not-found");
  return run(() => deleteZone(zoneId, viewer));
}
