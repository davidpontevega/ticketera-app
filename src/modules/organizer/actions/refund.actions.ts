"use server";

import { revalidatePath } from "next/cache";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import {
  getOrganizerCheckInPath,
  getOrganizerOrdersPath,
  ORGANIZER_PATH,
} from "../constants/organizer.constants";
import { refundOrderSchema, retryEventRefundsSchema } from "../schemas/refund.schema";
import { retryEventRefunds } from "../services/organizer-event-cancel.service";
import { refundOrder } from "../services/organizer-refund.service";
import type { RefundActionState, RetryRefundsActionState } from "../types/refund.types";

export async function refundOrderAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = refundOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { result, ...rest } = await refundOrder(parsed.data, viewer);

  if (result === "refunded") {
    const { eventId } = parsed.data;
    revalidatePath(getOrganizerOrdersPath(eventId));
    revalidatePath(getOrganizerCheckInPath(eventId));
    revalidatePath(ORGANIZER_PATH);
  }
  return { status: result, ...rest } as RefundActionState;
}

export async function retryEventRefundsAction(
  _prev: RetryRefundsActionState,
  formData: FormData,
): Promise<RetryRefundsActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const parsed = retryEventRefundsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const result = await retryEventRefunds(parsed.data, viewer);
  if (!result.ok) return { status: "error", message: "No se encontro el evento cancelado" };

  const { eventId } = parsed.data;
  revalidatePath(getOrganizerOrdersPath(eventId));
  revalidatePath(getOrganizerCheckInPath(eventId));
  revalidatePath(ORGANIZER_PATH);
  return { status: "done", refunds: result.refunds };
}
