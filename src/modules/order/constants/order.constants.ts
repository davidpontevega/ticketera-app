import { Banknote, CreditCard, Smartphone, type LucideIcon } from "lucide-react";

import type { CheckoutFieldName, DocumentType, PaymentMethod } from "../types/order.types";

export const CHECKOUT_HOLD_SECONDS = 600;

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
  hint?: string; // texto explicativo cuando no hay campos de tarjeta
}

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
  { value: "card", label: "Tarjeta", icon: CreditCard },
  {
    value: "yape",
    label: "Yape",
    icon: Smartphone,
    hint: "Al continuar te mostraremos un codigo QR para pagar desde tu app de Yape.",
  },
  {
    value: "cash",
    label: "PagoEfectivo",
    icon: Banknote,
    hint: "Generaremos un codigo de pago para que pagues en agentes, bodegas o tu banca movil.",
  },
];

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
  "paymentMethod",
  "card.number",
  "card.expiry",
  "card.cvc",
  "card.holderName",
  "acceptedTerms",
];
