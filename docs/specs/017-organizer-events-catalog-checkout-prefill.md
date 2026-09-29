# 017 — Eventos del organizador en el catalogo y checkout autocompletado

## Contexto
Pedidos del usuario (puntos 5 y 6):
- Los eventos publicados desde el panel del organizador (spec 014) tienen que aparecer en la landing y en la
  busqueda.
- El checkout se tiene que autocompletar con los datos del usuario con sesion.

Problema tecnico: el catalogo es estatico (`EVENTS_MOCK`, paginas prerenderizadas con `generateStaticParams`),
mientras que los eventos del organizador viven en `localStorage` del navegador, al que el servidor no tiene acceso.
La solucion es combinar ambas fuentes en el cliente y dar a las paginas de evento un fallback cliente para los slugs
que no estan en el mock.

**Depende de la 015** (geometria de recintos: los eventos del organizador arman su recinto con esas formas) y de la
**016** (cuentas).

## Alcance
- Incluye:
  - **Modulo nuevo `src/modules/catalog`**: compone `event`, `organizer`, `ticket` y `order` sin crear dependencias
    circulares (`event` no conoce a `organizer`).
    - `toCatalogEvent(orgEvent)`: convierte un `OrganizerEvent` publicado en `EventEntity`. Slug
      `<nombre-slugificado>-<sufijo del id>`, `priceFrom` = menor precio, disponibilidad segun vendidas/capacidad,
      flags de destacado en `false`.
    - `useCatalogEvents()`: `EVENTS_MOCK` + eventos publicados por **cualquier** organizador en este navegador. Es el
      catalogo publico: los compradores ven eventos de otros usuarios.
    - `getOrganizerVenueLayout(orgEvent)`: recinto de admision general con **los tipos de entrada del organizador**
      (nombre, precio, capacidad restante), no la plantilla por categoria.
  - **Landing**: "Proximos eventos" incluye los eventos publicados (wrapper cliente `CatalogUpcomingEvents`). Hero,
    Tendencias y Lo mas vendido siguen solo con el mock (dependen de flags editoriales).
  - **Busqueda `/events`**: `CatalogEventSearch` usa el catalogo combinado (texto, filtros, contadores y orden
    incluidos).
  - **Paginas de un evento del organizador** (`/events/<slug>`, `/tickets`, `/checkout`, `/confirmation`): si el slug
    no esta en el mock, la pagina renderiza un componente cliente que lo busca en el catalogo local. Si no existe,
    muestra "No encontramos este evento" + "Explorar eventos" (en vez del 404 de Next). Se reusa todo: detalle,
    seleccion por zonas, checkout y confirmacion.
  - **Ventas reales en el panel:** al comprar entradas de un evento del organizador, se suman a `sold` de cada tipo.
    El dashboard lo refleja (vendidas, ingresos, barra) y la capacidad restante baja.
  - **Checkout autocompletado:**
    - Con sesion: nombre y correo de la cuenta.
    - Documento, numero y celular del ultimo pedido de ese usuario, si existe.
    - Aviso "Completamos tus datos con tu cuenta" (editable).
    - Sin sesion: link "Inicia sesion para autocompletar tus datos" (`/login?redirect=<checkout>`).
- Excluye:
  - Que los eventos del organizador sean visibles en otro navegador o dispositivo (no hay backend).
  - Asientos numerados para eventos creados en el panel (solo admision general por tipo de entrada).
  - Hero, Tendencias y Lo mas vendido con eventos del organizador.
  - Editar o despublicar eventos publicados.

## Decisiones
- **Rutas iguales para ambos origenes:** `/events/<slug>`. Las paginas siguen prerenderizando los slugs del mock.
  Para los demas (`dynamicParams` por defecto) renderizan el fallback cliente en vez de `notFound()`. En el servidor
  no se puede saber si el slug existe en `localStorage`.
- **`dynamicParams`**: se verifica en `node_modules/next/dist/docs` que el default permita renderizar slugs no
  generados. Si la ruta queda dinamica, se documenta.
- **Imagen en data URL:** `EventCard`, detalle y demas usan `next/image`. Para `data:` se pasa `unoptimized` (se
  agrega la condicion donde haga falta, sin cambiar el aspecto).
- **Descripcion, direccion y horarios:** la direccion se arma como "<lugar>, <ciudad>"; apertura de puertas = inicio
  − 1 h; edad minima `null`.
- **Capacidad y ventas:** la zona de cada tipo muestra `quantity - sold` disponibles. Si llega a 0, la zona queda
  agotada. Si todo esta agotado, el evento tambien.
- **Autocompletado:** solo en la primera carga del formulario (no pisa lo que el usuario ya escribio). El formulario
  se monta despues de hidratar, asi los valores iniciales salen del store sin hydration mismatch.

## Reuso detectado
- `src/modules/event`: `EventEntity`, `EVENTS_MOCK`, `EventSearch`, `UpcomingEvents`, `EventDetailHero`,
  `EventDetailInfo`, `RelatedEvents`, `getEventBySlug`, `getRelatedEvents`.
- `src/modules/organizer`: `useOrganizerStore`, `OrganizerEvent`, utils de capacidad/vendidas/precio.
- `src/modules/ticket`: `TicketSelection`, `TicketOffer`, `ZonePriceList`, geometria de la 015.
- `src/modules/order`: `CheckoutForm` (suma `onOrderPlaced` y valores iniciales), `OrderConfirmation`, `useOrderStore`.
- `src/modules/auth`: `useAuthStore`, `getAuthHref`.
- `src/components/shared/empty-state.tsx`, `purchase-header.tsx`; `src/hooks/use-is-client.ts`.

