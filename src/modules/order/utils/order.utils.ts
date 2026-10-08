import type { AuthUser } from "@/modules/auth";
import type { EventEntity } from "@/modules/event";
import { getEventBySlug } from "@/modules/event/utils/event.utils";

import type { OrderRecord, OrderStatus } from "../db/order.table";
import type { CreateCheckoutSessionInput } from "../schemas/checkout.schema";
import type {
  BuyerInfo,
  CheckoutFieldName,
  CheckoutFormValues,
  Order,
  OrderEventSnapshot,
  OrderTicket,
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

// id del input de cada campo, para asociar label/errores y enfocar el primer error.
export function getCheckoutFieldId(field: CheckoutFieldName): string {
  return `checkout-${field.replace(".", "-")}`;
}

// Devuelve una copia de los valores con el campo actualizado.
export function setCheckoutField(
  values: CheckoutFormValues,
  field: CheckoutFieldName,
  value: string | boolean,
): CheckoutFormValues {
  return { ...values, [field]: value };
}

// Body de POST /api/checkout/session: buyer saneado + seleccion, solo los datos que admite el endpoint.
export function buildCheckoutSessionInput(
  eventSlug: string,
  values: Pick<CheckoutFormValues, keyof BuyerInfo>,
  selection: { quantities: Record<string, number>; seatIds: Record<string, string[]> },
): CreateCheckoutSessionInput {
  return {
    eventSlug,
    quantities: selection.quantities,
    seatIds: selection.seatIds,
    buyer: {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      documentType: values.documentType,
      documentNumber: values.documentNumber.trim(),
      phone: values.phone.replace(/\s+/g, ""),
    },
  };
}

// Numero estable derivado del id de la orden: "TK-ABCDEF12".
export function getOrderNumber(orderId: string): string {
  return `TK-${orderId.slice(0, 8).toUpperCase()}`;
}

// Orden de DB -> Order del cliente. Numero estable entre recargas.
export function toOrderFromRecord(record: OrderRecord, event: EventEntity): Order {
  return {
    number: getOrderNumber(record.id),
    eventId: event.id,
    event: toOrderEventSnapshot(event),
    buyer: record.buyer,
    lines: record.lines,
    total: Number(record.totalAmount),
    // el RSC puede serializar la fecha como string
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

export type ConfirmationStatus = OrderStatus | "not-found";

export function getConfirmationStatus(
  record: OrderRecord | null,
  eventSlug: string,
): ConfirmationStatus {
  return record && record.eventSlug === eventSlug ? record.status : "not-found";
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
export function getOrderTickets(order: Pick<Order, "number" | "lines">): OrderTicket[] {
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

// Fila de `tickets` a insertar al pagarse la orden (forma propia: no depende del esquema).
export interface TicketRow {
  orderId: string;
  sequence: number;
  qrCode: string;
  zoneName: string;
  seatLabel: string | null;
  attendeeName: string;
}

export function toTicketRows(record: Pick<OrderRecord, "id" | "buyer" | "lines">): TicketRow[] {
  return getOrderTickets({ number: getOrderNumber(record.id), lines: record.lines }).map(
    (ticket) => ({
      orderId: record.id,
      sequence: ticket.index,
      qrCode: ticket.code,
      zoneName: ticket.zoneName,
      seatLabel: ticket.seatLabel,
      attendeeName: record.buyer.fullName,
    }),
  );
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

// Registros pagados -> Orders; los de eventos fuera del catalogo se cuentan, no se muestran.
// Conserva el orden de entrada.
export function toUserOrders(
  records: readonly OrderRecord[],
  events: readonly EventEntity[],
): { orders: Order[]; unavailableCount: number } {
  const orders: Order[] = [];
  let unavailableCount = 0;
  for (const record of records) {
    const event = getEventBySlug(events, record.eventSlug);
    if (event) orders.push(toOrderFromRecord(record, event));
    else unavailableCount += 1;
  }
  return { orders, unavailableCount };
}

// Datos del comprador para autocompletar el checkout: nombre y correo de la cuenta.
export function getCheckoutPrefill(user: AuthUser | null): Partial<CheckoutFormValues> {
  return user ? { fullName: user.fullName, email: user.email } : {};
}
