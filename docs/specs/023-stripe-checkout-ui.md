# 023 — UI de checkout con Stripe hosted (fase 2 de la spec 022)

Estado: implementada (pendiente AC12 manual con Stripe)

## Objetivo
Fase 2 de `docs/specs/022-stripe-checkout-payments.md` (la API ya existe: `POST /api/checkout/session`,
`checkoutService.createCheckoutSession` / `syncOrderWithSession`, webhook). Esta spec conecta la UI:

1. El boton de pago pasa a "Pagar con Stripe": `POST /api/checkout/session` y `window.location.href = url`.
2. Se elimina toda captura/validacion/dato de tarjeta y el selector de metodo de pago (PCI).
3. La pagina `/events/[slug]/confirmation?session_id=...` lee la orden real con `syncOrderWithSession` (servidor), no
   el `useOrderStore`.
4. Estados visibles: pagado, pendiente, fallido, cancelado/expirado, no encontrado.
5. NO se toca `my-tickets*` ni la emision de tickets (tareas posteriores).

Referencias: `docs/SETUP.md` §1-§3; `docs/SYSTEM_DESIGN.md` (no hay seccion de auth/pagos que cambie; el contrato de
pagos es el de la spec 022).

### Contratos verificados en el codigo real
- **Endpoint** (`src/app/api/checkout/session/route.ts`): body = `createCheckoutSessionSchema`
  `{ eventSlug, quantities: Record<zoneId,number>, seatIds: Record<zoneId,string[]>, buyer: { fullName, email,
  documentType, documentNumber, phone } }` (sin precios). Respuestas: `200 {url}`, `400 {message}`,
  `404 {message}` (slug fuera de `EVENTS_MOCK`, incluye eventos del panel del organizador), `500 {message}`.
- **URLs que arma el service**: `success_url = ${origin}/events/${slug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
  `cancel_url = ${origin}/events/${slug}/checkout` (sin query hoy; esta spec le agrega `?payment=cancelled`, T5).
- **Auth**: la route llama `auth()` de Clerk (opcional, invitado permitido). El cliente no envia nada especial: la
  cookie de sesion viaja sola en el POST same-origin (`proxy.ts` = `clerkMiddleware()` cubre `/api`).
  Nota: `checkout-form.tsx` hoy autocompleta con `useAuthStore` (no `useCurrentUser`/Clerk); no se cambia aqui (ver
  Preguntas abiertas 4).
- `syncOrderWithSession(sessionId): Promise<OrderRecord | null>` lanza si Stripe rechaza el id; `null` si no hay
  orden con ese `stripe_checkout_session_id`. `OrderRecord.totalAmount` es `string` (numeric), `lines`/`buyer` jsonb.
- Next 16: `searchParams` es `Promise` en `page.tsx` (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`).
  `next.config.ts` no activa `cacheComponents`; leer `searchParams` hace dinamica la pagina (aceptable, mantiene
  `generateStaticParams`). No se usa `useSearchParams` en cliente (exigiria `Suspense`).

## Alcance
- Incluye:
  - Servicio cliente axios `startCheckoutSession` + traduccion de errores a mensaje.
  - `CheckoutForm`: submit valida buyer + terminos, arma el body, redirige a Stripe; estado "Redirigiendo a Stripe...";
    error 400/404/500 como mensaje en el formulario; aviso "pago cancelado" al volver de Stripe.
  - Eliminar `payment-fields.tsx`, `CardInfo`, `card.*`, `paymentMethod`, `PaymentMethod`, `PAYMENT_METHOD_OPTIONS`,
    `formatPaymentMethod`, `setCheckoutField` rama card, y sus tests.
  - Pagina de confirmacion con la orden real (`syncOrderWithSession`) y sus 5 estados.
  - Puente temporal: al ver `paid`, registrar la orden en `useOrderStore` (idempotente) y limpiar la seleccion, para que
    "Mis entradas" (que lee el store) siga mostrando la compra hasta que lea DB.
  - `cancel_url` con `?payment=cancelled` (cambio de 1 linea en el service de la spec 022 + su test).
