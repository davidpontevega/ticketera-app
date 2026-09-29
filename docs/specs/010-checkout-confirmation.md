# 010 — Checkout y confirmacion de compra

## Contexto
Tercera feature del flujo de compra del diseño de Claude Design
(`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`, boards `Checkout`, `CheckoutMobile`, `Confirmation`,
`ConfirmationMobile`: "5 · Checkout y pago" y "6 · Confirmacion de compra"). La seleccion de entradas (spec 008)
lleva a `/events/<slug>/checkout` con "Continuar", que hoy da 404.

Resultado esperado: el usuario completa sus datos y el metodo de pago en `/events/<slug>/checkout` (paso 2 de 3), con
un temporizador de reserva y el resumen de su compra; al pagar ve `/events/<slug>/confirmation` (paso 3 de 3) con
numero de pedido, su entrada con un QR decorativo y los proximos pasos. **Solo UI con mock data: no hay pago real ni
se envian ni guardan datos de tarjeta.**

## Alcance
- Incluye:
  - Componentes shadcn de formulario: `label`, `field`, `checkbox`, `radio-group`, `native-select`.
  - Persistencia de la seleccion de entradas en `sessionStorage` (para que el checkout sobreviva a un refresh) y un
    hook `useIsClient` para evitar hydration mismatch al leer stores persistidos.
  - Hook generico `useCountdown` para el temporizador de reserva (10 minutos).
  - Modulo nuevo `src/modules/order`: tipos, schema zod del checkout, store del ultimo pedido (persistido en
    `sessionStorage`), utils (numero de pedido, archivo `.ics` del calendario) y componentes.
  - Pagina `/events/[slug]/checkout`: header paso 2, aviso de reserva con cuenta regresiva, "Datos del comprador"
    (nombre, correo, tipo + numero de documento, celular), "Metodo de pago" (Tarjeta / Yape / PagoEfectivo, con campos
    de tarjeta solo para Tarjeta), aceptacion de terminos y resumen (aside en desktop; resumen plegable arriba y barra
    fija "Pagar S/ X" abajo en mobile).
  - Pagina `/events/[slug]/confirmation`: header paso 3, "¡Compra confirmada!", pedido N.º, tarjeta de entrada con
    zona(s), cantidad, total y QR decorativo, acciones (Ver mis entradas, Agregar al calendario, Descargar PDF) y
    "Que sigue" en 3 pasos.
  - `PurchaseHeader`: los pasos completados muestran un check (como en el board).
- Excluye:
  - Pasarela de pago, pantalla de QR de Yape o codigo de PagoEfectivo (todos los metodos confirman directo).
  - Envio de correo, generacion real de PDF (se usa `window.print()`), QR escaneable.
  - Pagina "Mis entradas" (spec 013): "Ver mis entradas" apunta a `/my-tickets`, que da 404 hasta la 013.
  - Persistir el deadline de la reserva entre recargas (el temporizador reinicia al entrar al checkout).
  - Login (spec 012): el checkout es como invitado.
- Backlog: 011 busqueda, 012 auth, 013 mis entradas, 014 organizador.

## Decisiones
- **Formulario controlado + zod, sin `react-hook-form`:** son 8 campos y una sola validacion al enviar (y por campo al
  salir de el despues del primer intento). `checkoutSchema.safeParse` + `z.flattenError` para los mensajes. No suma
  dependencias. Si los formularios crecen (spec 014, crear evento) se evalua RHF/TanStack Form ahi.
- **Validaciones:** nombre >= 3 letras; correo valido; DNI 8 digitos, CE 9-12 alfanumerico, Pasaporte 6-12
  alfanumerico; celular peruano 9 digitos empezando en 9; tarjeta (solo si metodo = Tarjeta): numero 16 digitos
  (se aceptan espacios), vencimiento `MM/AA` no vencido, CVV 3-4 digitos, nombre en tarjeta requerido; terminos
  aceptados. Mensajes en español, visibles bajo cada campo (`FieldError`) y `aria-invalid` en el input.
- **Datos de tarjeta:** viven solo en el estado del formulario; el pedido guardado nunca los incluye
  (`Order` solo tiene comprador, metodo y lineas).