## Contratos

### Catalog (`src/modules/catalog`)
```ts
export function slugify(value: string): string;                            // "Festival de Verano!" -> "festival-de-verano"
export function toCatalogEvent(event: OrganizerEvent): EventEntity;        // id "org-<id>", slug con sufijo del id
export function getPublishedCatalogEvents(events: readonly OrganizerEvent[]): EventEntity[];
export function getOrganizerVenueLayout(event: OrganizerEvent): VenueLayout;   // zonas = tipos (rect apilados)
export function findOrganizerEventBySlug(events, slug): OrganizerEvent | undefined;
export function applyOrderToOrganizerEvent(event: OrganizerEvent, lines: TicketLine[]): OrganizerEvent; // suma sold
export function useCatalogEvents(): EventEntity[];                         // mock + publicados (tras hidratar)

// componentes cliente
CatalogUpcomingEvents()                         // landing
CatalogEventSearch()                            // /events
LocalEventDetail({ slug })                      // /events/[slug] fallback
LocalEventTickets({ slug }) / LocalEventCheckout({ slug }) / LocalEventConfirmation({ slug })
```

### Order (`src/modules/order`)
```ts
export interface CheckoutFormProps { event: EventEntity; layout: VenueLayout; onOrderPlaced?: (order: Order) => void }
export function getCheckoutPrefill(user: AuthUser | null, orders: readonly Order[]): Partial<CheckoutFormValues>; // + test
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Catalog datos: conversion, layout del organizador, ventas + tests; hook | src/modules/catalog/utils/catalog.utils.ts, src/modules/catalog/utils/catalog.utils.test.ts, src/modules/catalog/hooks/use-catalog-events.ts | 015, 016 | S |
| T2 | Checkout autocompletado + `onOrderPlaced` + test del prefill | src/modules/order/components/checkout-form.tsx, src/modules/order/utils/order.utils.ts, src/modules/order/utils/order.utils.test.ts | - | P1 |
| T3 | Wrappers cliente (landing, busqueda) y fallbacks de paginas de evento | src/modules/catalog/components/catalog-upcoming-events.tsx, src/modules/catalog/components/catalog-event-search.tsx, src/modules/catalog/components/local-event-pages.tsx, src/modules/catalog/index.ts | T1 | P1 |
| T4 | `unoptimized` para data URLs en imagenes de evento | src/modules/event/components/event-card.tsx, src/modules/event/components/event-detail-hero.tsx, src/modules/order/components/order-ticket-card.tsx, src/modules/order/components/checkout-summary.tsx, src/modules/order/components/order-list.tsx, src/modules/order/components/order-ticket-viewer.tsx | - | P1 |
| T5 | Paginas: landing, busqueda y fallbacks en detalle/tickets/checkout/confirmacion | src/app/(main)/page.tsx, src/app/(main)/events/page.tsx, src/app/(main)/events/[slug]/page.tsx, src/app/(purchase)/events/[slug]/tickets/page.tsx, src/app/(purchase)/events/[slug]/checkout/page.tsx, src/app/(purchase)/events/[slug]/confirmation/page.tsx | T2, T3, T4 | S |

Orden: T1 → [T2 ‖ T3 ‖ T4] → T5. ~22 archivos.

## Criterios de aceptacion
- [ ] AC1: Publicar un evento desde `/organizer/events/new` y abrir `/`: aparece en "Proximos eventos" (tambien al
  filtrar por su categoria). En `/events` aparece en resultados, contadores y filtros (su ciudad y mes incluidos).
- [ ] AC2: Su tarjeta lleva a `/events/<slug>` con hero, info, lugar, precios por tipo de entrada y relacionados. Un
  slug inexistente muestra "No encontramos este evento".
- [ ] AC3: "Elegir entradas" muestra el recinto de admision general con los tipos del organizador (nombre, precio) y
  la capacidad restante. Se compra hasta la confirmacion y aparece en "Mis entradas".
- [ ] AC4: Tras la compra, `/organizer` del dueño muestra las vendidas e ingresos actualizados. Si se agota un tipo,
  la zona queda "Agotado".
- [ ] AC5: Checkout con sesion: nombre y correo precargados; con un pedido previo del usuario tambien documento y
  celular. Aviso "Completamos tus datos con tu cuenta". Sin sesion: link para iniciar sesion y volver al checkout.
- [ ] AC6: Los eventos del mock siguen prerenderizados y sin cambios. Sin hydration warnings.
- [ ] AC7: Imagenes subidas (data URL) se ven en tarjeta, detalle, checkout, confirmacion y "Mis entradas".
- [ ] AC8: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `catalog.utils.test.ts`: `slugify` (tildes, simbolos, espacios); `toCatalogEvent` (slug unico, `priceFrom`,
  disponibilidad por ventas, fecha en Lima, flags); solo publicados; layout con un rect por tipo y capacidad
  restante; `applyOrderToOrganizerEvent` suma por tipo y no pasa la capacidad.
- `order.utils.test.ts`: `getCheckoutPrefill` (sin usuario → {}, con usuario → nombre/correo, con pedido previo →
  documento/celular del ultimo pedido del usuario).

## Preguntas abiertas
Ninguna bloquea. Default: el catalogo publico muestra los eventos publicados por cualquier cuenta de este navegador
(simula un marketplace). Otra opcion seria mostrar solo los del usuario logueado.

## Estado
- Aprobacion humana: pendiente
- Fase: spec
- Log de review: -
