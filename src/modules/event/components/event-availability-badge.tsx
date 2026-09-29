import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { EVENT_AVAILABILITY_LABEL } from "../constants/event.constants";
import type { EventAvailability } from "../types/event.types";

export interface EventAvailabilityBadgeProps {
  availability: EventAvailability;
  className?: string;
}

export function EventAvailabilityBadge({ availability, className }: EventAvailabilityBadgeProps) {
  return (
    <Badge
      variant={availability === "sold-out" ? "destructive" : "secondary"}
      className={cn(
        availability === "available" && "bg-success text-success-foreground",
        availability === "few-left" && "bg-cta text-cta-foreground",
        className,
      )}
    >
      {EVENT_AVAILABILITY_LABEL[availability]}
    </Badge>
  );
}
