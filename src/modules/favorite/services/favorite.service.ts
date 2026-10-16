import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/modules/event/db/event.table";

import { favorites } from "../db/favorite.table";
import type { SetFavoriteResult } from "../types/favorite.types";

// Idempotente: recibe el estado deseado. Marcar exige evento publicado; desmarcar siempre se permite.
export async function setFavorite(userId: string, eventId: string, favorite: boolean): Promise<SetFavoriteResult> {
  if (!favorite) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.eventId, eventId)));
    return "ok";
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.status, "published")))
    .limit(1);
  if (!event) return "not-found";

  await db.insert(favorites).values({ userId, eventId }).onConflictDoNothing();
  return "ok";
}

// Todos los ids favoritos del usuario (para pintar el corazon), sin filtrar por estado.
export async function listFavoriteEventIds(userId: string): Promise<string[]> {
  const rows = await db.select({ eventId: favorites.eventId }).from(favorites).where(eq(favorites.userId, userId));
  return rows.map((row) => row.eventId);
}

// Slugs de favoritos publicados y futuros, los marcados mas recientemente primero.
export async function listFavoriteEventSlugs(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: events.slug })
    .from(favorites)
    .innerJoin(events, eq(events.id, favorites.eventId))
    .where(and(eq(favorites.userId, userId), eq(events.status, "published"), gte(events.startsAt, new Date())))
    .orderBy(desc(favorites.createdAt));
  return rows.map((row) => row.slug);
}
