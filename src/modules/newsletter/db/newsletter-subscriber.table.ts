import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Guardado normalizado (trim + lowercase) por el schema zod antes de insertar.
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
