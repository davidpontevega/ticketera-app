"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { getAuthHref } from "@/modules/auth/utils/auth.utils";

import { setFavoriteAction } from "../actions/favorite.actions";
import { useFavorite } from "./favorites-provider";

export interface FavoriteButtonProps {
  eventId: string;
  title: string;
  className?: string;
  iconClassName?: string;
}

export function FavoriteButton({ eventId, title, className, iconClassName }: FavoriteButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isFavorite, setLocalFavorite } = useFavorite(eventId);
  const [isPending, startTransition] = useTransition();

  const goToLogin = () =>
    router.push(getAuthHref("/login", `${window.location.pathname}${window.location.search}`));

  const toggle = () => {
    if (!isAuthenticated) return goToLogin();

    const desired = !isFavorite;
    setLocalFavorite(eventId, desired);
    startTransition(async () => {
      const result = await setFavoriteAction({ eventId, favorite: desired }).catch(() => null);
      if (result?.status === "success") return;
      setLocalFavorite(eventId, !desired);
      if (result?.status === "unauthenticated") goToLogin();
    });
  };

  return (
    <button
      type="button"
      aria-label={`Agregar a favoritos: ${title}`}
      aria-pressed={isFavorite}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      className={cn(
        "pointer-events-auto cursor-pointer rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait",
        className,
      )}
    >
      <Heart className={cn("size-5", isFavorite && "fill-current text-destructive", iconClassName)} aria-hidden />
    </button>
  );
}