- No incluye:
  - `my-tickets.tsx`, `order-list`, `order-ticket-*`, emision/QR de tickets, `order_items`, `tickets`.
  - Pago de eventos del panel del organizador (la API responde 404): se muestra "pago no disponible"; se quita
    `onOrderPlaced` (ya no hay compra local que sumar a `sold`). `applyOrderToOrganizerEvent` queda sin uso (no se borra).
  - Polling automatico del estado `pending`, Elements/`@stripe/stripe-js`, Yape/PagoEfectivo.
  - Inventario real de asientos, reintentos de orden huerfana (spec 022 backlog).

## Reutilizar
- `src/modules/order/services/checkout.service.ts` (`syncOrderWithSession`) y `OrderRecord`/`OrderStatus` de
  `order.table.ts` (ya en el barrel).
- `createCheckoutSessionSchema` / `CreateCheckoutSessionInput` (tipo del body; no se redefine).
- `checkoutSchema`, `validateCheckout`, `CHECKOUT_FORM_DEFAULT`, `CHECKOUT_FIELD_ORDER`, `BuyerFields`,
  `HoldTimerNotice`, `CheckoutSummary` (boton), `EmptyState`, `Button`, `Field*`, `Checkbox`.
- `toOrderEventSnapshot`, `OrderTicketCard`, `downloadEventCalendar` y el JSX de exito actual de `order-confirmation.tsx`.
- `useTicketSelectionStore` (`reset`, `quantities`, `seatIds`), `useIsClient`, `useAuthStore`, `MY_TICKETS_PATH`.
- axios (ya en `package.json`); no existe instancia en `src/lib`, se usa `axios.post` directo (YAGNI).
- shadcn: no hace falta instalar nada. Aviso/errores con markup simple como `HoldTimerNotice`/`FieldError`
  (`ls src/components/ui` ya tiene `field`, `button`, `checkbox`; `radio-group` deja de usarse en order: no se borra).

## Archivos
Nuevos:
- `src/modules/order/services/order.service.ts` (+ `.test.ts`) — cliente axios.
- `src/modules/order/components/order-payment-status.tsx` — estados pending/failed/cancelled.

Modificados (módulo order): `types/order.types.ts`, `schemas/checkout.schema.ts` (+test), `constants/order.constants.ts`,
`mocks/order.mock.ts`, `store/order.store.ts` (+test), `utils/order.utils.ts` (+test), `components/checkout-form.tsx`,
`components/checkout-summary.tsx`, `components/order-confirmation.tsx`, `index.ts`, `services/checkout.service.ts` (+test).

Modificados (catalog/app): `src/modules/catalog/components/event-page-views.tsx`,
`src/modules/catalog/components/local-event-pages.tsx`,
`src/app/(purchase)/events/[slug]/confirmation/page.tsx`, `src/app/(purchase)/events/[slug]/checkout/page.tsx`.

Eliminado: `src/modules/order/components/payment-fields.tsx`.

## Contratos

### Tipos (`order.types.ts`)
Se borran `PaymentMethod`, `CardInfo`; `Order.paymentMethod`; `CheckoutFormValues.paymentMethod/card`;
`CheckoutFieldName` queda `keyof BuyerInfo | "acceptedTerms"`; `PlaceOrderInput` se reemplaza (ver store).
`CheckoutFormValues extends BuyerInfo { acceptedTerms: boolean }`.

### Schema (`checkout.schema.ts`)
Se borran `cardSchema`, `isExpiryValid`, la rama de tarjeta de `getConditionalErrors`, `paymentMethod`/`card` de
`checkoutSchema` y de `CHECKOUT_FORM_DEFAULT`. Se mantienen `validateCheckout` y `createCheckoutSessionSchema`.

### Constantes (`order.constants.ts`)
Se borran `PaymentMethodOption`, `PAYMENT_METHOD_OPTIONS` (y el import de `Banknote/CreditCard/Smartphone`);
`CHECKOUT_FIELD_ORDER` pierde `paymentMethod` y `card.*`.

