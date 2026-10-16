# 041 — Reembolso total de ordenes pagadas

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-14, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Que un organizador (sobre ordenes de SUS eventos) o un admin/super_admin (cualquier orden) pueda **reembolsar por
completo una orden pagada** via Stripe Refunds API; la orden pasa a `refunded`, sus tickets a `cancelled`, y los
asientos/cupos vuelven a estar disponibles. El webhook `charge.refunded` mantiene DB y Stripe consistentes
(reembolsos hechos desde el dashboard de Stripe o reintentos tras un fallo parcial).
Referencias: `032` (tickets emitidos al pagar), `033` (inventario derivado de ordenes `paid`/`pending`), `038`
(metricas SQL sobre `status='paid'`), `040` (check-in: `tickets.status`, scope por rol, patron action + `useActionState`),
`030/036` (area del organizador). Modelo del profesor (solo lectura, NO copiado): tabla `refund` + `refund_ticket` +
`payment`; aqui se descarta (YAGNI, ver Decisiones 1).

## Hallazgos (verificado en codigo)
- `orders.stripe_payment_intent_id` **ya existe** y `applySessionStatus` (`checkout.service.ts`) lo persiste al pasar a
  `paid`. **No hace falta migrar para guardarlo.** Ordenes antiguas pueden tenerlo NULL => fallback
  `stripe.checkout.sessions.retrieve(stripeCheckoutSessionId).payment_intent`.
- `order_status` = `pending | paid | failed | cancelled`: **falta `refunded`**. `ticket_status` ya tiene `cancelled`
  (ninguna ruta lo escribe hoy; `040` lo trata como resultado `cancelled`).
- El inventario (`availability.service.ts` `getTakenInventoryBySlugs`) cuenta solo `paid` y `pending` en ventana =>
  una orden `refunded` **libera asientos/cupo sola**, sin tocar nada (compatible con la logica anti-sobreventa de 033).
- Metricas del organizador (`organizer-events.service.ts`, spec 038: `sold`, `revenue`) y stats de check-in (040) filtran
  `orders.status = 'paid'` => excluyen `refunded` sin cambios. `user-orders.service.ts` ("Mis entradas") filtra `paid` =>
  la orden reembolsada desaparece sin cambios. El check-in ya exige orden `paid` => `refunded` da `not-valid`.
- Webhook: `src/app/api/webhooks/stripe/route.ts` verifica firma y delega en `handleStripeEvent`
  (`checkout.service.ts`), que hoy ignora todo salvo eventos `checkout.session.*` (`getOrderStatusFromEvent` -> null).
  El Checkout crea el PaymentIntent con `metadata.orderId`.
- **No existe vista de ordenes del organizador.** `OrganizerEventRow` solo tiene agregados. Se define una minima.
- Compilacion: `OrderPaymentStatus` tiene `status: Exclude<OrderStatus, "paid">` y `COPY[status]` => agregar el valor al
  enum rompe `tsc` si no se cubre `refunded` ahi y en `OrderConfirmation`.
- Drizzle omite el prefijo de tabla en selects de una sola tabla: calificar a mano en subconsultas crudas.
- `stripe` ^23 (`src/lib/stripe.ts`, `server-only`). Opciones de request (idempotencia) van como 2do argumento:
  `stripe.refunds.create({ payment_intent }, { idempotencyKey })`. El developer verifica la firma en los tipos del
  paquete antes de usarla.

## Decisiones
1. **Modelo minimo, sin tabla `refunds`**: solo reembolso total y unico por orden => 3 columnas nullable en `orders`:
   `refunded_at timestamptz`, `refunded_by uuid -> users ON DELETE SET NULL`, `stripe_refund_id text`. Mas el valor
   `refunded` en `order_status`. Una tabla `refunds` (con `amount`, `status`, `reason`) se justifica solo con
   reembolso parcial o multiples reembolsos por orden (fuera de alcance).
