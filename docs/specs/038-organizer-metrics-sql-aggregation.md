# 038 — Metricas del dashboard del organizador agregadas en SQL

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-10, 4 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P2-10. Numero 038: el ultimo existente es 037.

## Objetivo
`listOrganizerEvents()` (`organizer-events.service.ts`) trae a memoria **todas** las ordenes `paid` de los eventos del
viewer (con su jsonb `lines`) y las suma en JS (`summarizeOrganizerEvents`); el propio codigo lo marca con un
comentario `ponytail:`. Se mueve esa agregacion a Postgres (`SUM`) dentro de la misma query de eventos, sin cambiar el
contrato publico (`OrganizerEventSummary`, `OrganizerKpis`) ni la UI.
Referencias: `029-organizer-dashboard-real-data.md` (define `sold`/`revenue`/`capacity` y el DAL; D2), `030` (alcance por
dueno, `getEventScope`), `032` (tickets por orden), `033` (indice `orders_event_slug_status_idx`; ordenes como fuente de
verdad), `008` (esquema), `014` (UI del dashboard), `SYSTEM_DESIGN.md` (fila Base de datos / Autorizacion).

## Hallazgos (verificado en codigo)
- **`order_items` sigue sin escribirse.** `grep orderItems` en `src` y `scripts`: solo la definicion de la tabla, el import
  de `ticket.table.ts` (FK nullable) y `scripts/verify-db.ts`. `checkout.service.ts:120-130` inserta la orden con `lines`
  jsonb, `eventSlug` y `totalAmount`; `orders.event_id` queda null. La tarjeta ("desde order_items") esta desactualizada:
  esa tabla esta vacia, un `SUM` sobre ella daria 0.
- **`tickets` si se escribe** (`checkout.service.ts:219`, 1 fila por entrada al pasar a `paid`), pero **no tiene precio**
  (`zoneName`, `status`, `qrCode`...), de modo que no sirve para ingresos, y puede tener `status = cancelled|used`
  (habria que decidir si cuentan) y no cubre ordenes pagadas antes de la spec 032 sin reparar.
- **`lines[].zoneId` NO siempre es `ticket_tiers.id`.** Segun 035 (lineas 42-44, 79-81): para los eventos sembrados con
  plantilla conserva el id de la plantilla (`platea`, `entrada-general`...), y solo para eventos con tiers "libres" es
  `tier.id`. Por eso un desglose por tier no es un `GROUP BY` fiable sobre `zoneId`. Como el dashboard **no muestra
  desglose por tier** (el contrato es por evento: `sold`, `revenue`, `capacity`), queda fuera (ver Alcance).
- `sold` actual = `getTicketTotals(lines).quantity` = suma de `line.quantity`; `revenue` actual =
  `Number(orders.totalAmount)` sumado. Ambos solo de ordenes `paid`, unidas por `orders.event_slug = events.slug`.
- Alcance por rol ya resuelto: `getEventScope(viewer)` (`organizer-event-admin.service.ts:21`) → `eq(events.organizerId,
  viewer.id)` para `organizer`, `undefined` (todos) para `admin`/`super_admin`. (029 D4 decia "solo lo suyo" tambien para
  admin; 030 lo cambio y el test actual lo cubre.) No cambia.
- `orders` no tiene columna de moneda: todo es PEN (el tipo ya documenta `revenue: number; // PEN`). No hay agrupacion
  por moneda que hacer.
- El dashboard no tiene filtro de fechas (`organizer-dashboard.tsx`: solo filtro por estado) ni la 029/014 lo piden.
- Indice existente: `orders_event_slug_status_idx (event_slug, status, created_at)` (`order.table.ts`).

## Decisiones
1. **Fuente de verdad: opcion (a), `orders` + `jsonb_array_elements(orders.lines)` en SQL.** Es la misma fuente que ya usa
   el calculo en memoria (resultado identico por construccion), no cambia el modelo ni el checkout. Descartadas:
   - (b) `tickets`: sin precio, depende de `status` de ticket y de la reparacion de la 032; otra definicion de "vendido".
   - (c) crear `order_items` al pagar: obliga a mapear `zoneId` (id de plantilla) → `ticket_tiers.id` por nombre, tocar el
     webhook/checkout bajo el advisory lock de 033, backfill de ordenes ya pagadas y migracion de datos; nada del
     requerimiento lo exige. Se reevalua si algun dia hay desglose por tier o analitica pesada.
