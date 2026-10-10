# 025 — Seed de eventos del catalogo mock en `events` y `ticket_tiers`

## Contexto
El catalogo publico vive en memoria (`EVENTS_MOCK`, 14 eventos) y sus zonas/precios salen de plantillas de venue
(`venue.mock.ts` + `getVenueLayout`). Las tablas `events` y `ticket_tiers` (spec 008) estan vacias. El usuario pide
dejar listo un seed con esos datos para cargarlos en Postgres, **sin ejecutarlo**: se correra despues, asociado a un
usuario con rol `organizer` que todavia no existe (se creara con la invitacion de la spec 027).

Resultado esperado: `npm run db:seed` existe y, cuando se corra con `SEED_ORGANIZER_EMAIL`, inserta los 14 eventos
publicados con sus tiers, asignados a ese organizador, de forma idempotente. Nada lo invoca automaticamente.

Independiente de la spec 024 (roles): solo lee `users.role`, columna que ya existe. Puede desarrollarse en paralelo.

## Alcance
- Incluye:
  - Funcion pura de mapeo `EventEntity` -> fila de `events` + filas de `ticket_tiers` (+ test).
  - Script `scripts/seed-events.ts` y script npm `db:seed`.
- Excluye:
  - **Ejecutar el seed** (ni en esta spec, ni desde otro script, ni en CI).
  - Que el catalogo de la app lea de la DB: la UI sigue leyendo `EVENTS_MOCK` (backlog "Catalogo en DB" de la 022).
  - Columnas nuevas en `events` para campos del mock que la tabla no tiene (ver "Mapeo").
  - `ORGANIZER_EVENTS_MOCK` (`src/modules/organizer/mocks/organizer.mock.ts`): son datos de demo del panel (ventas
    `sold`, un borrador) y 3 de sus 4 slugs repiten eventos del catalogo con otros tiers. Ver Preguntas abiertas 2.
- Backlog: catalogo leyendo de DB; columnas `doors_open_at`/`min_age` si se migra el detalle del evento; seed de
  ordenes/tickets de prueba.

## Reuso detectado
- `src/modules/event/mocks/event.mock.ts` — `EVENTS_MOCK`, fuente de los eventos.
- `src/modules/ticket/utils/ticket.utils.ts` — `getVenueLayout(event)`: ya resuelve plantilla por categoria, precio
  por zona (`priceFrom * priceFactor` redondeado) y asientos de zonas numeradas. Es la misma fuente que usa la UI y
  el checkout de Stripe (022), asi que los precios en DB coinciden con los que ve el usuario. Se importa por ruta
  directa (no el barrel `@/modules/ticket`, que arrastra componentes cliente) para que corra en `tsx`.
- `src/modules/event/db/event.table.ts` (`events`), `src/modules/event/db/ticket-tier.table.ts` (`ticketTiers`),
  `src/modules/user/db/user.table.ts` (`users`) — tablas destino/lookup, sin cambios. Tipos de insert con
  `$inferInsert` (no se redefinen).
- `src/lib/db.ts` — cliente drizzle.
- `scripts/verify-db.ts` + script `db:verify` — patron a copiar: `tsx --env-file=.env`, imports por ruta directa,
  `main().catch(... process.exit(1))`.
- No aplica UI, hooks ni shadcn.

## Mapeo (`EventEntity` -> tablas)

| `events` | Origen | Nota |
|----------|--------|------|
| `slug`, `title`, `description`, `category`, `city`, `imageUrl`, `isFeatured`, `isTrending`, `isBestSeller` | mismo campo | directo |
| `venueName` | `venue` | |
| `address` | `address` | |
| `startsAt` | `new Date(date)` | el ISO del mock trae offset `-05:00` |
| `latitude`, `longitude` | `CITY_COORDINATES[city]` | el mock no tiene coordenadas: centro de la ciudad (7 ciudades: Lima, Arequipa, Cusco, Trujillo, Chiclayo, Piura, Oxapampa). Ciudad sin entrada -> lanza (detecta mocks nuevos). Nadie lee estas columnas todavia |
| `status` | `"published"` | son eventos visibles en el catalogo |
| `organizerId` | `users.id` del organizador | parametro del script |
| — | `id` | se descarta: la tabla usa uuid propio; la identidad estable es `slug` (unique) |
| — | `priceFrom` | se descarta: derivable como el minimo de `ticket_tiers.price` |
| — | `availability` | se descarta: derivable de stock vs vendidos cuando existan ordenes reales |
| — | `doorsOpen`, `minAge` | se descartan: la tabla no tiene columnas (Preguntas abiertas 1) |

| `ticket_tiers` (una fila por zona de `getVenueLayout(event).zones`) | Origen |
|----------|--------|
| `name` | `zone.name` ("Campo VIP", "Platea", ...) |
| `price` | `zone.price.toFixed(2)` (numeric como string) |
| `totalStock` | zona numerada: `zone.seats.length` (capacidad de la plantilla); zona general: `SEED_GENERAL_ZONE_STOCK` (500) |
| `salesStartAt`, `salesEndAt` | `null` |

La ocupacion simulada (`availability` de la zona, asientos `occupied`) no se refleja: `totalStock` es capacidad.

## Contratos

