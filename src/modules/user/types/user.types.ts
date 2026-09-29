import { users } from "../db/user.table";

export type UserEntity = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
