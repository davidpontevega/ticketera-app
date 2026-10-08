# 022 — Cobro real con Stripe Checkout (hosted) en la compra de entradas

> Numeracion: se usa 022 porque 020 y 021 estan reservadas por la spec 018 (fases 3 y 4 de auth, en backlog).

## Contexto
El checkout actual es un mock: `checkout-form.tsx` valida el formulario, `useOrderStore.placeOrder` guarda la orden
en `localStorage` y redirige a `/confirmation` sin cobrar. `payment-fields.tsx` captura numero de tarjeta, vencimiento
y CVV en inputs propios (inaceptable con cobro real: PCI). La tabla `orders` (spec 008) tiene
`stripe_payment_intent_id` pero nada la usa.

Decisiones ya confirmadas con el usuario (cuenta test `acct_1ULZrv5yV75eQ7tP`):
- **Stripe Checkout Session hosted** (redirect a `session.url`). Sin Elements, sin embedded.
- **Comprobante = receipt email automatico de Stripe** (`payment_intent_data.receipt_email`). No se usa la API de
  Invoicing (no se crean objetos `Invoice`).
- Stack: Next 16 App Router, Drizzle + Postgres, Clerk, Zustand.

### Patron (contrato)
Patron estandar de Stripe: **orden `pending` en DB antes de redirigir; el estado final lo decide Stripe**.

```
CheckoutForm ──POST /api/checkout/session {eventSlug, quantities, seatIds, buyer}──> route.ts
                                                                                      │ checkoutService.createCheckoutSession
                                                                                      │ 1. evento por slug (EVENTS_MOCK) -> 404
                                                                                      │ 2. precios recalculados en servidor (getVenueLayout/getTicketLines)
                                                                                      │ 3. INSERT orders (status 'pending')
                                                                                      │ 4. stripe.checkout.sessions.create (metadata.orderId)
                                                                                      │ 5. UPDATE orders.stripe_checkout_session_id
   <────────────────────────────────── 200 {url} ─────────────────────────────────────┘
window.location.href = url ──> Stripe hosted ──success_url──> /events/[slug]/confirmation?session_id={CHECKOUT_SESSION_ID}
                                              ──cancel_url───> /events/[slug]/checkout
Stripe ──webhook (firma)──> /api/webhooks/stripe ──> checkoutService.handleStripeEvent ──> UPDATE orders.status
```

- **Fuente de verdad del precio:** el servidor. El body no lleva precios; se recalculan con `getVenueLayout(event)` +
  `getTicketLines(...)` (deterministas, ya existen en `@/modules/ticket`).
- **Transiciones de estado:** solo desde `pending`. `pending -> paid | failed | cancelled`. Un evento repetido o fuera
  de orden nunca degrada una orden `paid` (idempotencia: `UPDATE ... WHERE status = 'pending'`).
- **Webhook tardio:** la pagina de confirmacion (fase 2) no depende del webhook: llama a
  `syncOrderWithSession(sessionId)`, que consulta la session a Stripe y aplica la misma transicion. Es el patron
  "fulfill on success page + webhook" de Stripe; ambos caminos son idempotentes.
- **Hold de asientos:** hoy el hold es solo un countdown cliente (`CHECKOUT_HOLD_SECONDS = 600`, `useCountdown`); no hay
  inventario de asientos en servidor (el mapa sale de `venue.mock` con ocupacion determinista). Por eso:
  - La session se crea con `expires_at = ahora + 30 min` (minimo que acepta Stripe; el hold de 10 min no se puede
    trasladar a Stripe).
  - **Abandono (cancel_url):** el usuario vuelve a `/checkout`; la seleccion sigue en `useTicketSelectionStore`
    (localStorage) y el countdown reinicia. La orden `pending` anterior queda huerfana hasta que Stripe emite
    `checkout.session.expired` -> pasa a `cancelled`.
  - **Expiracion:** `checkout.session.expired` -> `cancelled`. No hay asientos que liberar en servidor (ver Backlog).
  - **Webhook tardio:** cubierto por `syncOrderWithSession`; la orden queda `pending` hasta que uno de los dos caminos
    la confirme.

## Alcance
El requerimiento completo excede una sesion (~14 archivos). Se divide en 2 fases secuenciales:

