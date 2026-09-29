import { numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";
import { users } from "@/modules/user/db/user.table";

export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled"]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
