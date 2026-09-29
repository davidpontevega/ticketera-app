"use client";

import { useEffect, useState } from "react";
import { Heart, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EventDetailActionsProps {
  title: string;
  className?: string;
}

const COPIED_FEEDBACK_MS = 2000;

const actionClassName =
  "flex size-13 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-white/40 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60";

export function EventDetailActions({ title, className }: EventDetailActionsProps) {
  const [isSaved, setIsSaved] = useState(false);
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
      <button
        type="button"
        aria-label="Guardar evento"
        aria-pressed={isSaved}
        onClick={() => setIsSaved((saved) => !saved)}
        className={cn(actionClassName, isSaved && "bg-white/15")}
      >
        <Heart className={cn("size-5", isSaved && "fill-current")} aria-hidden />
      </button>
      <button type="button" aria-label="Compartir evento" onClick={share} className={actionClassName}>
        <Share2 className="size-5" aria-hidden />
      </button>
      <span role="status" className="absolute top-full right-0 mt-2 text-xs whitespace-nowrap text-white">
        {isCopied ? "Enlace copiado" : ""}
      </span>
    </div>
  );
}
