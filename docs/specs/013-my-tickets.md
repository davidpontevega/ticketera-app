# 013 — Mis entradas

## Contexto
Feature "6 · Mis entradas" del diseño de Claude Design (`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`, boards
`MyTickets.dc.html` y `MyTicketsMobile.dc.html`). Hoy "Ver mis entradas" (confirmacion) y "Mis entradas" (menu de
usuario) apuntan a `/my-tickets`, que da 404. La compra (spec 010) solo guarda el ultimo pedido en `sessionStorage`
y la sesion mock existe desde la spec 012.

Resultado esperado: `/my-tickets` (requiere sesion) muestra los pedidos del usuario en pestañas "Proximas" y
"Pasadas", y la entrada seleccionada con su QR decorativo, navegacion entre entradas del pedido, datos (zona/asiento,
titular, codigo, estado) y acciones (Descargar PDF, Agregar al calendario). Solo UI con mock data.

## Alcance
- Incluye:
  - **Historial de pedidos:** `order.store` pasa de `lastOrder` en `sessionStorage` a `orders: Order[]` en
    `localStorage` (la compra queda en "Mis entradas" aunque se cierre la pestaña). Cada pedido guarda un snapshot del
    evento (titulo, fecha, lugar, imagen, categoria) y `accountEmail` (usuario logueado al comprar, si habia).
  - **Pedidos de ejemplo:** 3 pedidos mock (2 proximos, 1 pasado) que se muestran a cualquier usuario logueado junto
    con sus compras reales, para que la pantalla tenga contenido sin tener que comprar antes.
  - Utils: entradas individuales de un pedido (una por cantidad, con asiento si es numerada y codigo
    `TK-xxxxx-01`), separar proximas/pasadas, pedidos de un usuario.
  - Pagina `/my-tickets` en `(main)`: guard de sesion (sin sesion → `router.replace` a
    `/login?redirect=/my-tickets`), titulo + pestañas con contador, lista de pedidos (columna en desktop, fila con
    scroll en mobile) y visor de la entrada seleccionada. Estado vacio por pestaña.
  - "Agregar al calendario" y "Descargar PDF" reusan lo de la confirmacion (se extrae la descarga `.ics` a util).
- Excluye:
  - Transferir/revender entradas, reembolsos, estado "usada"/"cancelada" (todas "Valida"; las pasadas "Finalizado").
  - Wallet (Apple/Google), QR real.
  - Guard de sesion en servidor/middleware (la sesion mock vive en el navegador).
- Backlog: 014 organizador. Pendiente general: filtrar eventos pasados en landing/busqueda cuando el mock tenga fechas
  pasadas.

## Decisiones
- **Snapshot del evento en el pedido:** asi un pedido pasado se puede mostrar aunque el evento ya no este en el
  catalogo (`EVENTS_MOCK` solo tiene eventos futuros y no se agregan pasados para no mostrarlos en la landing).
  `OrderEventSnapshot = Pick<EventEntity, "id" | "slug" | "title" | "category" | "date" | "venue" | "address" | "city" | "imageUrl">`.
- **Pertenencia:** un pedido es del usuario si `accountEmail === user.email` o `buyer.email === user.email`
  (normalizados). Los pedidos de ejemplo se generan para el usuario (titular = su nombre).
- **Proximas vs pasadas:** por fecha del evento contra "ahora"; proximas ascendente, pasadas descendente.
- **Seleccion:** estado local (pedido y entrada). Por defecto el primer pedido de la pestaña; `?order=TK-xxxxx`
  preselecciona (lo usa "Ver mis entradas" de la confirmacion para abrir la compra recien hecha).
- **Confirmacion (spec 010):** busca el pedido por `lastOrderNumber` en vez de `lastOrder`; "Ver mis entradas" va a
  `/my-tickets?order=<numero>`.
- **Estado de la entrada:** "Valida" (proximas, `text-success`) o "Finalizado" (pasadas, `text-muted-foreground`).
- **Colores:** tokens de MASTER.md. Pestañas como el board (activa `bg-foreground text-background`).

