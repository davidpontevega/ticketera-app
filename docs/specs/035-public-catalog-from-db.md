# 035 — Catalogo publico, detalle y compra de eventos desde la DB (retirar EVENTS_MOCK del runtime)

Estado: implementada (pendiente verificacion manual con DB + seed)

## Estado
- Aprobacion humana: aprobada (2026-10-08, 6 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P1-06.

## Objetivo
Que home (tendencias, mas vendidos, proximos), `/events` (busqueda), `/events/[slug]` y las paginas de compra
(`tickets`, `checkout`, `confirmation`) lean los eventos **publicados de la DB** (`events` + `ticket_tiers`) en vez de
`EVENTS_MOCK` + eventos `localStorage` del `organizer.store`. Tambien el servidor de compra (`checkout.service`,
`availability.service`) y `/my-tickets` dejan de depender del mock, para no dejar el sistema incoherente (ver
"Fases"). `EVENTS_MOCK` queda solo como **fuente del seed** (025) y datos de tests/organizer-mock.
Referencias: `025` (seed), `029/030` (eventos y estados en DB, `status`), `031` (patron de lectura publica:
`featured-event.service.ts`), `033` (punto de cambio `getZoneCapacity`), `034` (`toUserOrders`), `SYSTEM_DESIGN.md`
(Base de datos).

## Hallazgos (verificado en codigo)
- Solo `listFeaturedEvents()` lee DB (`events.is_featured` + `status = 'published'`, orden `starts_at`, limite 8).
  `src/app/(main)/page.tsx` usa `EVENTS_MOCK` para `getTrendingEvents`/`getBestSellerEvents`.
- `/events` y "Proximos" usan `useCatalogEvents()` (cliente): `[...EVENTS_MOCK, ...getPublishedCatalogEvents(localStorage)]`.
  `/events` es `<Suspense><CatalogEventSearch/></Suspense>` y `EventSearch` es cliente con filtros en la URL
  (`useSearchParams`); filtra/ordena en memoria con `searchEvents` (`event-search.utils.ts`).
- Las 4 pages por evento (`events/[slug]`, `tickets`, `checkout`, `confirmation`) usan `generateStaticParams` sobre el
  mock y, si el slug no esta, caen a `LocalEvent*` (cliente, `localStorage`). Eso incluye `confirmation`.
- Consumidores de `EVENTS_MOCK`/`getEventBySlug` (grep, sin tests): las 5 pages anteriores + `my-tickets/page.tsx`
  (`toUserOrders(records, EVENTS_MOCK)`), `home`, `availability.service.ts:53` (`getEventAvailability` -> `null` si no
  esta en el mock), `checkout.service.ts:78` (404 si no esta), `order.utils.ts:199` (`toUserOrders`, recibe la lista
  por parametro: no cambia), `scripts/seed-events.ts` (se queda), `organizer/mocks/organizer.mock.ts` (se queda),
  `catalog/hooks/use-catalog-events.ts`, `catalog/components/local-event-pages.tsx`, `catalog.utils.ts`.
- Consumidores de `useOrganizerStore`: `event-form.tsx` (formulario de crear evento, **P1-07**, se queda) y
  catalog (`use-catalog-events`, `local-event-pages`, que esta spec retira). Eventos creados hoy desde el form viven
  solo en `localStorage`: **no son comprables** (`createCheckoutSession` -> 404) y **no tienen fila en DB**.
- Hay un hueco real hoy: el organizador puede cancelar/despublicar (030) y el evento sigue vendiendose porque
  `/checkout` y `createCheckoutSession` miran el mock, no `events.status`. Esta spec lo cierra.
- `events` no tiene columnas `doors_open_at` ni `min_age` (025 las descarto); `EventEntity.doorsOpen/minAge` solo las
  usa `event-detail-info.tsx`. `priceFrom` y `availability` tampoco existen: son derivables (min de `ticket_tiers.price`;
  stock vs vendido).
- `getVenueLayout(event)` arma zonas desde plantillas por categoria (`venue.mock.ts`); los ids de zona (`vip`,
  `platea`, `entrada-general`, ...) son los que quedan en `orders.lines[].zoneId`. El seed crea un `ticket_tier` por
  zona de la plantilla con `name = zone.name`, `price = zone.price`, `total_stock = seats.length` (numerada) o 500.
  `ticket_tiers.id` es uuid, **no** coincide con el id de zona de la plantilla.
- `getZoneCapacity(zone)` (`ticket.utils.ts:113`) es el unico punto de cambio de capacidad (033). `applyAvailability`
  tambien lo usa (cliente, via `useEventAvailability`).
- `buildZone` simula ocupacion (`SEAT_OCCUPANCY_BY_AVAILABILITY`) segun `event.availability` del mock: con datos reales
  esa ocupacion falsa debe desaparecer.
- `next.config.ts` sin `cacheComponents`: modelo previo de cache (`caching-without-cache-components.md`). El Hero ya es
  dinamico y las pages por request no cachean consultas Drizzle (no es `fetch`).
- `organizer-event.actions` solo hace `revalidatePath("/organizer")`; no invalida el catalogo.

## Decisiones
1. **Estados publicos**: solo `events.status = 'published'` aparece en listados, busqueda, detalle y compra. `draft` y
   `cancelled` => `notFound()` en las 4 pages por evento (tambien para el dueno: no hay preview, YAGNI) y `404` en
   `createCheckoutSession`/`getEventAvailability`. Excepcion: `/my-tickets` resuelve **cualquier estado** (un comprador
   conserva sus entradas de un evento cancelado/despublicado; `toUserOrders` no se toca).
2. **Fases (alcance de una sesion)**. Se hace en una sola spec porque la lectura publica sola dejaria incoherente el
   sistema (un evento visible pero no comprable, o un evento cancelado todavia vendible por URL directa), y lo que
   hay que cambiar para evitarlo es pequeno una vez existe un loader unico. Queda fuera:
   - **P1-07**: guardar el formulario de crear evento en DB (`event-form.tsx`, `organizer.store`). Consecuencia
     **explicita y aceptada**: desde esta spec los eventos creados con el form viejo (localStorage) **dejan de aparecer
     en el catalogo** (antes aparecian solo en ese navegador y no se podian comprar). Hasta P1-07 los eventos
     publicados del catalogo son los del seed (o los insertados por SQL/panel de estado 030).
   - `order_items`, `orders.event_id`, `tickets.order_item_id` (siguen con `event_slug`), ranking de ventas reales.
   Si la sesion no alcanza, el corte limpio es T3 (compra) + parte de T5 (pages de compra) juntos: **no** entregar la
   lectura publica (T4/T5 home/detalle) sin ellos.
3. **Loader unico** (`event.service.ts`, modulo `event`, `server-only`): lee `events` + `ticket_tiers` y devuelve
   `{ event: EventEntity, layout: VenueLayout }`. `catalog.service.ts` (modulo `catalog`) lo envuelve para sumar
   disponibilidad real desde `orders` (importa `order`; `order` solo importa `event`, sin ciclo).
4. **Mapeo fila DB -> `EventEntity`** (puro, `toEventEntity`): `id` = `events.id` (uuid); `date` = `startsAt.toISOString()`;
   `venue` = `venueName`; `priceFrom` = min(`price`) de los tiers (`0` si no tiene, no deberia pasar en publicados:
   publicar exige >= 1 tier, 030); flags `isFeatured/isTrending/isBestSeller` directos; `doorsOpen` = `date` - 1 h y
   `minAge = null` (**perdida consciente**: el mock tenia valores por evento; recuperarlos requiere migracion con
   `doors_open_at`/`min_age`, pregunta abierta 1); `availability` = derivada (D6).
5. **Layout desde tiers** (`buildVenueLayoutFromTiers(event, tiers)`, en `ticket`, puro):
   - Si **todos** los tiers coinciden por `name` con zonas de la plantilla de la categoria (`VENUE_LAYOUT_BY_CATEGORY`)
     y, en zonas numeradas, `total_stock === seats.length`: usa la plantilla con el **id de zona original** (`vip`,
     `platea`, ...), `price = Number(tier.price)` y todos los asientos `available` (sin ocupacion simulada). Es el
     caso de los 14 eventos sembrados, y mantiene validas las ordenes ya guardadas (`zoneId` viejo).
   - Si no: layout de admision general con una franja por tier (zona `id = tier.id`, `seating: "general"`), migrando a
     `ticket` la logica de `getOrganizerVenueLayout` (catalog.utils.ts) en vez de duplicarla. Es lo que usara P1-07.
   - Cada zona lleva `capacity` = `ticket_tiers.total_stock` (campo nuevo opcional en `VenueZone`).
   `getZoneCapacity(zone)` pasa a `zone.capacity ?? <regla actual>` (cierra el punto de cambio de 033; las plantillas
   sin `capacity` siguen funcionando en tests).
6. **Disponibilidad**: `zone.remaining`/`availability` de zonas generales y `EventEntity.availability` se derivan con
   `applyAvailability` + `deriveEventAvailability(layout)` (nuevo, puro): `sold-out` si el restante total es 0,
   `few-left` si restante/capacidad <= 0.2 (mismo umbral que `FEW_LEFT_RATIO` de catalog.utils, que se migra), si no
   `available`. El inventario tomado sale de `orders` con **el mismo predicado** que `getTakenInventory` (paid o
   pending dentro de la ventana, 033): se generaliza esa funcion a varios slugs (`getTakenInventoryBySlugs`) y
   `getTakenInventory(slug)` la reutiliza (sin duplicar el `where`). Una sola consulta para el catalogo (no N+1).
7. **Tendencias / mas vendidos**: por las **banderas** `is_trending` / `is_best_seller` (seed las llena; igual que
   `is_featured` en 031). Sin ranking por ventas reales (YAGNI, pregunta abierta 2). Orden: `starts_at` asc. Sin
   banderas => las secciones no se muestran (los componentes ya devuelven `null` con lista vacia). No hay fallback
   automatico.
8. **Busqueda y filtros**: se mantiene **cliente** sobre la lista completa (`EventSearch` sin cambios, filtros en URL).
   La page `/events` es un server component `async` que carga los publicados **futuros** (`starts_at >= now()`, orden
   `starts_at`) y los pasa como prop dentro del `<Suspense>`. Techo: `CATALOG_EVENTS_LIMIT = 200` con comentario
   `ponytail:` (pasar a filtros en SQL + paginacion si el catalogo crece). "Proximos" de home usa la misma lista.
   `CatalogEventSearch`/`CatalogUpcomingEvents` se eliminan (eran solo el puente del hook).
9. **Pages RSC**: `events/[slug]` y `tickets/checkout/confirmation` son `async`, sin `generateStaticParams` (requeriria
   DB en build; ademas contradice el estado dinamico) y llaman al loader; `null` => `notFound()`. `generateMetadata`
   del detalle usa el mismo loader (se envuelve con `React.cache` para deduplicar la consulta de metadata y la page).
   Las vistas (`event-page-views.tsx`) no cambian.
10. **Cache**: sin cache (render por request, igual que el Hero y `/my-tickets`). Razon: el estado/stock cambia por
    accion del organizador y por cada compra, no hay `fetch` que cachear y un `unstable_cache` obligaria a
    invalidar desde 030/031 y desde el webhook de pago. Revisar si el volumen lo pide (Proximas fases).
11. **Sin datos / entornos nuevos**: el seed **no** corre solo (025 lo prohibe). Con la DB vacia: Hero/tendencias/mas
    vendidos/proximos no se muestran, `/events` muestra el estado vacio existente, los detalles dan 404. Se documenta
    en `README.md` el paso `SEED_ORGANIZER_EMAIL=... npm run db:seed` como requisito para ver catalogo. No se agrega
    seed automatico ni fallback al mock (ocultaria datos reales ausentes).
12. **`getEventAvailability(slug)`**: devuelve `null` si el slug no existe **o no esta publicado** (consulta de existencia
    en DB, sin cargar tiers); mismo contrato para la ruta `/api/events/[slug]/availability` (404).
13. **`createCheckoutSession`**: carga `{event, layout}` por el loader (404 "Evento no encontrado" si `null`). Los
    precios y capacidades salen de DB, no del mock. No se toca el advisory lock ni `getTakenInventory`.
14. **Compras pasadas**: `toUserOrders(records, events)` ya recibe la lista; `my-tickets/page.tsx` pasa
    `listEventsBySlugs(records.map(r => r.eventSlug))` (cualquier estado, una consulta) en vez de `EVENTS_MOCK`.
15. **Fecha pasada**: `/events` y "Proximos" muestran solo futuros; el detalle/compra de un evento publicado ya pasado
    sigue accesible (no se agrega bloqueo de compra por fecha; pregunta abierta 3).

## Alcance
- Incluye: loader `event.service.ts` + `toEventEntity`; `buildVenueLayoutFromTiers` + `capacity` +
  `deriveEventAvailability`; `getTakenInventoryBySlugs`; `catalog.service.ts`; home, `/events`, detalle, tickets,
  checkout y confirmation desde DB con `notFound()`; `createCheckoutSession`, `getEventAvailability` y
  `my-tickets/page.tsx` sobre DB; retirada de `use-catalog-events`, `local-event-pages`, `catalog-event-search`,
  `catalog-upcoming-events` y de lo que quede sin uso en `catalog.utils`; README; tests.
- No incluye (se difiere):
  - Guardar eventos del formulario en DB / quitar `organizer.store` (**P1-07**). `event-form.tsx` y
    `organizer.mock.ts` no se tocan.
  - `order_items`, `orders.event_id`, `tickets.order_item_id`; ranking real de ventas.
  - Columnas `doors_open_at`/`min_age`, coordenadas en mapa.
  - Filtros/paginacion en servidor, cache/`revalidate`, preview de borradores para el dueno.
  - Bloqueo de compra por fecha pasada o por ventana `sales_start_at/sales_end_at` (hoy ningun codigo la usa).
  - Borrar `EVENTS_MOCK` (lo usan el seed, `organizer.mock` y tests).

## Reutilizar
- `listFeaturedEvents` como patron (`server-only`, `db`, select + where `status = 'published'`).
- `getTakenInventory`/`aggregateTaken`/`RESERVATION_WINDOW_SECONDS` (`availability.service.ts`), `applyAvailability`,
  `getVenueLayout`/`VENUE_TEMPLATES`/`VENUE_LAYOUT_BY_CATEGORY`, `buildSeats`, `ZONE_TONES`, `getZoneCapacity`.
- Logica de `getOrganizerVenueLayout`, `getAvailability`, `FEW_LEFT_RATIO`, `TONES_BY_PRICE` de `catalog.utils.ts`
  (se **mueve** a `ticket`, no se copia).
- `EventSearch`, `UpcomingEvents`, `TrendingSidebar`, `BestSellerEvents`, `RelatedEvents`, `getRelatedEvents`,
  `getTrendingEvents/getBestSellerEvents` (filtran por bandera sobre la lista: se mantienen), vistas de
  `event-page-views.tsx`, `EmptyState`.
- `notFound()` de `next/navigation`; `PageProps<...>` (Next 16, `params`/`searchParams` Promise);
  `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` (decision D10).
- Patron de test con `db` mockeado: `featured-event.service.test.ts`, `availability.service.test.ts`.

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/ticket/types/ticket.types.ts` | `VenueZone.capacity?: number` |
| `src/modules/ticket/utils/ticket.utils.ts` (+ `.test.ts`) | `getZoneCapacity` usa `zone.capacity ?? ...`; `deriveEventAvailability(layout)` |
| `src/modules/ticket/utils/tier-layout.utils.ts` (+ `.test.ts`) | nuevo: `buildVenueLayoutFromTiers`, layout general por tiers (movido de catalog.utils) |
| `src/modules/ticket/index.ts` | exporta lo nuevo |
| `src/modules/event/utils/event-db.utils.ts` (+ `.test.ts`) | nuevo: `toEventEntity(row, tiers)` |
| `src/modules/event/services/event.service.ts` (+ `.test.ts`) | nuevo: `listPublishedEvents`, `getPublishedEvent(slug)`, `listEventsBySlugs(slugs)`, `publishedEventExists(slug)` |
| `src/modules/event/index.ts` | tipo `PublishedEvent` (barrel sin `db`; el servicio se importa por ruta directa) |
| `src/modules/order/services/availability.service.ts` (+ `.test.ts`) | `getTakenInventoryBySlugs`; `getEventAvailability` por DB |
| `src/modules/order/services/checkout.service.ts` (+ `.test.ts`) | evento desde `getPublishedEvent` |
| `src/app/(main)/my-tickets/page.tsx` | `listEventsBySlugs` en vez de `EVENTS_MOCK` |
| `src/modules/catalog/services/catalog.service.ts` (+ `.test.ts`) | nuevo: `listCatalogEvents`, `getCatalogEvent(slug)` con disponibilidad |
| `src/modules/catalog/index.ts` | solo exporta las vistas y los tipos que sigan en uso |
| `src/modules/catalog/utils/catalog.utils.ts` (+ `.test.ts`) | **borrar** (todo se mueve o queda sin uso) |
| `src/modules/catalog/hooks/use-catalog-events.ts` | **borrar** |
| `src/modules/catalog/components/{local-event-pages,catalog-event-search,catalog-upcoming-events}.tsx` | **borrar** |
| `src/app/(main)/page.tsx`, `src/app/(main)/events/page.tsx`, `src/app/(main)/events/[slug]/page.tsx` | datos de DB, `notFound()` |
| `src/app/(purchase)/events/[slug]/{tickets,checkout,confirmation}/page.tsx` | datos de DB, `notFound()`, sin `generateStaticParams` |
| `README.md`, `docs/SYSTEM_DESIGN.md` | requisito de seed; fila de la spec 035 |

Verificar antes de borrar `catalog.utils.ts`: `grep` de `slugify`, `toCatalogEvent`, `applyOrderToOrganizerEvent`,
`getPublishedCatalogEvents` (hoy solo los usa el propio catalogo y su barrel; `organizer` no los importa).

## Contratos
```ts
// ticket
export function buildVenueLayoutFromTiers(
  event: EventEntity,
  tiers: readonly { id: string; name: string; price: number; totalStock: number }[],
): VenueLayout; // D5
export function deriveEventAvailability(layout: VenueLayout): EventAvailability; // D6

// event/utils/event-db.utils.ts
export type EventRow = typeof events.$inferSelect;
export type TierRow = typeof ticketTiers.$inferSelect;
export function toEventEntity(row: EventRow, tiers: readonly TierRow[]): EventEntity; // D4, availability "available" base

// event/services/event.service.ts (server-only)
export interface PublishedEvent { event: EventEntity; layout: VenueLayout } // layout sin ocupacion real
export function listPublishedEvents(): Promise<PublishedEvent[]>;   // status published, starts_at >= now, limit 200
export function getPublishedEvent(slug: string): Promise<PublishedEvent | null>; // published only
export function listEventsBySlugs(slugs: readonly string[]): Promise<EventEntity[]>; // cualquier estado; [] si slugs vacio
export function publishedEventExists(slug: string): Promise<boolean>;

// catalog/services/catalog.service.ts (server-only)
export function listCatalogEvents(): Promise<PublishedEvent[]>; // con availability real (1 consulta de orders)
export function getCatalogEvent(slug: string): Promise<PublishedEvent | null>; // cache() por request
```
Consultas: `ticket_tiers` de todos los eventos con `inArray(eventId, ids)` (una consulta), no una por evento.

## Criterios de aceptacion
- AC1: `buildVenueLayoutFromTiers` con los tiers sembrados de un evento de plantilla devuelve las zonas de la plantilla
  con sus ids originales, `price` numerico = tier, `capacity = total_stock` y todos los asientos `available`; con
  nombres/stock que no coinciden devuelve el layout general con `id = tier.id` y una zona por tier.
- AC2: `getZoneCapacity` devuelve `zone.capacity` si existe y la regla anterior si no; `applyAvailability` y
  `findAvailabilityConflict` (033) siguen pasando con layouts de plantilla y de DB.
- AC3: `toEventEntity` produce un `EventEntity` valido (`priceFrom` = min precio, `date` ISO, `venue`, `doorsOpen` =
  `date` - 1 h, `minAge` null, flags directos).
- AC4: `listPublishedEvents`/`getPublishedEvent` solo devuelven `status = 'published'` (el `where` lo incluye;
  `draft`/`cancelled` => lista sin ellos / `null`); `listEventsBySlugs` no filtra por estado.
- AC5: `getCatalogEvent`/`listCatalogEvents` marcan `sold-out` / `few-left` segun `orders` paid o pending en ventana
  (una sola consulta a `orders` para el listado).
- AC6: `getEventAvailability` devuelve `null` para slug inexistente o no publicado y el snapshot de `getTakenInventory`
  si esta publicado; `getTakenInventory(slug)` conserva su comportamiento (tests 033 verdes sin cambios de
  expectativa).
- AC7: `createCheckoutSession` responde 404 si el evento no esta publicado en DB; para uno publicado usa precios y
  capacidades de DB (un test cambia `price` en tier y el total de la orden lo refleja).
- AC8: home/`/events`/detalle/tickets/checkout/confirmation no importan `EVENTS_MOCK`; `grep` en `src/app`,
  `src/modules/{catalog,order}/{services,components,hooks}` sin referencias a `EVENTS_MOCK`, `useOrganizerStore`,
  `LocalEvent`, `useCatalogEvents` (solo seed, `organizer`, tests y barrel de `event` pueden mencionar el mock).
- AC9: slug inexistente, `draft` o `cancelled` en las 4 pages por evento => 404 (`notFound()`); sin
  `generateStaticParams`.
- AC10: `/my-tickets` sigue mostrando ordenes de eventos `cancelled`/`draft` y cuenta como `unavailableCount` solo los
  slugs que no existen en `events`.
- AC11: con DB vacia (sin seed) la home no rompe (sin Hero/tendencias/mas vendidos/proximos) y `/events` muestra el
  estado vacio.
- AC12: `tsc`, `eslint`, `vitest` y `next build` pasan (el build no necesita DB: ninguna page prerenderiza datos de DB).
  Verificacion manual (con seed): los 14 eventos aparecen; cambiar un evento a `cancelled` desde `/organizer` lo quita
  de home/`/events` y su URL da 404 tras recargar, y el checkout directo devuelve 404; una compra de prueba sigue
  funcionando de punta a punta y aparece en `/my-tickets`.

## Tests requeridos
(Vitest, junto al archivo)
- `tier-layout.utils.test.ts`: plantilla vs general (AC1), orden de zonas, precios, `capacity`, sin asientos ocupados.
- `ticket.utils.test.ts`: `getZoneCapacity` con y sin `capacity`; `deriveEventAvailability` (sold-out, few-left en el
  umbral, available).
- `event-db.utils.test.ts`: mapeo (AC3), sin tiers, `priceFrom` con varios tiers.
- `event.service.test.ts` (db mockeado): published-only, slug inexistente `null`, `listEventsBySlugs` vacio/no vacio,
  `publishedEventExists`.
- `availability.service.test.ts`: `getTakenInventoryBySlugs` agrega por slug; `getEventAvailability` null/snapshot.
- `checkout.service.test.ts`: 404 sin evento publicado; precios desde DB (reemplaza el mock de `EVENTS_MOCK`).
- `catalog.service.test.ts`: disponibilidad derivada (AC5).
- No automatizable sin DB/Clerk (manual): AC9 (404 reales), AC11, AC12.

## Tareas
### T1 — `ticket`: layout desde tiers, capacidad y disponibilidad derivada
- Archivos: `src/modules/ticket/types/ticket.types.ts`, `src/modules/ticket/utils/ticket.utils.ts`,
  `src/modules/ticket/utils/ticket.utils.test.ts`, `src/modules/ticket/utils/tier-layout.utils.ts`,
  `src/modules/ticket/utils/tier-layout.utils.test.ts`, `src/modules/ticket/index.ts`
- Depende de: —
- Paralelizable: no (base de T2)
- Cubre: AC1, AC2

### T2 — `event`: mapeo fila -> entidad y servicio de lectura
- Archivos: `src/modules/event/utils/event-db.utils.ts`, `src/modules/event/utils/event-db.utils.test.ts`,
  `src/modules/event/services/event.service.ts`, `src/modules/event/services/event.service.test.ts`,
  `src/modules/event/index.ts`
- Depende de: T1
- Paralelizable: no
- Cubre: AC3, AC4

### T3 — `order`: compra, disponibilidad y Mis entradas sobre DB
- Archivos: `src/modules/order/services/availability.service.ts` (+ `.test.ts`),
  `src/modules/order/services/checkout.service.ts` (+ `.test.ts`), `src/app/(main)/my-tickets/page.tsx`
- Depende de: T2
- Paralelizable: si (con T4)
- Cubre: AC6, AC7, AC10

### T4 — `catalog`: servicio con disponibilidad y retirada del puente localStorage
- Archivos: `src/modules/catalog/services/catalog.service.ts` (+ `.test.ts`), `src/modules/catalog/index.ts`; borrar
  `catalog.utils.ts` (+ test), `use-catalog-events.ts`, `local-event-pages.tsx`, `catalog-event-search.tsx`,
  `catalog-upcoming-events.tsx`
- Depende de: T2 y de `getTakenInventoryBySlugs` de T3 (**exporta primero esa funcion**; si corren en paralelo, T3
  la entrega antes que T4 la importe)
- Paralelizable: parcial (con T3 tras esa funcion)
- Cubre: AC5

### T5 — Pages, README y docs
- Archivos: `src/app/(main)/page.tsx`, `src/app/(main)/events/page.tsx`, `src/app/(main)/events/[slug]/page.tsx`,
  `src/app/(purchase)/events/[slug]/tickets/page.tsx`, `src/app/(purchase)/events/[slug]/checkout/page.tsx`,
  `src/app/(purchase)/events/[slug]/confirmation/page.tsx`, `README.md`, `docs/SYSTEM_DESIGN.md`
- Depende de: T3, T4
- Paralelizable: no
- Cubre: AC8, AC9, AC11, AC12

Orden: T1 -> T2 -> (T3 || T4) -> T5. Cada archivo pertenece a una sola tarea. Tras T2 queda `EVENTS_MOCK` aun importado
por las pages hasta T5; no correr el grep de AC8 antes.

## Preguntas abiertas
1. **`doorsOpen` y `minAge`**: default = `date` - 1 h y `null` para todos (el detalle muestra "Todo publico"). Alternativa:
   migracion con `events.doors_open_at timestamptz` y `events.min_age int null` (+ seed y formulario P1-07). ¿Se prefiere
   incluirla en esta spec (suma una migracion y toca `event.table.ts`, `event-seed.utils.ts` y el seed) o en P1-07?
2. **Tendencias / mas vendidos**: default = banderas de la DB (curadas). ¿Se quiere ranking por ventas reales
   (`paid` ultimos N dias) para "Mas vendidos"? Costaria una agregacion sobre `orders.lines` (en memoria hoy).
3. **Evento publicado con fecha pasada**: default = detalle y compra siguen abiertos (solo se oculta de listados).
   ¿Se bloquea la compra (404/mensaje) si `starts_at < now()`?
4. **Eventos del form viejo (localStorage)** desaparecen del catalogo hasta P1-07 (D2). ¿Aceptable, o se prefiere dejar
   el puente cliente solo para el listado (sin compra) hasta P1-07? Default: retirarlo.
5. **Layout de eventos creados en el panel**: hoy fallback "admision general" por tier (D5). ¿P1-07 deja elegir
   plantilla (estadio/teatro/general) o basta con admision general?
6. **Seed en produccion/entornos compartidos**: el catalogo queda vacio sin `db:seed` (D11). ¿Se quiere un chequeo
   visible (p. ej. aviso en `/organizer` si no hay eventos) o basta con el README?

## Proximas fases
- P1-07: formulario de crear/editar evento contra DB (estado `draft`), retirada de `organizer.store`, plantilla de
  venue y, si se aprueba la pregunta 1, `doors_open_at`/`min_age`.
- `order_items` + `orders.event_id` + `tickets.order_item_id`; ranking por ventas reales; filtros y paginacion en
  servidor; cache con invalidacion (`revalidateTag`) desde 030/031 y el webhook de pago si el trafico lo exige;
  bloqueo de compra por fecha / ventana de ventas (`sales_start_at`/`sales_end_at`).

## Log de review
- Iteracion 1 — PASS (reintento; la primera corrida fallo por error de conexion de la API). vitest ticket/event/order/catalog (272), tsc, eslint y npm run build OK. Pendiente manual con DB+seed: AC9 (404 real draft/cancelled/slug inexistente), AC11/AC12 (home y /events con DB vacia, cancelar evento desde /organizer, compra de punta a punta visible en /my-tickets). Notas no bloqueantes: ciclo de modulos ticket.utils <-> event-seed.utils por SEED_GENERAL_ZONE_STOCK (mover a ticket.constants); eventos sembrados sold-out/few-left del mock ahora available (D6); test debil "falls back when numbered stock does not match" en tier-layout.utils.test.ts.
