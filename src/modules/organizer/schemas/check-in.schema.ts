import { z } from "zod";

// Formato de getOrderTickets: "TK-" + 8 hex del id de la orden + "-" + secuencia (2 digitos).
export const CHECK_IN_CODE_PATTERN = /^TK-[0-9A-F]{8}-\d{2}$/;

export const checkInSchema = z.object({
  eventId: z.uuid("Evento invalido"),
  code: z
    .string("Codigo invalido")
    .trim()
    .toUpperCase()
    .regex(CHECK_IN_CODE_PATTERN, "Codigo invalido"),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
