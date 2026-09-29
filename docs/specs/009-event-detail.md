# 009 — Detalle de evento

## Contexto
Segunda feature del flujo de compra del diseño de Claude Design
(`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`, boards `EventDetail.dc.html` y `EventDetailMobile.dc.html`,
"3 · Detalle de evento"). La seleccion de entradas (spec 008) ya existe en `/events/[slug]/tickets` y su link
"Volver al evento" hoy da 404.

Resultado esperado: en `/events/<slug>` el usuario ve el evento (hero, descripcion, informacion importante, lugar),
los precios por zona del recinto (los mismos de la spec 008) y un CTA a `/events/<slug>/tickets`. Las cards y el hero
de la landing pasan a enlazar a este detalle. Solo UI con mock data.

## Alcance
- Incluye:
  - Campos nuevos en `EventEntity` para el detalle (`description`, `address`, `doorsOpen`, `minAge`) y su mock.
  - Zona horaria fija `America/Lima` en los formatters de fecha del evento (hoy las paginas estaticas se generan en
    UTC y un show de las 21:00 se ve "02:00 a. m." del dia siguiente) + formatters nuevos de fecha larga y hora.
  - `getRelatedEvents` (misma categoria primero).
  - Pagina `/events/[slug]` dentro de `(main)` (con `SiteHeader`/`SiteFooter`), desktop y mobile, `notFound()` y
    `generateMetadata` con el titulo del evento.
  - Hero con acciones Guardar (toggle local) y Compartir (`navigator.share` o copiar link).
  - Lista de precios por zona + CTA: aside sticky en desktop y barra fija abajo en mobile.
  - "Tambien te puede interesar" reusando `EventCard`.
  - Links reales a `/events/<slug>` desde `EventCard`, `HeroCarousel` y `TrendingSidebar`.
- Excluye:
  - Mapa embebido del lugar (Google Maps iframe/API). Se muestra un bloque decorativo + link "Como llegar" a Google Maps.
  - Persistir "Guardar" (favoritos) — backlog de "Mis entradas"/cuenta.
  - Header mobile propio del board (volver + guardar + compartir): se mantiene `SiteHeader` en todas las paginas de
    `(main)` y las acciones viven en el hero.
  - Pagina de busqueda (spec 011): el link "Ver mas" de relacionados va a `/#upcoming-events`.
- Backlog: roadmap de la spec 008 (010 checkout, 011 busqueda, 012 auth, 013 mis entradas, 014 organizador).

## Decisiones
- **Colores:** tokens de MASTER.md, no los hex del board (CTA indigo `--cta`, no naranja; precios en
  `text-foreground`/`text-cta`, no `#C2410C`). Panel del hero: `bg-indigo-950` (`#1E1B4B`, el mismo navy del board;
  clase de Tailwind, no token nuevo).
- **Precios por zona:** salen de `getVenueLayout(event)` del modulo `ticket` (spec 008), asi detalle y seleccion
  muestran siempre lo mismo. El componente de lista vive en `ticket` porque es data del recinto.
- **Evento agotado:** el CTA queda deshabilitado con texto "Agotado" y todas las zonas figuran agotadas (ya lo hace
  `getVenueLayout`).
- **Zona horaria:** `EVENT_TIME_ZONE = "America/Lima"` en los formatters de fecha de un evento (`formatEventDate`,
  `formatEventDateBadge` y los nuevos). `formatDateRangeLabel` no cambia: formatea fechas elegidas por el usuario en
  su calendario local.
- **Guardar/Compartir:** client component chico. Guardar es `useState` con `aria-pressed` (sin persistencia).
  Compartir usa `navigator.share` si existe; si no, `navigator.clipboard.writeText(location.href)` y muestra
  "Enlace copiado" por 2 s.
- **Relacionados:** hasta 4, primero de la misma categoria y luego el resto, sin el evento actual, en orden del mock.
  Desktop grid de 4 columnas; mobile fila horizontal con scroll-snap (mismo patron de "Lo mas vendido").