### `src/modules/event/utils/event-seed.utils.ts` (nuevo, puro)
```ts
import type { events } from "../db/event.table";
import type { ticketTiers } from "../db/ticket-tier.table";
import type { EventEntity } from "../types/event.types";

export const SEED_GENERAL_ZONE_STOCK = 500;

export const CITY_COORDINATES: Record<string, { latitude: string; longitude: string }>; // 7 ciudades del mock

export interface EventSeed {
  event: typeof events.$inferInsert;
  tiers: Array<Omit<typeof ticketTiers.$inferInsert, "eventId">>; // eventId se completa tras insertar el evento
}

// Puro y determinista. Lanza Error si event.city no esta en CITY_COORDINATES.
export function buildEventSeed(event: EventEntity, organizerId: string): EventSeed;
```

### `scripts/seed-events.ts` (nuevo)
```
Uso (manual, NO se ejecuta en esta spec):
  SEED_ORGANIZER_EMAIL=organizador@example.com npm run db:seed

1. SEED_ORGANIZER_EMAIL requerido (normalizado a minusculas). Falta -> error y exit 1.
2. Busca users activos (deleted_at IS NULL) con ese email. 0 filas, >1 fila o role <> 'organizer' -> error claro
   y exit 1 (no inserta nada).
3. En una transaccion, por cada EVENTS_MOCK: buildEventSeed -> INSERT events ... ON CONFLICT (slug) DO NOTHING
   RETURNING id. Si inserto, INSERT de sus ticket_tiers con ese event_id. Si ya existia, se omite (no actualiza ni
   duplica tiers).
4. Log final: insertados N, omitidos M. Error -> rollback, console.error, exit 1.
```
Idempotente: correrlo dos veces no duplica nada. No reasigna eventos ya existentes a otro organizador.

### `package.json` (se agrega)
```json
{ "scripts": { "db:seed": "tsx --env-file=.env scripts/seed-events.ts" } }
```
Ningun otro script (`build`, `dev`, `db:migrate`, `test`, postinstall) lo llama.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Mapeo puro `buildEventSeed` + `CITY_COORDINATES` + test | src/modules/event/utils/event-seed.utils.ts, src/modules/event/utils/event-seed.utils.test.ts | - | P1 |
| T2 | Script de seed + script npm `db:seed` (no ejecutarlo) | scripts/seed-events.ts, package.json | T1 | S |

2 tareas, 4 archivos, sin migraciones. Sin conflicto con la spec 024 (no comparten archivos; 024 no toca
`package.json`).

## Criterios de aceptacion
- [ ] AC1: `buildEventSeed` mapea los 14 `EVENTS_MOCK` sin lanzar; slugs, titulos y flags coinciden con el mock;
  `status = "published"`; `organizerId` = el recibido; `startsAt` es el instante del ISO del mock.
- [ ] AC2: Los tiers de cada evento son las zonas de `getVenueLayout(event)` (mismo nombre, mismo orden, precio con 2
  decimales igual a `zone.price`); stock > 0; zonas generales con `SEED_GENERAL_ZONE_STOCK`; el tier mas barato
  coincide con `priceFrom` del mock.
- [ ] AC3: Una ciudad fuera de `CITY_COORDINATES` lanza un error que nombra la ciudad.
- [ ] AC4: `npm run db:seed` existe y no es invocado por ningun otro script. **El seed no se ejecuta** durante el
  desarrollo ni la review.
- [ ] AC5 (lectura de codigo, sin ejecutar): el script aborta sin escribir si falta `SEED_ORGANIZER_EMAIL`, si el
  email no existe, si hay mas de un usuario activo con ese email o si su rol no es `organizer`; usa transaccion y
  `ON CONFLICT (slug) DO NOTHING`; solo inserta tiers de eventos recien insertados.
- [ ] AC6: La UI no cambia (el catalogo sigue leyendo `EVENTS_MOCK`).
- [ ] AC7: `npm run test`, `npx tsc --noEmit` y `npm run lint` sin errores.

## Tests requeridos
- `event-seed.utils.test.ts` (Vitest, sin DB): AC1, AC2 y AC3. Recorre `EVENTS_MOCK` completo; un caso puntual de
  estadio (Bad Bunny: 5 tiers) y uno de `general-admission` (1 tier con `SEED_GENERAL_ZONE_STOCK`).
- `scripts/seed-events.ts`: sin test unitario (glue de DB, igual que `verify-db.ts`); se valida por AC5.

## Preguntas abiertas
No bloqueantes (defaults tomados):
1. **`doorsOpen` y `minAge` se pierden** porque `events` no tiene esas columnas. Agregarlas es una migracion; se hara
   cuando el detalle del evento lea de la DB. Si se quieren ya, se suma una tarea de migracion a esta spec.
2. **`ORGANIZER_EVENTS_MOCK` no se siembra.** Si se quieren sus eventos (incluido el borrador "feria familiar"),
   decirlo y se agrega como segunda pasada con `status` del mock.
3. **Organizador por email** (`SEED_ORGANIZER_EMAIL`) en vez de `clerk_id`: mas facil de escribir a mano. Requisito
   de rol estricto `organizer` (un admin/super_admin no sirve como destino) porque el pedido dice "usuario con el rol
   organizador".
4. **Stock de zonas generales = 500** (valor arbitrario): el mock no define capacidad para zonas sin asientos.
5. **Coordenadas = centro de la ciudad**, no del venue (placeholder documentado; ninguna pantalla las usa).

## Estado
- Aprobacion humana: aprobada
- Fase: implementada (estado actualizado en P1-09, 2026-10-10)
- Log de review: Sin review formal registrado; codigo y tests presentes (comprobado en P1-09, 2026-10-10). Suite completa (552 tests), tsc, eslint y build en verde.
