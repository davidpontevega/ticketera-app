import { Clock, DoorOpen, ExternalLink, IdCard, MapPin, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { EventEntity } from "../types/event.types";
import { formatEventMinAge, formatEventTime, getEventMapsUrl } from "../utils/event.utils";

export interface EventDetailInfoProps {
  event: EventEntity;
}

const sectionTitleClassName = "font-heading text-xl font-bold tracking-tight lg:text-2xl";

export function EventDetailInfo({ event }: EventDetailInfoProps) {
  const facts = [
    { icon: DoorOpen, label: "Apertura de puertas", value: formatEventTime(event.doorsOpen) },
    { icon: Clock, label: "Inicio del show", value: formatEventTime(event.date) },
    { icon: IdCard, label: "Edad minima", value: formatEventMinAge(event.minAge) },
    { icon: QrCode, label: "Ingreso", value: "Entrada digital con QR" },
  ];

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <section aria-labelledby="event-about-title" className="flex flex-col gap-3 lg:gap-4">
        <h2 id="event-about-title" className={sectionTitleClassName}>
          Acerca del evento
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground lg:text-base">
          {event.description}
        </p>
      </section>

      <section aria-labelledby="event-info-title" className="flex flex-col gap-3 lg:gap-4">
        <h2 id="event-info-title" className={sectionTitleClassName}>
          Informacion importante
        </h2>
        <dl className="grid grid-cols-2 gap-2.5 lg:gap-4">
          {facts.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-2xl border border-border p-3.5 lg:flex-row lg:items-center lg:gap-3.5 lg:px-5 lg:py-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary lg:size-11">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground lg:text-[13px]">{label}</dt>
                <dd className="text-[15px] font-semibold lg:text-base">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="event-venue-title" className="flex flex-col gap-3 lg:gap-4">
        <h2 id="event-venue-title" className={sectionTitleClassName}>
          Lugar
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div
            aria-hidden
            className="flex h-40 items-center justify-center bg-primary/10 text-primary lg:h-60"
          >
            <MapPin className="size-10" />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-6 lg:py-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold lg:text-[17px]">{event.venue}</span>
              <span className="text-sm text-muted-foreground">
                {event.address}, {event.city}
              </span>
            </div>
            <Button
              variant="outline"
              size="lg"
              render={<a href={getEventMapsUrl(event)} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              className="h-11 shrink-0 rounded-xl border-foreground px-4 font-semibold"
            >
              Como llegar
              <ExternalLink aria-hidden />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
