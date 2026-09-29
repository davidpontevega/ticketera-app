import { Suspense } from "react";
import type { Metadata } from "next";

import { CatalogEventSearch } from "@/modules/catalog";

export const metadata: Metadata = {
  title: "Explora eventos | Ticketera",
  description: "Busca conciertos, deportes, teatro y mas por ciudad, fecha y precio.",
};

function EventSearchFallback() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-15 animate-pulse rounded-2xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:py-10">
      {/* useSearchParams en la busqueda: el Suspense permite prerenderizar el resto de la pagina */}
      <Suspense fallback={<EventSearchFallback />}>
        <CatalogEventSearch />
      </Suspense>
    </div>
  );
}
