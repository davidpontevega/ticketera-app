"use server";

import { revalidatePath } from "next/cache";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { PAYMENTS_PATH, isConnectEnabled } from "../constants/payment.constants";
import { getPayoutAccount } from "../services/connect.service";
import { releaseDuePayouts } from "../services/payout.service";
import type { PayoutActionState } from "../types/payment.types";

/** Libera los eventos vencidos del organizador de la sesion; no recibe ids del cliente. */
export async function releasePayoutsAction(): Promise<PayoutActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  if (!isConnectEnabled()) return { error: "Stripe Connect desactivado" };

  const account = await getPayoutAccount(viewer.id);
  if (!account) return { error: "Completa el onboarding de Stripe para retirar fondos." };

  try {
    const { errors } = await releaseDuePayouts({ id: viewer.id, stripeAccountId: account.accountId });
    return errors.length ? { error: errors.join(" ") } : { success: true };
  } catch {
    return { error: "No se pudo completar el retiro. Intenta de nuevo." };
  } finally {
    revalidatePath(PAYMENTS_PATH);
  }
}
