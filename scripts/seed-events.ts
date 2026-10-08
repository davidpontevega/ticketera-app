/**
 * Seed script for the public catalog mock (spec 025).
 * Inserts the 14 `EVENTS_MOCK` events (and their ticket tiers) into
 * `events` / `ticket_tiers`, assigned to an existing organizer user.
 * Idempotent: re-running it does not duplicate rows (ON CONFLICT (slug) DO NOTHING).
 *
 * Tambien borra TODAS las filas de `orders` (cascada a `order_items`/`tickets`) antes de
 * sembrar, para que ventas/ingresos del panel de organizador arranquen en 0. Destructivo:
 * solo para entornos de desarrollo.
 *
 * Usage (manual, NOT run by this task):
 *   SEED_ORGANIZER_EMAIL=organizador@example.com npm run db:seed
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";
import { ticketTiers } from "@/modules/event/db/ticket-tier.table";
import { buildEventSeed } from "@/modules/event/utils/event-seed.utils";
import { EVENTS_MOCK } from "@/modules/event/mocks/event.mock";
import { orders } from "@/modules/order/db/order.table";
import { users } from "@/modules/user/db/user.table";

async function main() {
  const organizerEmail = process.env.SEED_ORGANIZER_EMAIL?.trim().toLowerCase();
  if (!organizerEmail) {
    console.error("SEED_ORGANIZER_EMAIL env var is required, e.g.:\n" +
      "  SEED_ORGANIZER_EMAIL=organizador@example.com npm run db:seed");
    process.exit(1);
    return;
  }

  const matches = await db
    .select()
    .from(users)
    .where(and(eq(users.email, organizerEmail), isNull(users.deletedAt)));

  if (matches.length === 0) {
    console.error(`No existe un usuario activo con email "${organizerEmail}"`);
    process.exit(1);
    return;
  }
  if (matches.length > 1) {
    console.error(`Hay mas de un usuario activo con email "${organizerEmail}"`);
    process.exit(1);
    return;
  }

  const organizer = matches[0];
  if (organizer.role !== "organizer") {
    console.error(
      `El usuario con email "${organizerEmail}" tiene rol "${organizer.role}", se esperaba "organizer"`,
    );
    process.exit(1);
    return;
  }

  // Reinicia ventas a 0: order_items y tickets caen por cascada al borrar orders.
  const deletedOrders = await db.delete(orders).returning({ id: orders.id });
  console.log(`Ordenes borradas: ${deletedOrders.length} (ingresos/entradas vendidas vuelven a 0)`);

  let inserted = 0;
  let skipped = 0;

  try {
    await db.transaction(async (tx) => {
      for (const mockEvent of EVENTS_MOCK) {
        const seed = buildEventSeed(mockEvent, organizer.id);

        const [insertedEvent] = await tx
          .insert(events)
          .values(seed.event)
          .onConflictDoNothing({ target: events.slug })
          .returning({ id: events.id });

        if (!insertedEvent) {
          skipped += 1;
          continue;
        }

        await tx
          .insert(ticketTiers)
          .values(seed.tiers.map((tier) => ({ ...tier, eventId: insertedEvent.id })));
        inserted += 1;
      }
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
    return;
  }

  console.log(`Insertados: ${inserted}, Omitidos: ${skipped} de ${EVENTS_MOCK.length} eventos`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
