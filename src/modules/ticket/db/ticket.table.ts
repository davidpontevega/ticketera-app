import { index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { orderItems } from "@/modules/order/db/order-item.table";
import { orders } from "@/modules/order/db/order.table";

export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "used", "cancelled"]);

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable hasta P0-04 (inventario por tier): los tickets se vinculan directo a la orden.
  orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  zoneName: text("zone_name").notNull(),
  seatLabel: text("seat_label"),
  qrCode: text("qr_code").notNull().unique(),
  status: ticketStatusEnum("status").notNull().default("valid"),
  attendeeName: text("attendee_name"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("tickets_order_item_id_idx").on(table.orderItemId),
  index("tickets_order_id_idx").on(table.orderId),
  unique("tickets_order_id_sequence_unique").on(table.orderId, table.sequence),
]);
