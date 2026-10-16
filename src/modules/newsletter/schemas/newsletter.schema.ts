import { z } from "zod";

export const MAX_EMAIL_LENGTH = 254;

export const subscribeSchema = z.object({
  email: z
    .string("Correo requerido")
    .trim()
    .toLowerCase()
    .min(1, "Correo requerido")
    .max(MAX_EMAIL_LENGTH, `Correo: maximo ${MAX_EMAIL_LENGTH} caracteres`)
    .pipe(z.email("Correo invalido")),
  // Honeypot: los humanos no lo ven; si viene con valor es un bot.
  website: z.string().optional(),
});
