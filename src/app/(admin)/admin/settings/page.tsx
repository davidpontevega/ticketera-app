import type { Metadata } from "next";

import { AdminShell } from "@/modules/admin";
import { PlatformFeeForm } from "@/modules/payment";
// Ruta directa: los servicios son server-only y el barrel llega al bundle cliente.
import { getPlatformSettings } from "@/modules/payment/services/platform-settings.service";
import { requireRole, USER_ADMIN_ROLES } from "@/modules/user";

export const metadata: Metadata = { title: "Comision | Ticketera" };

export default async function AdminSettingsPage() {
  const viewer = await requireRole(USER_ADMIN_ROLES);
  const settings = await getPlatformSettings();

  return (
    <AdminShell viewer={{ fullName: viewer.fullName, email: viewer.email, role: viewer.role }}>
      <PlatformFeeForm feePercent={settings.feePercent} updatedAt={settings.updatedAt} />
    </AdminShell>
  );
}