## Reuso detectado
- `src/components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `separator.tsx`.
- `src/modules/event`: `EventCard`, `EventAvailabilityBadge`, `getEventCategoryOption` (label de categoria),
  `formatEventPrice`, `getEventBySlug`, `EVENTS_MOCK`.
- `src/modules/ticket`: `getVenueLayout` (zonas y precios).
- Patron de barra fija mobile + aside sticky de `purchase-summary.tsx` (spec 008).
- Patron de fila con scroll-snap de `best-seller-events.tsx`.
- `lucide-react`: `CalendarDays`, `Clock`, `MapPin`, `DoorOpen`, `IdCard`, `QrCode`, `Heart`, `Share2`, `ArrowRight`,
  `ShieldCheck`, `Navigation`.
- shadcn `breadcrumb` — **instalar** con `npx shadcn@latest add breadcrumb` (ver Preguntas abiertas).

## Contratos

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export interface EventEntity {
  // ...campos existentes sin cambios
  description: string; // 2-3 oraciones: artista/formato, duracion, que incluye la entrada
  address: string;     // "Av. Jose Diaz s/n, Cercado de Lima"
  doorsOpen: string;   // ISO 8601, apertura de puertas (antes de `date`)
  minAge: number | null; // null = apto para todo publico
}
```
Actualizar los 14 eventos de `event.mock.ts` y las 3 fixtures de `filterFixtureEvents` en `event.utils.test.ts`.

### Constantes (`src/modules/event/constants/event.constants.ts`)
`export const EVENT_TIME_ZONE = "America/Lima";`

### Utils (`src/modules/event/utils/event.utils.ts`)
```ts
export function formatEventLongDate(isoDate: string): string; // "sabado, 14 de noviembre"
export function formatEventTime(isoDate: string): string;     // "21:00"
export function formatEventMinAge(minAge: number | null): string; // "+18 años" | "Todo publico"
export function getRelatedEvents(events: readonly EventEntity[], event: EventEntity, limit?: number): EventEntity[];
//  limit default 4; misma categoria primero, luego el resto; excluye event.id; no muta.
export function getEventMapsUrl(event: EventEntity): string;
//  https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(venue, address, city)>
```
`formatEventDate` y `formatEventDateBadge` agregan `timeZone: EVENT_TIME_ZONE`.

### Componentes del modulo event (`src/modules/event/components`)
```ts
// event-detail-hero.tsx — server. Breadcrumb (Inicio / <Categoria> / <titulo>) + panel indigo-950:
//   desktop grid [540px_1fr] (texto | imagen), mobile imagen arriba (h-56) y texto abajo.
//   Chip de categoria, h1, lista con fecha larga, hora e "venue, city", CTA "Comprar entradas · desde S/ X"
//   (solo lg+) + <EventDetailActions/>.
export interface EventDetailHeroProps { event: EventEntity }

// event-detail-actions.tsx — "use client". Botones Guardar (aria-pressed, Heart relleno) y Compartir.
export interface EventDetailActionsProps { title: string; className?: string }

// event-detail-info.tsx — server. Secciones "Acerca del evento" (description), "Informacion importante"
//   (dl 2x2: Apertura de puertas, Inicio del show, Edad minima, Ingreso "Entrada digital con QR") y "Lugar"
//   (bloque decorativo bg-primary/5 con MapPin + venue, address, city + boton outline "Como llegar" -> Maps, target _blank).
export interface EventDetailInfoProps { event: EventEntity }

// related-events.tsx — server. "Tambien te puede interesar" + link "Ver mas eventos" (/#upcoming-events).
//   null si events.length === 0.
export interface RelatedEventsProps { events: readonly EventEntity[] }
```

### Componentes del modulo ticket (`src/modules/ticket/components`)
```ts
// zone-price-list.tsx — server. <ul> de zonas: swatch de color, nombre, badge "Ultimas entradas" si few-left,
//   precio o "Agotado" (texto muted si sold-out).
export interface ZonePriceListProps { zones: readonly VenueZone[]; className?: string }

// ticket-offer.tsx — server. Desktop (lg+): aside sticky top-24 "Entradas desde S/ X" + <ZonePriceList/> +
//   CTA "Elegir entradas" -> ticketsHref + nota "Pago seguro · Entrada digital con QR".
//   Mobile (< lg): barra fixed bottom "Desde S/ X" + CTA "Comprar entradas".
//   Evento agotado: CTA deshabilitado "Agotado".
export interface TicketOfferProps { layout: VenueLayout; priceFrom: number; ticketsHref: string; isSoldOut: boolean }
```
En mobile la seccion "Entradas" del board (lista de zonas dentro del contenido) se arma en la page con
`<ZonePriceList className="lg:hidden" />`.