- **Persistencia:** `ticket-selection.store` y `order.store` usan `persist` de zustand con `sessionStorage`
  (se pierde al cerrar la pestaña, no mezcla compras entre pestañas). Los componentes que leen estos stores muestran
  su estado vacio/skeleton hasta que `useIsClient()` es `true` (el HTML estatico no conoce la seleccion).
- **Sin seleccion:** si se entra a `/checkout` sin entradas elegidas para ese evento, se muestra "No tienes entradas
  seleccionadas" + boton "Elegir entradas" (a `/tickets`). Si se entra a `/confirmation` sin pedido para ese evento:
  "No encontramos tu compra" + "Ir al inicio".
- **Reserva vencida:** al llegar a 00:00 el aviso pasa a `destructive` ("Tu reserva vencio"), el boton Pagar se
  deshabilita y aparece "Volver a elegir entradas".
- **Pagar:** valida; si es valido crea el pedido (`placeOrder`), limpia la seleccion (`reset`) y navega con
  `router.replace` a `/confirmation` (para que "atras" no vuelva al formulario). Numero de pedido `TK-` + 5 digitos
  aleatorios, generado al pagar (nunca en render).
- **Calendario:** "Agregar al calendario" descarga un `.ics` generado en el cliente (inicio = fecha del evento,
  duracion 3 h, lugar = venue + direccion).
- **Colores:** tokens de MASTER.md (CTA indigo, no naranja). Aviso de reserva `bg-primary/10 text-primary`;
  vencido `bg-destructive/10 text-destructive`. Icono de exito en `bg-success/10 text-success`.
- **Instalacion de shadcn:** el registro `ui.shadcn.com` esta bloqueado en este entorno. Se toma el fuente oficial
  de `github.com/shadcn-ui/ui` (`apps/v4/registry/bases/base/ui/<name>.tsx`) resolviendo las clases `cn-*` con
  `apps/v4/registry/styles/style-nova.css` y los `IconPlaceholder` con lucide (mismo procedimiento que el
  `breadcrumb` de la spec 009; validado: aplicado a `button`/`input` da las mismas clases que los instalados). Imports
  `@/registry/bases/base/ui/*` → `@/components/ui/*`.

