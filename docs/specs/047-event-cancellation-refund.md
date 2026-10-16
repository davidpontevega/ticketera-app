# 047 — Cancelacion de evento con reembolso masivo + politica de reembolsos

Estado: aprobada

## Estado
- Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Hoy cancelar un evento (`changeEventStatusAction` -> `changeEventStatus`) solo cambia `events.status` a `cancelled`: el
dinero de los compradores no vuelve. Esta spec hace que **cancelar un evento reembolse por completo todas sus ordenes
`paid`** reutilizando el reembolso por orden de la spec 041 (Stripe primero, DB despues, idempotente, con reversa de
Connect de la 042), da una accion de **reintento** para lo que falle, y publica la pagina publica **`/refund-policy`**.
Referencias: `041` (nucleo de reembolso por orden, ya implementado), `042` (destination charge: `reverse_transfer` +
`refund_application_fee` ya contemplado), `033` (lock por slug / inventario derivado de ordenes), `040` (check-in
exige orden `paid`). Referencia del profesor (solo lectura, NO copiada): worktree `cancelacion-evento-reembolso`
(tablas `refund`/`refund_ticket`, webhook `refund.*`, 48 h de ventana); aqui se descarta casi todo (YAGNI, Decisiones 1-2).

## Hallazgos (verificado en codigo)
- Ya existe todo el nucleo: `refundOrder` (`organizer-refund.service.ts`) hace guardas + `stripe.refunds.create` con
  clave `refund-order-<orderId>` (+ `reverse_transfer`/`refund_application_fee` si `platformFeeAmount !== null`) +
  `applyOrderRefund` (transaccion idempotente, orden -> `refunded`, tickets `valid` -> `cancelled`, `used` intactos).
  `charge_already_refunded` se trata como exito. **No hace falta migracion ni tabla nueva**: `orders` ya tiene
  `refunded_at/by`, `stripe_refund_id` y `order_status.refunded`.
- El webhook `charge.refunded` (041) ya reconcilia la DB si el paso transaccional falla tras reembolsar. Sin cambios.
- Cancelar hoy: `changeEventStatus` valida la transicion (`getEventStatusChangeError`) y hace CAS
  `status = <leido>`. Un evento `cancelled` ya no se puede comprar (`getPublishedEvent` exige `published`) y
  `getEventForEdit` lo excluye (`ne(events.status, "cancelled")`).
- **Bug existente (041)**: `organizer-event-list.tsx` muestra "Ordenes" tambien en eventos `cancelled`, pero la pagina
  `/organizer/events/[id]/orders` usa `getEventForEdit` => `notFound()` en cancelados. Este flujo necesita esa pagina
  (reintento), asi que se corrige aqui.
- `refund.actions.ts` (041) revalida orders/check-in/`ORGANIZER_PATH` al reembolsar una orden.
- `SiteFooter` (`components/shared/site-footer.tsx`) tiene los links como `string` con `href="#"`; el layout
  `(main)` ya aporta header + footer, y `/refund-policy` es publica sin tocar el proxy (solo protege `/organizer`,
  `/admin`, etc.).
- No hay emails propios ni "Mis entradas" muestra ordenes reembolsadas (041, Decisiones 7 y 9).

## Decisiones
1. **Sin tabla `refunds`**: la cancelacion reembolsa orden por orden con el mismo mecanismo de 041; el estado vive en
   `orders.status`. Un `refund` por orden/webhook `refund.*` se justifica solo con reembolso parcial (fuera de alcance).
2. **Cancelar = dos pasos, el segundo re-ejecutable**: (A) cancelar el evento con `changeEventStatus` (validacion y CAS
   existentes; corta la venta al instante); (B) reembolsar en serie cada orden `paid` del evento. Si B falla en
   algunas, **la cancelacion sigue valida** y se reintenta solo lo que falta. Cancelar primero (no reembolsar primero)
   evita que entren compras nuevas mientras se reembolsa.
