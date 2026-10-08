import { index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";

export const ticketTiers = pgTable("ticket_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  totalStock: integer("total_stock").notNull(),
  salesStartAt: timestamp("sales_start_at", { withTimezone: true }),
  salesEndAt: timestamp("sales_end_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("ticket_tiers_event_id_idx").on(table.eventId)]);