2. **Una sola query, sin segunda consulta a `orders`.** `sold` y `revenue` pasan a subconsultas correlacionadas dentro del
   `select` de eventos (igual que `capacity`). El filtro de alcance (`getEventScope`) ya acota los eventos, asi que se
   eliminan `inArray(orders.eventSlug, slugs)` y el early-return posterior a la segunda query (el `rows.length === 0 →
   []` se conserva solo como resultado natural de la query).
   - `sold`: subconsulta separada de `revenue` a proposito. Un `JOIN LATERAL jsonb_array_elements` repite cada orden por
     linea y **duplicaria** `SUM(total_amount)`; dos subconsultas independientes evitan ese error.
   - Bug conocido de Drizzle: en `select` de una sola tabla omite el prefijo de tabla de las columnas dentro de
     `sql\`\``. Las subconsultas se escriben con nombres **calificados a mano** (`"orders"."..."`, `"events"."slug"`), no
     con `${orders.col}`. Hay que incluir `"events"."slug"` literal para la correlacion (mismo patron que
     `"events"."id"` en `capacity`/`changeEventStatus`).
3. **Precision**: `revenue` se calcula como `SUM(numeric(10,2))` exacto en Postgres y se devuelve como `text`
   (`::text`), luego `Number(...)` una sola vez por evento en el mapper (un total por evento cabe de sobra en un double:
   `numeric(10,2)` maximo 99.999.999,99). `getOrganizerKpis` suma varios eventos con flotantes: se redondea a centimos
   (`Math.round(x * 100) / 100`) para no mostrar `0.30000000000000004`. `sold` es entero (`bigint` → `mapWith(Number)`).
4. **Indices: sin cambios.** `orders_event_slug_status_idx` cubre `event_slug = X and status = 'paid'` de cada subconsulta
   (index scan solo sobre las ordenes pagadas de ese evento; el jsonb solo se expande para esas filas). Un indice GIN
   sobre `lines` no ayuda: se suma `quantity` de todos los elementos, no se busca por contenido. Si algun dia hace falta
   `SUM(sold)` instantaneo, la salida es `order_items` o una columna `quantity` en `orders`, no un indice.
5. **Volumen / paginacion**: el resultado sigue siendo 1 fila por evento (la lista de eventos no esta paginada hoy y no es
   parte de esta tarea). El costo baja de "N ordenes y sus lines a Node" a "agregados por evento en Postgres".
   Trade-off aceptado: la query de eventos hace 3 subconsultas correlacionadas por fila (capacity, sold, revenue) →
   O(eventos × ordenes pagadas del evento) con indice; suficiente a la escala actual. Marcar con comentario `ponytail:`
   (techo: miles de ordenes pagadas por evento; salida: `order_items`/columna materializada).
6. **Rango de fechas: fuera.** No lo pide 029/014 ni el dashboard. Si se agrega, es `and "orders"."created_at" >= ...` en
   las dos subconsultas (el indice ya incluye `created_at`); no requiere rediseño. Queda en Proximas fases.
7. **Contrato publico intacto**: `listOrganizerEvents(): Promise<OrganizerEventSummary[]>`, `OrganizerKpis`,
   `organizer-dashboard.tsx`, `organizer-event-list.tsx`, `organizer-kpis.tsx`, `index.ts` no se tocan.
   `OrganizerEventRow` gana `sold: number` y `revenue: string`; `PaidOrderRow` y `summarizeOrganizerEvents` se
   reemplazan por `toOrganizerEventSummaries` (sin consumidores externos, verificado con grep).

## Alcance
- Incluye: query SQL con `sold`/`revenue` por evento; mapper puro; redondeo de centimos en `getOrganizerKpis`; tests
  actualizados; nota en `SYSTEM_DESIGN.md`.
- No incluye: desglose por tier (no hay UI que lo use y `zoneId` no es fiable, ver Hallazgos); escribir `order_items`;
  filtro por fechas; paginacion de eventos; indices o migraciones nuevas; multi-moneda; cambios en UI.

## Reutilizar
`getEventScope`, `requireRole` + `ORGANIZER_AREA_ROLES`, patron de subconsulta correlacionada calificada de `capacity`,
`orders_event_slug_status_idx`, `OrganizerEventSummary`, `getOrganizerKpis`, `filterOrganizerEvents`. Nada nuevo en
`src/lib` ni `src/components`.

## Contrato SQL de referencia

