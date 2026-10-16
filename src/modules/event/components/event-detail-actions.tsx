"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/modules/favorite";

export interface EventDetailActionsProps {
  eventId: string;
  title: string;
  className?: string;
}

const COPIED_FEEDBACK_MS = 2000;

const actionClassName =
  "flex size-13 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-white/40 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60";

export function EventDetailActions({ eventId, title, className }: EventDetailActionsProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
    setIsCopied(true);
  };

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <FavoriteButton
        eventId={eventId}
        title={title}
        className={cn(actionClassName, "text-white hover:text-white focus-visible:ring-white/60")}
        iconClassName="text-white"
      />
      <button type="button" aria-label="Compartir evento" onClick={share} className={actionClassName}>
        <Share2 className="size-5" aria-hidden />
      </button>
      <span role="status" className="absolute top-full right-0 mt-2 text-xs whitespace-nowrap text-white">
        {isCopied ? "Enlace copiado" : ""}
      </span>
    </div>
  );
}
