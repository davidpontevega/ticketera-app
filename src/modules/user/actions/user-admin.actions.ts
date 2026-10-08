"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ADMIN_USERS_PATH, USER_ADMIN_ROLES } from "../constants/user.constants";
import {
  changeUserRoleSchema,
  deleteUserSchema,
  inviteUserSchema,
} from "../schemas/user-admin.schema";
import { changeUserRole, deleteUser, inviteUser } from "../services/user-admin.service";
import { requireRole } from "../services/user-access.service";
import type { UserAdminActionState } from "../types/user.types";

type FieldErrors = NonNullable<
  Extract<UserAdminActionState, { status: "error" }>["fieldErrors"]
>;

const RELEVANT_FIELDS = ["email", "role", "userId"] as const;

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors | undefined {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (RELEVANT_FIELDS as readonly string[]).includes(field)) {
      fieldErrors[field as (typeof RELEVANT_FIELDS)[number]] ??= issue.message;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

export async function inviteUserAction(
  prev: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  await requireRole(USER_ADMIN_ROLES);

  const parsed = inviteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const origin = (await headers()).get("origin");
  if (!origin) {
    return { status: "error", message: "No se pudo enviar la invitacion" };
  }

  const result = await inviteUser(parsed.data, { origin });
  if (!result.ok) {
    const messages = {
      "already-registered": "Ese email ya tiene cuenta: cambia su rol desde la lista",
      "already-invited": "Ese email ya tiene una invitacion pendiente",
      "invitation-failed": "No se pudo enviar la invitacion",
    } as const;
    return { status: "error", message: messages[result.error] };
  }

  revalidatePath(ADMIN_USERS_PATH);
  return { status: "success", message: `Invitacion enviada a ${parsed.data.email}` };
}

export async function changeUserRoleAction(
  prev: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  await requireRole(USER_ADMIN_ROLES);

  const parsed = changeUserRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const ok = await changeUserRole(parsed.data);
  if (!ok) {
    return { status: "error", message: "No se puede cambiar el rol de este usuario" };
  }

  revalidatePath(ADMIN_USERS_PATH);
  return { status: "success", message: "Rol actualizado" };
}

export async function deleteUserAction(
  prev: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  await requireRole(USER_ADMIN_ROLES);

  const parsed = deleteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los datos",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const result = await deleteUser(parsed.data);
  if (!result.ok) {
    const messages = {
      "not-found": "No se puede eliminar este usuario",
      "delete-failed": "No se pudo eliminar el usuario. Intenta de nuevo",
    } as const;
    return { status: "error", message: messages[result.error] };
  }

  revalidatePath(ADMIN_USERS_PATH);
  return { status: "success", message: "Usuario eliminado" };
}