3. **Nucleo compartido, sin duplicar**: se extrae de `refundOrder` la funcion interna `refundPaidOrder(orderId,
   refundedBy, platformFeeAmount, paymentIntentId, sessionId)` (resolucion de payment_intent + Stripe + `applyOrderRefund`)
   y `refundOrder` (boton por orden, con guardas y `has-used-tickets`) pasa a usarla. La cancelacion la llama directo.
4. **Tickets `used` NO bloquean la cancelacion masiva**: el evento se cancelo, todas las ordenes `paid` se reembolsan;
   `applyOrderRefund` conserva los `used` como historial (041). El bloqueo `has-used-tickets` queda solo para el
   boton por orden de un evento vigente.
5. **Orquestacion**: nueva `cancelEventWithRefunds(input, viewer)` en `organizer-event-cancel.service.ts` (`server-only`):
   llama `changeEventStatus({ eventId, status: "cancelled" })`; si `ok`, `refundEventOrders(eventId, viewer)` y devuelve
   `{ ok: true, refunds: { total, refunded, failed } }`. `refundEventOrders` lista las ordenes `paid` del evento
   (join por slug + `getEventScope`, igual que 041), las procesa **en serie**, y un fallo en una **no corta** las demas
   (se cuenta como `failed`, `console.error` sin datos personales). Es idempotente (clave Stripe por orden +
   `status='paid'` en el WHERE): sirve tambien como **reintento** (`retryEventRefunds`: valida scope y que el evento este
   `cancelled`, y llama a `refundEventOrders`). ponytail: serie sin cola; techo = decenas/cientos de ordenes por
   request (limite del timeout del server action); pasar a job en segundo plano si se supera.
6. **Cancelar no se puede saltar el reembolso**: `changeEventStatusAction` con `status === "cancelled"` delega en
   `cancelEventWithRefunds` en vez de `changeEventStatus`. `changeEventStatus` no se modifica (otros estados intactos).
   El resultado exitoso lleva el resumen en `message` ("Evento cancelado. Reembolsadas N de M..." y, si hay fallos,
   "K fallaron: reintentalas desde Ordenes").
7. **Reintento**: `retryEventRefundsAction` (action con `useActionState`, patron de 040/041) y boton "Reintentar
   reembolsos" en la pagina de ordenes de un evento `cancelled`, visible solo si quedan ordenes `paid`. `viewer` siempre
   del servidor.
8. **Pagina de ordenes para cancelados**: nueva consulta `getEventHeaderForOrders(eventId, viewer)` (nombre + estado, con
   scope, **incluye** cancelados) en `organizer-refund.service.ts`; la pagina deja de usar `getEventForEdit`. Se conserva
   `notFound()` para id no uuid o evento inexistente/ajeno.
9. **Ordenes `pending` al cancelar**: no se tocan (default). Si una compra en curso se confirma despues de cancelar,
   queda `paid` y la recoge el reintento. Ver pregunta 2.
10. **Pagina `/refund-policy`**: contenido **estatico, de servidor, en espanol**, que describe solo lo que existe hoy:
    evento cancelado => reembolso del 100 % de lo pagado, **automatico**, a la forma de pago original (plazo de
    acreditacion segun banco, tipicamente 5-10 dias habiles; el developer lo contrasta con docs.stripe.com/refunds);
    evento reprogramado => la entrada sigue valida; casos que **no** se reembolsan (extravio, no asistencia, entradas
    usadas en puerta). **No** promete ventana de solicitud ni reembolso a pedido (no existen; el profesor si los
    menciona) -- una linea indica que esa solicitud aun no esta disponible. Texto propio, no copiado.
