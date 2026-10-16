import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";
import type { BuyerInfo } from "@/modules/order/types/order.types";
import { users } from "@/modules/user/db/user.table";
import type { TicketLine } from "@/modules/ticket";

export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled", "refunded"]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "restrict" }),
  eventSlug: text("event_slug").notNull(),
  buyer: jsonb("buyer").notNull().$type<BuyerInfo>(),
  lines: jsonb("lines").notNull().$type<TicketLine[]>(),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundedBy: uuid("refunded_by").references(() => users.id, { onDelete: "set null" }),
  stripeRefundId: text("stripe_refund_id"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 10, scale: 2 }), // NULL = sin Connect (spec 042)
  organizerNetAmount: numeric("organizer_net_amount", { precision: 10, scale: 2 }),
  platformFeePercent: numeric("platform_fee_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("orders_user_id_idx").on(table.userId),
  index("orders_event_id_idx").on(table.eventId),
  index("orders_event_slug_status_idx").on(table.eventSlug, table.status, table.createdAt),
]);

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderRecord = typeof orders.$inferSelect;
