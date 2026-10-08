import type { CheckoutFieldName, DocumentType } from "../types/order.types";

export const CHECKOUT_HOLD_SECONDS = 600;

// Stripe fija el minimo de vida de una checkout session en 30 min.
export const CHECKOUT_SESSION_TTL_SECONDS = 1800;
// La reserva dura al menos lo que la session sigue pagable (+60 s de margen).
export const RESERVATION_WINDOW_SECONDS = CHECKOUT_SESSION_TTL_SECONDS + 60;

export const DOCUMENT_TYPE_OPTIONS: readonly { value: DocumentType; label: string }[] = [
  { value: "dni", label: "DNI" },
  { value: "ce", label: "CE" },
  { value: "passport", label: "Pasaporte" },
];

// Orden visual del formulario: se usa para enfocar el primer campo con error.
export const CHECKOUT_FIELD_ORDER: readonly CheckoutFieldName[] = [
  "fullName",
  "email",
  "documentType",
  "documentNumber",
  "phone",
  "acceptedTerms",
];
