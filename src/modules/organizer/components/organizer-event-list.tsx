import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  formatEventDate,
  formatEventLongDate,
  formatEventPrice,
  getEventHref,
} from "@/modules/event";

import {
  ORGANIZER_EVENT_FILTERS,
  ORGANIZER_NEW_EVENT_PATH,
} from "../constants/organizer.constants";
import type { OrganizerEvent, OrganizerEventFilter } from "../types/organizer.types";
import {
  getEventCapacity,
  getEventRevenue,
  getEventSold,
  toEventIsoDate,
} from "../utils/organizer.utils";

export interface OrganizerEventListProps {
  events: readonly OrganizerEvent[];
  filter: OrganizerEventFilter;
  onFilterChange: (filter: OrganizerEventFilter) => void;
}

const numberFormatter = new Intl.NumberFormat("es-PE");

// Sin hora (borradores) se muestra solo la fecha, para no inventar "12:00 a. m.".
function getEventDateLabel(date: string, time: string): string {
  const iso = toEventIsoDate(date, time);
  if (!iso) return "Sin fecha";
  return time ? formatEventDate(iso) : formatEventLongDate(iso);
}

function getEventAction(event: OrganizerEvent): { href: string; label: string } | null {
  if (event.status === "draft") {
    return { href: `${ORGANIZER_NEW_EVENT_PATH}?draft=${event.id}`, label: "Editar" };
  }
  return event.catalogSlug ? { href: getEventHref(event.catalogSlug), label: "Ver evento" } : null;
}

export function OrganizerEventList({ events, filter, onFilterChange }: OrganizerEventListProps) {
  return (
    <div className="flex flex-col gap-4">
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
              const sold = getEventSold(event);
              const capacity = getEventCapacity(event.tiers);
              const progress = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
              const action = getEventAction(event);
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
                      <span className="truncate font-semibold">{event.name}</span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {getEventDateLabel(event.date, event.time)}
                        {event.city && ` · ${event.city}`}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                      isDraft ? "bg-muted text-muted-foreground" : "bg-success/10 text-success",
                    )}
                  >
                    {isDraft ? "Borrador" : "Publicado"}
                  </span>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <span className="text-sm">
                      <strong className="font-semibold tabular-nums">
                        {numberFormatter.format(sold)}
                      </strong>{" "}
                      <span className="text-muted-foreground">
                        / {numberFormatter.format(capacity)} vendidas
                      </span>
                    </span>
                    <div
                      role="progressbar"
                      aria-label={`Entradas vendidas de ${event.name}`}
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
                    {isDraft ? "—" : formatEventPrice(getEventRevenue(event))}
                  </span>
                  <div className="flex justify-end">
                    {action && (
                      <Link
                        href={action.href}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {action.label}
                      </Link>
                    )}
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