11. **Ubicacion**: contenido en `src/modules/order/components/refund-policy.tsx` (dominio de pagos/ordenes; **no** se crea
    modulo `refund` para un componente estatico) y ruta `src/app/(main)/refund-policy/page.tsx` (solo routing +
    `metadata`; header/footer vienen del layout `(main)`). El footer pasa los links de `string` a `{ label, href }`;
    "Politica de reembolsos" apunta a `/refund-policy` en la columna "Legal"; los demas conservan `href="#"`.
12. **Config Stripe**: sin cambios (no se usan webhooks `refund.*`; 041 ya cubre `charge.refunded`).

## Alcance
- Incluye: refactor de `refundOrder` para extraer `refundPaidOrder`; `refundEventOrders`, `cancelEventWithRefunds`,
  `retryEventRefunds`; `getEventHeaderForOrders`; cancelacion con reembolso desde la accion existente; accion y boton de
  reintento; correccion de la pagina de ordenes para eventos cancelados; copy del dialogo de cancelar; pagina y
  componente `/refund-policy` + link en el footer; tests.
- No incluye (se difiere):
  - Tabla `refunds`/`refund_ticket`, webhooks `refund.created|updated|failed`, estados `pending` de reembolso.
  - Reembolso a pedido del comprador, parcial o por entrada; ventana de solicitud (48 h del profesor).
  - Email propio a compradores (solo el recibo de Stripe, como 041); mostrar ordenes reembolsadas en "Mis entradas".
  - Cola/job en segundo plano o paginacion para eventos con muchisimas ordenes.
  - Cancelar/expirar ordenes `pending`; reembolso automatico de pagos confirmados tarde (los recoge el reintento manual).
  - Reprogramar eventos (la politica solo lo menciona).
  - Cambios en proxy, esquema de DB, `charge.refunded` o `applyOrderRefund`.

## Reutilizar
- `refundOrder`, `listEventOrders`, `ALREADY_REFUNDED_CODE`/`errorCode` (`organizer-refund.service.ts`);
  `applyOrderRefund` (`order/services/refund.service.ts`); `getEventScope`, `EventAdminViewer`, `changeEventStatus`
  (`organizer-event-admin.service.ts`); `getOrganizerOrdersPath`, `ORGANIZER_PATH`, `getOrganizerCheckInPath`.
- `changeEventStatusAction` y `EventAdminActionState` (`organizer-event.actions.ts`, `organizer.types.ts`);
  `refund.actions.ts` y `RefundActionState` (patron action + `revalidatePath`).
- `OrganizerEventActions` (dialogo de cancelar), `EventOrdersTable`, `EmptyState`, `Button`, `Dialog` (ya instalados).
- Layout `(main)`, `SiteFooter`. Tests de referencia: `organizer-refund.service.test.ts`,
  `refund.actions.test.ts`, `organizer-event.actions.test.ts`, `event-orders-table.test.tsx`.