## Reuso detectado
- `src/components/shared/decorative-qr.tsx`, `empty-state.tsx`; `src/hooks/use-is-client.ts`.
- `src/modules/order`: `Order`, `useOrderStore`, `buildEventCalendarFile`, `formatPaymentMethod`, `order-ticket-card`
  (patron visual), `order-confirmation.tsx` (acciones calendario/PDF).
- `src/modules/auth`: `useAuthStore`, `getAuthHref`, `MY_TICKETS_PATH`.
- `src/modules/event`: `formatEventLongDate`, `formatEventTime`, `formatEventDateBadge`, `getEventCategoryOption`,
  `getEventHref`, `getEventSearchHref`.
- `src/components/ui/button.tsx`, `badge.tsx`.
- `lucide-react`: `CalendarDays`, `Clock`, `MapPin`, `ChevronLeft`, `ChevronRight`, `CalendarPlus`, `Download`,
  `Ticket`, `History`.
- No se instala nada.

## Contratos

### Tipos (`src/modules/order/types/order.types.ts`)
```ts
export type OrderEventSnapshot = Pick<EventEntity, "id" | "slug" | "title" | "category" | "date" | "venue" | "address" | "city" | "imageUrl">;
export interface Order {
  number: string; eventId: string; event: OrderEventSnapshot; accountEmail: string | null;
  buyer: BuyerInfo; paymentMethod: PaymentMethod; lines: TicketLine[]; total: number; createdAt: string;
}
export type PlaceOrderInput = Omit<Order, "number" | "createdAt">;
export interface OrderTicket {
  code: string;        // "TK-24817-01"
  index: number;       // 1..total
  total: number;
  zoneName: string;
  seatLabel: string | null; // "C12" en zonas numeradas
}
```

### Store (`src/modules/order/store/order.store.ts`)
```ts
export interface OrderState {
  orders: Order[];
  lastOrderNumber: string | null;
  placeOrder: (input: PlaceOrderInput) => Order;   // agrega al historial y marca como ultimo
  clearOrders: () => void;
}
// persist en localStorage, name "ticketera-orders"
```

### Utils (`src/modules/order/utils/order.utils.ts`)
```ts
export function toOrderEventSnapshot(event: EventEntity): OrderEventSnapshot;
export function getOrderTickets(order: Order): OrderTicket[];
export function isOrderUpcoming(order: Order, now?: Date): boolean;
export function splitOrdersByTime(orders: readonly Order[], now?: Date): { upcoming: Order[]; past: Order[] };
export function getUserOrders(orders: readonly Order[], email: string): Order[];
export function downloadEventCalendar(event: OrderEventSnapshot): void; // Blob .ics (cliente)
// buildEventCalendarFile pasa a recibir OrderEventSnapshot (EventEntity es compatible)
```

### Mocks (`src/modules/order/mocks/order.mock.ts`)
```ts
export function getDemoOrders(user: AuthUser): Order[];
//  TK-24817 Bad Bunny (2 x Campo General), TK-24790 Coldplay (2 x Tribuna Oriente, asientos C12 y C13),
//  TK-23105 evento pasado "Festival Selvamonos 2026" (mayo 2026, 1 x General). Titular = user.fullName.
```

### Componentes (`src/modules/order/components`)
```ts
// my-tickets.tsx — "use client". Guard de sesion, pestañas, seleccion (lee ?order=), compone lista + visor.
// order-list.tsx — presentacional. <ul aria-label="Pedidos"> de botones con aria-current (imagen, titulo,
//   fecha corta · ciudad, "N entradas · zona"). Columna en lg, fila con scroll-snap en mobile.
export interface OrderListProps { orders: readonly Order[]; selectedNumber: string | null; onSelect: (n: string) => void }
// order-ticket-viewer.tsx — "use client". Article: imagen + badge de fecha, titulo, fecha/hora/lugar, linea
//   troquelada, DecorativeQr (seed = codigo), "Entrada n de N" (aria-live) con anterior/siguiente, dl
//   (Zona/Asiento, Titular, Codigo, Estado), acciones Descargar PDF (window.print) y Agregar al calendario.
export interface OrderTicketViewerProps { order: Order; isPast: boolean }
```
`order-confirmation.tsx` usa `downloadEventCalendar`, `lastOrderNumber` y el link `/my-tickets?order=`.

