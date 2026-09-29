# 008 — MER de base de datos (Drizzle + Postgres, Neon local / Cloud SQL prod)

## Contexto
Primer modelo de datos real del proyecto. Hoy solo existe `EventEntity` (`src/modules/event/types/event.types.ts`) con mock data (`event.mock.ts`), sin persistencia, auth, ordenes ni pagos en codigo. Esta spec define el esquema de Postgres (tablas, enums, relaciones, constraints) necesario para soportar:
- Autenticacion con Clerk (email/password + Google), sincronizada a una tabla `users` propia via webhook.
- Roles: `super_admin`, `admin`, `organizer`, `customer`.
- Eventos con multiples tipos de entrada (`ticket_tiers`: General, VIP, etc.), cada uno con precio y stock propio.
- Compra: una orden por evento (`orders` + `order_items`), pago con Stripe (cobro directo a la plataforma, sin Connect/split).
- Entradas individuales con QR y estado de check-in (`tickets`).
- Venue con lat/lng para mostrar mapa (Google Maps) en produccion.
- Mismo schema para ambos ambientes (Neon local, Cloud SQL prod); solo cambia `DATABASE_URL`.

Discutido y aprobado en conversacion previa (brainstorming). No incluye: design system/tokens de UI, split payments a organizadores, checkout multi-evento, refunds modelados, Places Autocomplete, capa de servicios/zod/API routes que lean estas tablas (eso es la siguiente spec, una vez el schema este aprobado y migrado).

## Alcance
- Incluye:
  - Instalar `drizzle-orm`, `drizzle-kit`, `postgres` (driver `postgres-js`, sirve igual para Neon y Cloud SQL via connection string).
  - `drizzle.config.ts` + `src/lib/db.ts` (cliente singleton).
  - 6 tablas + 5 enums, una por dominio, en `src/modules/<domain>/db/<domain>.table.ts`.
  - Barrel `src/db/schema.ts` que reexporta todas las tablas: es el punto de import unico para codigo de aplicacion (servicios futuros, `relations()`). `drizzle.config.ts` sigue apuntando al glob `./src/modules/*/db/*.table.ts` (es lo que soporta `drizzle-kit generate`); el barrel y el glob son dos mecanismos independientes que coexisten a proposito, no uno reemplaza al otro.
  - Tipos inferidos (`$inferSelect`/`$inferInsert`): solo para `users` (`UserEntity`/`NewUser`), porque es la unica tabla que un webhook (siguiente spec) va a necesitar tipar de inmediato. Los de `events`/`ticket_tiers`/`orders`/`order_items`/`tickets` se agregan en la spec de servicios cuando haya codigo que los consuma (YAGNI).
  - Migracion generada (`drizzle-kit generate`) y un script de verificacion (insert/select end-to-end respetando FKs, con cleanup).
  - `.env.example` con `DATABASE_URL`.
- Excluye:
  - Servicios (`*.service.ts`), schemas zod (`*.schema.ts`) o API routes que usen estas tablas: siguiente spec.
  - Webhook de Clerk (`user.created`/`updated`) que popule `users`: siguiente spec, esta solo define la tabla destino.
  - Integracion real de Stripe (Checkout, webhooks de pago): siguiente spec, esta solo define `orders.stripe_payment_intent_id` como columna.
  - Split payments (Stripe Connect), checkout multi-evento, refunds, Places Autocomplete.
  - Deploy de Cloud SQL en si (proxy, IAM, red): se asume que en prod `DATABASE_URL` apunta a una instancia Postgres alcanzable (via Cloud SQL Auth Proxy o IP publica con SSL); wiring de infra queda fuera.
- Backlog: `relations()` de Drizzle (query API con joins) — se agrega cuando exista una spec que necesite leer datos relacionados; hoy no hay codigo que consulte estas tablas.