## Reuso detectado
- `src/components/shared/purchase-header.tsx` (paso 2 y 3), `brand-logo.tsx`.
- `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `separator.tsx`.
- `src/modules/ticket`: `useTicketSelectionStore`, `getVenueLayout`, `getTicketLines`, `getTicketTotals`,
  `formatTicketCount`, `TicketLine`.
- `src/modules/event`: `EVENTS_MOCK`, `getEventBySlug`, `getEventHref`, `formatEventDate`, `formatEventLongDate`,
  `formatEventPrice`, `getEventCategoryOption` (exportarlo en el barrel), `EventEntity`.
- Patron aside sticky + barra fija mobile de `purchase-summary.tsx` / `ticket-offer.tsx`.
- Patron de store zustand y su test (`ticket-selection.store.test.ts`).
- `zod` (ya instalado, v4) para el schema.
- `lucide-react`: `Timer`, `Lock`, `CreditCard`, `Smartphone`, `Banknote`, `ChevronDown`, `CircleCheck`, `Mail`,
  `QrCode`, `Ticket`, `CalendarPlus`, `Download`, `ArrowRight`, `Info`.
- Nada aplicable en `src/hooks` (vacio) ni `src/lib` para countdown/is-client → se crean en `src/hooks`.

## Contratos

### Hooks genericos (`src/hooks`)
```ts
// use-is-client.ts — true solo en el cliente, sin hydration mismatch (useSyncExternalStore con snapshot de servidor false)
export function useIsClient(): boolean;
// use-countdown.ts — segundos restantes desde que monta; se detiene en 0.
export function useCountdown(totalSeconds: number): { secondsLeft: number; isExpired: boolean; label: string }; // label "09:48"
```

### Store de seleccion (`src/modules/ticket/store/ticket-selection.store.ts`)
Misma interfaz de la spec 008 + `persist(..., { name: "ticketera-ticket-selection", storage: createJSONStorage(() => sessionStorage) })`.
`TicketSelection` (spec 008) usa `useIsClient` para no leer el store persistido antes de hidratar.

### Tipos (`src/modules/order/types/order.types.ts`)
```ts
import type { TicketLine } from "@/modules/ticket";
export type PaymentMethod = "card" | "yape" | "cash";
export type DocumentType = "dni" | "ce" | "passport";
export interface BuyerInfo { fullName: string; email: string; documentType: DocumentType; documentNumber: string; phone: string }
export interface CardInfo { number: string; expiry: string; cvc: string; holderName: string }
export interface Order {
  number: string;       // "TK-24817"
  eventId: string;
  buyer: BuyerInfo;
  paymentMethod: PaymentMethod;
  lines: TicketLine[];
  total: number;
  createdAt: string;    // ISO
}
```

### Constantes (`src/modules/order/constants/order.constants.ts`)
`CHECKOUT_HOLD_SECONDS = 600`, `PAYMENT_METHOD_OPTIONS` (value, label, icon, hint para Yape/PagoEfectivo),
`DOCUMENT_TYPE_OPTIONS` (DNI / CE / Pasaporte).

### Schema (`src/modules/order/schemas/checkout.schema.ts`)
```ts
export const checkoutSchema: z.ZodType<CheckoutFormValues>; // buyer + paymentMethod + card (opcional) + acceptedTerms
export type CheckoutFormValues = BuyerInfo & { paymentMethod: PaymentMethod; card: CardInfo; acceptedTerms: boolean };
export const CHECKOUT_FORM_DEFAULT: CheckoutFormValues;
export function validateCheckout(values: CheckoutFormValues, now?: Date): Partial<Record<CheckoutFieldName, string>>;
//  {} si es valido; clave por campo ("fullName", "card.number", "acceptedTerms", ...) con el primer mensaje.
//  Reglas de "Decisiones"; los campos de tarjeta solo se validan si paymentMethod === "card".
```

### Store (`src/modules/order/store/order.store.ts`)
```ts
export interface OrderState {
  lastOrder: Order | null;
  placeOrder: (input: Omit<Order, "number" | "createdAt">) => Order; // genera number y createdAt
  clearOrder: () => void;
}
// persist en sessionStorage, name "ticketera-last-order"
```

### Utils (`src/modules/order/utils/order.utils.ts`)
```ts
export function generateOrderNumber(random?: () => number): string;  // "TK-" + 5 digitos
export function buildEventCalendarFile(event: EventEntity): string;   // contenido .ics (VCALENDAR/VEVENT, fechas UTC)
export function formatPaymentMethod(method: PaymentMethod): string;   // "Tarjeta" | "Yape" | "PagoEfectivo"
```

### Componentes (`src/modules/order/components`)
```ts
// hold-timer-notice.tsx — "use client". Aviso con Timer + "Reservamos tus entradas por MM:SS..." o vencido.
export interface HoldTimerNoticeProps { label: string; isExpired: boolean }

// checkout-form.tsx — "use client". Contenedor: lee seleccion (store) + layout, estado del form, countdown,
//   estados vacio/vencido, submit -> placeOrder + reset + router.replace(confirmationHref).
export interface CheckoutFormProps { event: EventEntity; layout: VenueLayout }

// buyer-fields.tsx / payment-fields.tsx — presentacionales (values, errors, onChange, onBlur):
//   Field + FieldLabel + Input/NativeSelect + FieldError; RadioGroup de metodos con descripcion por metodo.

// checkout-summary.tsx — "use client". Desktop: aside sticky (evento, lineas, "Cambiar entradas", total, boton
//   Pagar S/ X submit del form via form="checkout-form", mensaje si faltan terminos). Mobile: resumen plegable arriba
//   (button aria-expanded) + barra fija con Pagar.
export interface CheckoutSummaryProps { event: EventEntity; lines: TicketLine[]; ticketsHref: string;
  canPay: boolean; hint?: string }

// order-confirmation.tsx — "use client". Lee lastOrder; si no hay o es de otro evento, estado vacio. Si hay:
//   encabezado de exito, <OrderTicketCard/>, acciones, "Que sigue".
export interface OrderConfirmationProps { event: EventEntity }
// order-ticket-card.tsx — presentacional: imagen, categoria, titulo, fecha, zona(s), entradas, total, <DecorativeQr/>.
```

### Compartido (`src/components/shared/decorative-qr.tsx`)
```ts
// SVG 21x21 con las 3 marcas de esquina y relleno pseudo-aleatorio deterministico por seed. aria-hidden. No es un QR real.
export interface DecorativeQrProps { seed: string; className?: string }
```

### Rutas (`src/app/(purchase)/events/[slug]`)
```
checkout/page.tsx      # generateStaticParams, notFound, <PurchaseHeader currentStep={2} title="Datos y pago"
                       #   backHref=".../tickets" backLabel="Volver a entradas" /> + <CheckoutForm/>
