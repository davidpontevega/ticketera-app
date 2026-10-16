import type { Metadata } from "next";

import { ConnectStatusCard, isConnectEnabled } from "@/modules/payment";
// Ruta directa: los servicios son server-only y el barrel llega al bundle cliente.
import { syncOnboardingStatus } from "@/modules/payment/services/connect.service";
import { ORGANIZER_AREA_ROLES, requireRole } from "@/modules/user";

export const metadata: Metadata = { title: "Pagos | Ticketera" };

export default async function OrganizerPaymentsPage() {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  const enabled = isConnectEnabled();

  // Sin cuenta o ya complete no hay nada que consultar a Stripe.
  let status = viewer.stripeOnboardingStatus;
  if (enabled && viewer.stripeAccountId && status !== "complete") {
    // Si Stripe falla se muestra el ultimo estado guardado en vez de romper la pagina.
    status = await syncOnboardingStatus(viewer).catch(() => viewer.stripeOnboardingStatus);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pagos</h1>
      <ConnectStatusCard status={status} enabled={enabled} />
    </div>
  );
}
