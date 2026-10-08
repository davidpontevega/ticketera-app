import { AdminShell } from "@/modules/admin";
import { listUsers, requireRole, USER_ADMIN_ROLES, UserAdminPanel, userListParamsSchema } from "@/modules/user";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const viewer = await requireRole(USER_ADMIN_ROLES);
  const params = userListParamsSchema.parse(await searchParams);
  const result = await listUsers(params);

  return (
    <AdminShell viewer={{ fullName: viewer.fullName, email: viewer.email, role: viewer.role }}>
      <UserAdminPanel result={result} params={params} />
    </AdminShell>
  );
}
