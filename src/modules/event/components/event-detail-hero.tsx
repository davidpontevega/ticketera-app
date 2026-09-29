import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import type { EventEntity } from "../types/event.types";
import {
  formatEventLongDate,
  formatEventPrice,
  formatEventTime,
  getEventCategoryOption,
} from "../utils/event.utils";
import { getEventSearchHref } from "../utils/event-search.utils";
import { EventDetailActions } from "./event-detail-actions";

export interface EventDetailHeroProps {
  event: EventEntity;
  ticketsHref: string;
}

export function EventDetailHero({ event, ticketsHref }: EventDetailHeroProps) {
  const category = getEventCategoryOption(event.category);
  const isSoldOut = event.availability === "sold-out";
  const facts = [
    { icon: CalendarDays, label: formatEventLongDate(event.date) },
    { icon: Clock, label: formatEventTime(event.date) },
    { icon: MapPin, label: `${event.venue}, ${event.city}` },
  ];

  return (
    <section className="flex flex-col gap-4 pt-4 lg:gap-5 lg:pt-6">
      <Breadcrumb aria-label="Ruta">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Inicio</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href={getEventSearchHref({ categories: [event.category] })} />}
            >
              {category.label}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbPage className="font-medium">{event.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid overflow-hidden rounded-3xl bg-indigo-950 lg:h-115 lg:grid-cols-[540px_minmax(0,1fr)] lg:rounded-4xl">
        <div className="relative h-56 sm:h-72 lg:order-2 lg:h-full">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-4 p-6 text-white lg:p-12">
          <span className="w-fit rounded-full border border-white/30 px-3.5 py-1 text-xs font-medium lg:text-sm">
            {category.label}
          </span>
          <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance lg:text-5xl">
            {event.title}
          </h1>
          <ul className="flex flex-col gap-2 text-sm text-indigo-100 lg:gap-2.5 lg:text-base">
            {facts.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-2.5 pt-2">
            {isSoldOut ? (
              <Button
                type="button"
                size="lg"
                disabled
                className="hidden h-13 flex-1 rounded-xl text-base font-semibold lg:inline-flex"
              >
                Agotado
              </Button>
            ) : (
              <Button
                size="lg"
                render={<Link href={ticketsHref} />}
                nativeButton={false}
                className="hidden h-13 flex-1 rounded-xl text-base font-semibold lg:inline-flex"
              >
                Comprar entradas · desde {formatEventPrice(event.priceFrom)}
              </Button>
            )}
            <EventDetailActions title={event.title} />
          </div>
        </div>
      </div>
    </section>
  );
}
