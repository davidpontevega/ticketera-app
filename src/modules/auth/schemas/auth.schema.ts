import { z } from "zod";

import type { FormErrors, LoginFormValues, RegisterFormValues } from "../types/auth.types";

const emailSchema = z.string().trim().pipe(z.email("Ingresa un correo valido"));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Ingresa tu nombre completo")
    .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede tener letras"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/\p{L}/u, "La contraseña debe tener al menos una letra")
    .regex(/\d/, "La contraseña debe tener al menos un numero"),
  acceptedTerms: z.literal(true, "Acepta los terminos para continuar"),
});

export const LOGIN_FORM_DEFAULT: LoginFormValues = { email: "", password: "" };

export const REGISTER_FORM_DEFAULT: RegisterFormValues = {
  fullName: "",
  email: "",
  password: "",
  acceptedTerms: false,
};

// {} si es valido; si no, el primer mensaje de cada campo.
function toFormErrors<T>(schema: z.ZodType, values: T): FormErrors<T> {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const errors: FormErrors<T> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof T;
    errors[field] ??= issue.message;
  }
  return errors;
}

export function validateLogin(values: LoginFormValues): FormErrors<LoginFormValues> {
  return toFormErrors(loginSchema, values);
}

export function validateRegister(values: RegisterFormValues): FormErrors<RegisterFormValues> {
  return toFormErrors(registerSchema, values);
}
