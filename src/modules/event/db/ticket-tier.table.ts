import { index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { events } from "@/modules/event/db/event.table";
import { venueZones } from "@/modules/venue/db/venue.table";

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
  venueZoneId: uuid("venue_zone_id").references(() => venueZones.id, { onDelete: "restrict" }),
}, (table) => [
  index("ticket_tiers_event_id_idx").on(table.eventId),
  unique("ticket_tiers_event_venue_zone_unique").on(table.eventId, table.venueZoneId),
]);
