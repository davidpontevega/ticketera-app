import { z } from "zod";

export const setFavoriteSchema = z.object({
  eventId: z.uuid(),
  favorite: z.boolean(),
});

export type SetFavoriteInput = z.infer<typeof setFavoriteSchema>;
