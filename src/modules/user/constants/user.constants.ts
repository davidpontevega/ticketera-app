import type { AssignableRole, InvitableRole, UserRole, UserStatusFilter } from "../types/user.types";

export const SUPER_ADMIN_EMAIL = "pontevegadavid@gmail.com"; // en minusculas: se compara con el email normalizado

export const ASSIGNABLE_ROLES = ["admin", "organizer", "customer"] as const satisfies readonly AssignableRole[];

export const USER_ADMIN_ROLES = ["super_admin"] as const satisfies readonly UserRole[];
export const ORGANIZER_AREA_ROLES = ["super_admin", "admin", "organizer"] as const satisfies readonly UserRole[];

export const INVITABLE_ROLES = ["admin", "organizer"] as const satisfies readonly InvitableRole[];
export const USER_STATUS_FILTERS = ["active", "all"] as const satisfies readonly UserStatusFilter[];
export const USERS_PAGE_SIZE = 10;
export const USER_SEARCH_MAX_LENGTH = 100;
export const ADMIN_USERS_PATH = "/admin/users";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Administrador",
  organizer: "Organizador",
  customer: "Cliente",
};
export const USER_STATUS_LABELS: Record<UserStatusFilter, string> = {
  active: "Activos",
  all: "Todos",
};
