import { users } from "../db/user.table";

export type UserEntity = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserRole = UserEntity["role"];
export type AssignableRole = Exclude<UserRole, "super_admin">;

export type InvitableRole = Extract<AssignableRole, "admin" | "organizer">;
export type UserStatusFilter = "active" | "all";

export interface UserListParams {
  q?: string; // ya recortado; undefined = sin busqueda
  role?: UserRole; // undefined = todos los roles
  status: UserStatusFilter;
  page: number; // 1-based
}

// Solo columnas que necesita la UI (no se manda clerkId/phone al cliente)
export type UserListItem = Pick<UserEntity, "id" | "email" | "fullName" | "role" | "createdAt" | "deletedAt">;

export interface UserListResult {
  users: UserListItem[];
  total: number; // filas que cumplen el filtro
  page: number; // pagina efectiva (clamp a la ultima si excede)
  pageSize: number;
}

export type InviteUserResult =
  | { ok: true }
  | { ok: false; error: "already-registered" | "already-invited" | "invitation-failed" };
export type DeleteUserResult = { ok: true } | { ok: false; error: "not-found" | "delete-failed" };

export type UserAdminActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"email" | "role" | "userId", string>> };