### Store (`order.store.ts`)
`placeOrder` se reemplaza por una accion idempotente (no genera numero aleatorio):
```ts
saveOrder: (order: Order) => void; // si ya existe un pedido con ese `number`, no hace nada; si no, lo agrega y fija lastOrderNumber
```
Se elimina `PlaceOrderInput` del tipo y del barrel. `clearOrders` se mantiene.

### Utils (`order.utils.ts`)
```ts
// buyer saneado (trim, phone sin espacios) + seleccion. Solo datos permitidos por el endpoint.
export function buildCheckoutSessionInput(
  eventSlug: string,
  values: Pick<CheckoutFormValues, keyof BuyerInfo>,
  selection: { quantities: Record<string, number>; seatIds: Record<string, string[]> },
): CreateCheckoutSessionInput;

// "TK-" + primeros 8 chars del uuid en mayusculas: estable entre recargas (idempotencia del puente).
export function toOrderFromRecord(record: OrderRecord, event: EventEntity, accountEmail: string | null): Order;
// number = `TK-${record.id.slice(0, 8).toUpperCase()}`, total = Number(record.totalAmount),
// createdAt = record.createdAt.toISOString() (aceptar Date | string, el RSC puede serializarlo).

// Estado visual de la confirmacion.
export type ConfirmationStatus = OrderStatus | "not-found";
export function getConfirmationStatus(record: OrderRecord | null, eventSlug: string): ConfirmationStatus;
// null o record.eventSlug !== eventSlug -> "not-found"; si no, record.status.
```
Se borran `formatPaymentMethod` y la rama `card.` de `setCheckoutField` (que pasa a `{ ...values, [field]: value }`).

### Servicio cliente (`order.service.ts`, sin `server-only`)
```ts
export async function startCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ url: string }>;
// axios.post<{ url: string }>("/api/checkout/session", input). En error lanza Error(getCheckoutErrorMessage(error)).
export function getCheckoutErrorMessage(error: unknown): string;
// AxiosError con response.data.message string -> ese mensaje; 404 -> "Este evento todavia no admite pagos en linea.";
// cualquier otro (red, 500 sin mensaje) -> "No pudimos iniciar el pago. Intenta de nuevo."
```
`CheckoutForm` maneja el `Error` capturado y muestra `error.message`.

### `CheckoutForm`
- Props: `{ event, layout, paymentCancelled?: boolean }` (se elimina `onOrderPlaced`).
- `handleSubmit`: igual validacion; luego `setIsPlacing(true); setSubmitError(null)`;
  `await startCheckoutSession(buildCheckoutSessionInput(event.slug, values, { quantities, seatIds }))`;
  exito -> `window.location.assign(url)` (isPlacing se queda en true; el usuario sale de la pagina);
  error -> `setIsPlacing(false)` + `setSubmitError(message)` renderizado con `role="alert"` encima del resumen/boton.
- Ya no importa `useRouter` ni `useOrderStore.placeOrder`. El prefill sigue leyendo `useOrderStore.getState().orders`.
- `paymentCancelled` -> aviso no bloqueante "Cancelaste el pago. Tu seleccion sigue guardada." El hold (countdown)
  reinicia (comportamiento de la spec 022).