```ts
// organizer-events.service.ts: nuevas columnas del select de eventos (nombres calificados a mano; Drizzle no los prefija)
sold: sql<number>`coalesce((
  select sum((line->>'quantity')::int)
  from "orders", jsonb_array_elements("orders"."lines") as line
  where "orders"."event_slug" = "events"."slug" and "orders"."status" = 'paid'
), 0)`.mapWith(Number),
revenue: sql<string>`coalesce((
  select sum("orders"."total_amount")
  from "orders"
  where "orders"."event_slug" = "events"."slug" and "orders"."status" = 'paid'
), 0)::text`,
```
`.from(events).where(getEventScope(viewer)).orderBy(desc(events.startsAt))` se mantiene. Una sola `db.select`.

```ts
// organizer.utils.ts
export interface OrganizerEventRow { /* actual */ sold: number; revenue: string }
export function toOrganizerEventSummaries(rows: readonly OrganizerEventRow[]): OrganizerEventSummary[];
// startsAt -> ISO; revenue -> Number(row.revenue); resto igual. getOrganizerKpis: revenue redondeado a centimos.
```

## Archivos

| Archivo | Accion | Tarea |
|---|---|---|
| `src/modules/organizer/utils/organizer.utils.ts` | Editar: `OrganizerEventRow` (+`sold`,`revenue`), borrar `PaidOrderRow` y `summarizeOrganizerEvents`, agregar `toOrganizerEventSummaries`, redondeo en `getOrganizerKpis`; quitar import de `getTicketTotals`/`TicketLine` si queda sin uso | T1 |
| `src/modules/organizer/utils/organizer.utils.test.ts` | Editar | T1 |
| `src/modules/organizer/services/organizer-events.service.ts` | Editar: una query, quitar `inArray`/`and`/`orders` si ya no se usan, quitar el `ponytail:` viejo | T2 |
| `src/modules/organizer/services/organizer-events.service.test.ts` | Editar | T2 |
| `docs/SYSTEM_DESIGN.md` | Editar: agregar 038 a la fila "Autorizacion" (metricas del organizador agregadas en SQL, desde `orders`) | T3 |

## Criterios de aceptacion
- AC1: `listOrganizerEvents` ejecuta **una** `db.select` (ya no consulta `orders` aparte) y no importa `inArray` ni `getTicketTotals`;
  `grep -rn "summarizeOrganizerEvents\|PaidOrderRow" src` sin resultados.
- AC2: Las subconsultas de `sold` y `revenue` filtran `status = 'paid'`, correlacionan por `"events"."slug"` con nombres calificados
  a mano, y `sold`/`revenue` se calculan en subconsultas separadas (sin join que multiplique `total_amount`).
- AC3: El alcance sigue siendo `getEventScope(viewer)`: `organizer` solo ve sus eventos, `admin`/`super_admin` todos; los
  tests existentes de rol siguen en verde.
- AC4: `revenue` llega de SQL como string decimal (`"150.00"`) y sale como `number` (`150`); un evento sin ordenes pagadas da
  `sold: 0`, `revenue: 0`; ordenes `pending|failed|cancelled` no cuentan.
- AC5: `getOrganizerKpis` suma ingresos sin artefactos de flotante (ej. `0.1 + 0.2` → `0.3`); `sold`/`published` no cambian.
- AC6: `OrganizerEventSummary`, `OrganizerKpis`, componentes del dashboard e `index.ts` no se modifican (diff vacio).
- AC7 (manual, Postgres real): para el organizador del seed, la consulta de verificacion (abajo) devuelve exactamente los mismos
  `sold`/`revenue` por evento que muestra el dashboard antes del cambio (version en memoria) y despues.
- AC8: `npx tsc --noEmit`, `npm run lint` y `npm run test -- --run` pasan.

## Tests requeridos
Vitest no puede ejecutar SQL real (la `db` se mockea): los tests cubren el mapeo y la forma de la llamada; la **correccion
del SQL solo se verifica manualmente contra Postgres** (AC7).
- `organizer.utils.test.ts`: `toOrganizerEventSummaries` (revenue string → number, `"0"`/`"0.00"` → 0, `startsAt` ISO,
  conserva orden, `sold` pasa tal cual); `getOrganizerKpis` con redondeo (`0.1 + 0.2 = 0.3`) y sumas existentes. Se borran
  los casos de `summarizeOrganizerEvents`.
- `organizer-events.service.test.ts`: `requireRole` con `ORGANIZER_AREA_ROLES`; `select` llamado una sola vez; `[]` si no hay
  eventos; con filas devuelve `sold`/`revenue` mapeados (`revenue: "150.00"` → `150`); rol `admin`/`super_admin` →
  `.where(undefined)`, `organizer` → `.where(<expr>)`. El mock encadena `select → from → where → orderBy` y se simplifica
  (ya no hay segundo `where` que resuelve directo).

