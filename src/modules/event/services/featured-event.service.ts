import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { events } from "../db/event.table";
import type { FeaturedEvent } from "../types/event.types";

const FEATURED_EVENTS_LIMIT = 8;

// Publica, sin auth: alimenta el Hero de la landing (/). Solo eventos destacados y publicados.
export async function listFeaturedEvents(): Promise<FeaturedEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      imageUrl: events.imageUrl,
      startsAt: events.startsAt,
      venue: events.venueName,
      city: events.city,
    })
    .from(events)
    .where(and(eq(events.isFeatured, true), eq(events.status, "published")))
    .orderBy(asc(events.startsAt))
    .limit(FEATURED_EVENTS_LIMIT);

  return rows.map(({ startsAt, ...row }) => ({
    ...row,
    date: startsAt.toISOString(),
  }));
}
