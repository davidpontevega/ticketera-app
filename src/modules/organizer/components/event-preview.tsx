import Image from "next/image";
import { ImageIcon, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatEventDateBadge, formatEventPrice, getEventCategoryOption } from "@/modules/event";

import type { EventFormValues } from "../types/organizer.types";
import { getEventPriceFrom, toEventIsoDate } from "../utils/organizer.utils";

export interface EventPreviewProps {
  values: EventFormValues;
}

// Vista previa con placeholders: el formulario puede estar incompleto (EventCard exige un evento completo).
export function EventPreview({ values }: EventPreviewProps) {
  const category = getEventCategoryOption(values.category);
  const iso = toEventIsoDate(values.date, values.time);
  const badge = iso ? formatEventDateBadge(iso) : null;
  const priceFrom = getEventPriceFrom(values.tiers.map((tier) => ({ price: Number(tier.price) })));
  const place = [values.venue.trim(), values.city.trim()].filter(Boolean).join(" · ");

  return (
    <aside aria-label="Vista previa" className="flex flex-col gap-3">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Vista previa
      </span>
      <div className="overflow-hidden rounded-2xl bg-background shadow-md ring-1 ring-foreground/10">
        <div className="relative aspect-video bg-muted">
          {values.imageUrl ? (
            <Image
              src={values.imageUrl}
              alt=""
              fill
              sizes="360px"
              unoptimized={values.imageUrl.startsWith("data:")}
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8" aria-hidden />
            </span>
          )}
          <span className="absolute top-2 left-2 flex w-12 flex-col items-center rounded-lg bg-background py-1 leading-none shadow-sm">
            <span className="text-[10px] font-bold text-primary uppercase">
              {badge?.month ?? "mes"}
            </span>
            <span className="text-lg font-bold">{badge?.day ?? "--"}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <span className={cn("text-sm font-medium", category.labelClassName)}>
            {category.label}
          </span>
          <span
            className={cn(
              "line-clamp-2 font-heading font-semibold",
              !values.name.trim() && "text-muted-foreground",
            )}
          >
            {values.name.trim() || "Nombre del evento"}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {place || "Lugar · Ciudad"}
          </span>
          <span className="mt-1 font-semibold text-cta">
            Desde {priceFrom ? formatEventPrice(priceFrom) : "S/ —"}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Asi veran tu evento los compradores en el listado.
      </p>
    </aside>
  );
}