2. **Quien**: `requireRole(ORGANIZER_AREA_ROLES)`; `getEventScope(viewer)` acota al organizer a eventos con
   `organizer_id = su id`; admin/super_admin sin filtro; `customer` fuera por construccion. `viewer` siempre sale del
   servidor. Orden ajena => `not-found` (no filtra existencia).
3. **Orden de operaciones (Stripe primero, DB despues)**:
   1. SELECT de la orden dentro del scope (join `events.slug = orders.event_slug`, igual que 040). Debe estar `paid`.
   2. Rechazo si existe algun ticket `used` de la orden (Decision 4).
   3. Resuelve `payment_intent` (columna o fallback por session).
   4. `stripe.refunds.create({ payment_intent }, { idempotencyKey: "refund-order-<orderId>" })` — reembolso total
      (sin `amount`). Si Stripe responde `charge_already_refunded`, se trata como exito y se reconcilia la DB.
   5. `applyOrderRefund` (transaccion): `UPDATE orders SET status='refunded', refunded_at, refunded_by,
      stripe_refund_id WHERE id=$id AND status='paid' RETURNING` y, solo si devolvio fila,
      `UPDATE tickets SET status='cancelled' WHERE order_id=$id AND status='valid'`. El `status='paid'` en el WHERE
      hace idempotente el cambio (segundo llamador, p. ej. el webhook, afecta 0 filas y no hace nada).
   Si el paso 5 falla despues de que Stripe reembolso: el webhook `charge.refunded` (Decision 5) o un reintento del
   boton (misma clave de idempotencia => Stripe devuelve el mismo refund, o `charge_already_refunded`) reparan la DB.
   Si Stripe falla (paso 4): no se toca la DB; error visible al usuario.
4. **Tickets `used` bloquean el reembolso** (default): resultado `has-used-tickets`, mensaje "La orden tiene entradas
   ya usadas en puerta". Un admin que quiera forzarlo lo hace desde el dashboard de Stripe (el webhook igual
   reconciliara, ver 5). Ver pregunta 1.
5. **Webhook `charge.refunded`**: en `handleStripeEvent`, antes de `getOrderStatusFromEvent`, se atiende
   `charge.refunded`. Solo cuando `charge.refunded === true` (reembolsado por completo; parcial => `console.warn` y
   se ignora). Busca la orden por `orders.stripe_payment_intent_id = charge.payment_intent` (fallback
   `charge.metadata`/`payment_intent` ausente => se ignora con warn) y llama a `applyOrderRefund` con `refundedBy = null`.
   Ordenes `pending`/`cancelled` o ya `refunded` no se tocan. Tickets `used` se conservan como `used` (historial);
   solo los `valid` pasan a `cancelled`.
6. **Vista minima de ordenes**: pagina `/organizer/events/[id]/orders` (servidor): lista de ordenes `paid` y `refunded`
   del evento (numero corto = primeros 8 chars del id en mayusculas, comprador `buyer.fullName`/`email`, total, entradas,
   fecha, estado) con boton "Reembolsar" solo en `paid`. Confirmacion con `Dialog` (ya instalado) mostrando monto y
   comprador. Sin filtros, busqueda ni paginacion (ponytail: techo = cientos de ordenes por evento; paginar luego).
7. **Server action** `refundOrderAction` con `useActionState` (patron de 040); estado: union discriminada
   `idle | refunded | not-found | not-refundable | has-used-tickets | stripe-error | error`. `revalidatePath` de la
   pagina de ordenes, la de check-in y `ORGANIZER_PATH` (KPIs).
8. **Cliente**: `OrderPaymentStatus` y `OrderConfirmation` agregan el caso `refunded` (copy "Esta compra fue reembolsada"
   y CTA "Ir al inicio", sin reintento de pago). Es lo minimo para que `tsc` compile y el comprador no vea un estado vacio.
9. **Sin email al comprador** (Stripe ya envia recibo de reembolso si `receipt_email` esta configurado; el checkout lo
   setea en `payment_intent_data.receipt_email`). Sin notificacion propia.
