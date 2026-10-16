import { index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "@/modules/user/db/user.table";

export const venueZoneKindEnum = pgEnum("venue_zone_kind", ["general", "numbered"]);

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("venues_created_by_idx").on(table.createdBy)]);

export const venueZones = pgTable("venue_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: venueZoneKindEnum("kind").notNull(),
  // Solo zonas generales; las numeradas derivan su capacidad de venue_seats.
  capacity: integer("capacity"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("venue_zones_venue_id_idx").on(table.venueId)]);

export const venueSeats = pgTable("venue_seats", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueZoneId: uuid("venue_zone_id").notNull().references(() => venueZones.id, { onDelete: "cascade" }),
  rowLabel: text("row_label").notNull(),
  seatNumber: integer("seat_number").notNull(),
}, (table) => [unique("venue_seats_zone_row_number_unique").on(table.venueZoneId, table.rowLabel, table.seatNumber)]);