## Decisiones
- **`priceFrom` y `availability` dejan de ser columnas de `events`.** Se calculan desde `ticket_tiers` (MIN precio entre tiers activos; disponibilidad segun `total_stock` vs entradas vendidas). Evita datos duplicados/desincronizados (DRY). El calculo en si (query o vista) es de la siguiente spec.
- **Precio en unidades (soles), no centavos.** Mismo criterio que el comentario existente en `EventEntity.priceFrom` (`numeric` en Postgres, no `integer` de centavos), para no introducir una conversion que el resto del codigo no usa.
- **`role` como enum en `users`, no tabla de permisos.** No se pidio un sistema de permisos granular/dinamico; 4 roles fijos no justifican una tabla `roles`/`permissions` (YAGNI).
- **IDs `uuid` con `defaultRandom()` (via `gen_random_uuid()`).** Requiere la extension `pgcrypto` habilitada en Postgres. `drizzle-kit` no gestiona extensiones: hay que ejecutar `CREATE EXTENSION IF NOT EXISTS pgcrypto;` una vez en cada ambiente (Neon y Cloud SQL) antes de aplicar la primera migracion. Se documenta como paso manual en T1, no se automatiza (no hay forma segura de correr DDL de extension desde una migracion versionada sin permisos de superuser variables por ambiente).
- **`ON DELETE` explicito por FK, pensado para no perder historial de compra:**
  - `events.organizer_id -> users.id`: `SET NULL` (columna nullable; si se borra el organizador, el evento no se pierde, queda sin dueño).
  - `ticket_tiers.event_id -> events.id`: `CASCADE` (un tier no tiene sentido sin su evento).
  - `orders.user_id -> users.id` y `orders.event_id -> events.id`: `RESTRICT` (no se puede borrar un usuario o evento con ordenes asociadas; preserva el historial financiero).
  - `order_items.order_id -> orders.id`: `CASCADE` (la linea de compra no tiene sentido sin su orden).
  - `order_items.ticket_tier_id -> ticket_tiers.id`: `RESTRICT` (no se puede borrar un tier si ya se vendio; combinado con el `CASCADE` de arriba, esto implica que un evento con ventas **no se puede borrar** — hay que usar `events.status = 'cancelled'` en su lugar, que ya existe para eso).
  - `tickets.order_item_id -> order_items.id`: `CASCADE`.
  - Nota: cancelar una orden o un evento es un cambio de `status`, no un `DELETE`. Los `ON DELETE` de arriba son para proteger integridad ante borrados manuales/scripts, no el flujo normal de la app.
- **`ticket_tiers` vive en el modulo `event`, no en `ticket`.** Un tier es la oferta de venta de un evento (lo define/edita el organizador junto al evento), mientras que `ticket` (modulo) es la entrada ya comprada por un cliente. Mismo criterio que separa "catalogo" de "inventario vendido".
- **Un driver para ambos ambientes.** `drizzle-orm/postgres-js` con el paquete `postgres` habla el protocolo Postgres estandar; Neon y Cloud SQL lo soportan igual. Se evita mantener dos clientes (`@neondatabase/serverless` solo para local) por una diferencia que no aporta nada en este proyecto (sin edge runtime).

## Reuso detectado
- `src/modules/event/types/event.types.ts`: `EventCategory` (union de 10 strings) se reusa tal cual como valores del enum `event_category` — no se inventan categorias nuevas.
- `src/modules/event/constants/event.constants.ts`: `EVENT_CURRENCY = "PEN"` confirma que el proyecto ya asume una sola moneda; no se agrega columna `currency` por tabla (YAGNI), se documenta como constante de aplicacion.
- No existe `src/lib/db.ts` ni nada de persistencia: no hay nada que reusar de infra, se crea desde cero.
- `docs/SETUP.md` seccion 1.3: estructura de modulo (`db/` es una subcarpeta nueva, analoga a `services/`/`schemas/`, se crea solo donde se usa).

## Contratos

### Dependencias nuevas (`package.json`)
```json
{
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### `drizzle.config.ts` (raiz)
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/*/db/*.table.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### `.env.example`
```
DATABASE_URL=postgresql://user:password@host:5432/ticketera
```

### `src/lib/db.ts`
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);
```

### `src/modules/user/db/user.table.ts`
```ts
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "organizer", "customer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("customer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```
`src/modules/user/types/user.types.ts`: `export type UserEntity = typeof users.$inferSelect;` `export type NewUser = typeof users.$inferInsert;`

