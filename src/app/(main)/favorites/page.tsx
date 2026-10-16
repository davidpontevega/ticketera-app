import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/modules/event";
// Ruta directa: el barrel de event no expone el servicio con `db`.
import { listEventsBySlugs } from "@/modules/event/services/event.service";
// Ruta directa: servicio server-only.
import { listFavoriteEventSlugs } from "@/modules/favorite/services/favorite.service";
import { getCurrentDbUser } from "@/modules/user";

export const metadata: Metadata = { title: "Mis favoritos | Ticketera" };

export default async function FavoritesPage() {
  // El proxy exige sesion; sin fila `users` sincronizada => lista vacia (sin redirect, evita bucle).
  const user = await getCurrentDbUser();
  const slugs = user ? await listFavoriteEventSlugs(user.id) : [];
  const bySlug = new Map((await listEventsBySlugs(slugs)).map((event) => [event.slug, event]));
  const events = slugs.flatMap((slug) => bySlug.get(slug) ?? []); // conserva el orden de favoritos

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:py-10">
      {events.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Aun no tienes favoritos"
          description="Toca el corazon de un evento para guardarlo aqui."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/events" />}
              size="lg"
              className="h-11 px-5"
            >
              Ver eventos
            </Button>
          }
        />
      ) : (
        <>
          <h1 className="mb-6 font-heading text-2xl font-semibold">Mis favoritos</h1>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} className="h-full" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
