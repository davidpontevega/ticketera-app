"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { setEventFeaturedAction } from "../actions/organizer-event.actions";

export interface OrganizerEventFeaturedToggleProps {
  eventId: string;
  isFeatured: boolean;
}

export function OrganizerEventFeaturedToggle({
  eventId,
  isFeatured,
}: OrganizerEventFeaturedToggleProps) {
  const [, formAction, pending] = useActionState(setEventFeaturedAction, { status: "idle" as const });

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="featured" value={isFeatured ? "false" : "true"} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={isFeatured ? "Quitar destacado" : "Marcar como destacado"}
      >
        <Star className={cn(isFeatured ? "fill-current text-yellow-500" : "text-muted-foreground")} />
      </Button>
    </form>
  );
}
