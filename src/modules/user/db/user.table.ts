import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "organizer", "customer"]);

export const stripeOnboardingStatusEnum = pgEnum("stripe_onboarding_status", ["not_started", "pending", "complete"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("customer"),
  stripeAccountId: text("stripe_account_id").unique(), // cuenta Connect Express del organizador (spec 042)
  stripeOnboardingStatus: stripeOnboardingStatusEnum("stripe_onboarding_status").notNull().default("not_started"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"), // null = activo. Soft delete: orders.user_id es RESTRICT (spec 008)
});
