# 034 — "Mis entradas" desde la DB (retirar order.store mock)

Estado: implementada (pendiente AC2/AC6/AC8 manual)

## Estado
- Aprobacion humana: aprobada (2026-10-08, 5 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P1-05.

## Objetivo
Que `/my-tickets` muestre las ordenes **pagadas del usuario autenticado leidas de la DB** (servidor), y no el historial
de `localStorage` (`useOrderStore`) mas pedidos de ejemplo (`getDemoOrders`). Se elimina el store y el puente
`saveOrder` de la confirmacion. Referencias: `013-my-tickets.md` (UI, se conserva), `023` (puente `saveOrder`, se
retira; nota de review: `accountEmail` salia del store legacy), `026` (el proxy ya exige sesion en `/my-tickets`),
`032` (tickets/`qr_code` en DB), `033` (catalogo aun en `EVENTS_MOCK`), `SYSTEM_DESIGN.md` (Base de datos / Auth).

## Hallazgos (verificado en codigo)
- `my-tickets.tsx` es `"use client"`: `useCurrentUser()` (Clerk) para el guard (`router.replace` al login),
  `useOrderStore` (localStorage `ticketera-orders`) y `getDemoOrders(user)` (3 pedidos fijos, uno con evento
  `past-1` fuera del catalogo). `?order=` se lee con `useSearchParams` (por eso la page usa `<Suspense>`).
- `order-confirmation.tsx` (cliente) lee `useAuthStore` (store legacy de la spec 016, no Clerk) solo para
  `accountEmail`, y en un `useEffect` llama `saveOrder(order)` (idempotente por `number`).
- `Order.accountEmail` solo lo consumen `toOrderFromRecord`, `getUserOrders` y `getCheckoutPrefill`; con DB deja de
  hacer falta (el dueno es `orders.user_id`).
- **`checkout-form.tsx` tambien depende del store**: `getCheckoutPrefill(authStore.user, useOrderStore.getState().orders)`
  toma documento y celular del ultimo pedido local. Borrar el store obliga a tocarlo (ver Decision 6).
- `orders.user_id` (uuid, FK `users.id`, nullable, indice `orders_user_id_idx`) ya existe. `createCheckoutSession`
  lo llena con `findUserIdByClerkId(clerkUserId)` (`checkout.service.ts`); queda `NULL` si no hay sesion o si la fila
  `users` aun no existe (webhook de Clerk no sincronizado). `/events/*/checkout` esta tras el proxy (026), asi que
  las compras nuevas siempre llegan con sesion.
- `getCurrentDbUser()` (`@/modules/user`) devuelve el `UserEntity` activo (`deletedAt IS NULL`) o `null`;
  `requireRole(allowed)` redirige a `/login` o `/` y se usa para areas con rol. Aqui basta cualquier usuario.
- Un `OrderRecord` `paid` siempre tiene filas en `tickets` (032, idempotente) y `qr_code` se genera con
  `getOrderTickets` (`toTicketRows`), el mismo que usa el visor => `getOrderTickets(order)` produce exactamente los
  codigos guardados.
- `Order.event` se arma con `toOrderEventSnapshot(EventEntity)`; hoy el unico origen de `EventEntity` es
  `getEventBySlug(EVENTS_MOCK, slug)`. `orders.event_id` es `NULL` (P1-06 pendiente).
- Eventos del panel (localStorage) no pasan por `createCheckoutSession` (404), asi que **no hay ordenes pagadas de
  ellos**; las unicas ordenes cuyo slug no esta en el mock serian de un evento retirado del catalogo/seed
  (p. ej. si se cambia el mock).
- Next 16: `PageProps<"/my-tickets">` con `searchParams` como `Promise` (mismo patron que la page de confirmacion).

## Decisiones
1. **Vinculo usuario-orden = `orders.user_id`**, sin columnas nuevas. `listUserOrders(userId)` filtra
   `user_id = $1 AND status = 'paid'`, orden `created_at DESC`. Pendientes/fallidas/canceladas no son entradas.
2. **Servicio recibe `userId` (uuid) y no resuelve la sesion**: la page llama `getCurrentDbUser()`; asi el servicio es
   testeable con DB mockeada y la autorizacion queda en un solo lugar. Ningun parametro de la URL decide de quien son
   las ordenes (no se puede ver ordenes ajenas).
3. **Ordenes de invitado / previas al login: sin backfill.** Justificacion: (a) `buyer.email` es texto libre del
   formulario, **no verificado**; asignar o mostrar ordenes por coincidencia de email permitiria ver entradas de otra
   persona (vector de fuga), mientras que el email de Clerk si esta verificado pero emparejarlo con `buyer.email`
   sigue siendo heuristica; (b) desde la spec 026 el checkout exige sesion, asi que las ordenes con `user_id NULL`
   solo pueden ser datos de desarrollo o de la ventana de carrera con el webhook de Clerk; (c) el historial local
   (`ticketera-orders`) era una copia de ordenes que ya estan en DB: con `user_id` poblado reaparecen solas. Un
   backfill puntual, si se quisiera, es un script SQL manual (`UPDATE orders SET user_id = u.id FROM users u WHERE
   orders.user_id IS NULL AND lower(orders.buyer->>'email') = lower(u.email)`), fuera de esta spec.
4. **Tickets**: no se agrega JOIN a `tickets` en esta fase. Los codigos/asientos que muestra el visor salen de
   `getOrderTickets(order)` (identicos a `tickets.qr_code`, ver Hallazgos) y la UI aun no muestra estado
   `used/cancelled` (013 lo excluyo). Cuando exista validacion de ingreso, se lee `tickets` (pregunta abierta 2).
5. **Mapeo** (funcion pura en `order.utils.ts`): `toUserOrders(records, events)` => `{ orders: Order[], unavailableCount }`;
   por registro busca `getEventBySlug(events, record.eventSlug)`; si existe, `toOrderFromRecord(record, event)`; si
   no, lo cuenta en `unavailableCount` (no inventa fecha/lugar). La UI muestra un aviso
   "N compras de eventos que ya no estan disponibles. Escribenos y te ayudamos." Degradar sin crashear > mostrar un
   evento falso que se clasificaria mal en Proximas/Pasadas.
6. **Prefill del checkout**: `getCheckoutPrefill(user)` rellena solo nombre y correo; se pierde documento/celular del
   ultimo pedido (venian del store local). Es una regresion consciente; recuperarlo desde DB es una tarea aparte
   (pregunta abierta 3). `checkout-form.tsx` deja de importar el store; su fuente de `user` (`useAuthStore`) no se
   toca aqui.
7. **`accountEmail` se elimina de `Order`** (YAGNI): ya no hay quien lo lea. Con eso `order-confirmation.tsx` no
   necesita auth: se retira `useAuthStore` (cumple la nota de review de 023 por eliminacion, no migrando a
   `useCurrentUser`). Sigue haciendo `resetSelection()` de la seleccion de tickets al pagar.
8. **Page server component**: `/my-tickets/page.tsx` es `async`, llama `getCurrentDbUser()` y
   `listUserOrders(user.id)`, mapea con `toUserOrders(records, EVENTS_MOCK)` y renderiza `<MyTickets orders
   unavailableCount initialOrderNumber />`. `?order=` se lee de `searchParams` en el servidor (sin `useSearchParams`
   ni `<Suspense>`). Sin `user` en DB (sesion valida pero fila `users` aun no sincronizada) => lista vacia (no
   redirect, para no hacer bucle con el login). El guard cliente se retira: lo cubre el proxy (026).
9. `MyTickets` conserva solo estado de UI: tab, orden seleccionada, `splitOrdersByTime`, `OrderList`,
   `OrderTicketViewer` (sin cambios). Props por serializacion RSC: `Order` es JSON plano (fechas como ISO string).
10. Sin paginacion ni cache (YAGNI): un usuario tiene pocas ordenes; la page es dinamica por `auth()`. Se importa el
    servicio por ruta directa (`@/modules/order/services/...`), no por el barrel (arrastraria `db`/`stripe` al
    bundle cliente), igual que la page de confirmacion.
11. El localStorage `ticketera-orders` existente queda huerfano en navegadores; no se migra ni se limpia (datos
    ya duplicados en DB o de demo).

## Alcance
- Incluye: `listUserOrders`; mapeo `toUserOrders`; page server con datos reales y `?order=`; `MyTickets` presentacional
  con aviso de eventos no disponibles; borrar `order.store.ts`, `getDemoOrders`, `getUserOrders`, `accountEmail`;
  retirar el puente `saveOrder` y `useAuthStore` de `order-confirmation.tsx`; ajustar `checkout-form.tsx` y el barrel;
  tests.
- No incluye (se difiere):
  - Backfill de ordenes sin `user_id` (script manual, Decision 3).
  - Leer `tickets` (estado `used/cancelled`, check-in), QR real, PDF real (siguen decorativos, 013).
  - Eventos desde DB (`events`/`order_items`/`orders.event_id`): P1-06.
  - Prefill de documento/celular desde ordenes en DB.
  - Paginacion, polling o refresco en vivo tras el pago.
  - Migrar `useAuthStore` (legacy 016) y su uso en `checkout-form.tsx`/`event-form.tsx`.

## Reutilizar
- `getCurrentDbUser` (`@/modules/user`), `orders`/`OrderRecord` (`order.table.ts`), `db` (`@/lib/db`).
- `toOrderFromRecord`, `getOrderTickets`, `splitOrdersByTime`, `getOrderNumber`, `toOrderEventSnapshot`
  (`order.utils.ts`); `EVENTS_MOCK`, `getEventBySlug` (`@/modules/event`).
- `OrderList`, `OrderTicketViewer`, `EmptyState`, `getEventSearchHref`, `MY_TICKETS_PATH` sin cambios.
- Patron de page con `PageProps<...>` + servicio por ruta directa: `events/[slug]/confirmation/page.tsx`.
- Patron de test con `db` mockeado: `availability.service.test.ts` / `checkout.service.test.ts`.
- Guia Next 16 de `page` (`searchParams` Promise): `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/order/services/user-orders.service.ts` | `listUserOrders(userId): Promise<OrderRecord[]>` (paid, created_at desc) |
| `src/modules/order/services/user-orders.service.test.ts` | tests |
| `src/modules/order/types/order.types.ts` | quita `accountEmail` de `Order` |
| `src/modules/order/utils/order.utils.ts` | `toOrderFromRecord(record, event)` sin `accountEmail`; agrega `toUserOrders`; `getCheckoutPrefill(user)`; elimina `getUserOrders` |
| `src/modules/order/utils/order.utils.test.ts` | actualiza/agrega tests |
| `src/app/(main)/my-tickets/page.tsx` | async server: usuario + ordenes + `searchParams`; sin `Suspense` |
| `src/modules/order/components/my-tickets.tsx` | props `orders`, `unavailableCount`, `initialOrderNumber`; sin Clerk/store/router |
| `src/modules/order/components/my-tickets.test.tsx` | reescrito para props |
| `src/modules/order/store/order.store.ts` + `order.store.test.ts` | **borrar** |
| `src/modules/order/mocks/order.mock.ts` | **borrar** |
| `src/modules/order/components/order-confirmation.tsx` | sin `useOrderStore`/`useAuthStore`/`saveOrder`; `toOrderFromRecord(record, event)` |
| `src/modules/order/components/checkout-form.tsx` | `getCheckoutPrefill(user)` sin store |
| `src/modules/order/index.ts` | quita export de `useOrderStore`/`OrderState` |
| `docs/SYSTEM_DESIGN.md` | agregar `034` a la fila correspondiente |

## Criterios de aceptacion
- AC1: `listUserOrders(userId)` devuelve solo ordenes con `user_id = userId` y `status = 'paid'`, ordenadas por
  `created_at` descendente; ordenes de otro usuario, con `user_id NULL`, `pending`, `failed` o `cancelled` no salen
  (verificado por la forma del `where` mockeado y/o por orden/filtrado).
- AC2: `/my-tickets` es un server component: obtiene el usuario con `getCurrentDbUser()` y las ordenes con
  `listUserOrders(user.id)`; el `userId` nunca proviene de la URL/props del cliente. Sin fila `users` => lista vacia,
  sin error ni redirect.
- AC3: `toUserOrders` mapea cada registro cuyo slug existe en el catalogo a un `Order` con `number = TK-<8 hex>`,
  `event` snapshot, `buyer`, `lines`, `total` numerico y `createdAt` ISO; los de slug desconocido no aparecen en
  `orders` y suman a `unavailableCount`.
- AC4: `MyTickets` muestra las tabs "Proximas (n)" / "Pasadas (n)" con `splitOrdersByTime`, el visor y las acciones
  como hoy (013); `initialOrderNumber` preselecciona la orden y abre la tab "Pasadas" si corresponde; estados vacios
  por tab; si `unavailableCount > 0` muestra el aviso con el conteo.
- AC5: no quedan referencias a `useOrderStore`, `getDemoOrders`, `getUserOrders`, `accountEmail`, `saveOrder` ni
  `ticketera-orders` en `src/` (`grep` limpio); `order.store.ts`, su test y `order.mock.ts` no existen.
- AC6: la confirmacion de compra sigue mostrando el pedido pagado y limpia la seleccion de tickets del evento
  (`resetSelection`), sin escribir en localStorage; el enlace "Ver mis entradas" (`?order=<number>`) abre
  `/my-tickets` con esa orden seleccionada (el numero coincide con `getOrderNumber(record.id)`).
- AC7: `getCheckoutPrefill(user)` devuelve `{}` sin usuario y `{ fullName, email }` con usuario; `checkout-form.tsx`
  compila y se autocompleta nombre/correo.
- AC8: `tsc`, `eslint` y `vitest` pasan. Verificacion manual: con una compra pagada de prueba, `/my-tickets`
  la lista tras recargar y desde otro navegador con la misma cuenta; otra cuenta no la ve.

## Tests requeridos
(Vitest, junto al archivo)
- `user-orders.service.test.ts` (db mockeado): consulta con filtro `user_id` + `paid` y orden descendente; lista
  vacia => `[]`; devuelve los registros tal cual.
- `order.utils.test.ts`: `toOrderFromRecord` sin `accountEmail` (actualizar el test existente); `toUserOrders`
  (mapea conocido, cuenta desconocido, vacio, preserva el orden de entrada); `getCheckoutPrefill` (sin usuario `{}`,
  con usuario nombre+correo); eliminar los tests de `getUserOrders` y de prefill con pedidos.
- `my-tickets.test.tsx` (props, sin mock de Clerk/router): tabs y contadores con ordenes futuras/pasadas, primera
  entrada visible, `initialOrderNumber` preselecciona (incluida una pasada => tab "Pasadas"), cambio de tab, estado
  vacio con enlace a explorar, aviso de `unavailableCount`.
- No automatizable sin DB/Clerk (manual): AC2 (sesion real) y AC8.

## Tareas
### T1 — Servicio `listUserOrders`
- Archivos: `src/modules/order/services/user-orders.service.ts`, `src/modules/order/services/user-orders.service.test.ts`
- Depende de: —
- Paralelizable: si (con T2)
- Cubre: AC1

### T2 — Tipos y utils (mapeo y prefill)
- Archivos: `src/modules/order/types/order.types.ts`, `src/modules/order/utils/order.utils.ts`,
  `src/modules/order/utils/order.utils.test.ts`
- Depende de: —
- Paralelizable: si (con T1)
- Cubre: AC3, AC7 (parte pura)
- Nota: tras T2 quedan rotos temporalmente los llamadores de `toOrderFromRecord`/`getCheckoutPrefill`/`getUserOrders`
  (los arregla T3/T4); no correr `tsc` global hasta T4.

### T3 — Page server y `MyTickets` presentacional
- Archivos: `src/app/(main)/my-tickets/page.tsx`, `src/modules/order/components/my-tickets.tsx`,
  `src/modules/order/components/my-tickets.test.tsx`
- Depende de: T1, T2
- Paralelizable: no
- Cubre: AC2, AC4

### T4 — Retirar store, mock y puente; docs
- Archivos: `src/modules/order/store/order.store.ts`, `src/modules/order/store/order.store.test.ts`,
  `src/modules/order/mocks/order.mock.ts` (borrar), `src/modules/order/components/order-confirmation.tsx`,
  `src/modules/order/components/checkout-form.tsx`, `src/modules/order/index.ts`, `docs/SYSTEM_DESIGN.md`
- Depende de: T2, T3 (T3 deja de importar store y mock)
- Paralelizable: no
- Cubre: AC5, AC6, AC7 (integracion), AC8

Orden: T1 y T2 en paralelo -> T3 -> T4. Cada archivo pertenece a una sola tarea.

## Preguntas abiertas
1. **Ordenes de eventos fuera del catalogo** (`unavailableCount`): default = aviso con conteo, sin mostrar la
   entrada. Alternativa: tarjeta degradada con titulo derivado del slug y fecha `createdAt` (queda en "Pasadas", sin
   imagen). ¿Se prefiere la alternativa? Hoy no hay casos reales (ver Hallazgos), asi que el impacto es bajo.
2. **Leer `tickets` de DB**: default = no (codigos identicos por construccion, 032). Se reabre cuando haya check-in o
   tickets `cancelled`; ¿o se quiere ya como fuente unica de codigos/asientos?
3. **Perdida del prefill de documento/celular** al borrar el store: default = aceptada (solo nombre y correo).
   ¿Se abre tarea para prefill desde la ultima orden en DB (server) o desde `users.phone`?
4. **Carrera con el webhook de Clerk**: si la fila `users` aun no existe al pagar, la orden queda con `user_id NULL`
   y el comprador no la vera en Mis entradas (solo le queda el correo). Default: riesgo aceptado (el sync ocurre al
   registrarse, mucho antes de comprar). ¿Se quiere que `createCheckoutSession` cree/sincronice el usuario si falta?
5. **Backfill** de ordenes con `user_id NULL`: default = ninguno (Decision 3). ¿Se corre el UPDATE manual por email en
   la DB actual de desarrollo?

## Proximas fases
- P1-06: catalogo/eventos en DB (`orders.event_id`, `order_items`); `toUserOrders` pasa a unir `events` y el
  snapshot sale de DB, eliminando el caso `unavailableCount`.
- Estado de tickets (`used/cancelled`), QR real y PDF real; prefill del checkout desde DB; paginacion si el volumen lo pide.

## Log de review
- Iteracion 1 — PASS. vitest order/ (82) y tsc OK. Pendiente manual: AC2 (sesion real, con y sin fila users), AC6 (boton "Ver mis entradas" tras pago real), AC8 (compra pagada visible tras recargar y en otro navegador; otra cuenta no la ve; ?order= ajeno no la muestra). Nota: aserción negativa de accountEmail en order.utils.test.ts:123 deja una coincidencia en el grep de AC5 (intencional).
