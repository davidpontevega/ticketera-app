import { redirect } from "next/navigation";

import { PAYMENTS_PATH } from "@/modules/payment";
import { startConnectOnboarding } from "@/modules/payment/services/connect.service";
import { getRequestOrigin } from "@/modules/payment/utils/request-origin";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

/** refresh_url del AccountLink (vencido o ya usado): emite uno nuevo y redirige. */
export async function GET(): Promise<never> {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);

  let target = PAYMENTS_PATH;
  try {
    const result = await startConnectOnboarding(viewer, await getRequestOrigin());
    if ("url" in result) target = result.url;
  } catch (error) {
    console.error("Failed to refresh Connect onboarding link:", error);
  }
  redirect(target);
}