10. **Reembolso parcial / por entrada**: fuera de alcance (Decision 1).
11. **Config Stripe (manual, fuera del codigo)**: suscribir el endpoint de webhook al evento `charge.refunded` en el
    dashboard / `stripe listen --events ...`. Documentar en el log; sin esto solo funciona el camino del boton.

## Alcance
- Incluye: migracion (`refunded` + 3 columnas); `applyOrderRefund` compartido; servicio `refundOrder` (Stripe +
  scope + guardas) y `listEventOrders`; manejo de `charge.refunded`; action; pagina y componente de ordenes con boton
  y confirmacion; enlace desde la lista de eventos; copy `refunded` en estados de orden del comprador; tests.
- No incluye (se difiere):
  - Reembolso parcial, por entrada o multiples reembolsos; tabla `refunds`/`refund_ticket`.
  - Motivo del reembolso (campo de texto/enum) y auditoria detallada.
  - Reembolso solicitado por el comprador (`customer`), flujo de aprobacion o politica por fecha del evento.
  - Reembolsar tickets `used` (forzado) o revertir un reembolso.
  - Stripe Connect / transferencias al organizador (el cobro es de la plataforma).
  - Filtros/paginacion/busqueda en la vista de ordenes; exportacion.
  - Email propio, estado "reembolsada" en "Mis entradas" (la orden simplemente deja de aparecer).
  - Cambios en proxy / `protected-routes.ts` (`/organizer(/.*)?` ya protegido).

## Reutilizar
- `orders` (`stripePaymentIntentId`, `stripeCheckoutSessionId`), `tickets`, `events`, `users`, `db`, `stripe`.
- `getEventScope`, `EventAdminViewer` (`organizer-event-admin.service.ts`); `requireRole`, `ORGANIZER_AREA_ROLES`.
- Patron de action + `useActionState` + `revalidatePath` (`check-in.actions.ts`); patron de pagina
  (`check-in/page.tsx`: `PageProps`, `z.uuid()`, `getEventForEdit` para scope y `notFound()`).
- `handleStripeEvent` / `applySessionStatus` (`checkout.service.ts`) como punto de entrada del webhook.
- `formatPrice`/helpers de moneda existentes (el developer busca en `src/lib`/`src/modules/event`; `EVENT_CURRENCY`).
- shadcn ya instalado: `dialog`, `button`, `badge`, `table` (verificar `ls src/components/ui`); `EmptyState` en
  `components/shared`; iconos `lucide-react`.