confirmation/page.tsx  # generateStaticParams, notFound, <PurchaseHeader currentStep={3} title="Confirmacion"
                       #   backHref="/" backLabel="Ir al inicio" /> + <OrderConfirmation/>
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | shadcn `label`, `field`, `checkbox`, `radio-group`, `native-select` | src/components/ui/label.tsx, src/components/ui/field.tsx, src/components/ui/checkbox.tsx, src/components/ui/radio-group.tsx, src/components/ui/native-select.tsx | - | S |
| T2 | Hooks `useIsClient` y `useCountdown` (+ test); persist del store de seleccion y `useIsClient` en `TicketSelection`; check en pasos completados de `PurchaseHeader` | src/hooks/use-is-client.ts, src/hooks/use-countdown.ts, src/hooks/use-countdown.test.ts, src/modules/ticket/store/ticket-selection.store.ts, src/modules/ticket/components/ticket-selection.tsx, src/components/shared/purchase-header.tsx | - | S |
| T3 | Datos del modulo order: tipos, constantes, schema (+ test), store (+ test), utils (+ test) | src/modules/order/types/order.types.ts, src/modules/order/constants/order.constants.ts, src/modules/order/schemas/checkout.schema.ts, src/modules/order/schemas/checkout.schema.test.ts, src/modules/order/store/order.store.ts, src/modules/order/store/order.store.test.ts, src/modules/order/utils/order.utils.ts, src/modules/order/utils/order.utils.test.ts | T2 | S |
| T4 | Checkout: aviso de reserva, campos, resumen, contenedor | src/modules/order/components/hold-timer-notice.tsx, src/modules/order/components/buyer-fields.tsx, src/modules/order/components/payment-fields.tsx, src/modules/order/components/checkout-summary.tsx, src/modules/order/components/checkout-form.tsx | T1, T3 | P1 |
| T5 | Confirmacion: QR decorativo, tarjeta de entrada, pantalla | src/components/shared/decorative-qr.tsx, src/modules/order/components/order-ticket-card.tsx, src/modules/order/components/order-confirmation.tsx | T3 | P1 |
| T6 | Barrels y pages | src/modules/order/index.ts, src/modules/event/index.ts, src/app/(purchase)/events/[slug]/checkout/page.tsx, src/app/(purchase)/events/[slug]/confirmation/page.tsx | T4, T5 | S |

Orden: T1 → T2 → T3 → [T4 ‖ T5] → T6. ~31 archivos (5 shadcn, 5 tests); misma justificacion que 008/009. Si se
prefiere partir: Fase 1 = T1-T4 + page de checkout; Fase 2 = T5 + confirmacion.

## Criterios de aceptacion
- [ ] AC1: Con entradas elegidas, "Continuar" en `/events/bad-bunny-world-tour/tickets` lleva a `/checkout` con el
  header en paso 2 ("Entradas" con check), el aviso "Reservamos tus entradas por 10:00" bajando cada segundo y el
  resumen con las mismas lineas y total de la seleccion.
- [ ] AC2: Refrescar `/checkout` conserva la seleccion (sessionStorage), sin hydration warnings. Entrar sin seleccion
  muestra "No tienes entradas seleccionadas" + "Elegir entradas".
- [ ] AC3: "Metodo de pago": Tarjeta muestra numero, vencimiento, CVV y nombre; Yape y PagoEfectivo muestran su
  texto explicativo y ocultan los campos de tarjeta. Radios navegables con teclado.
- [ ] AC4: Pagar con el formulario vacio no navega: cada campo invalido muestra su mensaje en español, `aria-invalid`,
  y el foco va al primer campo con error. Con Yape no se piden datos de tarjeta.
- [ ] AC5: Sin aceptar terminos el boton Pagar indica "Acepta los terminos para continuar." y no confirma.
- [ ] AC6: Con datos validos, "Pagar S/ X" navega (replace) a `/confirmation`, la seleccion queda vacia y "atras" no
  vuelve al formulario con datos.