### Links de la landing
- `event-card.tsx`: `<a href="#">` → `<Link href={`/events/${event.slug}`}>` (mismo overlay `absolute inset-0`).
- `hero-carousel.tsx`: CTA "Comprar entradas" → `/events/<slug>`.
- `trending-sidebar.tsx`: items → `/events/<slug>`.

### Barrels
- `src/modules/event/index.ts`: `EventDetailHero`, `EventDetailInfo`, `RelatedEvents`, `getRelatedEvents`,
  `formatEventLongDate`, `formatEventTime`, `EVENT_TIME_ZONE` (+ tipos de props).
- `src/modules/ticket/index.ts`: `ZonePriceList`, `TicketOffer` (+ tipos de props).

### Ruta (`src/app/(main)/events/[slug]/page.tsx`)
```tsx
export function generateStaticParams() { return EVENTS_MOCK.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata>;
//  { title: `${event.title} | Ticketera` } ; slug inexistente -> {}
export default async function EventDetailPage({ params }: PageProps<"/events/[slug]">)
//  notFound() si no existe; layout = getVenueLayout(event)
//  <EventDetailHero/> ; grid lg:[1fr_400px]: (<EventDetailInfo/> + <ZonePriceList lg:hidden/>) | <TicketOffer/> ;
//  <RelatedEvents events={getRelatedEvents(EVENTS_MOCK, event)} /> ; pb-24 en mobile por la barra fija.
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar shadcn `breadcrumb` | src/components/ui/breadcrumb.tsx | - | S |
| T2 | Campos nuevos + mock; `EVENT_TIME_ZONE`; formatters, `getRelatedEvents`, `getEventMapsUrl` + tests | src/modules/event/types/event.types.ts, src/modules/event/mocks/event.mock.ts, src/modules/event/constants/event.constants.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts | - | S |
| T3 | Hero, acciones (+ test) e info del detalle | src/modules/event/components/event-detail-hero.tsx, src/modules/event/components/event-detail-actions.tsx, src/modules/event/components/event-detail-actions.test.tsx, src/modules/event/components/event-detail-info.tsx | T1, T2 | P1 |
| T4 | `ZonePriceList` y `TicketOffer` | src/modules/ticket/components/zone-price-list.tsx, src/modules/ticket/components/ticket-offer.tsx | T2 | P1 |
| T5 | `RelatedEvents` + links reales en card/hero/trending (+ test del link en la card) | src/modules/event/components/related-events.tsx, src/modules/event/components/event-card.tsx, src/modules/event/components/event-card.test.tsx, src/modules/event/components/hero-carousel.tsx, src/modules/event/components/trending-sidebar.tsx | T2 | P1 |
| T6 | Barrels y page | src/modules/event/index.ts, src/modules/ticket/index.ts, src/app/(main)/events/[slug]/page.tsx | T3, T4, T5 | S |

Orden: T1 → T2 → [T3 ‖ T4 ‖ T5] → T6. ~19 archivos (6 son tests/tipos/mock/constantes); misma justificacion que la
008: la pagina no es util partida.

## Criterios de aceptacion
- [ ] AC1: `/events/bad-bunny-world-tour` muestra header y footer del sitio, breadcrumb "Inicio / Conciertos / Bad
  Bunny - World Tour", hero con chip "Conciertos", titulo, "sabado, 14 de noviembre", "21:00", "Estadio Nacional,
  Lima" e imagen. El `<title>` del documento es "Bad Bunny - World Tour | Ticketera".
- [ ] AC2: `/events/no-existe` responde 404.
- [ ] AC3: "Acerca del evento", "Informacion importante" (apertura de puertas, inicio, edad minima, ingreso con QR) y
  "Lugar" con direccion y "Como llegar" que abre Google Maps en otra pestaña.
- [ ] AC4: Desktop (>= 1024px): aside sticky con "Entradas desde S/ 250", las 5 zonas (VIP Agotado, General 450,
  Occidente 380 + "Ultimas entradas", Oriente 320, Norte 250) y "Elegir entradas" que lleva a
  `/events/bad-bunny-world-tour/tickets`. Los precios coinciden con la pagina de seleccion.
- [ ] AC5: Mobile: lista de zonas dentro del contenido y barra fija abajo "Desde S/ 250" + "Comprar entradas"; el
  contenido no queda tapado por la barra.
- [ ] AC6: Guardar alterna `aria-pressed` y el icono relleno; Compartir usa el share nativo o copia el link y muestra
  "Enlace copiado".
- [ ] AC7: Un evento agotado (`/events/romeo-y-julieta`) muestra todas las zonas "Agotado" y el CTA deshabilitado.
- [ ] AC8: "Tambien te puede interesar" muestra hasta 4 `EventCard` (misma categoria primero, sin el evento actual);
  grid de 4 en desktop y scroll-snap horizontal en mobile.
- [ ] AC9: En `/`, click en una card, en "Comprar entradas" del hero o en un item de Tendencias navega a
  `/events/<slug>`. "Volver al evento" de la pagina de seleccion ya no da 404.
- [ ] AC10: Las fechas/horas del evento se ven en hora de Lima en todas las paginas (card de la landing incluida),
  sin hydration warnings.
- [ ] AC11: CTA en `--cta` (indigo, sin naranja), `cursor-pointer` y foco visible; sin scroll horizontal en
  375/768/1024/1440.
- [ ] AC12: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `event.utils.test.ts`: `formatEventLongDate` y `formatEventTime` devuelven "sabado, 14 de noviembre"/"21:00" para
  Bad Bunny (independiente de `process.env.TZ`); `formatEventMinAge`; `getRelatedEvents` (misma categoria primero,
  excluye el actual, respeta `limit`, no muta); `getEventMapsUrl` codifica la query. Fixtures con los campos nuevos.
- `event-detail-actions.test.tsx`: Guardar alterna `aria-pressed`; Compartir llama `navigator.share` si existe y
  `navigator.clipboard.writeText` si no (y muestra "Enlace copiado").
- `event-card.test.tsx`: el link de la card apunta a `/events/<slug>`.
- Sin test: hero, info, `ZonePriceList`, `TicketOffer`, `RelatedEvents` (presentacionales).

## Preguntas abiertas
- **Instalacion de `breadcrumb` (bloqueante para T1):** este entorno cloud no llega a `ui.shadcn.com` (bloqueado por
  la politica de red), asi que `npx shadcn@latest add breadcrumb` falla aca. Opciones:
  1. Lo corres tu en tu maquina, lo pusheas a `main` y sigo (recomendado, respeta la regla de reuso).
  2. Agregar `ui.shadcn.com` a la lista de red permitida del entorno.
  3. Hacer las migas a mano como `<nav aria-label="Ruta"><ol>` (3 links; excepcion documentada a la regla shadcn).
- Defaults tomados (ajustables): `SiteHeader` tambien en mobile (no el header propio del board); textos del mock
  (descripcion, direccion, edad) inventados por evento.

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - `breadcrumb.tsx` generado desde el fuente oficial de shadcn (`apps/v4/registry/bases/base/ui/breadcrumb.tsx` +
    clases de `style-nova.css`), igual a lo que instala el CLI: el registro `ui.shadcn.com` esta bloqueado en el entorno.
  - `EventDetailHero` recibe tambien `ticketsHref` (el modulo event no conoce la ruta de entradas).
  - Helper nuevo `getEventHref(slug)` en `event.utils.ts`, usado por card, hero, tendencias, detalle y seleccion (DRY).
  - Fix en `EventCard`: imagen y contenido con `pointer-events-none` (el favorito con `pointer-events-auto`); antes
    tapaban el link overlay y el click en la card no navegaba.
  - Test existente de `formatEventDateBadge` usa una fecha fija en hora de Lima (fallaba con `TZ=Asia/Tokyo`).
- Verificacion: 78 tests (tambien con `TZ` UTC, Asia/Tokyo, America/Lima, Pacific/Honolulu), `tsc`, `lint` y `build`
  OK; en Chromium: 1440px y 375px, detalle -> entradas -> volver, evento agotado, links de la landing, 404, sin
  scroll horizontal ni errores de hidratacion con el navegador en Asia/Tokyo y Pacific/Honolulu.
- Log de review: -