- Patron de tests con `db` mockeado: `organizer-check-in.service.test.ts`, `check-in.actions.test.ts`,
  `check-in-panel.test.tsx`, `checkout.service.test.ts` (mock de `stripe`).

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/order/db/order.table.ts` | `refunded` en `orderStatusEnum`; `refundedAt`, `refundedBy` (FK users SET NULL), `stripeRefundId` |
| `drizzle/0007_*.sql` + `drizzle/meta/*` | generado con `npx drizzle-kit generate` (NO se aplica; lo aplica el usuario con `npm run db:migrate`) |
| `src/modules/order/services/refund.service.ts` | `applyOrderRefund({ orderId \| paymentIntentId, refundedBy, stripeRefundId })` (transaccion, idempotente) |
| `src/modules/order/services/refund.service.test.ts` | tests con `db` mockeado |
| `src/modules/order/services/checkout.service.ts` | `handleStripeEvent` atiende `charge.refunded` |
| `src/modules/order/services/checkout.service.test.ts` | casos nuevos de `charge.refunded` |
| `src/modules/order/utils/stripe-checkout.utils.ts` | `getRefundedPaymentIntentId(event)` pura (null si no aplica o es parcial) |
| `src/modules/order/utils/stripe-checkout.utils.test.ts` | tests |
| `src/modules/order/components/order-payment-status.tsx` | copy + CTA `refunded` |
| `src/modules/order/components/order-confirmation.tsx` | rama `refunded` |
| `src/modules/organizer/types/refund.types.ts` | `EventOrderRow`, `RefundResult`, `RefundActionState` |
| `src/modules/organizer/schemas/refund.schema.ts` | `refundOrderSchema` (`eventId`, `orderId` uuid) |
| `src/modules/organizer/schemas/refund.schema.test.ts` | tests |
| `src/modules/organizer/services/organizer-refund.service.ts` | `refundOrder`, `listEventOrders` (`server-only`) |
| `src/modules/organizer/services/organizer-refund.service.test.ts` | tests con `db` y `stripe` mockeados |
| `src/modules/organizer/actions/refund.actions.ts` | `refundOrderAction` |
| `src/modules/organizer/actions/refund.actions.test.ts` | tests |
| `src/modules/organizer/components/event-orders-table.tsx` | tabla + boton + `Dialog` de confirmacion (cliente) |
| `src/modules/organizer/components/event-orders-table.test.tsx` | tests de UI condicional |
| `src/app/(organizer)/organizer/events/[id]/orders/page.tsx` | page servidor: `requireRole`, uuid, `getEventForEdit`, `listEventOrders` |
| `src/modules/organizer/constants/organizer.constants.ts` | `getOrganizerOrdersPath(id)` |
| `src/modules/organizer/components/organizer-event-list.tsx` | enlace "Ordenes" (eventos `published`) |
| `src/modules/organizer/index.ts` | exporta `EventOrdersTable`, `getOrganizerOrdersPath` |

## Criterios de aceptacion
- AC1: `orders` tiene `refunded_at`, `refunded_by` (FK `users.id`, `ON DELETE SET NULL`) y `stripe_refund_id` (todas
  NULL) y `order_status` incluye `refunded`; la migracion 0007 solo contiene el `ALTER TYPE ... ADD VALUE` y los
  `ADD COLUMN`/FK (nada mas).
- AC2: `refundOrder` sobre orden `paid` en scope, sin tickets `used`, llama una vez a
  `stripe.refunds.create({ payment_intent }, { idempotencyKey: "refund-order-<orderId>" })` **sin `amount`**, y despues
  deja la orden `refunded` (con `refunded_at`, `refunded_by = viewer.id`, `stripe_refund_id`) y sus tickets `valid` en
  `cancelled`, en una transaccion. Devuelve `{ result: "refunded" }`.
- AC3: guardas, en este orden de precedencia, **sin llamar a Stripe**: orden inexistente o ajena (organizer) =>
  `not-found`; estado distinto de `paid` => `not-refundable`; algun ticket `used` => `has-used-tickets`.
- AC4: si no hay `stripe_payment_intent_id`, se resuelve via `checkout.sessions.retrieve(session_id).payment_intent`;
  si tampoco existe, `not-refundable` sin llamar a `refunds.create`.
- AC5: si Stripe falla (error generico), la DB no cambia y el resultado es `stripe-error` con mensaje; si Stripe
  responde `charge_already_refunded`, se aplica el reembolso en DB como exito.
- AC6: `applyOrderRefund` es idempotente: llamarlo dos veces (boton + webhook, o dos webhooks) deja un solo cambio;
  la segunda llamada afecta 0 filas y no toca tickets. Los tickets `used` nunca se pasan a `cancelled`.
- AC7: `handleStripeEvent` con `charge.refunded` y `charge.refunded === true` aplica el reembolso a la orden con ese
  `stripe_payment_intent_id` (`refunded_by = null`); con reembolso parcial (`refunded === false`), sin `payment_intent`
  o sin orden coincidente, no cambia nada y no lanza. Un evento no relacionado sigue devolviendo sin efecto.
- AC8: autorizacion: `customer`/sin sesion no accede (page y action usan `requireRole(ORGANIZER_AREA_ROLES)`);
  `organizer` solo reembolsa/ve ordenes de eventos con `organizer_id = su id` (via `getEventScope`); admin/super_admin
  cualquiera; `viewer` nunca viene del `FormData`.
- AC9: `refundOrderSchema` acepta `eventId` y `orderId` uuid y rechaza vacios/no uuid; la action devuelve
  `status: "error"` sin tocar DB ni Stripe.
- AC10: tras reembolsar: la disponibilidad del evento (`getTakenInventory`) ya no cuenta esa orden; `sold`/`revenue` del
  organizador y `getCheckInStats` la excluyen; el check-in de uno de sus codigos responde `not-valid`; la orden no
  aparece en "Mis entradas" (todos por el filtro `status='paid'` existente; el test del servicio/consultas confirma que
  no hay que tocar esos filtros, y una prueba manual lo verifica).
- AC11: la pagina `/organizer/events/[id]/orders` hace `notFound()` con id no uuid o evento inexistente/ajeno
  (organizer); lista solo ordenes `paid`/`refunded` del evento (mas recientes primero), con boton "Reembolsar" solo en
  las `paid`; la `Dialog` muestra comprador y monto y no envia hasta confirmar; el boton se deshabilita en `isPending`.
- AC12: `EventOrdersTable` muestra el resultado (`role="status"`): `refunded` (exito), `has-used-tickets`,
  `not-refundable`, `not-found`, `stripe-error`, `error`, cada uno con mensaje distinto.
- AC13: `OrderConfirmation`/`OrderPaymentStatus` con orden `refunded` muestra "reembolsada" (sin boton de reintento de
  pago) y `tsc` compila (sin `COPY[status]` indefinido).
- AC14: `organizer-event-list.tsx` muestra el enlace "Ordenes" solo en eventos `published`.
- AC15: `tsc`, `eslint` y `vitest` pasan. Verificacion manual (con DB, migracion aplicada y Stripe en modo test):
  comprar, reembolsar desde la UI => orden `refunded`, tickets `cancelled`, asiento libre en el mapa, KPIs bajan,
  reembolso visible en Stripe; repetir clic => sin segundo reembolso; reembolso desde dashboard de Stripe + webhook
  => orden `refunded`.

## Tests requeridos
(Vitest, junto al archivo)
- `refund.service.test.ts` (`db` mockeado): transaccion con UPDATE condicional `status='paid'`; tickets solo si el
  UPDATE devolvio fila; segunda llamada = 0 filas sin tocar tickets; busca por `orderId` y por `paymentIntentId` (AC6).
- `stripe-checkout.utils.test.ts`: `getRefundedPaymentIntentId` (total, parcial, sin `payment_intent`, `payment_intent`
  como objeto/string, otro tipo de evento) (AC7).
- `checkout.service.test.ts`: `charge.refunded` total/parcial/sin orden; evento ajeno sin efecto (AC7).
- `organizer-refund.service.test.ts`: camino feliz con `refunds.create` mockeado + clave de idempotencia + sin `amount`
  (AC2); precedencia de guardas sin llamar a Stripe (AC3); fallback por session y sin payment_intent (AC4); error de
  Stripe vs `charge_already_refunded` (AC5); scope organizer vs admin (AC8); `listEventOrders` solo `paid`/`refunded`.
- `refund.schema.test.ts` (AC9). `refund.actions.test.ts` (`requireRole`, servicio y `revalidatePath` mockeados):
  `requireRole` con `ORGANIZER_AREA_ROLES`, payload invalido sin llamar al servicio, `revalidatePath` solo en
  `refunded`, viewer desde `requireRole` (AC8, AC9).
- `event-orders-table.test.tsx` (RTL, action mockeada): boton solo en `paid`, dialogo de confirmacion, un mensaje por
  resultado, boton deshabilitado en pending (AC11, AC12). Tests de `OrderPaymentStatus`/confirmacion para `refunded`
  si ya existen archivos de test (AC13).
- Manual (sin DB/Stripe real no automatizable): AC1 aplicado, AC10 de punta a punta, AC15.

## Tareas
### T0 — Esquema y migracion
- Archivos: `src/modules/order/db/order.table.ts`, `drizzle/0007_*.sql`, `drizzle/meta/*`
- Depende de: —
- Paralelizable: no (bloquea a T1..T3)
- Cubre: AC1
- Nota: el developer ejecuta solo `npx drizzle-kit generate`, revisa el SQL (que sea 0007 y solo lo de AC1); **no**
  ejecuta `db:migrate`.

### T1 — Nucleo de reembolso en `order` y webhook
- Archivos: `src/modules/order/services/refund.service.ts`, `src/modules/order/services/refund.service.test.ts`,
  `src/modules/order/services/checkout.service.ts`, `src/modules/order/services/checkout.service.test.ts`,
  `src/modules/order/utils/stripe-checkout.utils.ts`, `src/modules/order/utils/stripe-checkout.utils.test.ts`,
  `src/modules/order/components/order-payment-status.tsx`, `src/modules/order/components/order-confirmation.tsx`
- Depende de: T0
- Paralelizable: no
- Cubre: AC6, AC7, AC13

### T2 — Servicio del organizador (Stripe + scope) y schema
- Archivos: `src/modules/organizer/types/refund.types.ts`, `src/modules/organizer/schemas/refund.schema.ts`,
  `src/modules/organizer/schemas/refund.schema.test.ts`, `src/modules/organizer/services/organizer-refund.service.ts`,
  `src/modules/organizer/services/organizer-refund.service.test.ts`
- Depende de: T0, T1 (usa `applyOrderRefund` por ruta directa)
- Paralelizable: no
- Cubre: AC2, AC3, AC4, AC5, AC8 (scope), AC9 (schema), AC10 (consultas)

### T3 — Action, UI y pagina
- Archivos: `src/modules/organizer/actions/refund.actions.ts`, `src/modules/organizer/actions/refund.actions.test.ts`,
  `src/modules/organizer/components/event-orders-table.tsx`, `src/modules/organizer/components/event-orders-table.test.tsx`,
  `src/app/(organizer)/organizer/events/[id]/orders/page.tsx`
- Depende de: T2
- Paralelizable: no
- Cubre: AC8 (roles), AC9 (action), AC11, AC12

### T4 — Enlace, constantes y barrel
- Archivos: `src/modules/organizer/constants/organizer.constants.ts`, `src/modules/organizer/components/organizer-event-list.tsx`,
  `src/modules/organizer/index.ts`
- Depende de: T3 (exporta `EventOrdersTable`)
- Paralelizable: no
- Cubre: AC14, AC15

Orden estricto: T0 -> T1 -> T2 -> T3 -> T4 (ninguna es paralelizable: T1 y T2 comparten el contrato de
`applyOrderRefund`; T0 bloquea el tipado). Cada archivo pertenece a una sola tarea. Si T3 necesita
`getOrganizerOrdersPath` antes, se mueve la constante a T2 (no a un archivo compartido).

## Riesgos
- **Stripe cobrado/reembolsado vs DB desincronizados**: es el riesgo principal. Mitigaciones: (a) Stripe primero con
  clave de idempotencia determinista por orden => un reintento nunca duplica el reembolso; (b) `charge.refunded` repara
  la DB si cayo el paso transaccional; (c) `charge_already_refunded` se trata como exito. Ventana residual: las claves
  de idempotencia de Stripe expiran a las 24 h; pasado eso el camino es (c). Si el endpoint de webhook no esta
  suscrito a `charge.refunded` (Decision 11) y el paso DB fallo, la orden queda `paid` con el dinero devuelto hasta que
  alguien reintente el boton: **el boton debe seguir visible en `paid`**.
- **Carrera check-in vs reembolso**: entre la guarda `used` y el UPDATE un ticket puede validarse. Efecto: orden
  `refunded` con un ticket `used` (se conserva como historial). Aceptado; `ponytail`: si importa, hacer la guarda
  dentro de la transaccion con `SELECT ... FOR UPDATE`.
- **Reembolso desde el dashboard de Stripe con tickets `used`**: el webhook reconcilia igual (Stripe es la fuente de
  verdad); no se bloquea porque no se puede.
- **Reembolso parcial hecho en Stripe**: se ignora con warn (la orden sigue `paid`, dinero parcialmente devuelto).
  Aceptado en fase 1.
- **`ALTER TYPE ... ADD VALUE`**: no puede usarse en la misma transaccion en que se crea; drizzle lo emite solo y la
  migracion no usa el valor nuevo, asi que es seguro. No hay rollback simple del enum value (aceptado).
- **Union `orders.event_slug` -> `events.slug`** (misma nota que 040): si el slug fuera editable tras vender, el scope
  perderia ordenes; confirmar y dejar nota.
- **Fuga por mensajes**: orden ajena y orden inexistente devuelven ambas `not-found`.
- **Doble clic / dos operadores**: la clave de idempotencia + `status='paid'` en el WHERE aseguran un solo reembolso;
  la UI deshabilita el boton en `isPending`.
- **Drizzle sin prefijo de tabla** en selects de una tabla: calificar a mano; los tests revisan el SQL de las
  subconsultas.
- **Moneda/decimales**: no se envia `amount` (reembolso total) => no hay conversion a centavos que pueda desviarse.

## Preguntas abiertas
1. **Tickets `used`**: ¿bloquear el reembolso si hay alguno? Default: si (`has-used-tickets`). Alternativa: permitir
   a admin/super_admin con confirmacion extra.
2. **Quien reembolsa**: ¿el organizer puede reembolsar sin aprobacion del admin? Default: si, solo sobre sus eventos
   (como pide el requerimiento). Alternativa: solo admin (`refund:manage` del profesor).
3. **Ventana**: ¿restringir el reembolso despues de la fecha del evento? Default: no se restringe.
4. **Motivo del reembolso**: ¿se necesita registrarlo? Default: no (YAGNI; `refunded_by` + `refunded_at` bastan).
5. **Reembolso parcial por entrada / varias entradas**: default = fuera de alcance; requeriria tabla `refunds`
   (+ `refund_tickets`) y mantener `orders.status` ademas de estado por ticket. ¿Spec aparte?
6. **Email al comprador**: default = solo el recibo de reembolso de Stripe, ninguno propio.
7. **Visibilidad al comprador**: default = la orden reembolsada simplemente desaparece de "Mis entradas". ¿Se quiere
   mostrarla como "Reembolsada"?
8. **Ordenes antiguas sin `payment_intent`**: default = fallback por session de Stripe; ¿existen en produccion
   ordenes `paid` sin session (por ejemplo, creadas a mano)? Se tratarian como `not-refundable`.
9. **Suscripcion del webhook** a `charge.refunded` en Stripe (accion manual del usuario): ¿confirmado que se hara?
   Default: si, documentado en Decision 11.

## Proximas fases
- Reembolso parcial/por entrada con tabla `refunds` y `refund_tickets`; motivo y auditoria.
- Reembolso solicitado por el comprador con flujo de aprobacion y politica por fecha.
- Filtros, busqueda y paginacion en la vista de ordenes; exportacion.
- Estado "Reembolsada" visible en "Mis entradas"; email propio.
- Forzar reembolso con tickets `used` (admin) y manejo de Stripe Connect.

## Log de review
- (pendiente)

## Log de review
- Reviewer: PASS (AC1-AC15 en lo automatizable; AC15 manual con DB y Stripe pendiente). Ajustes posteriores: el enlace "Ordenes" tambien aparece en eventos cancelled (el reviewer lo marco como hueco de severidad media; cambia AC14: Check-in sigue solo en published); si applyOrderRefund falla tras reembolsar en Stripe, se devuelve stripe-error con aviso de sincronizacion en vez de lanzar.