- shadcn: no se necesita nada nuevo.

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/organizer/services/organizer-refund.service.ts` | extrae `refundPaidOrder`; `refundOrder` la usa; agrega `refundEventOrders`, `getEventHeaderForOrders` |
| `src/modules/organizer/services/organizer-refund.service.test.ts` | tests de lo anterior (sin romper los de 041) |
| `src/modules/organizer/services/organizer-event-cancel.service.ts` | nuevo: `cancelEventWithRefunds`, `retryEventRefunds` (`server-only`) |
| `src/modules/organizer/services/organizer-event-cancel.service.test.ts` | nuevo |
| `src/modules/organizer/types/refund.types.ts` | `EventRefundSummary`, `CancelEventResult`, `RetryRefundsActionState` |
| `src/modules/organizer/actions/organizer-event.actions.ts` | `changeEventStatusAction` delega en `cancelEventWithRefunds` si `status === "cancelled"` |
| `src/modules/organizer/actions/organizer-event.actions.test.ts` | casos de cancelacion |
| `src/modules/organizer/actions/refund.actions.ts` | agrega `retryEventRefundsAction` |
| `src/modules/organizer/actions/refund.actions.test.ts` | casos del reintento |
| `src/modules/organizer/components/organizer-event-actions.tsx` | copy del dialogo de cancelar (reembolso automatico) |
| `src/modules/organizer/components/retry-refunds-button.tsx` | nuevo (cliente, `useActionState`) |
| `src/modules/organizer/components/retry-refunds-button.test.tsx` | nuevo |
| `src/modules/organizer/schemas/refund.schema.ts` | `retryEventRefundsSchema` (`eventId` uuid) |
| `src/modules/organizer/schemas/refund.schema.test.ts` | caso nuevo |
| `src/modules/organizer/index.ts` | exporta `RetryRefundsButton` |
| `src/app/(organizer)/organizer/events/[id]/orders/page.tsx` | usa `getEventHeaderForOrders`; muestra `RetryRefundsButton` si `cancelled` y hay `paid` |
| `src/modules/order/components/refund-policy.tsx` | nuevo, estatico (servidor) |
| `src/modules/order/index.ts` | exporta `RefundPolicy` |
| `src/app/(main)/refund-policy/page.tsx` | nuevo, solo routing + `metadata` |
| `src/components/shared/site-footer.tsx` | links `{ label, href }`; "Politica de reembolsos" -> `/refund-policy` |

## Criterios de aceptacion
- AC1: `cancelEventWithRefunds` sobre evento en scope con N ordenes `paid` cancela el evento (via `changeEventStatus`) y
  llama a `stripe.refunds.create` **una vez por orden**, con clave `refund-order-<orderId>` y **sin `amount`**
  (y con `reverse_transfer`/`refund_application_fee` solo si `platformFeeAmount !== null`); cada orden queda `refunded`
  con `refunded_by = viewer.id` y sus tickets `valid` en `cancelled`. Devuelve `{ ok: true, refunds: { total: N,
  refunded: N, failed: 0 } }`.
- AC2: si `changeEventStatus` falla (`not-found`, transicion invalida, evento ajeno para organizer) **no se llama a
  Stripe** y se propaga el error. Un evento sin ordenes `paid` se cancela con `total: 0`.
- AC3: un fallo de Stripe (o de `applyOrderRefund`) en una orden no corta las demas: se cuenta en `failed`, las otras se
  reembolsan, el evento queda `cancelled` y el resultado es `ok: true`. `charge_already_refunded` cuenta como `refunded`.
- AC4: tickets `used` no bloquean: la orden se reembolsa y los `used` permanecen `used`.
- AC5: `retryEventRefunds` solo actua sobre evento `cancelled` en scope (organizer ajeno, evento no cancelado o
  inexistente => `not-found`, sin Stripe); reembolsa solo las ordenes que siguen `paid` y es idempotente (segunda
  ejecucion: `total: 0`).
- AC6: `refundOrder` (boton por orden de 041) mantiene su comportamiento y resultados (`refunded`, `not-found`,
  `not-refundable`, `has-used-tickets`, `stripe-error`); sus tests de 041 siguen pasando sin cambios de asercion.
- AC7: `changeEventStatusAction` con `status: "cancelled"` usa `cancelEventWithRefunds` (nunca solo `changeEventStatus`)
  y devuelve `success` con el resumen en `message` (menciona cuantas se reembolsaron y, si hay fallos, cuantas fallaron
  y que se reintentan desde Ordenes); con otros estados el comportamiento no cambia. Revalida `ORGANIZER_PATH`, orders y
  check-in del evento.
- AC8: `retryEventRefundsAction` usa `requireRole(ORGANIZER_AREA_ROLES)`, valida `eventId` con zod (invalido =>
  `error`, sin servicio), toma el `viewer` de la sesion (nunca del `FormData`) y revalida orders + `ORGANIZER_PATH`.
- AC9: autorizacion: `customer`/sin sesion no accede; organizer solo cancela/reembolsa/reintenta eventos con
  `organizer_id = su id`; admin/super_admin cualquiera.
- AC10: la pagina de ordenes `/organizer/events/[id]/orders` ya **no** hace `notFound()` en un evento `cancelled`
  propio; sigue haciendo `notFound()` con id no uuid o evento inexistente/ajeno. En `cancelled` con ordenes `paid`
  muestra "Reintentar reembolsos"; sin ordenes `paid` no lo muestra. El boton se deshabilita en `isPending` y muestra
  el resultado (`role="status"`): reembolsadas / fallaron / nada pendiente / error.
- AC11: el dialogo de cancelar ya no dice que "luego solo podra eliminarse" sin mas: informa que se reembolsara
  automaticamente a los compradores y que no se puede revertir.
- AC12: `/refund-policy` carga **sin sesion** (200, bajo el layout `(main)`), tiene `metadata.title`, `<h1>` y las
  secciones de Decision 10 en espanol, no contiene logica ni afirma una ventana de solicitud ni reembolso a pedido
  disponible. El footer enlaza "Politica de reembolsos" a `/refund-policy`; los demas links quedan `href="#"`.
- AC13: `tsc`, `eslint` y `vitest` pasan. Verificacion manual (Stripe modo test, con compras de prueba): cancelar un evento
  con 2+ ordenes => ordenes `refunded`, tickets `cancelled`, reembolsos visibles en Stripe, KPIs y check-in sin esas
  ordenes; forzar un fallo (p. ej. quitar la clave) y usar "Reintentar" => se completan sin duplicar.

## Tests requeridos
(Vitest, junto al archivo; `db` y `stripe` mockeados como en 041)
- `organizer-event-cancel.service.test.ts`: AC1 (llamadas a Stripe, clave, sin `amount`, flags Connect segun fee), AC2
  (sin Stripe si falla el cambio de estado; evento sin ordenes), AC3 (un fallo no corta; `charge_already_refunded`),
  AC4, AC5 (scope, estado, idempotencia).
- `organizer-refund.service.test.ts`: AC6 (regresion de `refundOrder` tras el refactor); `refundEventOrders` en serie
  y solo `paid`; `getEventHeaderForOrders` incluye cancelados y respeta scope.
- `organizer-event.actions.test.ts`: AC7 (cancelled delega y arma el mensaje; otros estados no cambian).
- `refund.actions.test.ts` + `refund.schema.test.ts`: AC8.
- `retry-refunds-button.test.tsx` (RTL, action mockeada): pending deshabilita, un mensaje por resultado (AC10).
- Sin test: `refund-policy.tsx` y la ruta (estaticos, SETUP §3.1); AC12 se revisa en el review y manualmente.

## Tareas
### T1 — Servicios de cancelacion con reembolso masivo
- Archivos: `src/modules/organizer/services/organizer-refund.service.ts`, `src/modules/organizer/services/organizer-refund.service.test.ts`,
  `src/modules/organizer/services/organizer-event-cancel.service.ts`, `src/modules/organizer/services/organizer-event-cancel.service.test.ts`,
  `src/modules/organizer/types/refund.types.ts`, `src/modules/organizer/schemas/refund.schema.ts`,
  `src/modules/organizer/schemas/refund.schema.test.ts`
- Depende de: —
- Paralelizable: si (con T4; bloquea T2 y T3)
- Cubre: AC1, AC2, AC3, AC4, AC5, AC6, AC9 (scope)

### T2 — Acciones y copy del dialogo
- Archivos: `src/modules/organizer/actions/organizer-event.actions.ts`, `src/modules/organizer/actions/organizer-event.actions.test.ts`,
  `src/modules/organizer/actions/refund.actions.ts`, `src/modules/organizer/actions/refund.actions.test.ts`,
  `src/modules/organizer/components/organizer-event-actions.tsx`
- Depende de: T1
- Paralelizable: no (comparte contrato con T1; disjunto de T4)
- Cubre: AC7, AC8, AC9 (roles), AC11

### T3 — Boton de reintento y pagina de ordenes
- Archivos: `src/modules/organizer/components/retry-refunds-button.tsx`, `src/modules/organizer/components/retry-refunds-button.test.tsx`,
  `src/modules/organizer/index.ts`, `src/app/(organizer)/organizer/events/[id]/orders/page.tsx`
- Depende de: T2
- Paralelizable: no (disjunto de T4)
- Cubre: AC10, AC13

### T4 — Pagina publica de politica de reembolsos
- Archivos: `src/modules/order/components/refund-policy.tsx`, `src/modules/order/index.ts`,
  `src/app/(main)/refund-policy/page.tsx`, `src/components/shared/site-footer.tsx`
- Depende de: —
- Paralelizable: si (totalmente disjunta de T1-T3; puede correr en paralelo con T1)
- Cubre: AC12

Orden: T1 y T4 en paralelo; luego T2 -> T3. No hay T0 (sin migraciones, dependencias ni shadcn nuevos).

## Riesgos
- **Timeout del server action** con muchas ordenes (llamadas Stripe en serie). Mitigacion: el evento ya esta
  `cancelled` antes de reembolsar y el reintento es idempotente; techo documentado (ponytail, Decision 5).
- **Dinero devuelto sin reflejo en DB**: igual que 041 (`charge.refunded` + clave de idempotencia de 24 h +
  `charge_already_refunded`). El boton de reintento queda visible mientras haya `paid`.
- **Compras en curso al cancelar**: una orden `pending` que se paga despues queda `paid` en un evento cancelado; solo la
  recoge el reintento manual (pregunta 2).
- **Mensaje de exito descartado**: `ConfirmDialogBody` cierra el dialogo en `success`; el developer verifica donde se
  muestra `state.message` y, si no se ve, el resumen de fallos debe quedar accesible (la pagina de ordenes lo cubre).
- **Fuga**: evento ajeno e inexistente devuelven ambos `not-found`.
- **Refactor de `refundOrder`**: toca codigo de 041 ya revisado; los tests existentes son la red de seguridad (AC6).
- **Texto legal**: la politica es informativa; no sustituye terminos y condiciones.

## Preguntas abiertas
1. **Quien cancela**: ¿organizer sobre sus eventos y admin cualquiera (igual que 041)? Default: si.
2. **Ordenes `pending` al cancelar / pagos tardios**: default = no se tocan; los pagos tardios se reembolsan con
   "Reintentar reembolsos". Alternativa: cancelar las `pending` y expirar su Checkout Session al cancelar.
3. **Tickets `used`**: default = no bloquean la cancelacion masiva (se conservan como historial). Alternativa: excluir
   ordenes con entradas usadas y reembolsarlas a mano.
4. **Tope de ordenes por request**: default = sin tope, serie. ¿Cual es el volumen maximo esperado de un evento?
5. **Ventana/reembolso a pedido en la politica**: default = no se mencionan como disponibles. El profesor lista 48 h
   antes del evento; ¿se quiere una spec de reembolso a pedido?
6. **Plazo de acreditacion** (5-10 dias habiles): default = cifra generica a contrastar con Stripe antes de publicar.
7. **Email al comprador**: default = solo el recibo de reembolso de Stripe, ninguno propio.
8. **Enlace a la politica** en la pagina de confirmacion/"Mis entradas": default = solo el footer.

## Proximas fases
- Reembolso a pedido y parcial (tabla `refunds` + `refund_tickets`, webhooks `refund.*`, ventana de solicitud).
- Job en segundo plano / paginacion para cancelaciones grandes; cancelar ordenes `pending` y sesiones de Checkout.
- Email propio de evento cancelado; ordenes "Reembolsada" visibles en "Mis entradas".
- Reprogramacion de eventos.

## Log de review
- (pendiente)
