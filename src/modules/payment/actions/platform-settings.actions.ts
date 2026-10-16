"use server";

import { revalidatePath } from "next/cache";

import { USER_ADMIN_ROLES, requireRole } from "@/modules/user";

import { ADMIN_SETTINGS_PATH } from "../constants/payment.constants";
import { feePercentSchema } from "../schemas/platform-settings.schema";
import { setPlatformFeePercent } from "../services/platform-settings.service";
import type { FeeActionState } from "../types/payment.types";

export async function updatePlatformFeeAction(_prev: FeeActionState, formData: FormData): Promise<FeeActionState> {
  const viewer = await requireRole(USER_ADMIN_ROLES);

  const parsed = feePercentSchema.safeParse({ feePercent: formData.get("feePercent") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Porcentaje invalido" };

  await setPlatformFeePercent(parsed.data.feePercent, viewer.id);
  revalidatePath(ADMIN_SETTINGS_PATH);
  return { success: true };
}
