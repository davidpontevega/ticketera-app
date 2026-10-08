import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEventDate, formatEventPrice } from "@/modules/event";

import { ORGANIZER_EVENT_FILTERS, ORGANIZER_NEW_EVENT_PATH } from "../constants/organizer.constants";
import { OrganizerEventActions } from "./organizer-event-actions";
import { OrganizerEventFeaturedToggle } from "./organizer-event-featured-toggle";
import type {
  OrganizerDbEventStatus,
  OrganizerEventFilter,
  OrganizerEventSummary,
} from "../types/organizer.types";

export interface OrganizerEventListProps {
  events: readonly OrganizerEventSummary[];
  filter: OrganizerEventFilter;
  onFilterChange: (filter: OrganizerEventFilter) => void;
}

const numberFormatter = new Intl.NumberFormat("es-PE");

const STATUS_LABEL: Record<OrganizerDbEventStatus, string> = {
  published: "Publicado",
  draft: "Borrador",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<OrganizerDbEventStatus, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export function OrganizerEventList({ events, filter, onFilterChange }: OrganizerEventListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtrar eventos"
          className="flex w-fit gap-1 rounded-xl bg-background p-1 ring-1 ring-foreground/10"
        >
          {ORGANIZER_EVENT_FILTERS.map((option) => {
            const isActive = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(option.value)}
                className={cn(
                  "h-9 cursor-pointer rounded-lg px-3.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isActive
                    ? "bg-foreground font-semibold text-background"
                    : "font-medium hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <Button
          render={<Link href={ORGANIZER_NEW_EVENT_PATH} />}
          nativeButton={false}
          className="cursor-pointer"
        >
          <Plus aria-hidden />
          Crear evento
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-2xl bg-background p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No hay eventos en esta vista.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,2.4fr)_110px_minmax(0,1.3fr)_minmax(0,1fr)_110px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:grid"
          >
            <span>Evento</span>
            <span>Estado</span>
            <span>Vendidas</span>
            <span className="text-right">Ingresos</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const isDraft = event.status === "draft";
              const progress =
                event.capacity > 0 ? Math.round((event.sold / event.capacity) * 100) : 0;
              return (
                <li
                  key={event.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-4 lg:grid-cols-[minmax(0,2.4fr)_110px_minmax(0,1.3fr)_minmax(0,1fr)_110px] lg:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {event.imageUrl && (
                        <Image
                          src={event.imageUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized={event.imageUrl.startsWith("data:")}
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{event.title}</span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {formatEventDate(event.startsAt)}
                        {event.city && ` · ${event.city}`}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                      STATUS_CLASS[event.status],
                    )}
                  >
                    {STATUS_LABEL[event.status]}
                  </span>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <span className="text-sm">
                      <strong className="font-semibold tabular-nums">
                        {numberFormatter.format(event.sold)}
                      </strong>{" "}
                      <span className="text-muted-foreground">
                        / {numberFormatter.format(event.capacity)} vendidas
                      </span>
                    </span>
                    <div
                      role="progressbar"
                      aria-label={`Entradas vendidas de ${event.title}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums lg:text-right">
                    <span className="text-muted-foreground lg:hidden">Ingresos: </span>
                    {isDraft ? "—" : formatEventPrice(event.revenue)}
                  </span>
                  <div className="flex justify-end gap-1">
                    <OrganizerEventFeaturedToggle eventId={event.id} isFeatured={event.isFeatured} />
                    <OrganizerEventActions event={event} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
