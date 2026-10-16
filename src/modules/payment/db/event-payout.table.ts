import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";
import { users } from "@/modules/user/db/user.table";

// Un payout por evento (event_id unico): garantiza que la liberacion no se duplica (spec 049)
export const eventPayouts = pgTable("event_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().unique().references(() => events.id, { onDelete: "restrict" }),
  organizerId: uuid("organizer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  stripePayoutId: text("stripe_payout_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
