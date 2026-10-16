import { z } from "zod";

export const refundOrderSchema = z.object({
  eventId: z.uuid("Evento invalido"),
  orderId: z.uuid("Orden invalida"),
});

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