| Fase | Spec | Entrega | Estado de la app al terminar |
|------|------|---------|------------------------------|
| 1 | 022 (esta) | Servidor: SDK Stripe, migracion `orders`, schema del body, service, `POST /api/checkout/session`, webhook | API funcional y probable con curl + Stripe CLI. La UI sigue en mock (sin cambios visibles). |
| 2 | 023 (backlog) | UI: boton "Pagar con Stripe", borrar `payment-fields.tsx` y todo dato de tarjeta, confirmacion leyendo la orden real | Checkout cobra de verdad; no queda captura de tarjeta propia. |

- Incluye (Fase 1):
  - Dependencia `stripe` (SDK oficial, no esta en `package.json`) y cliente servidor `src/lib/stripe.ts`.
  - Migracion de `orders` para poder persistir ordenes del catalogo actual (ver "Contratos > DB").
  - Schema zod del body de creacion de session.
  - Utilidades puras: mapeo `TicketLine[] -> line_items` y `session/event -> OrderStatus`.
  - `checkout.service.ts`: `createCheckoutSession`, `syncOrderWithSession`, `handleStripeEvent`.
  - Rutas `POST /api/checkout/session` y `POST /api/webhooks/stripe`.
  - `.env.example` con instrucciones reales de Stripe (incluye `stripe listen`).
- Excluye:
  - Cualquier cambio de UI (fase 2).
  - Eventos publicados desde el panel del organizador (viven en `localStorage`, el servidor no puede leerlos ni
    tasarlos): la API responde 404 para esos slugs. Ver Preguntas abiertas 3.
  - Escribir `order_items` y `tickets` (requieren `ticket_tiers` en DB; hoy el catalogo es mock).
  - Refunds, Stripe Connect, API de Invoicing, Stripe Tax, cupones.
- Backlog:
  - **Fase 2 (023):** ver "Contratos de la fase 2".
  - Inventario real de asientos en servidor (reserva al crear la session, liberacion en `checkout.session.expired`).
  - Catalogo en DB (events/ticket_tiers): rellenar `orders.event_id`, escribir `order_items`/`tickets`, y dejar de
    guardar `lines` como jsonb.
  - "Mis entradas" leyendo `orders` de DB en vez de `useOrderStore`.

## Reuso detectado
- `@/modules/event`: `EVENTS_MOCK`, `getEventBySlug` — resolver el evento por slug en servidor; `EVENT_CURRENCY`
  (`"PEN"`) para `price_data.currency` (en minusculas).
- `@/modules/ticket`: `getVenueLayout`, `getTicketLines`, `getTicketTotals`, tipo `TicketLine` — recalcular lineas y
  total en servidor (deterministas: `buildSeats` usa hash, no `Math.random`).
- `src/modules/order/schemas/checkout.schema.ts`: `checkoutSchema.pick({ fullName, email, documentType,
  documentNumber, phone })` — validacion del comprador en el body (no se duplican reglas).
- `src/lib/db.ts`: `db` (Drizzle) — sin cambios.
- `src/modules/order/db/order.table.ts`: `orders`, `orderStatusEnum` — se extiende (no se crea tabla nueva).
- `src/modules/user/db/user.table.ts`: `users` — buscar `users.id` por `clerk_id` para `orders.user_id`
  (no existe helper de lectura en el modulo `user`; consulta Drizzle de 1 linea en el service, YAGNI).
- `@clerk/nextjs/server`: `auth()` — obtener el `userId` de Clerk en la route (opcional, compra como invitado permitida).
- `src/app/api/webhooks/clerk/route.ts` — patron a copiar para el webhook (400 firma invalida / 500 error / 200 ok).
- `src/proxy.ts` — `clerkMiddleware()` sin proteccion: no bloquea `/api/webhooks/stripe`. Sin cambios.
- Next 16: lectura del raw body con `await request.text()` (ver
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, seccion "Webhooks").
- Mocks de tests: patron `vi.mock("@/lib/db", ...)` de `src/modules/user/services/user-sync.service.test.ts`.
- `server-only` (ya instalado) — en `src/lib/stripe.ts` para que la secret key nunca llegue al bundle cliente.
- Nuevo: `stripe` (npm). No hay alternativa en el proyecto. `@stripe/stripe-js` **no** se instala: con Checkout
  hosted basta `window.location.href = url` (fase 2).
