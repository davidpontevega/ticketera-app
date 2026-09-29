import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "organizer", "customer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("customer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
