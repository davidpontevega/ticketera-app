# 043 — Gestion de recintos (venues), zonas y asientos; asignar recinto a un evento (Fase 1)

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-14, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Hoy las zonas y asientos de un evento salen de plantillas por categoria (`ticket/mocks/venue.mock.ts`, usadas por los
eventos del seed) o de una franja general por tipo de entrada (`buildGeneralLayout`, eventos creados con el form de 036).
Nadie puede definir un recinto propio. Esta spec agrega **recintos** (`venues`) con **zonas** (`venue_zones`: numeradas por
filas x asientos por fila, o generales con capacidad) y **asientos** (`venue_seats`), un CRUD para organizador/admin, y la
posibilidad de **asignar un recinto a un evento** en el formulario de 036: cada tipo de entrada (`ticket_tiers`) se asocia a
una zona del recinto y el mapa de compra se dibuja desde esa zona.

Hecho cuando: un organizador crea un recinto con una zona numerada (ej. 10 x 20) y otra general (capacidad 300), crea un
evento eligiendo ese recinto, vincula un tipo de entrada a cada zona, lo publica y compra desde `/events/[slug]` eligiendo
asientos en el mapa, sin que el checkout permita sobreventa.

Referencias: `033` (inventario = `orders.lines` por `zoneId`, advisory lock por slug), `035` (D5 layout desde tiers, plantilla
vs admision general), `036` (form de evento, bloqueo de tiers con ventas, `hasOrders`), `040`/`ticket.table.ts`
(`zone_name`/`seat_label` son copias de texto). Consulta de apoyo solo lectura al repo del profesor
(`profesor/main:src/db/schema/venue.ts`, `src/modules/venue/*`, `docs/specs/venue-management.md`): su esquema es otro
(`venue` singular, `seatingType` enum compartido, `mapShape` jsonb, `event_zone`/`event_seat`, `neon-http` sin transacciones),
**no se copia**; de ahi solo se toma la idea de generar asientos por filas y de bloquear la edicion estructural con uso.
Next 16: `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `.../03-file-conventions/page.md` (`params` es Promise,
`PageProps<'/organizer/venues/[id]'>`).

## Hallazgos (verificado en codigo)
- La unidad de inventario **no es una tabla de zonas del evento**: `orders.lines[].zoneId` es el id de zona de plantilla
  (seed) o `ticket_tiers.id` (eventos del panel, 035 D5); `seatLabels` son textos `"C12"`; el stock sale de
  `getTakenInventory(executor, slug)` (paid o pending dentro de `RESERVATION_WINDOW_SECONDS`) y `findAvailabilityConflict`
  compara contra `getZoneCapacity(zone)` = `zone.capacity ?? ...` (`checkout.service.ts`, serializado con
  `pg_advisory_xact_lock(hashtext(slug))`). `tickets.zone_name`/`seat_label` son texto (snapshot): no apuntan a ninguna tabla.
- `buildVenueLayoutFromTiers(event, tiers)` (`ticket/utils/tier-layout.utils.ts`) decide plantilla vs admision general y es
  llamado solo por `event.service.ts#toPublished`; `layout.zones[].id` es lo que viaja a `orders.lines.zoneId`.
- Ids de asiento = `<zoneId>-<fila>-<numero>` (`buildSeats`), etiqueta = `fila + numero`; filas A-Z (`ROW_LETTERS`); `layoutSeats`
  usa `SEAT_MIN_PITCH = 14` unidades de viewBox, por eso una zona rectangular de 600 de ancho admite ~40 asientos por fila.
- `events` tiene `venue_name`, `address`, `latitude`, `longitude`, `city` NOT NULL (036 D7: `address = venue`, coordenadas por
  `CITY_COORDINATES` o `"0"`). El form (`EventFormValues`) tiene `venue` y `city` como texto libre.
- `src/lib/db.ts` usa `drizzle-orm/postgres-js`: **hay `db.transaction`** (a diferencia de `neon-http` del repo del profesor).
- Drizzle omite el prefijo de tabla en selects de **una sola tabla**: en subconsultas/`EXISTS` calificar a mano
  (`"events"."id"`, `"venue_zones"."id"`), como en `organizer-event-admin.service.ts` (`tierCount`).
- `ORGANIZER_NAV` (`organizer.constants.ts`) alimenta tambien el menu del admin (`admin.constants.ts`).
- `requireRole(ORGANIZER_AREA_ROLES)`, `getEventScope(viewer)` y `EventAdminViewer = Pick<UserEntity, "id" | "role">` ya existen.

## Decisiones
1. **Fases**. Esta spec es la **Fase 1** (T0-T4). Queda fuera y se lista en "Proximas fases": editor visual del mapa, formas
   libres, migracion total del seed a recintos, plantillas de recinto, asientos individuales (bloqueo/pasillos).
2. **Compatibilidad = aditivo y nullable**. `events.venue_id` y `ticket_tiers.venue_zone_id` son **nullable**; todo evento
   existente (seed, 036) queda con `NULL` y sigue por el camino actual sin tocar una fila. Las tablas de ordenes/tickets
   **no cambian**.
