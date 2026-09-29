import { notFound } from "next/navigation";

import { PurchaseHeader } from "@/components/shared/purchase-header";
import { EVENTS_MOCK, getEventBySlug, getEventHref } from "@/modules/event";
import { CheckoutForm } from "@/modules/order";
import { getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function CheckoutPage({ params }: PageProps<"/events/[slug]/checkout">) {
  const event = getEventBySlug(EVENTS_MOCK, (await params).slug);
  if (!event) notFound();

  return (
    <>
      <PurchaseHeader
        currentStep={2}
        title="Datos y pago"
        backHref={`${getEventHref(event.slug)}/tickets`}
        backLabel="Volver a entradas"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 lg:py-8">
        <CheckoutForm event={event} layout={getVenueLayout(event)} />
      </main>
    </>
  );
}
