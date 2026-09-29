import type { EventEntity } from "@/modules/event";

import { PAYMENT_METHOD_OPTIONS } from "../constants/order.constants";
import type { CheckoutFieldName, CheckoutFormValues, PaymentMethod } from "../types/order.types";

const EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

export function generateOrderNumber(random: () => number = Math.random): string {
  const digits = Math.floor(random() * 90_000) + 10_000;
  return `TK-${digits}`;
}

// "2026-11-15T02:00:00.000Z" -> "20261115T020000Z"
function toIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[,;]/g, (char) => `\\${char}`);
}

export function buildEventCalendarFile(event: EventEntity, now: Date = new Date()): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ticketera//ES",
    "BEGIN:VEVENT",
    `UID:${event.id}@ticketera`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(`${event.venue}, ${event.address}, ${event.city}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function formatPaymentMethod(method: PaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

// id del input de cada campo, para asociar label/errores y enfocar el primer error.
export function getCheckoutFieldId(field: CheckoutFieldName): string {
  return `checkout-${field.replace(".", "-")}`;
}

// Devuelve una copia de los valores con el campo actualizado ("card.number" actualiza values.card.number).
export function setCheckoutField(
  values: CheckoutFormValues,
  field: CheckoutFieldName,
  value: string | boolean,
): CheckoutFormValues {
  if (field.startsWith("card.")) {
    const cardField = field.slice("card.".length);
    return { ...values, card: { ...values.card, [cardField]: value } };
  }
  return { ...values, [field]: value };
}
