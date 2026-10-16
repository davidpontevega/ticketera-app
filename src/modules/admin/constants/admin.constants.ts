import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Percent, Users } from "lucide-react";

import { ORGANIZER_NAV } from "@/modules/organizer";
import { ADMIN_SETTINGS_PATH } from "@/modules/payment/constants/payment.constants";
import {
  ADMIN_USERS_PATH,
  ORGANIZER_AREA_ROLES,
  USER_ADMIN_ROLES,
} from "@/modules/user/constants/user.constants";
import type { UserRole } from "@/modules/user/types/user.types";

export const ADMIN_HOME_PATH = "/admin";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavSection {
  label: string;
  roles: readonly UserRole[];
  items: readonly AdminNavItem[];
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  { label: "Organizador", roles: ORGANIZER_AREA_ROLES, items: ORGANIZER_NAV },
  {
    label: "Administracion",
    roles: USER_ADMIN_ROLES,
    items: [
      { href: ADMIN_HOME_PATH, label: "Resumen", icon: LayoutDashboard },
      { href: ADMIN_USERS_PATH, label: "Usuarios", icon: Users },
      { href: ADMIN_SETTINGS_PATH, label: "Comision", icon: Percent },
    ],
  },
];