- shadcn: no aplica en fase 1 (sin UI).

## Contratos

### Dependencia y cliente
```ts
// package.json: "stripe" (ultima version estable; usar la apiVersion por defecto del SDK, no fijar string a mano)

// src/lib/stripe.ts
import "server-only";
import Stripe from "stripe";
export const stripe: Stripe; // new Stripe(process.env.STRIPE_SECRET_KEY!)
```

### DB — migracion de `orders` (`src/modules/order/db/order.table.ts` + `npm run db:generate`)
El esquema de la spec 008 no admite el catalogo actual: `orders.event_id` es FK uuid a `events` (los eventos son mock,
ids `"1"`, `"2"`...), `orders.user_id` es NOT NULL (el checkout admite invitados) y `order_items.ticket_tier_id` exige
tiers en DB. Cambios minimos:

| Columna | Cambio | Motivo |
|---------|--------|--------|
| `user_id` | pasa a **nullable** (FK y `RESTRICT` se mantienen) | compra como invitado; se completa si hay sesion Clerk y fila en `users` |
| `event_id` | pasa a **nullable** (FK se mantiene) | null mientras el catalogo sea mock |
| `event_slug` | **nueva** `text NOT NULL` | identifica el evento hoy |
| `buyer` | **nueva** `jsonb NOT NULL` `.$type<BuyerInfo>()` | snapshot del comprador |
| `lines` | **nueva** `jsonb NOT NULL` `.$type<TicketLine[]>()` | snapshot de lineas (zona, cantidad, precio unitario, asientos) |
| `stripe_checkout_session_id` | **nueva** `text UNIQUE` (nullable: se llena tras crear la session) | buscar la orden desde webhook y success page |

```ts
// ponytail: lines/buyer en jsonb mientras no existan ticket_tiers en DB; al migrar el catalogo, escribir order_items.
```
`order_items` y `tickets` no cambian. `status`, `total_amount`, `stripe_payment_intent_id` se usan tal cual.

### Tipos (en `order.table.ts`, junto a la tabla de la que derivan; owner T2; exportados por el barrel con `export type`)
```ts
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number]; // "pending" | "paid" | "failed" | "cancelled"
export type OrderRecord = typeof orders.$inferSelect;
```

### Schema del body (`src/modules/order/schemas/checkout.schema.ts`, se agrega)
```ts
export const createCheckoutSessionSchema = z.object({
  eventSlug: z.string().min(1),
  quantities: z.record(z.string(), z.number().int().min(0)),   // zonas de admision general
  seatIds: z.record(z.string(), z.array(z.string())),          // zonas numeradas
  buyer: checkoutSchema.pick({ fullName: true, email: true, documentType: true, documentNumber: true, phone: true }),
}); // sin campos de precio: cualquier precio enviado por el cliente se descarta (z.object no es passthrough)
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
```

### Utilidades puras (`src/modules/order/utils/stripe-checkout.utils.ts`)
```ts
// unit_amount = Math.round(unitPrice * 100); currency = EVENT_CURRENCY.toLowerCase();
// product_data.name = `${eventTitle} — ${zoneName}`; description = seatLabels.join(", ") solo si hay asientos
// (Stripe rechaza description vacia).
export function toStripeLineItems(eventTitle: string, lines: readonly TicketLine[]):
  Stripe.Checkout.SessionCreateParams.LineItem[];

// status "complete" + payment_status "paid" | "no_payment_required" -> "paid"; status "expired" -> "cancelled";
// cualquier otro caso -> "pending" (ej. pago asincrono aun no confirmado).
export function getOrderStatusFromSession(session: Stripe.Checkout.Session): OrderStatus;

// checkout.session.completed | checkout.session.async_payment_succeeded -> getOrderStatusFromSession(session)
// checkout.session.async_payment_failed -> "failed"
// checkout.session.expired -> "cancelled"
// cualquier otro tipo -> null (se ignora, el webhook responde 200)
export function getOrderStatusFromEvent(event: Stripe.Event): OrderStatus | null;
```

