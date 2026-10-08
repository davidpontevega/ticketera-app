import "server-only";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { orders, type OrderRecord } from "../db/order.table";

// Solo ordenes pagadas del usuario (orders.user_id), las mas recientes primero.
export async function listUserOrders(userId: string): Promise<OrderRecord[]> {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid")))
    .orderBy(desc(orders.createdAt));
}
