# 033 — Inventario real: disponibilidad en servidor y anti-sobreventa

Estado: implementada (pendiente migrar 0005 + AC4/AC5 manual)

## Estado
- Aprobacion humana: aprobada (2026-10-08, 6 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P0-04.

## Objetivo
Que el servidor sea la fuente de verdad de que asientos/cupos estan tomados y que `createCheckoutSession` no pueda
vender dos veces el mismo asiento ni pasarse del cupo de una zona, ni siquiera con dos compradores simultaneos.
Hoy la ocupacion es un hash determinista de `venue.mock` (solo cosmetico) y nada en servidor impide que dos
personas paguen el mismo asiento (riesgo aceptado en `022-stripe-checkout-payments.md`, preguntas abiertas; aqui se
cierra). Referencias: `008-database-mer.md` (esquema), `022` (ciclo de vida de la orden / Stripe), `025`
(`SEED_GENERAL_ZONE_STOCK`, regla de capacidad), `032` (tickets por orden), `SYSTEM_DESIGN.md` (Base de datos /
Pagos).

## Hallazgos (verificado en codigo)
- `ticket_tiers.total_stock` existe pero la tabla esta **vacia** (`events`/`ticket_tiers` sin sembrar; spec 025 sin
  ejecutar). El catalogo vive en `EVENTS_MOCK` y `orders.event_id` queda `NULL`; la unica clave de evento usable hoy
  es `orders.event_slug` (NOT NULL). `order_items` no se escribe en ningun lado (decision 032).
- Seleccion y mapa son 100% cliente (`ticket-selection.store.ts`, `venue-map.tsx`, `getVenueLayout`).
  `createCheckoutSession` solo valida que el asiento exista y que no sea `occupied` **segun el hash del mock**; no
  consulta ordenes; en zonas generales no valida cupo (ni siquiera `availability: "sold-out"`).
- Cada orden ya guarda `lines` jsonb (`zoneId`, `quantity`, `seatLabels` ej. `["C12"]`) y su `status`
  (`pending|paid|failed|cancelled`). Basta para derivar lo vendido/reservado sin tablas nuevas.
- Solo los eventos de `EVENTS_MOCK` pueden pasar por `createCheckoutSession` (los publicados desde el panel viven en
  localStorage y el servidor devuelve 404 para ellos): el inventario de esta spec cubre exactamente el set que hoy
  se puede pagar.
- Tiempos: Stripe fija la session en 1800 s (`CHECKOUT_SESSION_TTL_SECONDS`, minimo permitido por Stripe);
  `hold-timer-notice` + `CHECKOUT_HOLD_SECONDS = 600` es un contador **solo de cliente** para completar el
  formulario, y no reserva nada en servidor. `checkout.session.expired` ya pasa la orden a `cancelled`
  (`getOrderStatusFromEvent`), pero una orden `pending` cuya session nunca vence por webhook (webhook caido, fallo de
  `stripe.checkout.sessions.create` tras el insert) quedaria bloqueando asientos para siempre.

## Dependencia con P1-06 (decision)
P1-06 migra el catalogo a DB (`events`, `ticket_tiers`, `order_items`). **No se bloquea esta tarea por P1-06**: sin
tiers en DB no hay `total_stock` que leer, pero la disponibilidad se puede derivar hoy de `orders` + la capacidad
del layout, y el diseño deja un unico punto de cambio:
- Capacidad por zona = `getZoneCapacity(zone)`: `zone.seats.length` (numerada) o `SEED_GENERAL_ZONE_STOCK` (500,
  misma regla que el seed 025, asi `capacidad == ticket_tiers.total_stock` cuando se siembre). **P1-06 solo
  reemplaza el cuerpo de esa funcion por la lectura de `ticket_tiers.total_stock`**; nada mas cambia.
- La clave de evento sigue siendo `event_slug`; cuando P1-06 llene `orders.event_id`/`order_items`, la consulta puede
  migrar a `order_items.quantity` sin cambiar el contrato publico (`EventAvailabilitySnapshot`).
- Se descarta "requerir seed" como prerequisito: ejecutar el seed no aporta stock utilizable mientras
  `createCheckoutSession` y el mapa lean del mock.

## Decisiones
1. **Fuente de verdad = `orders` del servidor.** Una orden "cuenta" si `status='paid'` **o** (`status='pending'` y
   `created_at > now() - RESERVATION_WINDOW_SECONDS`). `failed`/`cancelled` no cuentan. Se agrega por
   `lines[].zoneId`: `sold[zoneId] += quantity` y `seats[zoneId] += seatLabels`. Sin tabla de reservas ni columna
   nueva: `tickets` (032) solo existe para ordenes `paid`, que ya estan en `orders`, y leer `lines` cubre tambien
   las `pending`.
2. **Liberacion por TTL perezoso (sin cron).** Una `pending` vieja deja de contar por la condicion de tiempo de la
   consulta; no hay job de limpieza. `RESERVATION_WINDOW_SECONDS = CHECKOUT_SESSION_TTL_SECONDS + 60` (la reserva
   debe durar **al menos** lo que la session de Stripe sigue pagable; si fuera menor, alguien podria pagar un asiento
   ya re-vendido). `checkout.session.expired` ya libera de inmediato via `cancelled` (sin cambios). El comparador de
   tiempo se calcula **en SQL** (`now() - make_interval(secs => N)`) porque `orders.created_at` es
   `timestamp` sin zona con `defaultNow()` de la DB: comparar contra un `Date` de JS puede desfasar horas.
3. **Carrera real y mecanismo minimo: advisory lock transaccional por evento.** Leer disponibilidad y luego insertar
   la orden no es atomico: dos POST simultaneos verian el asiento libre. Un unique parcial o tabla
   `seat_reservations(event_slug, zone_id, seat_label)` resolveria solo asientos, **no el conteo de zonas
   generales** (suma de cantidades), y exigiria insertar/borrar filas en cada transicion (pending->cancelled,
   expiracion). En cambio `pg_advisory_xact_lock(hashtext(event_slug))` al inicio de `db.transaction` serializa las
   compras del mismo evento: dentro del lock se calcula lo tomado, se valida y se inserta la orden; al commit el
   lock se libera solo. Cubre asientos **y** cupos con el mismo codigo, sin migracion de datos. Limite conocido
   (marcar con comentario `ponytail:`): serializa por evento, adecuado a la escala actual; si un evento muy popular
   saturara, pasar a reservas por asiento con unique parcial. Se usa la variante `xact` (no de sesion) para ser
   compatible con un pooler en modo transaccion.
4. **Orden pendiente = reserva; no hay reserva mientras se llena el formulario.** Los 600 s del `HoldTimerNotice`
   siguen siendo UX de cliente (no se tocan). La reserva servidor nace al crear la orden (POST) y dura hasta pago,
   `expired` o `RESERVATION_WINDOW_SECONDS`. Se documenta en la spec y se deja como pregunta abierta si se quiere
   un hold mas temprano (seria otra tarea: requiere crear orden/reserva al entrar al checkout).
5. **Reintento del mismo comprador no se auto-bloquea.** Dentro del lock, antes de validar, las `pending` del mismo
   evento y el mismo `lower(buyer->>'email')` se marcan `cancelled` y, fuera de la transaccion y en best-effort,
   se hace `stripe.checkout.sessions.expire(id)` (el `cancel_url` de Stripe deja la orden `pending`; sin esto el
   usuario que vuelve a intentar chocaria con su propia reserva por 30 min). Si `expire` falla se registra el error y
   se sigue (la orden ya esta `cancelled`; ver riesgo en Preguntas abiertas 3).
6. **Si `stripe.checkout.sessions.create` falla** la orden recien insertada se marca `cancelled` (hoy quedaria
   `pending` reservando cupo) y se propaga el error (500 como hoy).
7. **Error de conflicto = HTTP 409** con mensaje en español; `order.service.ts` ya propaga `response.data.message`,
   por lo que la UI de checkout lo muestra sin cambios.
8. **Lectura**: `GET /api/events/[slug]/availability` devuelve `{ seats: Record<zoneId,string[]>, sold:
   Record<zoneId,number> }` (labels `"C12"`, igual que `TicketLine.seatLabels`), 404 si el slug no esta en el mock.
   El mapa la aplica con una funcion pura `applyAvailability(layout, snapshot)`: marca esos asientos `occupied` y fija
   `zone.remaining = capacidad - sold` en zonas generales (campo ya existente y ya consumido por `ticket-tier-list`
   y `venue-map`); si `remaining <= 0` la zona pasa a `availability: "sold-out"`. Sin React Query (no hay
   `QueryClientProvider` en la app): `useEffect` + axios, igual que el resto de servicios cliente.
9. La disponibilidad del hash (`occupied` del mock) se conserva como base cosmetica (esos asientos nunca se venden);
   lo real se superpone. No se tocan `buildSeats`/`SEAT_OCCUPANCY_BY_AVAILABILITY`.

## Alcance
- Incluye: indice en `orders` para la consulta; constante de ventana de reserva; `getZoneCapacity` y
  `applyAvailability` puros; servicio y endpoint de lectura de disponibilidad; validacion + lock + 409 en
  `createCheckoutSession` (asientos tomados, cupo de zona general, zona `sold-out`); cancelacion de pendientes
  previas del mismo comprador y de la orden si falla Stripe; hook cliente que pinta asientos ocupados y cupos
  restantes; tests.
- No incluye (se difiere):
  - **P1-06**: leer `ticket_tiers.total_stock`, escribir `order_items`, llenar `orders.event_id`, poblar
    `tickets.order_item_id`, descuento de stock en DB, reglas `sales_start_at/sales_end_at`.
  - **P1-05**: "Mis entradas" desde DB / QR.
  - Reserva temprana al entrar al checkout y alineacion del contador de 600 s con el servidor.
  - Cron/job de limpieza de `pending` (el TTL perezoso basta).
  - Tiempo real (websocket/SSE); el mapa se refresca al montar y al volver a enfocar la pestana, no por push.
  - Eventos publicados desde el panel (localStorage): siguen sin pasar por servidor (404).
  - Reembolso automatico si un pago llega para una orden ya `cancelled` (ver Preguntas abiertas 3).
  - Reconciliacion del conteo si dos eventos comparten slug (el slug es unico en el mock y en `events.slug`).

## Reutilizar
- `lines` jsonb de `orders`, `OrderStatus`, `CHECKOUT_SESSION_TTL_SECONDS` (se mueve a `order.constants.ts`).
- `SEED_GENERAL_ZONE_STOCK` (`src/modules/event/utils/event-seed.utils.ts`, exportar via `@/modules/event` si aun no
  esta) — no se duplica el 500.
- `getVenueLayout`, `getTicketLines`, `hasInvalidSeatSelection` y `Seat.status` / `VenueZone.remaining` ya existentes.
- `order.service.ts` (extraccion de `message` del error HTTP) para mostrar el 409 sin tocar UI.
- Patron de test de `checkout.service.test.ts` (mock de `db` con `transaction`, extender con `execute`).
- Estilo de route handler de `src/app/api/checkout/session/route.ts`.
- Guia de route handlers dinamicos de Next 16: `node_modules/next/dist/docs/` (params es `Promise` en
  `RouteContext`/`PageProps`; verificar antes de escribir T3).

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/order/db/order.table.ts` | indice `orders_event_slug_status_idx` sobre `(event_slug, status, created_at)` |
| `drizzle/0005_*.sql` + `drizzle/meta/*` | generado con `npm run db:generate` (no editar a mano) |
| `src/modules/order/constants/order.constants.ts` | mueve `CHECKOUT_SESSION_TTL_SECONDS`; agrega `RESERVATION_WINDOW_SECONDS` |
| `src/modules/ticket/types/ticket.types.ts` | `EventAvailabilitySnapshot` |
| `src/modules/ticket/utils/ticket.utils.ts` | `getZoneCapacity(zone)`, `applyAvailability(layout, snapshot)` |
| `src/modules/ticket/utils/ticket.utils.test.ts` | tests de lo anterior |
| `src/modules/ticket/index.ts` | exporta `getZoneCapacity`, `applyAvailability` y el tipo (el hook y el servicio cliente se importan por ruta relativa dentro del modulo) |
| `src/modules/order/services/availability.service.ts` | `getTakenInventory(executor, eventSlug)` y `getEventAvailability(slug)` |
| `src/modules/order/services/availability.service.test.ts` | tests |
| `src/app/api/events/[slug]/availability/route.ts` | `GET` delgado, 404 si el slug no existe |
| `src/modules/order/services/checkout.service.ts` | lock + validacion + 409 + reemplazo de pendientes + cancel en fallo Stripe |
| `src/modules/order/services/checkout.service.test.ts` | tests |
| `src/app/api/checkout/session/route.ts` | ya devuelve `result.status`; solo ajustar si el tipo lo exige |
| `src/modules/ticket/services/availability.service.ts` | `fetchEventAvailability(slug)` (axios) |
| `src/modules/ticket/hooks/use-event-availability.ts` | hook cliente (mount + focus) |
| `src/modules/ticket/hooks/use-event-availability.test.ts` | tests |
| `src/modules/ticket/components/ticket-selection.tsx` | usa el hook y pasa el layout fusionado al mapa/lista |
| `docs/SYSTEM_DESIGN.md` | solo agregar `033` a la fila de Base de datos/Pagos |

## Criterios de aceptacion
- AC1: `getEventAvailability(slug)` cuenta lo vendido/reservado por zona usando solo ordenes `paid` y `pending` dentro
  de `RESERVATION_WINDOW_SECONDS`; `failed`, `cancelled` y `pending` vencidas no cuentan. Asientos como labels por
  `zoneId`, cantidad total por `zoneId`.
- AC2: `createCheckoutSession` responde `{ ok:false, status:409 }` si algun asiento pedido ya esta en una orden que
  cuenta, aun si el hash del mock lo marca `available`.
- AC3: en zona general, si `sold + pedido > getZoneCapacity(zone)` responde 409 (mensaje con la zona); si cabe, crea
  la orden. Una zona `availability: "sold-out"` responde 409.
- AC4: la lectura de lo tomado, la validacion y el insert de la orden ocurren dentro de una misma `db.transaction`
  que toma `pg_advisory_xact_lock(hashtext(eventSlug))` **antes** de leer (verificable en test por orden de
  llamadas; verificacion manual con dos POST concurrentes del mismo asiento: exactamente uno responde 200 y el otro
  409).
- AC5: tras 1800+60 s una orden `pending` deja de reservar (el asiento vuelve a estar libre sin job); un
  `checkout.session.expired` la libera de inmediato (ya existente, test de regresion de la consulta).
- AC6: un nuevo POST del mismo comprador (mismo email, mismo evento) con una `pending` previa de los mismos asientos
  la cancela y tiene exito (no choca con su propia reserva); se invoca `stripe.checkout.sessions.expire` para esa
  session y un error de `expire` no hace fallar la compra.
- AC7: si `stripe.checkout.sessions.create` lanza, la orden insertada queda `cancelled` y el error se propaga.
- AC8: `GET /api/events/<slug>/availability` devuelve 200 con el snapshot y 404 para slug desconocido; no requiere
  sesion y no expone datos del comprador.
- AC9: `applyAvailability` marca como `occupied` los asientos del snapshot, fija `zone.remaining = capacidad - sold` en
  zonas generales (minimo 0; 0 => `availability: "sold-out"`), no muta el layout original y deja intactas las zonas
  sin datos.
- AC10: en la pagina de seleccion, el mapa muestra los asientos tomados como ocupados y las zonas generales muestran
  "Quedan N"; si el fetch falla, se muestra el layout base sin romper la pagina (el servidor sigue siendo la
  barrera).
- AC11: la migracion aplica sobre la DB actual; `tsc`, `eslint` y `vitest` pasan; sin cambios en el flujo
  webhook/confirmacion (022/023/032).

## Tests requeridos
(Vitest, junto al archivo)
- `ticket.utils.test.ts`: `getZoneCapacity` (numerada = cantidad de asientos, general = 500); `applyAvailability`
  (asiento tomado pasa a `occupied`, label `C12` mapea al asiento `<zone>-C-12`, `remaining` correcto y clamp a 0,
  sold-out al llegar a 0, inmutabilidad, snapshot vacio = layout igual).
- `availability.service.test.ts` (db mockeado): suma de varias ordenes por zona; ignora estados que no cuentan
  (el filtro se verifica en la forma de la consulta/where mockeada y en una funcion pura de agregacion
  `aggregateTaken(rows)` testeada directamente con filas `paid`/`pending`); varias lineas y zonas.
- `checkout.service.test.ts` (extender mock con `execute`): lock llamado antes de cualquier select/insert; 409 por
  asiento tomado; 409 por cupo general excedido; 409 por zona sold-out; exito conserva el comportamiento actual
  (insert + update de session id + url); reemplazo de pendientes del mismo email y `expire` best-effort (rechazo no
  propaga); Stripe `create` falla => update a `cancelled` y rethrow. Los tests existentes (404, 400 sin asientos,
  asiento invalido) siguen pasando.
- `use-event-availability.test.ts`: devuelve `null`/layout base antes de resolver, aplica el snapshot al resolver,
  error de red no lanza, refetch en `focus`.
- No automatizable sin DB (verificacion manual documentada): dos `curl` simultaneos al mismo asiento => 200 + 409;
  `SELECT ... FROM orders` tras 31 min para confirmar que el asiento vuelve a estar libre.

## Tareas
### T1 — Indice, migracion y constantes de reserva
- Archivos: `src/modules/order/db/order.table.ts`, `drizzle/0005_*.sql`, `drizzle/meta/_journal.json`,
  `drizzle/meta/0005_snapshot.json`, `src/modules/order/constants/order.constants.ts`
- Depende de: —
- Paralelizable: si (con T2)
- Cubre: AC11 (y habilita AC1, AC5)

### T2 — Capacidad y fusion de disponibilidad (puro)
- Archivos: `src/modules/ticket/types/ticket.types.ts`, `src/modules/ticket/utils/ticket.utils.ts`,
  `src/modules/ticket/utils/ticket.utils.test.ts`, `src/modules/ticket/index.ts`
- Depende de: —
- Paralelizable: si (con T1)
- Cubre: AC9

### T3 — Servicio y endpoint de lectura de disponibilidad
- Archivos: `src/modules/order/services/availability.service.ts`,
  `src/modules/order/services/availability.service.test.ts`, `src/app/api/events/[slug]/availability/route.ts`
- Depende de: T1, T2
- Paralelizable: no
- Cubre: AC1, AC5, AC8

### T4 — Anti-sobreventa en `createCheckoutSession`
- Archivos: `src/modules/order/services/checkout.service.ts`, `src/modules/order/services/checkout.service.test.ts`,
  `src/app/api/checkout/session/route.ts`, `docs/SYSTEM_DESIGN.md`
- Depende de: T1, T2, T3 (reutiliza `getTakenInventory` dentro de la transaccion)
- Paralelizable: no
- Cubre: AC2, AC3, AC4, AC5, AC6, AC7, AC11

### T5 — Cliente: pintar asientos ocupados y cupos
- Archivos: `src/modules/ticket/services/availability.service.ts`, `src/modules/ticket/hooks/use-event-availability.ts`,
  `src/modules/ticket/hooks/use-event-availability.test.ts`, `src/modules/ticket/components/ticket-selection.tsx`
- Depende de: T2, T3 (contrato del endpoint)
- Paralelizable: si (con T4; archivos disjuntos)
- Cubre: AC10

Nota de orden: T1 y T2 en paralelo -> T3 -> T4 y T5 en paralelo. `src/modules/ticket/index.ts` pertenece solo a T2.

## Preguntas abiertas
1. **Capacidad de zonas generales**: default = 500 (`SEED_GENERAL_ZONE_STOCK`, valor arbitrario del seed 025).
   ¿Hay capacidades reales por zona antes de P1-06? Si si, se agregarian al mock de venue (cambio pequeño en T2).
2. **Ventana de reserva**: default = 31 min (30 de Stripe + 60 s). ¿Se prefiere reservar menos tiempo (p. ej. 10 min,
   alineado con `hold-timer-notice`)? Exigiria cancelar tambien la session de Stripe a los 10 min (job o
   `expire` al re-intentar) porque Stripe no permite menos de 30 min; se deja fuera por complejidad.
3. **Pago sobre orden ya `cancelled`** (p. ej. `expire` de Stripe fallo al reemplazar la pendiente y el usuario
   pago igual): hoy `applySessionStatus` ignora `cancelled` y el cobro quedaria sin tickets. Default: riesgo
   aceptado (probabilidad baja: requiere fallo de `expire`); reembolso/alerta queda como tarea de Pagos.
4. **Hold temprano**: ¿se quiere reservar al entrar al checkout (antes de rellenar datos) para que el contador de
   600 s sea real? Default: no, solo se reserva al pagar (POST).
5. **Eventos del panel (localStorage)**: siguen sin inventario de servidor hasta que P1-06/organizador los
   persista en DB. ¿Aceptado?
6. **Asiento ya elegido que otro compra mientras tanto**: default = el servidor devuelve 409 y el mensaje pide
   volver a elegir; el store local no se limpia automaticamente (el refetch al enfocar lo pinta ocupado). ¿Se quiere
   auto-quitarlo de la seleccion?

## Proximas fases
- P1-06: capacidad desde `ticket_tiers.total_stock`; `order_items` + `orders.event_id`; `tickets.order_item_id`;
  ventanas de venta por tier.
- Hold temprano real + contador servidor-sincronizado; reserva por asiento con unique parcial si la contencion
  por evento lo exige.
- Actualizacion en tiempo real del mapa (SSE/polling) y reembolso automatico en pago tardio.

## Log de review
- Iteracion 1 — PASS. vitest order/ + ticket/ (124) y tsc OK. Pendiente manual: db:migrate (0005), 2 POST simultaneos mismo asiento (200+409), reserva libre tras 31 min. Nota: ticket/index.ts ya exportaba tickets (drizzle pg-core en bundle cliente, preexistente).
