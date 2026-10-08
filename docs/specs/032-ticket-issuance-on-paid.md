# 032 — Emision de tickets (entradas) al confirmarse el pago

Estado: implementada (pendiente AC7 migrar + AC2-AC4 manual)

## Estado
- Aprobacion humana: aprobada (2026-10-07, 4 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P0-03.

## Objetivo
Cuando una orden pasa a `paid` (webhook Stripe o `syncOrderWithSession` de la pagina de confirmacion, spec 022)
se crean sus filas en `tickets`: una por entrada, con codigo unico, zona, asiento y titular. Debe ser atomico
(misma transaccion que el `UPDATE orders`) e idempotente ante reintentos del webhook y ante la carrera
webhook vs. pagina de confirmacion. Referencias: `008-database-mer.md` (esquema), `022` (transiciones de estado),
`023` (UI de confirmacion ya implementada, no se toca).

## Hallazgos (verificado en codigo)
- Hoy **no se crea ningun `order_items` ni `tickets`**: `createCheckoutSession` solo inserta `orders` (con `lines`
  jsonb) y `applySessionStatus` solo hace `UPDATE orders SET status`. Ningun otro archivo escribe esas tablas.
- `order_items.ticket_tier_id` es `NOT NULL` FK a `ticket_tiers`, pero `events`/`ticket_tiers` estan vacias (el
  catalogo vive en `EVENTS_MOCK`; el seed de la spec 025 no se ha ejecutado) y `orders.event_id` queda `NULL`.
  **No se puede crear `order_items` valido hoy.**
- `tickets.order_item_id` es `NOT NULL` y no hay `order_id`, zona, asiento ni codigo legible en `tickets`.
- Codigo ya usado por la UI: `toOrderFromRecord` => `TK-${id.slice(0,8).toUpperCase()}` y `getOrderTickets` =>
  `<number>-0n` (mock: `TK-24817-01`). Ambos en `src/modules/order/utils/order.utils.ts`.

## Decisiones
1. **Sin `order_items` en esta fase.** Los tickets se vinculan directo a la orden. `order_items` queda para P0-04
   (inventario por tier), cuando exista el catalogo en DB. Por eso `tickets.order_item_id` pasa a **nullable**
   (la FK y el cascade se conservan).
2. **Columnas nuevas en `tickets`** (tabla vacia, migracion segura): `order_id uuid NOT NULL` FK `orders(id)`
   ON DELETE cascade, `sequence integer NOT NULL` (1..n dentro de la orden), `zone_name text NOT NULL`,
   `seat_label text NULL`. `attendee_name` (ya existe) = `buyer.fullName`.
3. **Idempotencia por constraint de DB**, no por logica: `UNIQUE (order_id, sequence)` +
   `INSERT ... ON CONFLICT DO NOTHING`. Se ejecuta **siempre que el estado resultante sea `paid`**, dentro de la
   misma transaccion que el `UPDATE ... WHERE status='pending'`. Asi: doble `checkout.session.completed` => segundo
   insert no-op; carrera webhook/sync => ambos pueden insertar, la constraint garantiza un solo juego; ordenes que
   ya estaban `paid` antes de esta spec se "reparan" en el siguiente sync/webhook.
4. **Formato de codigo = `qr_code`** (columna existente, ya `UNIQUE`): `TK-<8 hex del order id en mayuscula>-0n`,
   el mismo que ya muestra la UI (compatible con el mock). Se reutiliza la logica de `getOrderTickets` (DRY) en vez
   de una segunda. **Sin imagen QR**: YAGNI; no hay dependencia de QR instalada (`qrcode` no esta en `node_modules`)
   y renderizarlo es de la UI (P1-05). El "QR" almacenado es el texto, que cualquier lib codificara tal cual.
   Limite conocido: el codigo es derivable del id de la orden (no secreto); si el escaner de check-in necesita
   anti-falsificacion, se cambia por token aleatorio/firmado (ver Preguntas abiertas 1).
5. Un fallo al insertar tickets hace rollback del cambio a `paid` (transaccion), y el webhook responde 500 para que
   Stripe reintente: nunca queda una orden pagada sin entradas.

## Alcance
- Incluye: migracion drizzle de `tickets`; funcion pura que genera las filas desde una `OrderRecord`; emision
  transaccional e idempotente en `applySessionStatus`; tests (incluido doble `checkout.session.completed`).
- No incluye: UI "Mis entradas" desde DB (P1-05); correos con entradas (receipt de Stripe ya existe; email propio
  es otra tarea); inventario/`order_items`/descuento de stock (P0-04); imagen QR; check-in/escaneo; cambios de UI
  de confirmacion; reembolsos/cancelacion de tickets (`ticket_status` ya soporta `cancelled`, sin uso aqui).

## Reutilizar
- `getOrderTickets` / `toOrderFromRecord` en `src/modules/order/utils/order.utils.ts` (formato de codigo y orden
  de las entradas por linea).
- `applySessionStatus` en `src/modules/order/services/checkout.service.ts` (punto unico por donde pasan webhook y
  sync; no se toca `handleStripeEvent`/`syncOrderWithSession` ni la ruta del webhook).
- `tickets`, `ticketStatusEnum` en `src/modules/ticket/db/ticket.table.ts`; `OrderRecord` de `order.table.ts`.
- `db.transaction` de drizzle (driver `postgres`, ya en uso en `src/lib/db.ts`).

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/ticket/db/ticket.table.ts` | `orderItemId` nullable; agrega `orderId`, `sequence`, `zoneName`, `seatLabel`; unique `(order_id, sequence)` + indice `order_id` |
| `drizzle/0004_*.sql` + `drizzle/meta/*` | generado con `npm run db:generate` (no editar a mano) |
| `src/modules/order/utils/order.utils.ts` | `getOrderNumber(orderId)` (usado por `toOrderFromRecord`); `getOrderTickets` acepta `Pick<Order,"number"\|"lines">`; nueva `toTicketRows(record)` |
| `src/modules/order/utils/order.utils.test.ts` | tests de lo anterior |
| `src/modules/order/services/checkout.service.ts` | `applySessionStatus` transaccional con emision |
| `src/modules/order/services/checkout.service.test.ts` | mock de `db.transaction` + tests de idempotencia |
| `docs/SYSTEM_DESIGN.md` | solo agregar `032` a la fila de Base de datos/Pagos |

## Criterios de aceptacion
- AC1: tras `pending -> paid` existen `sum(lines[].quantity)` filas en `tickets` para la orden, con `qr_code`
  `TK-XXXXXXXX-01..0n` (n con 2 digitos, consecutivo a traves de las lineas), `zone_name` y `seat_label` de la
  linea (null en zona general), `attendee_name = buyer.fullName`, `status='valid'`.
- AC2: dos `checkout.session.completed` para la misma orden dejan exactamente un juego de tickets y no lanzan error.
- AC3: `syncOrderWithSession` y `handleStripeEvent` concurrentes sobre la misma orden dejan un solo juego (garantizado
  por `UNIQUE(order_id, sequence)` + `ON CONFLICT DO NOTHING`).
- AC4: una orden ya `paid` sin tickets los obtiene al llegar un evento/sync posterior (reparacion).
- AC5: ordenes `failed`/`cancelled`/`pending` no generan tickets; una orden `paid` nunca se degrada (sin cambios 022).
- AC6: si el insert de tickets falla, la orden sigue `pending` (rollback) y el error se propaga (webhook => 500).
- AC7: la migracion aplica sobre la DB actual (`tickets` vacia) y `qr_code` sigue unico.
- AC8: `tsc`, `eslint` y `vitest` pasan; la UI de confirmacion (023) sigue funcionando sin cambios.

## Tests requeridos
- `order.utils.test.ts`: `getOrderNumber`; `toTicketRows` con dos lineas (zona general + numerada) => codigos
  consecutivos `-01..-0n`, `seatLabel` correcto, `attendeeName`, `sequence`; cantidad 0 => [].
- `checkout.service.test.ts` (db mockeado, extender con `transaction`): paid inserta tickets con
  `onConflictDoNothing`; doble `checkout.session.completed` no falla y el segundo update devuelve vacio pero igual
  invoca el insert idempotente; orden ya paid => inserta (reparacion); failed/expired => no inserta; error del
  insert propaga y no se traga.
- Verificacion manual (no automatizable sin DB): `stripe trigger`/reenviar el evento dos veces y comprobar
  `SELECT count(*) FROM tickets WHERE order_id = ...`.

## Tareas
### T1 — Esquema y migracion de `tickets`
- Archivos: `src/modules/ticket/db/ticket.table.ts`, `drizzle/0004_*.sql`, `drizzle/meta/_journal.json`,
  `drizzle/meta/0004_snapshot.json`
- Depende de: —
- Paralelizable: si (con T2)
- Cubre: AC7 (y habilita AC1-AC4)

### T2 — Generacion pura de filas de ticket
- Archivos: `src/modules/order/utils/order.utils.ts`, `src/modules/order/utils/order.utils.test.ts`
- Depende de: —
- Paralelizable: si (con T1; `toTicketRows` devuelve `Omit<typeof tickets.$inferInsert, ...>` tipado por forma
  propia para no depender de T1 hasta T3)
- Cubre: AC1 (formato)

### T3 — Emision transaccional e idempotente
- Archivos: `src/modules/order/services/checkout.service.ts`, `src/modules/order/services/checkout.service.test.ts`,
  `docs/SYSTEM_DESIGN.md`
- Depende de: T1, T2
- Paralelizable: no
- Cubre: AC1-AC6, AC8

## Dependencias con otras tareas
- P0-04 (inventario): creara `order_items`/tiers y podra poblar `tickets.order_item_id`; esta spec deja la columna
  nullable para eso.
- P1-05 (Mis entradas desde DB): leera `tickets` por `order_id`; mostrara el QR a partir de `qr_code`.
- Email de entradas: consumira los tickets emitidos aqui.

## Preguntas abiertas
1. **Codigo secreto**: default = `TK-<order8>-0n` (derivable del id, igual que la UI). ¿Se requiere token aleatorio
   (ej. `crypto.randomUUID()`) como `qr_code` para el check-in, dejando `TK-...` solo como etiqueta visible?
   Implicaria columna `code` separada.
2. **Colision de prefijo de 8 hex** entre dos ordenes: probabilidad despreciable (~1 en 4.3e9 por par); si ocurre,
   el unique de `qr_code` falla y la transaccion hace rollback (reintento de Stripe no lo resuelve). Default:
   aceptado. ¿Prefieres usar el uuid completo/sufijo mas largo?
3. **Titular por entrada**: default = comprador para todas. ¿Se necesitara nombre por asistente mas adelante?
4. Las ordenes `paid` previas a esta spec (si hay) se reparan solo cuando llegue otro evento/sync; no hay backfill
   masivo. Default: aceptado.

## Proximas fases
- `order_items` + stock por tier (P0-04), vinculando `tickets.order_item_id`.
- "Mis entradas" desde DB con QR (P1-05), email con entradas, check-in (`checked_in_at`, estado `used`).

## Log de review
- Iteracion 1 — PASS. vitest order/ (68) y tsc OK. Pendiente manual: npm run db:migrate (0004), reenviar checkout.session.completed x2 y contar tickets. Notas no bloqueantes: checkout.service.ts:136 record obsoleto tras perder la carrera; :139 paid tardio sobre orden failed (teorico).
