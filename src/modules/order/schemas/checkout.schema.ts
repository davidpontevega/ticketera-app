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

// "MM/AA" vigente hasta el ultimo dia de ese mes.
function isExpiryValid(expiry: string, now: Date): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const firstDayAfterExpiry = new Date(year, month, 1);
  return firstDayAfterExpiry > now;
}

const cardSchema = z.object({
  number: z.string(),
  expiry: z.string(),
  cvc: z.string(),
  holderName: z.string(),
});

// Reglas por campo. Las que dependen de otro campo (documento segun su tipo, tarjeta segun el
// metodo de pago) van en getConditionalErrors: zod no corre los refine del objeto si falla
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
  paymentMethod: z.enum(["card", "yape", "cash"]),
  card: cardSchema,
  acceptedTerms: z.literal(true, "Acepta los terminos para continuar"),
});

function getConditionalErrors(values: CheckoutFormValues, now: Date): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const rule = DOCUMENT_RULES[values.documentType];
  if (rule && !rule.pattern.test(values.documentNumber.trim())) {
    errors.documentNumber = rule.message;
  }
  if (values.paymentMethod !== "card") return errors;

  const { number, expiry, cvc, holderName } = values.card;
  if (!/^\d{16}$/.test(removeSpaces(number))) {
    errors["card.number"] = "La tarjeta debe tener 16 digitos";
  }
  if (!isExpiryValid(expiry, now)) {
    errors["card.expiry"] = "Ingresa un vencimiento MM/AA vigente";
  }
  if (!/^\d{3,4}$/.test(cvc.trim())) {
    errors["card.cvc"] = "El CVV tiene 3 o 4 digitos";
  }
  if (holderName.trim().length < 3) {
    errors["card.holderName"] = "Ingresa el nombre como aparece en la tarjeta";
  }
  return errors;
}

export const CHECKOUT_FORM_DEFAULT: CheckoutFormValues = {
  fullName: "",
  email: "",
  documentType: "dni",
  documentNumber: "",
  phone: "",
  paymentMethod: "card",
  card: { number: "", expiry: "", cvc: "", holderName: "" },
  acceptedTerms: false,
};

// {} si es valido; si no, el primer mensaje de cada campo ("fullName", "card.number", ...).
export function validateCheckout(
  values: CheckoutFormValues,
  now: Date = new Date(),
): CheckoutErrors {
  const errors = getConditionalErrors(values, now);
  const result = checkoutSchema.safeParse(values);
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") as CheckoutFieldName;
    errors[field] ??= issue.message;
  }
  return errors;
}
