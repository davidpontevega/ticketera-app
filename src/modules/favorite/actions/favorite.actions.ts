"use server";

import { getCurrentDbUser } from "@/modules/user";

import { setFavoriteSchema, type SetFavoriteInput } from "../schemas/favorite.schema";
import { setFavorite } from "../services/favorite.service";
import type { FavoriteActionState } from "../types/favorite.types";

// userId sale de la sesion en servidor; el input solo aporta eventId y el estado deseado.
export async function setFavoriteAction(input: SetFavoriteInput): Promise<FavoriteActionState> {
  try {
    const user = await getCurrentDbUser();
    if (!user) return { status: "unauthenticated" };

    const parsed = setFavoriteSchema.safeParse(input);
    if (!parsed.success) return { status: "error" };

    const result = await setFavorite(user.id, parsed.data.eventId, parsed.data.favorite);
    return result === "ok" ? { status: "success" } : { status: "not-found" };
  } catch (error) {
    console.error("favorite action failed", error);
    return { status: "error" };
  }
}
