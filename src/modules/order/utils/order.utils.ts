import type { AuthUser } from "@/modules/auth";
import type { EventEntity } from "@/modules/event";

import { PAYMENT_METHOD_OPTIONS } from "../constants/order.constants";
import type {
  CheckoutFieldName,
  CheckoutFormValues,
  Order,
  OrderEventSnapshot,
  OrderTicket,
  PaymentMethod,
} from "../types/order.types";

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

export function buildEventCalendarFile(event: OrderEventSnapshot, now: Date = new Date()): string {
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

export function toOrderEventSnapshot(event: EventEntity): OrderEventSnapshot {
  const { id, slug, title, category, date, venue, address, city, imageUrl } = event;
  return { id, slug, title, category, date, venue, address, city, imageUrl };
}

// Descarga el .ics del evento (solo en el cliente).
export function downloadEventCalendar(event: OrderEventSnapshot): void {
  const blob = new Blob([buildEventCalendarFile(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.slug}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

// Una entrada por cantidad; en zonas numeradas cada entrada lleva su asiento.
export function getOrderTickets(order: Order): OrderTicket[] {
  const total = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const tickets: OrderTicket[] = [];
  for (const line of order.lines) {
    for (let seat = 0; seat < line.quantity; seat += 1) {
      const index = tickets.length + 1;
      tickets.push({
        code: `${order.number}-${String(index).padStart(2, "0")}`,
        index,
        total,
        zoneName: line.zoneName,
        seatLabel: line.seatLabels[seat] ?? null,
      });
    }
  }
  return tickets;
}

export function isOrderUpcoming(order: Order, now: Date = new Date()): boolean {
  return Date.parse(order.event.date) >= now.getTime();
}

// Proximas por fecha ascendente, pasadas de la mas reciente a la mas antigua.
export function splitOrdersByTime(
  orders: readonly Order[],
  now: Date = new Date(),
): { upcoming: Order[]; past: Order[] } {
  const byDate = (a: Order, b: Order) => Date.parse(a.event.date) - Date.parse(b.event.date);
  return {
    upcoming: orders.filter((order) => isOrderUpcoming(order, now)).sort(byDate),
    past: orders.filter((order) => !isOrderUpcoming(order, now)).sort((a, b) => byDate(b, a)),
  };
}

// Pedidos del usuario: comprados con su cuenta o con su correo como comprador.
export function getUserOrders(orders: readonly Order[], email: string): Order[] {
  const normalized = email.trim().toLowerCase();
  return orders.filter(
    (order) =>
      order.accountEmail?.toLowerCase() === normalized ||
      order.buyer.email.trim().toLowerCase() === normalized,
  );
}

// Datos del comprador para autocompletar el checkout: nombre y correo de la cuenta, y documento y
// celular del ultimo pedido del usuario (si tiene alguno).
export function getCheckoutPrefill(
  user: AuthUser | null,
  orders: readonly Order[],
): Partial<CheckoutFormValues> {
  if (!user) return {};
  const lastOrder = getUserOrders(orders, user.email).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )[0];
  return {
    fullName: user.fullName,
    email: user.email,
    ...(lastOrder && {
      documentType: lastOrder.buyer.documentType,
      documentNumber: lastOrder.buyer.documentNumber,
      phone: lastOrder.buyer.phone,
    }),
  };
}
