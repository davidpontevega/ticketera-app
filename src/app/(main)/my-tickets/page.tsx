import { Suspense } from "react";
import type { Metadata } from "next";

import { MyTickets } from "@/modules/order";

export const metadata: Metadata = { title: "Mis entradas | Ticketera" };

export default function MyTicketsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:py-10">
      {/* MyTickets lee ?order= con useSearchParams */}
      <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <MyTickets />
      </Suspense>
    </div>
  );
}
