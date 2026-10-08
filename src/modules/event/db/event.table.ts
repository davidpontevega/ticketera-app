import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "@/modules/user/db/user.table";

export const eventCategoryEnum = pgEnum("event_category", [
  "concerts",
  "sports",
  "theater",
  "festivals",
  "family",
  "standup",
  "cinema",
  "arts",
  "fairs",
  "conferences",
]);

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled"]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: eventCategoryEnum("category").notNull(),
  organizerId: uuid("organizer_id").references(() => users.id, { onDelete: "set null" }),
  venueName: text("venue_name").notNull(),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  city: text("city").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  imageUrl: text("image_url").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  isTrending: boolean("is_trending").notNull().default(false),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  status: eventStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("events_organizer_id_idx").on(table.organizerId)]);