## Verificacion manual (AC7)
En `psql`/Drizzle Studio, con `:org` = id del organizador (o sin filtro para admin). Comparar con el dashboard:
```sql
-- A) Resultado nuevo (lo mismo que la subconsulta del servicio)
select e.slug,
       coalesce((select sum((line->>'quantity')::int)
                 from orders o, jsonb_array_elements(o.lines) as line
                 where o.event_slug = e.slug and o.status = 'paid'), 0) as sold,
       coalesce((select sum(o.total_amount) from orders o
                 where o.event_slug = e.slug and o.status = 'paid'), 0)::text as revenue
from events e
where e.organizer_id = :org
order by e.starts_at desc;

-- B) Control independiente (no usa jsonb_array_elements en subconsulta): debe coincidir con A
select o.event_slug,
       sum((select sum((l->>'quantity')::int) from jsonb_array_elements(o.lines) l)) as sold,
       sum(o.total_amount) as revenue
from orders o
where o.status = 'paid' and o.event_slug in (select slug from events where organizer_id = :org)
group by o.event_slug;
```
Ademas: `select count(*) from tickets t join orders o on o.id = t.order_id where o.event_slug = :slug and o.status = 'paid'`
deberia igualar `sold` (una fila de ticket por entrada, spec 032) como chequeo cruzado; una diferencia indica ordenes
pagadas sin tickets emitidos, no un error de esta query. Tambien confirmar con `EXPLAIN` que las subconsultas usan
`orders_event_slug_status_idx`.

## Tareas

### T1 — Mapper puro y redondeo de KPIs
- Archivos: `src/modules/organizer/utils/organizer.utils.ts`, `src/modules/organizer/utils/organizer.utils.test.ts`
- Depende de: —
- Paralelizable: si (con T3)
- Cubre: AC4, AC5, AC6, AC8

### T2 — Servicio con agregacion SQL
- Archivos: `src/modules/organizer/services/organizer-events.service.ts`, `src/modules/organizer/services/organizer-events.service.test.ts`
- Depende de: T1 (tipo `OrganizerEventRow` y `toOrganizerEventSummaries`)
- Paralelizable: no (espera T1)
- Cubre: AC1, AC2, AC3, AC4, AC7, AC8

### T3 — Docs
- Archivos: `docs/SYSTEM_DESIGN.md`
- Depende de: —
- Paralelizable: si (con T1)
- Cubre: documentacion (sin AC propio)

## Preguntas abiertas
1. **Desglose por tier**: la tarjeta lo menciona pero el dashboard no lo muestra y `zoneId` no siempre es `tier.id` (035).
   Se propone dejarlo fuera; si se quiere, hace falta definir un criterio (por `zoneName` = `tier.name`, o crear
   `order_items` resolviendo plantilla → tier, opcion (c)) y una UI que lo consuma. Confirmar.
2. **Filtro por rango de fechas**: se propone no incluirlo (nadie lo pide). Si la tarjeta original lo exige, agregar un
   parametro opcional `{ from, to }` al servicio + control en el dashboard (~+2 archivos).
3. **Redondeo de KPIs** (Decision 3): se propone redondear a centimos en `getOrganizerKpis`; es un cambio pequeno fuera de
   "mover a SQL", pero cierra el tema de precision decimal. Alternativa: dejarlo como esta.
4. **Correccion de la tarjeta**: "desde order_items" no es viable hoy (tabla vacia). Se propone actualizar la tarjeta de
   Trello a "desde orders.lines (SQL)".

## Proximas fases
- `order_items` al pagar + backfill (si se necesita desglose por tier o `SUM` sin jsonb).
- Filtro por rango de fechas y paginacion de la lista de eventos.
- Desglose de ventas por tier en el dashboard.

## Log de review
- Iteracion 1 — PASS. vitest completo (47 archivos, 553 tests), tsc, eslint y npm run build OK. AC7 verificado por el orquestador contra Postgres real (solo lectura): sold=6 y revenue=920.00 para peru-vs-brasil-eliminatorias, igual que el control GROUP BY y las 6 filas de tickets. Pendiente opcional: EXPLAIN del indice orders_event_slug_status_idx y comparar con el dashboard en pantalla. Notas no bloqueantes: lines no-array haria fallar jsonb_array_elements (el checkout siempre escribe array; lines es jsonb NOT NULL); mock con imageUrl null en organizer-events.service.test.ts.
