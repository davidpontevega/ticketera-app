import { z } from "zod";

import { MAX_GENERAL_CAPACITY, MAX_ROWS, MAX_SEATS_PER_ROW } from "../utils/venue.utils";

const text = (label: string, min: number, max: number) =>
  z
    .string(`${label} requerido`)
    .trim()
    .min(min, `${label}: minimo ${min} caracteres`)
    .max(max, `${label}: maximo ${max} caracteres`);

// Entero positivo escrito como string ("abc" y "1.5" se rechazan).
const intString = (label: string, max: number) =>
  z
    .string(`${label} requerido`)
    .trim()
    .regex(/^\d+$/, `${label}: ingresa un numero entero`)
    .transform(Number)
    .pipe(z.number().min(1, `${label}: minimo 1`).max(max, `${label}: maximo ${max}`));

const coordinate = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || (Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit), {
      message: `${label} invalida`,
    });

export const venueSchema = z
  .object({
    name: text("Nombre", 2, 120),
    address: text("Direccion", 2, 200),
    city: text("Ciudad", 2, 80),
    latitude: coordinate("Latitud", 90),
    longitude: coordinate("Longitud", 180),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      const path = value.latitude === undefined ? "latitude" : "longitude";
      ctx.addIssue({ code: "custom", path: [path], message: "Ingresa latitud y longitud juntas" });
    }
  })
  .transform((value) => ({
    name: value.name,
    address: value.address,
    city: value.city,
    latitude: value.latitude === undefined ? null : String(Number(value.latitude)),
    longitude: value.longitude === undefined ? null : String(Number(value.longitude)),
  }));

export const zoneSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("general"),
    name: text("Nombre", 1, 80),
    capacity: intString("Capacidad", MAX_GENERAL_CAPACITY),
  }),
  z.object({
    kind: z.literal("numbered"),
    name: text("Nombre", 1, 80),
    rows: intString("Filas", MAX_ROWS),
    seatsPerRow: intString("Asientos por fila", MAX_SEATS_PER_ROW),
  }),
]);

export const venueIdSchema = z.uuid();

export type ParsedVenueInput = z.output<typeof venueSchema>;
export type ParsedZoneInput = z.output<typeof zoneSchema>;