- Boton (en `checkout-summary.tsx`, nueva prop `isPlacing`): label "Pagar con Stripe" (con spinner "Redirigiendo a
  Stripe..." y `disabled` si `isPlacing`); `PayHint` mantiene el hint de terminos.
- Se muestra una nota fija "Seras redirigido a Stripe para completar el pago de forma segura." donde estaba
  `PaymentFields`.

### Pagina de confirmacion (`confirmation/page.tsx`, server)
```tsx
const { slug } = await params;
const { session_id } = await searchParams;           // string | string[] | undefined
const event = getEventBySlug(EVENTS_MOCK, slug);
if (!event) return <LocalEventConfirmation slug={slug} />;   // evento del panel: nunca tiene orden real
const sessionId = typeof session_id === "string" ? session_id : undefined;
let order: OrderRecord | null = null;
if (sessionId) { try { order = await syncOrderWithSession(sessionId); } catch (e) { console.error(e); } }
return <EventConfirmationView event={event} order={order} />;
```
`syncOrderWithSession` se importa por ruta directa (`@/modules/order/services/checkout.service`) para que `stripe` y
`server-only` no entren al bundle cliente (nota de barrel de la spec 022). `generateStaticParams` se conserva.
`PageProps<"/events/[slug]/confirmation">` ya tipa `searchParams`.

### `EventConfirmationView` / `OrderConfirmation`
- `EventConfirmationView({ event, order }: { event: EventEntity; order: OrderRecord | null })`;
  `LocalEventConfirmation` pasa `order={null}`.
- `OrderConfirmation({ event, order })` (client): `status = getConfirmationStatus(order, event.slug)`.
  - `paid`: JSX de exito actual; el `Order` para `OrderTicketCard` sale de `toOrderFromRecord(order, event, user?.email)`;
    un `useEffect` llama `saveOrder(...)` y, si `selectionEventId === event.id`, `resetSelection()` (idempotente: el
    numero es estable, recargar no duplica).
  - `pending`: `OrderPaymentStatus` "Estamos confirmando tu pago" + boton "Verificar de nuevo" (`router.refresh()`).
  - `failed`: "No pudimos procesar tu pago" + link a `${eventHref}/checkout` ("Intentar de nuevo").
  - `cancelled`: "Tu pago fue cancelado o expiro" + link a `/checkout`.
  - `not-found`: el `EmptyState` actual ("No encontramos tu compra").
  - En estados distintos de `paid` NO se limpia la seleccion ni se escribe en el store.

### Pagina de checkout (`checkout/page.tsx`)
Lee `searchParams.payment`; `paymentCancelled = payment === "cancelled"` y lo pasa a
`EventCheckoutView` -> `CheckoutForm`. `LocalEventCheckout` no lo recibe.

### `checkout.service.ts` (spec 022, cambio minimo)
`cancel_url: \`${context.origin}/events/${input.eventSlug}/checkout?payment=cancelled\``; el test existente
(`checkout.service.test.ts` linea ~176) se actualiza.

## Criterios de aceptacion
- AC1: En `/events/<slug>/checkout` con seleccion y datos validos, el boton dice "Pagar con Stripe"; al enviar hace
  `POST /api/checkout/session` con el body `{eventSlug, quantities, seatIds, buyer}` (sin precios ni tarjeta) y navega
  a `url` (`https://checkout.stripe.com/...`). Mientras tanto el boton queda deshabilitado ("Redirigiendo a Stripe...").
- AC2: Errores del endpoint: 400/404/500 o falla de red muestran un mensaje `role="alert"` en el formulario, rehabilitan
  el boton y no navegan. Un evento del panel (404) muestra "Este evento todavia no admite pagos en linea.".
- AC3: Sin validacion de campos de tarjeta ni selector de metodo de pago:
  `grep -rniE "cc-number|cc-csc|card\.number|CardInfo|PaymentMethod|PAYMENT_METHOD|payment-fields" src` devuelve vacio
  (fuera de `*.md`), y `src/modules/order/components/payment-fields.tsx` no existe.
- AC4: `checkoutSchema`/`CheckoutFormValues`/`CHECKOUT_FORM_DEFAULT`/`CHECKOUT_FIELD_ORDER` no contienen `paymentMethod`
  ni `card`; `validateCheckout` sigue exigiendo nombre, correo, documento, celular y terminos.
- AC5: `/events/<slug>/confirmation?session_id=<cs>` con orden `paid` muestra "Compra confirmada" con los datos de la
  orden real (correo del comprador, N.º `TK-XXXXXXXX`, zonas/asientos de `lines`), limpia la seleccion de ese evento y
  agrega el pedido a `useOrderStore`. Recargar la pagina no duplica el pedido.
- AC6: Orden `pending` muestra "Estamos confirmando tu pago" + "Verificar de nuevo"; `failed` y `cancelled` muestran
  su mensaje con enlace a `/checkout`; en ninguno se limpia la seleccion ni se escribe en `useOrderStore`.
- AC7: Sin `session_id`, `session_id` invalido (Stripe lanza), session de otro evento (`order.eventSlug !== slug`) u
  orden inexistente muestra "No encontramos tu compra" (sin error 500 ni stack).
- AC8: La confirmacion ya no depende de `lastOrderNumber`: abrirla sin pasar por el checkout con un `session_id`
  valido de una orden pagada la muestra correctamente.
- AC9: Cancelar en Stripe vuelve a `/checkout?payment=cancelled`, con el aviso "Cancelaste el pago..." y la seleccion
  intacta.
- AC10: `my-tickets.tsx`, `order-list.tsx`, `order-ticket-*.tsx` y `my-tickets.test.tsx` no tienen cambios en el diff;
  "Mis entradas" sigue mostrando la compra pagada via `useOrderStore`.
- AC11: `npx tsc --noEmit`, `npm run lint`, `npm test -- --run` sin errores; `npm run build` ok.
- AC12 (manual, con `stripe listen`): pagar con `4242 4242 4242 4242` termina en confirmacion `paid`; abandonar y
  dejar expirar la session y luego abrir `success_url` de esa session muestra `cancelled`.

## Tests requeridos
Vitest, junto al archivo:
- `order.service.test.ts` (mock de `axios`): body enviado a `/api/checkout/session`; devuelve `{url}`; 400 con
  `message` -> ese mensaje; 404 -> mensaje de pago no disponible; error de red/500 -> mensaje generico.
- `order.utils.test.ts` (ampliar/ajustar): `buildCheckoutSessionInput` (trim, phone sin espacios, sin campos extra);
  `toOrderFromRecord` (numero estable `TK-` + 8, total numerico, buyer/lines copiados); `getConfirmationStatus`
  (null, slug distinto, cada estado); `setCheckoutField` sin rama card; se borra el test de `formatPaymentMethod`.
- `checkout.schema.test.ts` (ajustar): se eliminan los casos de tarjeta/paymentMethod; los de buyer y terminos siguen;
  `createCheckoutSessionSchema` sigue cubierto.
- `order.store.test.ts` (ajustar): `saveOrder` agrega y fija `lastOrderNumber`; segundo llamado con el mismo
  `number` no duplica; sin `paymentMethod` en el fixture.
- `checkout.service.test.ts`: `cancel_url` termina en `/checkout?payment=cancelled`.
- Componentes: sin test unitario nuevo salvo que el reviewer lo pida (la logica condicional vive en utils/service).

## Tareas
Orden: T1 y T3 en paralelo -> T2 -> T4 -> T5. Cada archivo pertenece a una sola tarea. Sin `T0` (no hay
dependencias nuevas, `package.json`/layout/shadcn no cambian).

### T1 — Limpiar tipos, schema, constantes, mock y store
- Archivos: `src/modules/order/types/order.types.ts`, `src/modules/order/schemas/checkout.schema.ts`,
  `src/modules/order/schemas/checkout.schema.test.ts`, `src/modules/order/constants/order.constants.ts`,
  `src/modules/order/mocks/order.mock.ts`, `src/modules/order/store/order.store.ts`,
  `src/modules/order/store/order.store.test.ts`
- Depende de: —
- Paralelizable: si (con T3)
- Cubre: AC3 (parcial), AC4, AC10 (sin tocar my-tickets)

### T2 — Utils del order (limpieza + nuevas funciones)
- Archivos: `src/modules/order/utils/order.utils.ts`, `src/modules/order/utils/order.utils.test.ts`
- Depende de: T1 (tipos)
- Paralelizable: no
- Cubre: AC3 (parcial), AC5, AC7, AC8

### T3 — Servicio cliente de checkout
- Archivos: `src/modules/order/services/order.service.ts`, `src/modules/order/services/order.service.test.ts`
- Depende de: — (solo el tipo `CreateCheckoutSessionInput`, ya existe)
- Paralelizable: si (con T1)
- Cubre: AC1, AC2

### T4 — UI del modulo order
- Archivos: `src/modules/order/components/checkout-form.tsx`, `src/modules/order/components/checkout-summary.tsx`,
  `src/modules/order/components/order-confirmation.tsx`, `src/modules/order/components/order-payment-status.tsx`,
  `src/modules/order/components/payment-fields.tsx` (eliminar), `src/modules/order/index.ts`
- Depende de: T1, T2, T3
- Paralelizable: no
- Cubre: AC1, AC2, AC3, AC5, AC6, AC7, AC9, AC10

### T5 — Paginas, vistas del catalogo y cancel_url
- Archivos: `src/app/(purchase)/events/[slug]/confirmation/page.tsx`, `src/app/(purchase)/events/[slug]/checkout/page.tsx`,
  `src/modules/catalog/components/event-page-views.tsx`, `src/modules/catalog/components/local-event-pages.tsx`,
  `src/modules/order/services/checkout.service.ts`, `src/modules/order/services/checkout.service.test.ts`
- Depende de: T4
- Paralelizable: no
- Cubre: AC2, AC5-AC9, AC11, AC12

## Preguntas abiertas
1. **Puente a `useOrderStore`** (default propuesto: si, en la confirmacion `paid`): sin el, "Mis entradas" quedaria vacio
   al desaparecer `placeOrder`, y la spec prohibe tocarlo. Costo: el pedido solo existe en el navegador que vio la
   confirmacion (si el usuario paga y cierra la pestana, no aparece hasta que "Mis entradas" lea DB). Confirmar.
2. **Eventos del panel del organizador**: quedan sin compra posible (404 -> "no admite pagos en linea") y se pierde el
   sumado a `sold`. `applyOrderToOrganizerEvent` queda huerfano. ¿Se acepta hasta migrar el catalogo a DB (spec 025)?
3. **Estado `pending`**: default = boton manual "Verificar de nuevo" (sin polling). ¿Se quiere auto-refresco (ej. cada
   5 s, max 6 intentos)?
4. **Fuente de auth del cliente**: `checkout-form.tsx` usa `useAuthStore` (legacy localStorage) para autocompletar y
   `accountEmail`, mientras el servidor usa Clerk. ¿Migrar a `useCurrentUser` en esta spec o en otra? Default: no se toca.
5. **Validacion de documento en servidor**: `createCheckoutSessionSchema` solo valida formato basico via `pick`
   (las reglas DNI/CE/pasaporte viven en `validateCheckout`, cliente). Default: se deja como esta (la orden no depende
   del documento para cobrar).
6. **Acceso a la confirmacion**: cualquiera con el `session_id` (no adivinable) ve nombre/correo del comprador, igual
   que el patron de Stripe. ¿Se exige que coincida con el usuario Clerk cuando la orden tiene `user_id`? Default: no.

## Proximas fases
- "Mis entradas" leyendo `orders` de DB; eliminar el puente a `useOrderStore`.
- Emision de tickets (`order_items`/`tickets`, QR) al pasar a `paid`.
- Catalogo en DB e inventario real de asientos (reserva/liberacion).
- Pago de eventos del organizador.

## Estado
- Aprobacion humana: aprobada (2026-10-06, las 6 preguntas abiertas aceptadas con la opcion propuesta)
- Fase: implementada (pendiente AC12: prueba manual con Stripe)
- Log de review: Iteracion 1 — PASS. tsc, eslint, vitest (468) y npm run build OK. Pendiente solo AC12 (pago 4242 + stripe listen). Nota: order-confirmation.tsx usa useAuthStore para accountEmail (legacy, migrar en P1-08).
