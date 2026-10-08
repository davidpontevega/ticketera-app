import { z } from "zod";

import { ASSIGNABLE_ROLES, INVITABLE_ROLES, USER_SEARCH_MAX_LENGTH, USER_STATUS_FILTERS } from "../constants/user.constants";
import { userRoleEnum } from "../db/user.table";
import type { UserListParams } from "../types/user.types";

// Cada campo de searchParams de Next puede llegar como string | string[] | undefined.
// Un array no es un valor valido para ninguno de estos filtros: cae al default del campo.
const toSingleValue = (value: unknown): unknown => (Array.isArray(value) ? undefined : value);

const qSchema = z
  .preprocess(
    toSingleValue,
    z
      .string()
      .trim()
      // Se recorta a USER_SEARCH_MAX_LENGTH en vez de descartar la busqueda: el usuario sigue
      // viendo resultados (acotados) en vez de un filtro silenciosamente vacio.
      .transform((value) => value.slice(0, USER_SEARCH_MAX_LENGTH))
      .transform((value) => (value === "" ? undefined : value)),
  )
  .catch(undefined);

const roleSchema = z
  .preprocess(toSingleValue, z.enum(userRoleEnum.enumValues).optional())
  .catch(undefined);

const statusSchema = z
  .preprocess(toSingleValue, z.enum(USER_STATUS_FILTERS))
  .catch("active" as const);

const pageSchema = z.preprocess(toSingleValue, z.coerce.number().int().min(1)).catch(1);

// Nunca lanza: cada campo tiene su propio .catch(default).
export const userListParamsSchema: z.ZodType<UserListParams> = z.object({
  q: qSchema,
  role: roleSchema,
  status: statusSchema,
  page: pageSchema,
});

export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ingresa un correo valido")),
  role: z.enum(INVITABLE_ROLES, "Selecciona un rol invitable"),
});

export const changeUserRoleSchema = z.object({
  userId: z.uuid("Usuario invalido"),
  role: z.enum(ASSIGNABLE_ROLES, "Selecciona un rol valido"),
});

export const deleteUserSchema = z.object({
  userId: z.uuid("Usuario invalido"),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
