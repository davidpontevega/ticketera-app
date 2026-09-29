import { Suspense } from "react";
import type { Metadata } from "next";

import { MockInbox } from "@/modules/dev";

export const metadata: Metadata = { title: "Bandeja de prueba | Ticketera" };

export default function DevInboxPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bandeja de prueba</h1>
        <p className="text-muted-foreground">
          Correos simulados de la app. No se envian: se guardan en este navegador.
        </p>
      </div>
      {/* MockInbox lee ?id= con useSearchParams */}
      <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <MockInbox />
      </Suspense>
    </div>
  );
}
