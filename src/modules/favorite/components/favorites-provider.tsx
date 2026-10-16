"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface FavoritesContextValue {
  isAuthenticated: boolean;
  isFavorite: (eventId: string) => boolean;
  setLocalFavorite: (eventId: string, favorite: boolean) => void;
}

// Sin provider (anonimo / fuera del layout): nada marcado y sin sesion.
const FavoritesContext = createContext<FavoritesContextValue>({
  isAuthenticated: false,
  isFavorite: () => false,
  setLocalFavorite: () => undefined,
});

export interface FavoritesProviderProps {
  favoriteEventIds: string[];
  isAuthenticated: boolean;
  children: ReactNode;
}

export function FavoritesProvider({ favoriteEventIds, isAuthenticated, children }: FavoritesProviderProps) {
  const [ids, setIds] = useState(() => new Set(favoriteEventIds));

  const setLocalFavorite = useCallback((eventId: string, favorite: boolean) => {
    setIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, isFavorite: (eventId: string) => ids.has(eventId), setLocalFavorite }),
    [ids, isAuthenticated, setLocalFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorite(eventId: string) {
  const { isAuthenticated, isFavorite, setLocalFavorite } = useContext(FavoritesContext);
  return { isAuthenticated, isFavorite: isFavorite(eventId), setLocalFavorite };
}