### Ruta
```
src/app/(main)/my-tickets/page.tsx   # metadata "Mis entradas | Ticketera"; <Suspense><MyTickets/></Suspense> (lee ?order=)
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Historial de pedidos: tipos, store (localStorage), utils, mocks + tests; checkout y confirmacion adaptados | src/modules/order/types/order.types.ts, src/modules/order/store/order.store.ts, src/modules/order/store/order.store.test.ts, src/modules/order/utils/order.utils.ts, src/modules/order/utils/order.utils.test.ts, src/modules/order/mocks/order.mock.ts, src/modules/order/components/checkout-form.tsx, src/modules/order/components/order-confirmation.tsx | - | S |
| T2 | Lista de pedidos y visor de entrada | src/modules/order/components/order-list.tsx, src/modules/order/components/order-ticket-viewer.tsx | T1 | P1 |
| T3 | Contenedor (+ test), barrel y page | src/modules/order/components/my-tickets.tsx, src/modules/order/components/my-tickets.test.tsx, src/modules/order/index.ts, src/app/(main)/my-tickets/page.tsx | T2 | S |

Orden: T1 → T2 → T3. ~14 archivos.

## Criterios de aceptacion
- [ ] AC1: Sin sesion, `/my-tickets` redirige (replace) a `/login?redirect=/my-tickets`; tras ingresar vuelve a
  `/my-tickets`.
- [ ] AC2: Con sesion: titulo "Mis entradas", pestañas "Proximas (n)" y "Pasadas (n)" con contadores correctos, y los
  pedidos de ejemplo (2 proximos, 1 pasado) mas las compras reales del usuario.
- [ ] AC3: La lista marca el pedido seleccionado (`aria-current`); al elegir otro, el visor cambia y vuelve a la
  entrada 1.
- [ ] AC4: El visor muestra imagen con badge de fecha, titulo, fecha larga, hora y lugar (hora de Lima), QR distinto
  por entrada, "Entrada n de N" con anterior/siguiente deshabilitados en los extremos, y Zona (con asiento si aplica),
  Titular, Codigo `TK-xxxxx-0n` y Estado "Valida" (o "Finalizado" en pasadas).
- [ ] AC5: "Agregar al calendario" descarga el `.ics` del evento; "Descargar PDF" abre la impresion.
- [ ] AC6: Una compra hecha en el checkout aparece en "Proximas" (tambien tras cerrar y abrir la pestaña) si el
  usuario logueado es quien compro o el correo del comprador coincide; "Ver mis entradas" de la confirmacion abre
  `/my-tickets?order=<numero>` con esa compra seleccionada. Otro usuario no la ve.
- [ ] AC7: La confirmacion sigue funcionando (recarga incluida) con el historial nuevo.
- [ ] AC8: Mobile: pedidos en fila horizontal con scroll, visor debajo; sin scroll horizontal de pagina en
  375/768/1024/1440. Foco visible, botones con `aria-label`.
- [ ] AC9: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `order.store.test.ts`: `placeOrder` agrega al historial (sin borrar anteriores), setea `lastOrderNumber`, persiste en
  `localStorage` sin datos de tarjeta; `clearOrders`.
- `order.utils.test.ts`: `getOrderTickets` (cantidad total, codigos `-01..`, asientos repartidos, zona general sin
  asiento); `isOrderUpcoming`/`splitOrdersByTime` (orden de cada grupo); `getUserOrders` (por cuenta o por correo del
  comprador, case-insensitive); `toOrderEventSnapshot`.
- `my-tickets.test.tsx`: sin sesion llama `router.replace` al login; con sesion muestra contadores de pestañas y
  "Entrada 1 de 2"; "Entrada siguiente" avanza y se deshabilita en la ultima.
- Tests existentes del checkout/confirmacion siguen pasando.

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Pedidos de ejemplo visibles para cualquier usuario logueado (junto a sus compras reales).
- Historial en `localStorage` (antes era solo el ultimo pedido en `sessionStorage`).

## Estado
- Aprobacion humana: pendiente
- Fase: spec
- Log de review: -
