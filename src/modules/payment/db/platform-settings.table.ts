import { check, numeric, pgTable, smallint, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "@/modules/user/db/user.table";

// Tabla de una sola fila (id = 1): configuracion global de la plataforma (spec 042)
export const platformSettings = pgTable("platform_settings", {
  id: smallint("id").primaryKey(),
  feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check("platform_settings_single_row", sql`${table.id} = 1`)]);
