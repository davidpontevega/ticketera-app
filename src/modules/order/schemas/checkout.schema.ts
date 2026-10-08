import { z } from "zod";

import type {
  CheckoutErrors,
  CheckoutFieldName,
  CheckoutFormValues,
  DocumentType,
} from "../types/order.types";

const DOCUMENT_RULES: Record<DocumentType, { pattern: RegExp; message: string }> = {
  dni: { pattern: /^\d{8}$/, message: "El DNI debe tener 8 digitos" },
  ce: { pattern: /^[a-z0-9]{9,12}$/i, message: "El CE debe tener entre 9 y 12 caracteres" },
  passport: {
    pattern: /^[a-z0-9]{6,12}$/i,
    message: "El pasaporte debe tener entre 6 y 12 caracteres",
  },
};

const removeSpaces = (value: string) => value.replace(/\s+/g, "");

// Reglas por campo. Las que dependen de otro campo (documento segun su tipo) van en getConditionalErrors: zod no corre los refine del objeto si falla
// algun campo, y el usuario tiene que ver todos los errores juntos.
export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Ingresa tu nombre completo")
    .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede tener letras"),
  email: z.string().trim().pipe(z.email("Ingresa un correo valido")),
  documentType: z.enum(["dni", "ce", "passport"]),
  documentNumber: z.string().trim(),
  phone: z
    .string()
    .transform(removeSpaces)
    .pipe(z.string().regex(/^9\d{8}$/, "Ingresa un celular de 9 digitos que empiece con 9")),
  acceptedTerms: z.literal(true, "Acepta los terminos para continuar"),
});

function getConditionalErrors(values: CheckoutFormValues): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const rule = DOCUMENT_RULES[values.documentType];
  if (rule && !rule.pattern.test(values.documentNumber.trim())) {
    errors.documentNumber = rule.message;
  }
  return errors;
}

export const CHECKOUT_FORM_DEFAULT: CheckoutFormValues = {
  fullName: "",
  email: "",
  documentType: "dni",
  documentNumber: "",
  phone: "",
  acceptedTerms: false,
};

// {} si es valido; si no, el primer mensaje de cada campo ("fullName", "email", ...).
export function validateCheckout(values: CheckoutFormValues): CheckoutErrors {
  const errors = getConditionalErrors(values);
  const result = checkoutSchema.safeParse(values);
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") as CheckoutFieldName;
    errors[field] ??= issue.message;
  }
  return errors;
}

// Body de POST /api/checkout/session. Sin campos de precio: z.object descarta props desconocidas
// (unitPrice, total, etc.) al parsear, el servidor siempre recalcula el monto.
export const createCheckoutSessionSchema = z.object({
  eventSlug: z.string().min(1),
  quantities: z.record(z.string(), z.number().int().min(0)),
  seatIds: z.record(z.string(), z.array(z.string())),
  buyer: checkoutSchema.pick({
    fullName: true,
    email: true,
    documentType: true,
    documentNumber: true,
    phone: true,
  }),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
