import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { orderItems } from "@/modules/order/db/order-item.table";

export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "used", "cancelled"]);

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  qrCode: text("qr_code").notNull().unique(),
  status: ticketStatusEnum("status").notNull().default("valid"),
  attendeeName: text("attendee_name"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