### Service (`src/modules/order/services/checkout.service.ts`, solo servidor)
```ts
export type CreateCheckoutSessionResult =
  | { ok: true; url: string; orderId: string }
  | { ok: false; status: 400 | 404; message: string };

export interface CheckoutContext {
  origin: string;          // new URL(request.url).origin, para success_url / cancel_url
  clerkUserId: string | null; // auth().userId; si hay fila en users, se guarda orders.user_id
}

// 404: slug fuera de EVENTS_MOCK. 400: seleccion vacia, seatId inexistente u ocupado (status "occupied").
// En error no se inserta ninguna orden. Crea la session con:
//   mode "payment", line_items = toStripeLineItems(...), customer_email = buyer.email,
//   payment_intent_data: { receipt_email: buyer.email, metadata: { orderId } },
//   client_reference_id = orderId, metadata: { orderId },
//   success_url = `${origin}/events/${slug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
//   cancel_url  = `${origin}/events/${slug}/checkout`,
//   expires_at  = ahora + CHECKOUT_SESSION_TTL_SECONDS (1800, constante en el mismo service)
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  context: CheckoutContext,
): Promise<CreateCheckoutSessionResult>;

// Aplica `status` a la orden con ese stripe_checkout_session_id SOLO si sigue "pending"; guarda
// stripe_payment_intent_id (session.payment_intent como string) y updated_at. Devuelve la orden resultante o null
// si no existe. "pending" -> no escribe.
async function applySessionStatus(session: Stripe.Checkout.Session, status: OrderStatus): Promise<OrderRecord | null>; // privada

// Para la success page (fase 2): stripe.checkout.sessions.retrieve(sessionId) + getOrderStatusFromSession.
export async function syncOrderWithSession(sessionId: string): Promise<OrderRecord | null>;

// Para el webhook: getOrderStatusFromEvent; null -> no hace nada.
export async function handleStripeEvent(event: Stripe.Event): Promise<void>;
```

### Endpoints
```
POST /api/checkout/session        (src/app/api/checkout/session/route.ts)
  body: CreateCheckoutSessionInput (JSON)
  200 { url: string }                 // https://checkout.stripe.com/...
  400 { message: string }             // JSON invalido, zod falla, o resultado 400 del service
  404 { message: string }             // evento no encontrado
  500 { message: "No pudimos iniciar el pago" } // error de Stripe/DB (se loguea con console.error)

POST /api/webhooks/stripe         (src/app/api/webhooks/stripe/route.ts)
  raw body: await request.text(); header "stripe-signature"
  stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  400 "Invalid signature"   // header ausente o firma invalida; no toca DB
  500 "Internal Server Error" // handleStripeEvent lanza (Stripe reintenta)
  200 "OK"                    // incluye eventos ignorados
```
Las routes no contienen logica de negocio: parsean, llaman al service y mapean a `Response`.

### Variables de entorno (`.env.example`)
- `STRIPE_SECRET_KEY` — Dashboard -> Developers -> API keys (modo test: `sk_test_...`). Solo servidor.
- `STRIPE_WEBHOOK_SECRET` — local: salida de `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  (`whsec_...`); prod: Dashboard -> Developers -> Webhooks -> endpoint `/api/webhooks/stripe` con eventos
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
  `checkout.session.expired`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — se conserva con comentario "no requerida con Checkout hosted" (no se borra:
  la usaria Elements si algun dia se adopta).
- Nota de comprobantes: en modo test Stripe no envia receipts por email; en live se envian a `receipt_email`.

### Contratos de la fase 2 (023, solo referencia; se especifican en su spec)
- `order.service.ts` (cliente, axios): `createCheckoutSession(input): Promise<{ url: string }>`.
- `checkout-form.tsx`: submit -> `createCheckoutSession` -> `window.location.href = url`; errores 400/404/500 como
  mensaje en el formulario; boton "Pagar con Stripe". Eventos locales del organizador: mensaje "pago no disponible".
- Borrar `payment-fields.tsx`, `CardInfo`, `card.*` y `paymentMethod` de `CheckoutFormValues`/`checkoutSchema`/
  `CHECKOUT_FIELD_ORDER`/`PAYMENT_METHOD_OPTIONS` (+ tests). AC: `grep -rn "cc-number\|cc-csc\|card.number" src` vacio.
