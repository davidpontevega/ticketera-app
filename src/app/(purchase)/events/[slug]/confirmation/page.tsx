import { notFound } from "next/navigation";

import { PurchaseHeader } from "@/components/shared/purchase-header";
import { EVENTS_MOCK, getEventBySlug } from "@/modules/event";
import { OrderConfirmation } from "@/modules/order";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function ConfirmationPage({ params }: PageProps<"/events/[slug]/confirmation">) {
  const event = getEventBySlug(EVENTS_MOCK, (await params).slug);
  if (!event) notFound();

  return (
    <>
      <PurchaseHeader currentStep={3} title="Confirmacion" backHref="/" backLabel="Ir al inicio" />
      <main className="w-full flex-1 px-4 py-8 md:px-6 lg:py-12">
        <OrderConfirmation event={event} />
      </main>
    </>
  );
}