- [ ] AC7: `/confirmation` muestra "¡Compra confirmada!", "Pedido N.º TK-xxxxx", la tarjeta con evento, zona(s),
  cantidad, total pagado y QR decorativo "Entrada 1 de N", y "Que sigue". "Agregar al calendario" descarga un `.ics`
  valido; "Descargar PDF" abre el dialogo de impresion. Refrescar la conserva. Sin pedido: "No encontramos tu compra".
- [ ] AC8: Al vencer la reserva (00:00) el aviso cambia a rojo, Pagar se deshabilita y aparece "Volver a elegir
  entradas".
- [ ] AC9: Mobile: resumen plegable arriba (`aria-expanded`), barra fija "Pagar S/ X" abajo sin tapar contenido;
  desktop: formulario + aside sticky. Sin scroll horizontal en 375/768/1024/1440.
- [ ] AC10: El pedido guardado en `sessionStorage` no contiene datos de tarjeta.
- [ ] AC11: CTA indigo (sin naranja), `cursor-pointer`, foco visible, labels asociados a cada input.
- [ ] AC12: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `use-countdown.test.ts`: baja cada segundo con fake timers, formatea `MM:SS`, se detiene en 0 con `isExpired`.
- `checkout.schema.test.ts`: formulario valido => `{}`; cada regla de "Decisiones" (correo, DNI 8 digitos, CE,
  pasaporte, celular, tarjeta 16 digitos, vencimiento pasado, CVV, terminos); con Yape/PagoEfectivo ignora la tarjeta.
- `order.store.test.ts`: `placeOrder` guarda el pedido con `number` `TK-\d{5}` y `createdAt`, sin datos de tarjeta;
  `clearOrder`.
- `order.utils.test.ts`: `generateOrderNumber` con random inyectado; `buildEventCalendarFile` contiene
  `BEGIN:VEVENT`, `SUMMARY`, `DTSTART` en UTC y `LOCATION`; `formatPaymentMethod`.
- Tests existentes del store de seleccion siguen pasando con `persist`.
- Sin test: componentes de checkout/confirmacion y `DecorativeQr` (composicion/presentacionales sobre logica testeada).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Todos los metodos de pago confirman directo (sin pantalla intermedia de QR Yape / codigo PagoEfectivo).
- Reserva de 10 minutos que reinicia al entrar al checkout.
- Formulario sin `react-hook-form` (controlado + zod).
- Seleccion y ultimo pedido en `sessionStorage` (no `localStorage`).

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - Schema: `checkoutSchema` valida campo a campo y las reglas cruzadas (documento segun tipo, tarjeta segun metodo)
    van aparte en `validateCheckout`: zod no ejecuta `superRefine` si falla algun campo base y el formulario vacio
    tiene que mostrar todos los errores juntos. No existe `createCheckoutSchema`.
  - Helpers extra en `order.utils.ts` (con test): `getCheckoutFieldId` y `setCheckoutField`.
  - Componentes extra: `checkout-text-field.tsx` (Field + Label + Input + FieldError, DRY entre comprador y pago),
    `src/components/shared/empty-state.tsx` (estados vacios de checkout y confirmacion) y
    `src/modules/ticket/components/ticket-line-list.tsx` (lista de lineas compartida con `PurchaseSummary`).
  - `CheckoutSummary` exporta tambien `CheckoutSummaryToggle` (resumen plegable mobile).
  - La seleccion se limpia al montar la confirmacion (no en el submit del checkout), para evitar un flash del estado
    vacio antes de navegar.
  - Metodos de pago apilados en 1 columna en mobile ("PagoEfectivo" no entraba en 3 columnas a 375px).
  - Con checkbox/radio de base-ui el `id` queda en un input oculto: el foco del primer error va al control visible.
- Verificacion: 97 tests, `tsc`, `lint` y `build` OK. En Chromium: checkout vacio, seleccion -> checkout, refresh
  conserva seleccion, 9 errores con foco en el primero, Yape oculta tarjeta, pago -> confirmacion (replace), pedido en
  sessionStorage sin datos de tarjeta, seleccion limpia, descarga `.ics`, refresh de confirmacion, "atras" vuelve a
  entradas, sin pedido -> "No encontramos tu compra", reserva vencida (reloj adelantado 10 min) bloquea el pago; sin
  scroll horizontal a 375/640/768/1024/1440 ni errores de consola.
- Log de review: -