- Confirmation page: lee `searchParams.session_id`, llama `syncOrderWithSession`, muestra `paid` / "estamos
  confirmando tu pago" (`pending`) / error (`failed`/`cancelled`); al ver `paid` limpia la seleccion y registra la
  orden en `useOrderStore` (puente para "Mis entradas" hasta que lea DB).

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar `stripe`, crear cliente servidor y documentar env | package.json, package-lock.json, src/lib/stripe.ts, .env.example | - | S |
| T2 | Migracion de `orders` (columnas de la tabla de Contratos), tipos `OrderStatus`/`OrderRecord` y `npm run db:generate` | src/modules/order/db/order.table.ts, drizzle/0002_*.sql, drizzle/meta/0002_snapshot.json, drizzle/meta/_journal.json | - | P1 |
| T3 | `createCheckoutSessionSchema` + tests | src/modules/order/schemas/checkout.schema.ts, src/modules/order/schemas/checkout.schema.test.ts | - | P1 |
| T4 | Utilidades puras de Stripe + tests | src/modules/order/utils/stripe-checkout.utils.ts, src/modules/order/utils/stripe-checkout.utils.test.ts | T1, T2 (tipo `OrderStatus`) | S |
| T5 | Service de checkout + tests (mock de `@/lib/db` y `@/lib/stripe`) | src/modules/order/services/checkout.service.ts, src/modules/order/services/checkout.service.test.ts | T2, T3, T4 | S |
| T6 | Routes de session y webhook + exports del barrel | src/app/api/checkout/session/route.ts, src/app/api/webhooks/stripe/route.ts, src/modules/order/index.ts | T5 | S |

Orden: T1 -> P1 {T2, T3} -> T4 -> T5 -> T6. T4 solo necesita tipos de T1 (`stripe`) y T2 (`OrderStatus`); si el
orquestador quiere paralelizar T4 con T2, T4 puede declarar `OrderStatus` como el union literal
`"pending" | "paid" | "failed" | "cancelled"` importado luego desde la tabla (archivos igualmente disjuntos). La migracion generada se aplica con
`npm run db:migrate` antes de verificar los AC de integracion.

Nota de barrel: `src/modules/order/index.ts` es importado por componentes cliente. Exportar desde el barrel solo
tipos (`OrderStatus`, `OrderRecord` desde `order.table.ts`; `CreateCheckoutSessionInput`) y
`createCheckoutSessionSchema`; las routes
importan el service por ruta directa (`@/modules/order/services/checkout.service`) para que `server-only`/`stripe`
nunca entren al bundle cliente. (Mismo criterio que `orders` ya exportado: solo se usa en servidor.)

## Criterios de aceptacion
- [ ] AC1: `POST /api/checkout/session` con un slug de `EVENTS_MOCK`, una zona general con `quantity: 2` y buyer valido
  responde 200 `{ url }` con `url` que empieza por `https://checkout.stripe.com/`; en DB existe una orden `pending`
  con `stripe_checkout_session_id` = id de la session, `event_slug`, `buyer`, `lines` y `total_amount` igual a
  `getTicketTotals(getTicketLines(...)).amount` calculado en servidor.
- [ ] AC2: Un body con campos extra de precio (`unitPrice`, `total`) no altera el monto: la session de Stripe
  (`amount_total`) es igual a `total_amount * 100`.
- [ ] AC3: Slug inexistente -> 404; body invalido (JSON roto, email invalido, `quantities` negativas) -> 400; seleccion
  vacia -> 400; `seatIds` con un asiento inexistente u ocupado -> 400. En ninguno de estos casos se inserta una orden.
- [ ] AC4: Con sesion Clerk y fila en `users`, la orden guarda `user_id`; sin sesion, `user_id` es null y la orden se
  crea igual.
- [ ] AC5: `POST /api/webhooks/stripe` sin header `stripe-signature` o con firma invalida responde 400 y no modifica
  ninguna orden.
- [ ] AC6: Pagando la session de AC1 con la tarjeta de prueba `4242 4242 4242 4242` (con `stripe listen` corriendo),
  la orden pasa a `paid` y `stripe_payment_intent_id` empieza por `pi_`. `orders.status` solo pasa a `paid` via
  `checkout.session.completed`/`async_payment_succeeded` verificado o via `syncOrderWithSession` (que consulta a Stripe).
- [ ] AC7: `stripe checkout sessions expire <cs_id>` sobre una session sin pagar deja la orden en `cancelled`.
- [ ] AC8: Idempotencia: reenviar el evento `checkout.session.completed` (`stripe events resend <evt_id>`) deja la orden
  en `paid` sin errores; un `checkout.session.expired` posterior sobre una orden `paid` no la cambia.