3. **Inventario sin cambios de contrato**: en un evento con recinto, `layout.zones[].id = ticket_tiers.id` (igual que la
   admision general de 035 D5). Asi `orders.lines.zoneId`, `getTakenInventory`, el advisory lock, `findAvailabilityConflict`
   y `getZoneCapacity` **no se modifican**. El tier es el "producto vendible"; la zona del recinto aporta su geometria.
   - Zona **general**: `capacity` de la zona = tope; el tier guarda `total_stock <= venue_zones.capacity`.
   - Zona **numerada**: `total_stock` = numero de `venue_seats` de la zona, **calculado por el servidor** (el cliente no lo
     decide); el layout expone `capacity = total_stock` y los asientos vienen de `venue_seats`.
   - Una zona se usa **una sola vez por evento**: `UNIQUE (event_id, venue_zone_id)` en `ticket_tiers` (los NULL no chocan).
   - Evento con recinto: **todos** los tiers deben llevar zona del mismo recinto (todo o nada; lo valida el servidor).
4. **Layout desde el recinto** (`buildVenueLayoutFromVenueZones`, puro, en `ticket`): admision "apilada" como
   `buildGeneralLayout` (viewBox 1000 de ancho, zonas rectangulares en columna, escenario/ingreso arriba). Zona general:
   franja de 90 de alto. Zona numerada: rectangulo de 600 de ancho y alto `max(90, filas * 28 + 40)`; asientos con
   `layoutSeats(shape, filas, maxAsientosPorFila)` filtrados a los que existen en `venue_seats`, id
   `<tier.id>-<fila>-<numero>`. Colores/tonos por precio igual que `buildGeneralLayout`. Sin coordenadas por asiento en DB
   (editor visual = fase futura).
5. **Limites del generador** (se derivan de la geometria): filas 1-26 (`A`-`Z`, coincide con `ROW_LETTERS` y las etiquetas
   `"C12"`), asientos por fila 1-40 (`SEAT_MIN_PITCH` en 600 de ancho), zona general `capacity` 1-100 000, <= 20 zonas por
   recinto. El layout y la etiqueta usan **solo** `fila + numero`: `venue_seats.row_label` es una letra A-Z y
   `seat_number` entero >= 1 (`UNIQUE (venue_zone_id, row_label, seat_number)`).