### `src/modules/event/db/event.table.ts`
```ts
export const eventCategoryEnum = pgEnum("event_category", [
  "concerts", "sports", "theater", "festivals", "family",
  "standup", "cinema", "arts", "fairs", "conferences",
]); // mismo orden/valores que EventCategory

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled"]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: eventCategoryEnum("category").notNull(),
  organizerId: uuid("organizer_id").references(() => users.id, { onDelete: "set null" }),
  venueName: text("venue_name").notNull(),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  city: text("city").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  imageUrl: text("image_url").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  isTrending: boolean("is_trending").notNull().default(false),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  status: eventStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### `src/modules/event/db/ticket-tier.table.ts`
```ts
export const ticketTiers = pgTable("ticket_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "General", "VIP"
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // soles, no centavos
  totalStock: integer("total_stock").notNull(),
  salesStartAt: timestamp("sales_start_at", { withTimezone: true }),
  salesEndAt: timestamp("sales_end_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### `src/modules/order/db/order.table.ts`
```ts
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled"]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### `src/modules/order/db/order-item.table.ts`
```ts
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  ticketTierId: uuid("ticket_tier_id").notNull().references(() => ticketTiers.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(), // snapshot al comprar
});
```

### `src/modules/ticket/db/ticket.table.ts`
```ts
export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "used", "cancelled"]);

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  qrCode: text("qr_code").notNull().unique(),
  status: ticketStatusEnum("status").notNull().default("valid"),
  attendeeName: text("attendee_name"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### `src/db/schema.ts` (barrel)
```ts
export * from "@/modules/user/db/user.table";
export * from "@/modules/event/db/event.table";
export * from "@/modules/event/db/ticket-tier.table";
export * from "@/modules/order/db/order.table";
export * from "@/modules/order/db/order-item.table";
export * from "@/modules/ticket/db/ticket.table";
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar deps, `drizzle.config.ts`, `src/lib/db.ts`, `.env.example`, scripts npm. Documentar (comentario en `.env.example`) el paso manual `CREATE EXTENSION IF NOT EXISTS pgcrypto;` | package.json, drizzle.config.ts, src/lib/db.ts, .env.example | — | P1 |
| T2 | Tabla `users` + enum `user_role` + `UserEntity`/`NewUser` | src/modules/user/db/user.table.ts, src/modules/user/types/user.types.ts, src/modules/user/index.ts | T1 | P2 |
| T3 | Tabla `events` + enums `event_category`/`event_status` (FK a `users`) | src/modules/event/db/event.table.ts | T2 | P3 |
| T4 | Tabla `ticket_tiers` (FK a `events`) | src/modules/event/db/ticket-tier.table.ts | T3 | P4 |
| T5 | Tabla `orders` + enum `order_status` (FK a `users`, `events`) | src/modules/order/db/order.table.ts, src/modules/order/index.ts | T3 | P4 |
| T6 | Tabla `order_items` (FK a `orders`, `ticket_tiers`) | src/modules/order/db/order-item.table.ts | T4, T5 | P5 |
| T7 | Tabla `tickets` + enum `ticket_status` (FK a `order_items`) | src/modules/ticket/db/ticket.table.ts, src/modules/ticket/index.ts | T6 | P6 |
| T8 | Barrel `src/db/schema.ts`, generar migracion (`db:generate`), script de verificacion end-to-end | src/db/schema.ts, drizzle/ (generado), scripts/verify-db.ts | T7 | P7 |

Orden: T1 → T2 → T3 → [T4 ‖ T5] → T6 → T7 → T8. La cadena de FKs (`users → events → {ticket_tiers, orders} → order_items → tickets`) limita el paralelismo real a T4/T5.

## Criterios de aceptacion
- [ ] AC1: `npm run db:generate` genera la migracion SQL con las 6 tablas y 5 enums sin errores.
- [ ] AC2: Cada FK tiene el `onDelete` definido segun la seccion Decisiones (verificable en el SQL generado).
- [ ] AC3: Constraints `UNIQUE` presentes en `users.clerk_id`, `events.slug`, `tickets.qr_code`.
- [ ] AC4: Script de verificacion (`scripts/verify-db.ts`) inserta, en orden, un user → event → ticket_tier → order → order_item → ticket contra `DATABASE_URL` de `.env`, lee cada fila de vuelta, y hace cleanup (delete en orden inverso) sin dejar filas huerfanas. Corre con `tsx scripts/verify-db.ts` o similar.
- [ ] AC5: `npx tsc --noEmit` sin errores.
- [ ] AC6: `npm run lint` sin errores.
- [ ] AC7: `npm run build` compila (drizzle en server-only, no debe romper el build de Next.js).

## Tests requeridos
- No aplica Vitest unitario: no hay logica de negocio en esta spec (solo definiciones de tabla, sin funciones puras que testear). La verificacion es el script de integracion de AC4, que requiere una base real y por eso no corre en el suite de Vitest (no hay Postgres mockeable que valide constraints/FKs de forma util).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- **Nombre de columnas de moneda:** no se agrega `currency` por fila (se asume PEN global via `EVENT_CURRENCY`). Si el proyecto agrega otra moneda mas adelante, es una migracion nueva, no bloquea esto.
- **`description` de `events` como `NOT NULL`:** hoy `EventEntity` no tiene `description`. Se agrega como requerido porque una pagina de detalle de evento (fuera de esta spec) la va a necesitar. Si se prefiere nullable, es un cambio de una linea antes de generar la migracion.

## Estado
- Aprobacion humana: aprobada (2026-09-28)
- Fase: implementado
- Log de review:
  - Iteracion 1: CHANGES_REQUESTED. `.env.example` ignorado por `.gitignore` (`.env*` sin excepcion); `scripts/verify-db.ts` no cargaba `DATABASE_URL` al documentarse con `npx tsx` plano; cleanup de `verify-db.ts` no corria si un insert intermedio fallaba. Ademas 2 ambiguedades en el texto de la spec (proposito de `src/db/schema.ts` vs glob de `drizzle.config.ts`; alcance de tipos inferidos).
  - Iteracion 2: APPROVED. Los 3 hallazgos de codigo corregidos (excepcion en `.gitignore`, script `db:verify` con `--env-file=.env`, try/finally en el cleanup) y las 2 ambiguedades de la spec resueltas. `tsc`, `lint`, `test` y `build` limpios.
