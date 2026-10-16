import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { tickets } from "@/modules/ticket";

import { orders } from "../db/order.table";

export type OrderRefundInput = ({ orderId: string } | { paymentIntentId: string }) & {
  refundedBy: string | null; // null = reembolso hecho fuera de la app (webhook)
  stripeRefundId: string | null;
};

// Idempotente: el WHERE status='paid' hace que un segundo llamador afecte 0 filas.
// Devuelve true solo si esta llamada cambio la orden. Los tickets `used` se conservan.
export async function applyOrderRefund(input: OrderRefundInput): Promise<boolean> {
  const target = "orderId" in input
    ? eq(orders.id, input.orderId)
    : eq(orders.stripePaymentIntentId, input.paymentIntentId);

  return db.transaction(async (tx) => {
    const [refunded] = await tx
      .update(orders)
      .set({
        status: "refunded",
        refundedAt: new Date(),
        refundedBy: input.refundedBy,
        stripeRefundId: input.stripeRefundId,
        updatedAt: new Date(),
      })
      .where(and(target, eq(orders.status, "paid")))
      .returning({ id: orders.id });
    if (!refunded) return false;

    await tx
      .update(tickets)
      .set({ status: "cancelled" })
      .where(and(eq(tickets.orderId, refunded.id), eq(tickets.status, "valid")));
    return true;
  });
}
