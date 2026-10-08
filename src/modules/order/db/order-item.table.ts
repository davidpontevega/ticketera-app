import { index, integer, numeric, pgTable, uuid } from "drizzle-orm/pg-core";

import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orders } from "./order.table";

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  ticketTierId: uuid("ticket_tier_id")
    .notNull()
    .references(() => ticketTiers.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(), // snapshot al comprar
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_ticket_tier_id_idx").on(table.ticketTierId),
]);
