/**
 * End-to-end verification script for the DB schema (spec 008, AC4).
 * Inserts one row per table in FK order, reads each one back, then cleans up
 * in reverse FK order. Run against a real DATABASE_URL:
 *
 *   npm run db:verify
 *
 * Not run automatically by any test suite: requires a real Postgres instance.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { orderItems } from "@/modules/order/db/order-item.table";
import { orders } from "@/modules/order/db/order.table";
import { tickets } from "@/modules/ticket/db/ticket.table";
import { users } from "@/modules/user/db/user.table";

async function main() {
  const runId = Date.now();

  let user: typeof users.$inferSelect | undefined;
  let event: typeof events.$inferSelect | undefined;
  let ticketTier: typeof ticketTiers.$inferSelect | undefined;
  let order: typeof orders.$inferSelect | undefined;
  let orderItem: typeof orderItems.$inferSelect | undefined;
  let ticket: typeof tickets.$inferSelect | undefined;

  try {
    [user] = await db
      .insert(users)
      .values({
        clerkId: `verify-db-clerk-${runId}`,
        email: `verify-db-${runId}@example.com`,
        fullName: "Verify DB User",
      })
      .returning();
    const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
    console.log("OK user", userRow);

    [event] = await db
      .insert(events)
      .values({
        slug: `verify-db-event-${runId}`,
        title: "Verify DB Event",
        description: "Event created by scripts/verify-db.ts",
        category: "concerts",
        organizerId: user.id,
        venueName: "Verify Venue",
        address: "123 Verify St",
        latitude: "0",
        longitude: "0",
        city: "Verify City",
        startsAt: new Date(),
        imageUrl: "https://example.com/image.png",
      })
      .returning();
    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id));
    console.log("OK event", eventRow);

    [ticketTier] = await db
      .insert(ticketTiers)
      .values({
        eventId: event.id,
        name: "General",
        price: "10.00",
        totalStock: 100,
      })
      .returning();
    const [ticketTierRow] = await db
      .select()
      .from(ticketTiers)
      .where(eq(ticketTiers.id, ticketTier.id));
    console.log("OK ticket_tier", ticketTierRow);

    [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        eventId: event.id,
        totalAmount: "10.00",
      })
      .returning();
    const [orderRow] = await db.select().from(orders).where(eq(orders.id, order.id));
    console.log("OK order", orderRow);

    [orderItem] = await db
      .insert(orderItems)
      .values({
        orderId: order.id,
        ticketTierId: ticketTier.id,
        quantity: 1,
        unitPrice: "10.00",
      })
      .returning();
    const [orderItemRow] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItem.id));
    console.log("OK order_item", orderItemRow);

    [ticket] = await db
      .insert(tickets)
      .values({
        orderItemId: orderItem.id,
        qrCode: `verify-db-qr-${runId}`,
      })
      .returning();
    const [ticketRow] = await db.select().from(tickets).where(eq(tickets.id, ticket.id));
    console.log("OK ticket", ticketRow);

    console.log("All checks passed");
  } finally {
    if (ticket) {
      await db.delete(tickets).where(eq(tickets.id, ticket.id));
      console.log("OK cleanup ticket");
    }
    if (orderItem) {
      await db.delete(orderItems).where(eq(orderItems.id, orderItem.id));
      console.log("OK cleanup order_item");
    }
    if (order) {
      await db.delete(orders).where(eq(orders.id, order.id));
      console.log("OK cleanup order");
    }
    if (ticketTier) {
      await db.delete(ticketTiers).where(eq(ticketTiers.id, ticketTier.id));
      console.log("OK cleanup ticket_tier");
    }
    if (event) {
      await db.delete(events).where(eq(events.id, event.id));
      console.log("OK cleanup event");
    }
    if (user) {
      await db.delete(users).where(eq(users.id, user.id));
      console.log("OK cleanup user");
    }
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
