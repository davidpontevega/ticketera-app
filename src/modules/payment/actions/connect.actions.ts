"use server";

import { redirect } from "next/navigation";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { startConnectOnboarding } from "../services/connect.service";
import type { ConnectActionState } from "../types/payment.types";
import { getRequestOrigin } from "../utils/request-origin";

export async function startConnectOnboardingAction(): Promise<ConnectActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  let url: string;
  try {
    const result = await startConnectOnboarding(viewer, await getRequestOrigin());
    if ("error" in result) return { error: "Stripe Connect desactivado" };
    url = result.url;
  } catch {
    return { error: "No se pudo iniciar el onboarding con Stripe. Intenta de nuevo." };
  }
  redirect(url);
}