- [ ] AC9: Un evento no manejado (ej. `stripe trigger payment_intent.created`) responde 200 y no modifica ordenes.
- [ ] AC10: La session creada tiene `payment_intent_data.receipt_email` = email del comprador (visible en el
  PaymentIntent en el Dashboard test). No se crea ningun objeto `Invoice` (Dashboard -> Invoices vacio).
- [ ] AC11: `grep -rn "STRIPE_SECRET_KEY\|from \"stripe\"" src` solo aparece en `src/lib/stripe.ts`,
  `checkout.service.ts`, `stripe-checkout.utils.ts` (tipos) y las routes; `src/lib/stripe.ts` importa `server-only`.
- [ ] AC12: `.env.example` documenta las 3 keys de Stripe, el comando `stripe listen` y los 4 eventos del webhook.
- [ ] AC13: `npx tsc --noEmit`, `npm run lint` y `npm test -- --run` sin errores; `npm run build` ok.
- [ ] AC14: La UI del checkout no cambia en esta fase (los inputs de tarjeta se eliminan en la fase 2, spec 023).

## Tests requeridos
Vitest, junto al archivo:
- `checkout.schema.test.ts` (ampliar): body valido pasa; email invalido, `quantities` negativas y `eventSlug` vacio
  fallan; campos de precio extra se descartan del resultado parseado.
- `stripe-checkout.utils.test.ts`: `toStripeLineItems` (centimos con `Math.round`, ej. 89.9 -> 8990; currency `pen`;
  description solo con asientos); `getOrderStatusFromSession` (complete+paid -> paid, complete+unpaid -> pending,
  expired -> cancelled, no_payment_required -> paid); `getOrderStatusFromEvent` (los 4 tipos + tipo ignorado -> null).
- `checkout.service.test.ts` (mock de `@/lib/db` y `@/lib/stripe`): slug inexistente -> 404 sin insert; seleccion
  vacia y asiento ocupado -> 400 sin insert; caso feliz llama a `sessions.create` con `metadata.orderId`,
  `receipt_email`, `success_url` con `{CHECKOUT_SESSION_ID}` y montos del servidor; `handleStripeEvent` con evento
  ignorado no escribe; `syncOrderWithSession` aplica `paid` cuando la session esta pagada.
- Las routes no llevan test unitario (sin logica propia); se verifican con AC3, AC5-AC9.

## Preguntas abiertas
1. **Modelo de datos (bloqueante para aprobar):** esta spec relaja `orders.user_id`/`orders.event_id` a nullable y
   guarda `buyer`/`lines` en jsonb, porque eventos y tiers no estan en DB. Alternativa: una spec previa que migre el
   catalogo (seed de `events` + `ticket_tiers`) y usar `order_items` normalizado. Default propuesto: la migracion de
   esta spec. Confirmar.
2. **Compra como invitado:** default permitida (`user_id` null sin sesion). Si se exige login para pagar, `user_id`
   queda NOT NULL y la route responde 401 sin sesion (depende tambien de que el webhook de Clerk haya creado la fila
   en `users`).
3. **Eventos publicados desde el panel del organizador** (localStorage, spec 017): el servidor no puede tasarlos, la
   API responde 404. Con la fase 2 dejaran de poder comprarse. ¿Aceptado hasta que el catalogo viva en DB?
4. **Hold vs. expiracion:** el hold de la app es 10 min (solo cliente) y Stripe exige `expires_at` >= 30 min. Sin
   inventario en servidor, dos personas pueden pagar el mismo asiento numerado. ¿Aceptable para esta fase (backlog:
   inventario real)?
5. **Metodos de pago:** Yape y PagoEfectivo del mock no existen en Stripe. Default: Checkout muestra los metodos
   activos en el Dashboard (tarjeta). La fase 2 elimina el selector de metodo. Confirmar.
6. **Receipts en test:** Stripe no envia receipts por email en modo test; solo se puede verificar `receipt_email` en
   el PaymentIntent (AC10). En live requiere tener activado "Successful payments" en Settings -> Emails o se envia por
   `receipt_email`. Confirmar que esto cubre "invoicing".

## Estado
- Aprobacion humana: aprobada
- Fase: spec
- Log de review: -
