import { z } from "zod";

import type {
  ForgotPasswordValues,
  FormErrors,
  LoginFormValues,
  RegisterFormValues,
  ResetPasswordValues,
} from "../types/auth.types";

const emailSchema = z.string().trim().pipe(z.email("Ingresa un correo valido"));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña"),
});

// Reglas de contraseña nueva (registro y restablecer).
const newPasswordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/\p{L}/u, "La contraseña debe tener al menos una letra")
  .regex(/\d/, "La contraseña debe tener al menos un numero");

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Ingresa tu nombre completo")
    .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede tener letras"),
  email: emailSchema,
  password: newPasswordSchema,
  acceptedTerms: z.literal(true, "Acepta los terminos para continuar"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
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

export function validateForgotPassword(
  values: ForgotPasswordValues,
): FormErrors<ForgotPasswordValues> {
  return toFormErrors(forgotPasswordSchema, values);
}

export function validateResetPassword(
  values: ResetPasswordValues,
): FormErrors<ResetPasswordValues> {
  const errors = toFormErrors(resetPasswordSchema, values);
  // El refine no corre si falla la contraseña: la confirmacion se valida igual.
  if (!errors.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden";
  }
  return errors;
}
