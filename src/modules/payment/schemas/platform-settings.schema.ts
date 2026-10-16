import { z } from "zod";

import { FEE_PERCENT_MAX } from "../constants/payment.constants";

export const feePercentSchema = z.object({
  feePercent: z.preprocess(
    // Un campo vacio no debe convertirse en 0 %
    (value) => (value == null || (typeof value === "string" && value.trim() === "") ? Number.NaN : value),
    z.coerce
      .number({ error: "Ingresa un porcentaje valido" })
      .min(0, "El porcentaje no puede ser negativo")
      .max(FEE_PERCENT_MAX, `El porcentaje maximo es ${FEE_PERCENT_MAX}`)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Maximo 2 decimales"),
  ),
});
