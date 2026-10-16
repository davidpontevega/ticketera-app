import type { Metadata } from "next";

import { AdminDashboard, AdminShell } from "@/modules/admin";
// Ruta directa: los servicios son server-only y el barrel llega al bundle cliente.
import { getAdminMetrics } from "@/modules/admin/services/admin-metrics.service";
import { requireRole, USER_ADMIN_ROLES } from "@/modules/user";

export const metadata: Metadata = { title: "Resumen | Ticketera" };

export default async function AdminPage() {
  const viewer = await requireRole(USER_ADMIN_ROLES);
  const metrics = await getAdminMetrics();

  return (
    <AdminShell viewer={{ fullName: viewer.fullName, email: viewer.email, role: viewer.role }}>
      <AdminDashboard metrics={metrics} />
    </AdminShell>
  );
}
