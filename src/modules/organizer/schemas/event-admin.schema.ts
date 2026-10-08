import { z } from "zod";

import { eventStatusEnum } from "@/modules/event/db/event.table";

export const changeEventStatusSchema = z.object({
  eventId: z.uuid("Evento invalido"),
  status: z.enum(eventStatusEnum.enumValues, "Estado invalido"),
});

export const deleteEventSchema = z.object({
  eventId: z.uuid("Evento invalido"),
});

export const setEventFeaturedSchema = z.object({
  eventId: z.uuid("Evento invalido"),
  featured: z.enum(["true", "false"], "Valor invalido").transform((value) => value === "true"),
});

export type ChangeEventStatusInput = z.infer<typeof changeEventStatusSchema>;
export type DeleteEventInput = z.infer<typeof deleteEventSchema>;
export type SetEventFeaturedInput = z.infer<typeof setEventFeaturedSchema>;
