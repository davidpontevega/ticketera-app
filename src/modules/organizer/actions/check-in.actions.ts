"use server";

import { revalidatePath } from "next/cache";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { getOrganizerCheckInPath } from "../constants/organizer.constants";
import { checkInSchema } from "../schemas/check-in.schema";
import { checkInTicket } from "../services/organizer-check-in.service";
import type { CheckInActionState } from "../types/check-in.types";

export async function checkInTicketAction(
  prev: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Codigo invalido" };
  }

  const { result, ...rest } = await checkInTicket(parsed.data, viewer);

  if (result === "valid") revalidatePath(getOrganizerCheckInPath(parsed.data.eventId));
  return { status: result, ...rest } as CheckInActionState;
}
