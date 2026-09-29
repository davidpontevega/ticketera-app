import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PurchaseHeader } from "@/components/shared/purchase-header";
import { EVENTS_MOCK, formatEventDate, getEventBySlug, getEventHref } from "@/modules/event";
import { TicketSelection, getVenueLayout } from "@/modules/ticket";

export function generateStaticParams() {
  return EVENTS_MOCK.map(({ slug }) => ({ slug }));
}

export default async function TicketsPage({ params }: PageProps<"/events/[slug]/tickets">) {
  const { slug } = await params;
  const event = getEventBySlug(EVENTS_MOCK, slug);
  if (!event) notFound();

  const eventHref = getEventHref(event.slug);

  return (
    <>
      <PurchaseHeader
        currentStep={1}
        title="Elige tus entradas"
        backHref={eventHref}
        backLabel="Volver al evento"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 lg:py-6">
        <Link
          href={eventHref}
          className="mb-4 hidden w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:flex"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al evento
        </Link>
        <div className="mb-4 flex items-center gap-3 lg:mb-7 lg:gap-4">
          <Image
            src={event.imageUrl}
            alt=""
            width={64}
            height={64}
            className="size-13 rounded-xl object-cover lg:size-16 lg:rounded-2xl"
          />
          <div className="flex min-w-0 flex-col">
            <h1 className="font-heading text-base font-semibold lg:text-2xl lg:font-bold lg:tracking-tight">
              {event.title}
            </h1>
            <p className="text-sm text-muted-foreground lg:text-[15px]">
              {formatEventDate(event.date)} · {event.venue}, {event.city}
            </p>
          </div>
        </div>
        <TicketSelection event={event} layout={getVenueLayout(event)} />
      </main>
    </>
  );
}
