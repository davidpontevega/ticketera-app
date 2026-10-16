import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";
import { users } from "@/modules/user/db/user.table";

export const favorites = pgTable("favorites", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.eventId] }),
  index("favorites_event_id_idx").on(table.eventId),
]);
