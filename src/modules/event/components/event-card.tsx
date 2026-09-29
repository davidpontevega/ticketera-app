"use client";

import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { EventEntity } from "../types/event.types";
import { EventAvailabilityBadge } from "./event-availability-badge";
import {
  formatEventDate,
  formatEventDateBadge,
  formatEventPrice,
  getEventCategoryOption,
  getEventHref,
} from "../utils/event.utils";

export interface EventCardProps {
  event: EventEntity;
  className?: string;
}

export function EventCard({ event, className }: EventCardProps) {
  const isSoldOut = event.availability === "sold-out";
  const categoryOption = getEventCategoryOption(event.category);
  const { month, day } = formatEventDateBadge(event.date);

  return (
    <Card
      className={cn(
        "relative transition-all",
        isSoldOut ? "opacity-90" : "hover:shadow-lg hover:-translate-y-0.5",
        className,
      )}
    >
      <Link href={getEventHref(event.slug)} aria-label={event.title} className="absolute inset-0 z-0" />
      <div className="pointer-events-none relative z-10 aspect-video">
        <Image
          src={event.imageUrl}
          alt={event.title}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover"
        />
        <div className="absolute left-2 top-2 flex flex-col items-center leading-none rounded-lg bg-card px-2 py-1 shadow-sm">
          <span className="text-xs uppercase font-medium text-muted-foreground">{month}</span>
          <span className="text-lg font-bold">{day}</span>
        </div>
        <EventAvailabilityBadge
          availability={event.availability}
          className="absolute right-2 top-2"
        />
      </div>
      <CardContent className="pointer-events-none relative z-10 flex flex-col gap-1">
        <p className={cn("text-sm font-medium", categoryOption.labelClassName)}>
          {categoryOption.label}
        </p>
        <h3 className="font-heading font-medium leading-snug">{event.title}</h3>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(event.date)} · {event.venue}, {event.city}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-cta font-semibold">Desde {formatEventPrice(event.priceFrom)}</p>
          <button
            type="button"
            aria-label="Agregar a favoritos"
            onClick={(e) => e.preventDefault()}
            className="pointer-events-auto cursor-pointer text-muted-foreground hover:text-destructive"
          >
            <Heart className="size-5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