6. **Zona "en uso"** = algun `ticket_tiers.venue_zone_id` la referencia (de cualquier evento y estado). Una zona en uso queda
   **estructuralmente bloqueada**: no se borra, no cambia de tipo, capacidad, filas ni asientos; solo se edita el nombre
   (no viaja a ordenes: el nombre del tier manda). Es mas estricta que "hay ventas" a proposito (KISS): cubre ventas
   pagadas, reservas `pending`, y eventos publicados sin ventas cuyo `total_stock` se calcula de la zona. Es el analogo de
   036 (tiers bloqueados con ordenes), pero se aplica antes. La UI muestra el motivo ("La usa N evento(s): solo se puede
   cambiar el nombre").
7. **Recinto "en uso"** = algun `events.venue_id` lo referencia (cualquier estado): no se elimina (FK `RESTRICT` ademas del
   chequeo). Sus datos basicos (nombre, direccion, ciudad, coordenadas) siguen editables, pero **no se propagan** a
   `events.venue_name/address/city/latitude/longitude` ya copiados (snapshot al guardar el evento; Riesgos). Zonas que no
   estan en uso siguen libres aunque el recinto lo este.
8. **Copia al evento**: al guardar un evento con `venue_id`, el servidor rellena `venue_name = venue.name`,
   `address = venue.address`, `city = venue.city`, `latitude/longitude` = coordenadas del recinto o, si faltan,
   `CITY_COORDINATES[city]` o `"0"` (misma regla de 036 D7). El form oculta `venue`/`city` de texto cuando hay recinto.
9. **Autorizacion** (la decide el servidor, nunca la UI):
   | Actor | Listar / ver | Crear | Editar / eliminar | Usar en un evento |
   |-------|--------------|-------|-------------------|-------------------|
   | `customer` | no (`requireRole(ORGANIZER_AREA_ROLES)`) | no | no | no |
   | `organizer` | solo `created_by = su id` | si (`created_by` = sesion) | solo los suyos | solo los suyos |
   | `admin` / `super_admin` | todos | si | todos | todos |
   `created_by` sale **siempre** de la sesion, nunca del input. Recinto ajeno o inexistente => `not-found` (no distingue, como
   040 D3). Funcion unica `getVenueScope(viewer)` (analoga a `getEventScope`): `organizer` => `eq(venues.createdBy, viewer.id)`,
   resto => `undefined`.
10. **Concurrencia (driver postgres-js, hay transacciones)**: toda mutacion estructural corre en `db.transaction`.
    - Editar/borrar/regenerar una zona: `select ... from venue_zones where id = ? for update`, luego verifica "en uso" **dentro
      de la transaccion** y recien escribe. `venue_seats` se reemplaza con `delete` + `insert` en chunks de 500 en la misma
      transaccion.
    - Vincular tiers a zonas (guardado del evento, T4): en la transaccion de `createEvent`/`updateEvent` se leen las zonas con
      `for share` antes de insertar los tiers, de modo que una edicion estructural concurrente espere o falle; `total_stock`
      se calcula **despues** del `for share`.
    - Borrado de recinto: `delete ... where id = ? and not exists (select 1 from "events" where "events"."venue_id" = "venues"."id")`;
      0 filas => "Lo usa un evento". El FK `RESTRICT` es la red de seguridad (`pgErrorCode === "23503"` => mismo mensaje).
11. **Server actions** (patron de `organizer-event.actions.ts`): reciben objeto serializable, hacen
    `requireRole(ORGANIZER_AREA_ROLES)` **primero**, `safeParse` zod, actor desde la sesion, llaman al servicio y devuelven
    `{ status: "success", ... } | { status: "error", message, fieldErrors? }` con mensajes genericos (detalle a
    `console.error`). Exito => `revalidatePath("/organizer/venues")`; si el cambio puede alterar un evento publicado
    (nombre de zona no, estructura no: estan bloqueadas) no hace falta revalidar el catalogo.
12. **Modulo nuevo `src/modules/venue`** (singular, kebab-case, SETUP §1.2). Las tablas viven en `venue/db/*.table.ts` y se
    exportan desde `src/db/schema.ts` (patron actual). `event` y `organizer` importan el servicio/tipos de `venue` por ruta
    directa donde haya `db` (el barrel solo exporta tipos, schemas y componentes; mismo criterio que `order` -> `event`).
13. **Sin cache de React Query ni store**: lecturas en servidor (RSC) y `router.refresh()` tras cada accion (patron de 036/040).
14. **Seed y plantillas intactos**: no se tocan `seed.ts`, `venue.mock.ts` ni la ruta de plantilla de
    `buildVenueLayoutFromTiers`; la nueva funcion se usa solo cuando el evento tiene recinto.

## Alcance
- Incluye (Fase 1):
  - Tablas `venues`, `venue_zones`, `venue_seats`, enum `venue_zone_kind`; columnas nullable `events.venue_id` y
    `ticket_tiers.venue_zone_id` + `UNIQUE (event_id, venue_zone_id)`; migracion generada.
  - CRUD de recinto (datos basicos) y de zonas: numeradas por **filas x asientos por fila** (genera `venue_seats`) y generales
    con **capacidad**; reordenar no (orden = creacion, columna `sort_order`).
  - Pantallas `/organizer/venues` (lista), `/organizer/venues/new`, `/organizer/venues/[id]` (datos + zonas) con previsualizacion
    SVG simple (reutiliza el layout builder), item "Recintos" en `ORGANIZER_NAV`.
  - Asignar recinto a un evento en `/organizer/events/new` y `/edit`: selector de recinto + selector de zona por tipo de
    entrada; stock de zona numerada calculado por el servidor; eventos con ventas siguen bloqueados (036).
  - Layout publico/compra desde el recinto (`buildVenueLayoutFromVenueZones`) conservando anti-sobreventa (033).
  - Tests, README minimo en `docs/SYSTEM_DESIGN.md` (una fila de la spec).
- No incluye (se difiere, ver "Proximas fases"):
  - Editor visual del mapa (arrastrar zonas, formas, escenario, pasillos), coordenadas por asiento, colores por zona.
  - Migrar el seed / eventos existentes a recintos; recintos compartidos de plataforma; duplicar/archivar recintos.
  - Varios tiers por zona; bloqueo de asientos individuales; sectores; imagenes de plano; geocodificacion/`google_place_id`.
  - Propagar cambios del recinto a eventos ya creados; cambiar de recinto en un evento con ventas.
  - Cambios en `orders`, `tickets`, checkout, webhook, `getTakenInventory` o `findAvailabilityConflict`.

## Reutilizar
- `requireRole`, `ORGANIZER_AREA_ROLES`, `getEventScope`/`EventAdminViewer` (`organizer-event-admin.service.ts`), `pgErrorCode`
  (hoy privado en `organizer-event-write.service.ts`: el developer lo extrae a `src/lib/pg-error.ts` solo si T4 lo necesita en
  mas de un archivo, en cuyo caso pasa a ser archivo de T4), `CITY_COORDINATES` (`event-seed.utils.ts`).
- `layoutSeats`, `getShapePath`, `getShapeCenter` (`venue-geometry.ts`), `getAvailabilityByRatio`, `buildGeneralLayout`
  (extraer `TONES_BY_PRICE`/constantes comunes a no duplicar; ver T3), `ZONE_TONES`, `TierInput`.
- `event-write.utils.ts` (`toEventDbInput`, `hasTiersChanged`), `event-tier-fields.tsx`, `NativeSelect`, `TextField`, `Button`,
  `Card`; patron de pagina server + `notFound()` de `/organizer/events/[id]/edit`.
- UI shadcn: revisar `ls src/components/ui` antes de crear nada; solo se anaden con `npx shadcn@latest add` en T0 si falta
  alguno (`alert-dialog` para confirmar borrado si no existe). Si se crea un componente de tabla/confirmacion generico va a
  `src/components/shared`.

## Archivos
| Archivo | Cambio | Tarea |
|---------|--------|-------|
| `src/modules/venue/db/venue.table.ts` | nuevo: `venues`, `venueZones`, `venueSeats`, `venueZoneKindEnum` | T0 |
| `src/modules/event/db/event.table.ts` | `venueId` uuid nullable, FK `venues.id` `RESTRICT`, indice | T0 |
| `src/modules/event/db/ticket-tier.table.ts` | `venueZoneId` uuid nullable, FK `venue_zones.id` `RESTRICT`, `UNIQUE(eventId, venueZoneId)` | T0 |
| `src/db/schema.ts` | `export * from venue.table` | T0 |
| `drizzle/000N_*.sql`, `drizzle/meta/*` | generados (`npx drizzle-kit generate`) | T0 |
| `src/modules/venue/types/venue.types.ts` | `VenueDto`, `VenueZoneDto`, `VenueForEdit`, `VenueOption`, `VenueActionState` | T1 |
| `src/modules/venue/schemas/venue.schema.ts` (+ `.test.ts`) | zod: venue, zone, grid | T1 |
| `src/modules/venue/utils/venue.utils.ts` (+ `.test.ts`) | `generateSeatGrid`, `rowLabelAt`, `summarizeZone`, `canEditVenue` | T1 |
| `src/modules/venue/services/venue.service.ts` (+ `.test.ts`) | lecturas (`server-only`): `listVenues`, `getVenueForEdit`, `listVenueOptions`, `getVenueScope` | T1 |
| `src/modules/venue/services/venue-write.service.ts` (+ `.test.ts`) | `createVenue`, `updateVenue`, `deleteVenue`, `createZone`, `updateZone`, `deleteZone` | T1 |
| `src/modules/venue/actions/venue.actions.ts` (+ `.test.ts`) | server actions | T1 |
| `src/modules/venue/components/venue-form.tsx`, `venue-list.tsx`, `venue-zone-editor.tsx`, `venue-zone-form.tsx`, `venue-preview.tsx` (+ tests de los que tengan logica) | UI | T2 |
| `src/modules/venue/index.ts` | barrel (tipos, schemas, componentes) | T2 |
| `src/app/(organizer)/organizer/venues/page.tsx`, `new/page.tsx`, `[id]/page.tsx` | routing (sin logica) | T2 |
| `src/modules/ticket/utils/tier-layout.utils.ts` (+ `.test.ts`) | `buildVenueLayoutFromVenueZones`; reutiliza constantes de `buildGeneralLayout` | T3 |
| `src/modules/ticket/types/ticket.types.ts` | tipo de entrada `VenueZoneInput` (si hace falta) | T3 |
| `src/modules/event/utils/event-db.utils.ts` (+ test) | `TierRow` ya trae `venueZoneId`; `EventRow` trae `venueId` | T3 |
| `src/modules/event/services/event.service.ts` | carga zonas+asientos de los eventos con recinto y elige el builder | T3 |
| `src/modules/organizer/types/organizer.types.ts` | `EventFormValues.venueId`, `EventFormTier.zoneId` | T4 |
| `src/modules/organizer/schemas/event-form.schema.ts` (+ test) | reglas de recinto/zona | T4 |
| `src/modules/organizer/utils/event-write.utils.ts` (+ test) | `toEventDbInput` con recinto, `hasTiersChanged` con zona/recinto, `toEventForm` | T4 |
| `src/modules/organizer/services/organizer-event-write.service.ts` (+ test) | valida alcance del recinto, `for share`, calcula `total_stock`, copia datos | T4 |
| `src/modules/organizer/components/event-form.tsx`, `event-tier-fields.tsx` (+ tests) | selector de recinto y zona | T4 |
| `src/modules/organizer/constants/organizer.constants.ts` | item "Recintos" en `ORGANIZER_NAV`, `ORGANIZER_VENUES_PATH` | T4 |
| `src/app/(organizer)/organizer/events/new/page.tsx`, `[id]/edit/page.tsx` | pasan las opciones de recinto | T4 |
| `docs/SYSTEM_DESIGN.md` | fila de la spec | T4 |

Nota: `organizer.constants.ts` y `organizer/index.ts` estan modificados sin commit por la spec 040 y las specs 041/042 corren
en paralelo: el developer parte de la rama actualizada y resuelve el solape, sin sobrescribir cambios ajenos.

## Contratos
```ts
// venue/db/venue.table.ts
export const venueZoneKindEnum = pgEnum("venue_zone_kind", ["general", "numbered"]);
venues      = { id, name, address, city, latitude numeric(10,7) null, longitude numeric(10,7) null,
                createdBy uuid null -> users.id on delete set null, createdAt, updatedAt };  // index created_by
venueZones  = { id, venueId -> venues.id on delete cascade, name, kind, capacity int null /* solo general */,
                sortOrder int default 0, createdAt, updatedAt };                              // index venue_id
venueSeats  = { id, venueZoneId -> venue_zones.id on delete cascade, rowLabel text /* A-Z */,
                seatNumber int };                                                              // UNIQUE(venue_zone_id,row_label,seat_number)
// event.table.ts:   venueId uuid null -> venues.id on delete restrict
// ticket-tier.table: venueZoneId uuid null -> venue_zones.id on delete restrict; UNIQUE(event_id, venue_zone_id)

// venue/types/venue.types.ts
export type VenueZoneKind = "general" | "numbered";
export interface VenueZoneInput { name: string; kind: VenueZoneKind; capacity?: string; rows?: string; seatsPerRow?: string } // strings del form
export interface VenueZoneDto { id: string; name: string; kind: VenueZoneKind; capacity: number; // numeradas: nº de asientos
                                rows: number; seatsPerRow: number; inUse: boolean; usedByEvents: number }
export interface VenueDto { id: string; name: string; address: string; city: string; latitude: string | null;
                            longitude: string | null; zoneCount: number; capacity: number; eventCount: number; isOwn: boolean }
export interface VenueForEdit extends VenueDto { zones: VenueZoneDto[] }
export interface VenueOption { id: string; name: string; city: string;
                               zones: { id: string; name: string; kind: VenueZoneKind; capacity: number }[] } // para el form de evento
export type VenueError = "not-found" | "zone-locked" | "in-use" | "limit" | "unknown";
export type VenueActionState =
  | { status: "success"; id?: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>> };

// venue/utils/venue.utils.ts (puro)
export function rowLabelAt(index: number): string;                    // 0 -> "A" ... 25 -> "Z"; fuera de rango lanza
export function generateSeatGrid(rows: number, seatsPerRow: number): { rowLabel: string; seatNumber: number }[];
export function summarizeZone(z: { kind; capacity: number | null; seatCount: number }): number; // capacidad efectiva
export function getZoneDimensions(seats: readonly { rowLabel: string; seatNumber: number }[]): { rows: number; seatsPerRow: number };

// venue/services/venue.service.ts (server-only)
export function getVenueScope(viewer: EventAdminViewer): SQL | undefined;
export function listVenues(viewer): Promise<VenueDto[]>;
export function getVenueForEdit(id: string, viewer): Promise<VenueForEdit | null>;   // null: no existe/ajeno/id no uuid
export function listVenueOptions(viewer): Promise<VenueOption[]>;

// venue/services/venue-write.service.ts (server-only)
type R<T = void> = Promise<{ ok: true; data: T } | { ok: false; error: VenueError }>;
createVenue(input, viewer): R<{ id: string }>;  updateVenue(id, input, viewer): R;  deleteVenue(id, viewer): R;
createZone(venueId, input, viewer): R<{ id: string }>;  updateZone(zoneId, input, viewer): R;  deleteZone(zoneId, viewer): R;

// ticket/utils/tier-layout.utils.ts (puro)
export interface VenueZoneLayoutInput { tier: TierInput; kind: VenueZoneKind; seats: readonly { rowLabel: string; seatNumber: number }[] }
export function buildVenueLayoutFromVenueZones(venueName: string, zones: readonly VenueZoneLayoutInput[]): VenueLayout;
// zone.id = tier.id; numbered => capacity = seats.length; general => capacity = tier.totalStock; seat.id = `${tier.id}-${row}-${number}`
```

## Criterios de aceptacion
- AC1: la migracion agrega `venues`, `venue_zones`, `venue_seats`, el enum `venue_zone_kind`, `events.venue_id` y
  `ticket_tiers.venue_zone_id` (ambos nullable, FK `RESTRICT`) y `UNIQUE (event_id, venue_zone_id)`; no altera ni reescribe filas de
  `events`, `ticket_tiers`, `orders` ni `tickets`. Un evento existente con `venue_id NULL` se muestra y se compra igual que antes
  (plantilla del seed y admision general de 036), verificado con los tests existentes de `tier-layout`/`checkout` sin cambios.
- AC2: `generateSeatGrid(rows, seatsPerRow)` devuelve exactamente `rows * seatsPerRow` asientos, filas `A..` consecutivas,
  numeros `1..seatsPerRow`, sin duplicados; el schema rechaza filas fuera de 1-26, asientos por fila fuera de 1-40, capacidad
  general fuera de 1-100 000 y mas de 20 zonas por recinto. `getZoneDimensions(generateSeatGrid(r, c))` devuelve `{ r, c }`.
- AC3: `createVenueAction` guarda `created_by` = id de la sesion (ignora cualquier `createdBy` del input) y devuelve el id;
  nombre 2-120, direccion 2-200, ciudad 2-80 (trim); `latitude`/`longitude` opcionales, rango valido y **ambos o ninguno**.
- AC4: autorizacion: `organizer` lista/ve/edita/borra solo recintos con `created_by` propio; sobre un recinto ajeno o inexistente
  toda funcion de servicio y accion responde `not-found` sin distinguir; `admin`/`super_admin` operan sobre todos; un
  `customer` por POST directo es redirigido por `requireRole` antes de tocar la DB. Un evento de un organizador no puede usar un
  recinto ajeno (T4 responde `not-found` al validar `venueId`); admin si.
- AC5: crear una zona numerada inserta `rows * seatsPerRow` filas en `venue_seats` en la misma transaccion que la zona; una
  zona general guarda `capacity` y ningun asiento; editar `rows`/`seatsPerRow` de una zona libre reemplaza sus asientos
  (delete + insert) de forma atomica.
- AC6: **zona en uso** (algun `ticket_tiers.venue_zone_id`): `deleteZone`, cambio de `kind`, de `capacity`, de `rows` o de
  `seatsPerRow` responden `zone-locked` sin escribir; renombrarla funciona. El chequeo se hace dentro de la transaccion tras
  `for update` de la fila de la zona (nunca solo en la UI) y la UI no ofrece los controles bloqueados y muestra el motivo.
- AC7: `deleteVenue` elimina recinto, zonas y asientos si ningun `events.venue_id` lo referencia; con cualquier evento (draft,
  published o cancelled) responde `in-use` con el mensaje "Este recinto lo usa un evento"; la guarda va en el `WHERE`
  (`NOT EXISTS`) y un `23503` se traduce al mismo mensaje.
- AC8: `createEventAction`/`updateEventAction` con `venueId`: exigen que **todos** los tiers tengan `zoneId` del mismo recinto y
  sin repetir zona; rechazan zona de otro recinto, recinto ajeno (organizer) o tier sin zona; para zona numerada el servidor
  fija `total_stock` = nº de asientos (ignora la cantidad del cliente) y para zona general exige `1 <= quantity <= capacity`.
  Copia `venue_name`, `address`, `city`, coordenadas del recinto (fallback `CITY_COORDINATES`/`"0"`). Las zonas se leen con
  `for share` dentro de la transaccion.
- AC9: evento con ordenes `paid`/`pending`: no se puede cambiar `venueId` ni ningun `zoneId` (`hasTiersChanged` los incluye) ->
  `tiers-locked` como en 036; el form los deshabilita. Evento sin recinto no ve ningun cambio de comportamiento (el selector
  tiene la opcion "Sin recinto (admision general libre)", valor por defecto).
- AC10: `buildVenueLayoutFromVenueZones`: `zone.id` = `tier.id`; zona numerada => `seating "numbered"`, `capacity` = nº de
  asientos, `seats` con id `<tier.id>-<fila>-<numero>` y etiqueta `fila+numero`, posiciones dentro de su rectangulo y sin
  superposicion; zona general => `seating "general"`, `capacity = tier.totalStock`, `remaining = totalStock`; orden de zonas
  estable (por `sort_order` y luego `created_at`); `viewBox.height` crece con las zonas; funcion pura y determinista.
- AC11: `event.service` usa `buildVenueLayoutFromVenueZones` solo si el evento tiene `venue_id` y **todos** sus tiers tienen
  zona; en cualquier otro caso usa `buildVenueLayoutFromTiers` (comportamiento actual). Una consulta adicional por lote (no N+1)
  para zonas y asientos de los eventos listados.
- AC12: anti-sobreventa conservado (033): en un evento con recinto, `findAvailabilityConflict` rechaza un asiento ya tomado
  (`pending` vigente o `paid`) y una cantidad que excede la capacidad de una zona general, usando `tier.id` como `zoneId`;
  `checkout.service.ts` queda sin modificaciones (verifica `git diff`).
- AC13: las paginas bajo `src/app` solo hacen `requireRole`, leen del servicio y componen; `notFound()` para id no uuid,
  inexistente o ajeno. `/organizer/venues` lista nombre, ciudad, zonas, capacidad, nº de eventos y acciones segun permisos;
  "Recintos" aparece en `ORGANIZER_NAV` (organizador y admin) y queda activo en `/organizer/venues/**`.
- AC14: accesibilidad: campos con etiqueta y `aria-invalid`/`aria-describedby` al error o motivo de bloqueo, targets >= 44 px,
  confirmacion de borrado con foco atrapado y cierre con Esc, la previsualizacion SVG con `role="img"` + `aria-label` y nombre de
  zona visible (el color no es la unica senal).
- AC15: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` pasan. Verificacion manual (DB + Clerk):
  crear recinto con zona numerada 10x20 y general 300 como organizador; otro organizador recibe 404 en la URL; crear evento con
  ese recinto, un tier por zona, publicar, ver el mapa en `/events/[slug]`, comprar 2 asientos contiguos; intentar editar la
  zona numerada (bloqueada) y borrar el recinto (bloqueado); editar un evento con ventas (recinto/zona bloqueados).

## Tests requeridos
(Vitest, junto al archivo; services con `db` mockeado, patron de `organizer-event-write.service.test.ts`)
- `venue.utils.test.ts`: `rowLabelAt` (A, Z, fuera de rango lanza), `generateSeatGrid` (cantidad, etiquetas, numeracion, sin
  duplicados, 26x40 limite), `summarizeZone`, `getZoneDimensions` ida y vuelta (AC2, AC5).
- `venue.schema.test.ts`: venue (largos, trim, lat/lng ambos-o-ninguno y rango), zona numerada (filas/asientos limites, strings
  `"abc"`, `"1.5"`), zona general (capacidad 0, 100001, ausente), nombre vacio (AC2, AC3).
- `venue.service.test.ts`: `getVenueScope` por rol (organizer filtra por `created_by`, admin sin filtro), `getVenueForEdit`
  devuelve `null` para id no uuid, `listVenueOptions` incluye capacidad efectiva (AC4).
- `venue-write.service.test.ts`: crear con `createdBy` de sesion; zona numerada inserta asientos en la misma transaccion; zona
  en uso => `zone-locked` (delete, kind, capacity, rows, seatsPerRow) y rename permitido; `for update` antes del chequeo;
  `deleteVenue` `in-use` por 0 filas y por `23503`; recinto ajeno => `not-found` (AC3-AC7).
- `venue.actions.test.ts`: `requireRole` primero, validacion y mensajes genericos, `revalidatePath` en exito, sin escritura si
  falla la validacion (AC4, AC3).
- `tier-layout.utils.test.ts`: casos nuevos de `buildVenueLayoutFromVenueZones` (AC10); los existentes no cambian (AC1).
- `event.service.test.ts` (o `event-db.utils.test.ts` segun donde viva): eleccion de builder con y sin recinto/zonas parciales (AC11).
- `checkout.service.test.ts`: un caso con layout de recinto (zona numerada + general) para asiento tomado y exceso de capacidad
  (AC12); sin cambiar el codigo del servicio.
- `event-form.schema.test.ts`, `event-write.utils.test.ts`, `organizer-event-write.service.test.ts`, `event-form.test.tsx`:
  reglas de recinto/zona, `hasTiersChanged` con `venueId`/`zoneId`, copia de datos y `total_stock` calculado, rechazo de zona
  de otro recinto/recinto ajeno, `for share` previo, formulario con selector y campos deshabilitados (AC8, AC9).
- Componentes de `venue`: `venue-zone-form.test.tsx` (campos segun `kind`, bloqueo con motivo) y `venue-list.test.tsx` (acciones
  segun permisos y `eventCount > 0` sin boton de eliminar). Presentacionales puros sin test.

## Tareas
### T0 — Esquema, migracion y base compartida
- Archivos: `src/modules/venue/db/venue.table.ts`, `src/modules/event/db/event.table.ts`,
  `src/modules/event/db/ticket-tier.table.ts`, `src/db/schema.ts`, `drizzle/000N_*.sql`, `drizzle/meta/*`; `package.json` y
  `npx shadcn@latest add` solo si hiciera falta un componente.
- Depende de: —
- Paralelizable: no (bloquea a las demas)
- Cubre: AC1
- Nota: el developer ejecuta **solo** `npx drizzle-kit generate` (no `db:migrate`; lo aplica el usuario). El numero y el nombre
  reales de la migracion los fija el developer al generar: las specs 041/042 migran en paralelo (hoy el ultimo es `0006`); si
  hay choque de `_journal.json`/snapshot, regenerar sobre la rama integrada. Revisar el SQL (nullable, FK `RESTRICT`, `UNIQUE`).

### T1 — Dominio `venue`: tipos, schemas, utilidades, servicios y acciones
- Archivos: `src/modules/venue/types/venue.types.ts`, `schemas/venue.schema.ts` (+ test), `utils/venue.utils.ts` (+ test),
  `services/venue.service.ts` (+ test), `services/venue-write.service.ts` (+ test), `actions/venue.actions.ts` (+ test)
- Depende de: T0
- Paralelizable: no (T2 y T4 consumen sus contratos); ya puede arrancar T3 en paralelo
- Cubre: AC2, AC3, AC4, AC5, AC6, AC7
- Nota: es la tarea mas pesada; corte limpio si no cabe: T1a (tipos, schema, utils, servicio de lectura) y T1b (escritura +
  acciones), sin cambiar a los demas owners.

### T2 — UI de recintos y rutas
- Archivos: `src/modules/venue/components/venue-form.tsx`, `venue-list.tsx`, `venue-zone-editor.tsx`, `venue-zone-form.tsx`,
  `venue-preview.tsx` (+ tests con logica), `src/modules/venue/index.ts`, `src/app/(organizer)/organizer/venues/page.tsx`,
  `src/app/(organizer)/organizer/venues/new/page.tsx`, `src/app/(organizer)/organizer/venues/[id]/page.tsx`
- Depende de: T1 (acciones y tipos); `venue-preview` consume `buildVenueLayoutFromVenueZones` de T3 (por contrato; si T3 no esta,
  el preview usa solo la lista y el SVG se completa al integrar)
- Paralelizable: si, con T3 y T4 (archivos disjuntos)
- Cubre: AC13, AC14, AC6 (UI), AC7 (UI)

### T3 — Layout y lectura publica desde el recinto
- Archivos: `src/modules/ticket/utils/tier-layout.utils.ts` (+ test), `src/modules/ticket/types/ticket.types.ts`,
  `src/modules/event/utils/event-db.utils.ts` (+ test), `src/modules/event/services/event.service.ts` (+ test),
  `src/modules/order/services/checkout.service.test.ts` (solo el caso nuevo)
- Depende de: T0
- Paralelizable: si, con T1 y T2 (solo toca `ticket`/`event` lectura)
- Cubre: AC10, AC11, AC12, AC1 (compatibilidad)

### T4 — Asignar recinto en el formulario del evento + menu
- Archivos: `src/modules/organizer/types/organizer.types.ts`, `schemas/event-form.schema.ts` (+ test),
  `utils/event-write.utils.ts` (+ test), `services/organizer-event-write.service.ts` (+ test),
  `components/event-form.tsx` (+ test), `components/event-tier-fields.tsx`, `constants/organizer.constants.ts`,
  `src/app/(organizer)/organizer/events/new/page.tsx`, `src/app/(organizer)/organizer/events/[id]/edit/page.tsx`,
  `docs/SYSTEM_DESIGN.md`
- Depende de: T1 (`listVenueOptions`, tipos), T0
- Paralelizable: si, con T2 y T3
- Cubre: AC8, AC9, AC13 (menu), AC4 (evento con recinto ajeno)

Orden: T0 -> T1 -> {T2, T3, T4} (T3 puede empezar apenas termine T0). Cada archivo pertenece a una sola tarea. Verificar al cierre
que `git diff` no toca `checkout.service.ts`, `availability.service.ts`, `order.table.ts`, `ticket.table.ts`, `seed.ts` ni
`venue.mock.ts`.

## Riesgos
- **Ordenes/tickets ya emitidos**: guardan `zoneId` (id de plantilla o `tier.id`) y `seatLabels`/`zone_name`/`seat_label` como
  texto; no apuntan a `venues`. Mitigaciones: tablas de ordenes intactas; eventos existentes con `NULL`; zona en uso y evento con
  ventas **inmutables** (AC6, AC9); ids de asiento determinados por `tier.id + fila + numero`, que no cambian mientras el tier
  existe. Si un organizador de un evento **sin ventas** cambia de recinto, los tiers se reemplazan (ids nuevos, 036 D10) y no
  hay ordenes que los referencien.
- **Snapshot en `events`** (`venue_name`, `address`, `city`, coordenadas): renombrar el recinto no actualiza eventos ya guardados;
  se actualizan al volver a guardar el evento. Se acepta (evita reescribir datos de eventos con ventas); ver pregunta 4.
- **Carrera edicion de zona vs. vinculacion a evento**: resuelta con `for update` (zona) / `for share` (evento) en transacciones;
  el test de servicio verifica el orden de las llamadas, la verificacion real es manual.
- **Carrera compra vs. cambio de recinto**: el cambio de tiers ya exige `hasOrders = false` bajo el mismo advisory lock que el
  checkout (036 D10); sin cambios.
- **Colision con el layout de plantilla**: un evento con recinto nunca entra a la rama de plantilla (AC11), asi que no hay
  coincidencia accidental por nombre/stock (efecto conocido de 036 D8 solo para eventos sin recinto).
- **Rendimiento**: una zona 26x40 = 1040 asientos; un recinto con 20 zonas llega a ~20 000 filas en `venue_seats`; se cargan
  por lote solo para eventos con recinto en el catalogo (hasta 200 eventos). `ponytail:` techo; si el catalogo lo siente,
  cachear el layout por evento o paginar. Inserts en chunks de 500 (limite de parametros de Postgres).
- **Migracion**: aditiva y nullable (`ADD COLUMN` + tablas nuevas, sin backfill). Conflicto de numeracion/journal con 041/042
  (ver T0). Drizzle sin prefijo de tabla en subconsultas (`"events"."venue_id"`, `"venue_zones"."id"`): calificar a mano y
  revisar el SQL generado en los tests.
- **Dos organizadores editando el mismo recinto**: no aplica (cada organizador solo ve los suyos); admin + dueno: gana el ultimo
  guardado, con las guardas de zona en uso intactas.

## Preguntas abiertas
1. **Visibilidad de recintos**: default = el organizador solo ve y usa **los suyos**; admin/super_admin todos. Alternativa: recintos
   "de plataforma" compartidos (creados por admin, usables por todos, editables solo por admin), que requiere un flag o
   `created_by` nulo con semantica de plataforma. ¿Se acepta el default?
2. **Un tier por zona**: default = `UNIQUE (event_id, venue_zone_id)`. Alternativa: varios tiers (precios) en una zona
   numerada, que exige repartir asientos entre tiers (fuera de alcance). ¿Basta?
3. **Zona en uso = bloqueo estructural total** (solo nombre editable), aunque el evento no tenga ventas. Alternativa: permitir
   cambiar la estructura mientras el evento es borrador sin ordenes y recalcular `total_stock`. Default: bloqueo total (KISS).
4. **Propagar cambios del recinto** (nombre/direccion/ciudad) a eventos existentes: default = no (snapshot, se refresca al
   guardar el evento). Alternativa: actualizar los eventos sin ventas al editar el recinto.
5. **Limites**: 26 filas x 40 asientos por fila, 20 zonas por recinto, capacidad general <= 100 000. ¿Se ajustan?
6. **Cambio de recinto/zonas en un evento publicado sin ventas**: default = permitido (se reemplazan los tiers, como 036 D10).
   Alternativa: bloquearlo una vez publicado.
7. **Coordenadas**: `latitude`/`longitude` opcionales en el recinto (sin geocodificacion ni picker). Default: se piden como texto
   opcional; sin ellas el evento usa `CITY_COORDINATES` o `"0"`. ¿O se omiten del formulario del recinto en esta fase?
8. **Eliminar recinto con eventos solo `cancelled`**: default = tambien bloqueado (FK `RESTRICT`). Alternativa: permitirlo
   poniendo `venue_id` en NULL.
9. **Preview del mapa en el editor de recinto** reutiliza el layout publico (requiere T3); si T3 se retrasa, el editor sale
   con lista de zonas sin dibujo. ¿Aceptable como corte?

## Proximas fases
- **Fase 2 — Editor visual del mapa**: posicion/forma/rotacion de zonas, escenario, pasillos y colores por zona
  (`venue_zones.map_shape` jsonb o columnas), coordenadas por asiento (`venue_seats.x/y`), asientos bloqueados.
- **Fase 3 — Migracion total del seed**: generar recintos y zonas desde `venue.mock.ts`, `events.venue_id` y
  `ticket_tiers.venue_zone_id` para los 14 eventos sembrados (con mapeo de `zoneId` de plantilla -> `tier.id` y reglas para
  ordenes existentes), retirar la rama de plantilla de `buildVenueLayoutFromTiers`.
- Recintos de plataforma/compartidos, duplicar/archivar, varios tiers por zona, `google_place_id`/geocodificacion y mapa real.
- Propagacion de cambios del recinto a eventos y aviso a compradores.
- Rellenar `orders.event_id`/`order_items` para que Postgres proteja la integridad zona-ventas (hoy se deriva de `orders.lines`).

## Log de review
(vacio: la spec esta en borrador, sin implementacion)

## Log de review
- Iteracion 1: FAIL (H1 falta test de checkout con layout de recinto AC12; H2 carrera entre for share y conteo de asientos; H3 pgErrorCode duplicado). Corregidos.
- Iteracion 2: PASS (eslint, tsc, vitest 80 archivos / 858 tests, build OK). Pendiente manual: aplicar migraciones 0006-0009 y probar en pantalla (AC15). Nota menor aceptada: el mensaje "No se encontro el evento o no tienes permiso" tambien se muestra cuando falta recinto o zona.
