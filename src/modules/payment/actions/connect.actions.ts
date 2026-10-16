"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

import { startConnectOnboarding } from "../services/connect.service";
import type { ConnectActionState } from "../types/payment.types";

export async function startConnectOnboardingAction(): Promise<ConnectActionState> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  const h = await headers();
  // Solo `host`: x-forwarded-host lo puede fijar el cliente si no hay un proxy que lo sobrescriba.
  const host = h.get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";

  let url: string;
  try {
    const result = await startConnectOnboarding(viewer, `${proto}://${host}`);
    if ("error" in result) return { error: "Stripe Connect desactivado" };
    url = result.url;
  } catch {
    return { error: "No se pudo iniciar el onboarding con Stripe. Intenta de nuevo." };
  }
  redirect(url);
}
