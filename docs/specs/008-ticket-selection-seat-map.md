# 008 — Seleccion de entradas con mapa de zonas y asientos

## Contexto
La landing esta cerrada (specs 001-007). Seguimos con las features del diseño de Claude Design
(`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`, boards `Tickets.dc.html` y `TicketsMobile.dc.html`,
"4 · Seleccion de entradas").

Esta spec es la primera del flujo de compra porque las demas dependen de ella: el detalle de evento (spec 009)
muestra las zonas y precios que se definen aca, y el checkout (spec 010) lee la seleccion del store que se crea aca.

Alcance del proyecto en esta etapa: **solo UI/UX con mock data**, sin backend ni base de datos.

Resultado esperado: en `/events/<slug>/tickets` el usuario ve el mapa de zonas del recinto, elige zona, y
- en zonas de **admision general** (Campo, Galeria...) elige cantidad con +/−;
- en zonas **numeradas** (Tribunas, Platea...) ve un mapa de asientos con zoom/pan y elige asientos individuales.

El resumen "Tu compra" (aside en desktop, barra fija abajo en mobile) muestra lineas y total en vivo.

### Roadmap de features (backlog, una spec por item)
| Spec | Feature | Boards del diseño |
|------|---------|-------------------|
| 008 | Seleccion de entradas + mapa de asientos (esta) | Tickets, TicketsMobile |
| 009 | Detalle de evento `/events/[slug]` + links desde las cards | EventDetail, EventDetailMobile |
| 010 | Checkout y confirmacion | Checkout, Confirmation (+ Mobile) |
| 011 | Busqueda y listado | Search, SearchMobile |
| 012 | Login y registro | Auth, AuthMobile |
| 013 | Mis entradas | MyTickets, MyTicketsMobile |
| 014 | Panel de organizador y crear evento | OrgDashboard, OrgCreate (+ Mobile) |

## Decision: libreria para el mapa de asientos

| Opcion | Veredicto | Motivo |
|--------|-----------|--------|
| **SVG propio en React + `react-zoom-pan-pinch`** | **Elegida** | SVG nativo: cada asiento es un nodo React accesible (foco, `role="checkbox"`, `aria-label`), se estiliza con Tailwind y tokens del proyecto, funciona con SSR y en tests jsdom. `react-zoom-pan-pinch` (MIT, v4.2, peer `react: *`, mantenida) agrega zoom con rueda/botones, pan con arrastre y **pinch en mobile**. Sin canvas, sin D3. |
| `react-konva` + `konva` (canvas) | Descartada | Muy buena para decenas de miles de asientos, pero `react-konva@19.3` exige React `^19.3` (tenemos 19.2.8), requiere `dynamic(..., { ssr: false })` y el canvas no es accesible por teclado/lector de pantalla sin reimplementarlo. Excede el tamaño de nuestros recintos (cientos de asientos por zona). |
| `@alisaitteke/seatmap-canvas` | Descartada | Peer `react ^18` (incompatible con React 19), API imperativa sobre D3. |
| Seats.io (`@seatsio/seatsio-react`) | Descartada para esta etapa | Estandar de la industria, pero es SaaS pago: requiere cuenta, disenar el recinto en su editor y backend para holds. Candidata para produccion cuando haya backend. |
| `seatchart` | Descartada | Sin mantenimiento desde 2022, solo grillas tipo cine. |

**Patron de dos niveles** (como Ticketmaster/Joinnus): primero el mapa de **zonas** (el grid del diseño, en HTML
accesible), y solo para la zona numerada elegida se abre el mapa de **asientos** en SVG con zoom. Asi nunca se
dibujan miles de asientos a la vez y mobile sigue siendo usable.

## Alcance
- Incluye:
  - Rutas con grupos: `(main)` con `SiteHeader`/`SiteFooter` (landing y futuras paginas publicas) y `(purchase)`
    sin nav ni footer (el diseño usa un header de compra propio con pasos y "Compra segura").
  - Modulo nuevo `src/modules/ticket`: tipos, 3 plantillas de recinto mock, utils puras, store zustand de seleccion y
    componentes de la pagina.
  - `getEventBySlug` en `event.utils.ts` (la pagina la necesita; la spec 009 la reusa).
  - Componentes compartidos `QuantityStepper` y `PurchaseHeader` (los reusa el checkout en la 010).
  - Pagina `/events/[slug]/tickets`, desktop y mobile, con `notFound()` si el slug no existe.
- Excluye:
  - Detalle de evento (spec 009). El link "Volver al evento" apunta a `/events/<slug>`, que da 404 hasta la 009.
  - Checkout (spec 010). "Continuar" navega a `/events/<slug>/checkout`, que da 404 hasta la 010.
  - Holds/timer de reserva, "mejor asiento disponible", filas curvas, precios distintos por fila, persistencia del
    store en `localStorage`, editor de recintos.
- Backlog: ver roadmap arriba.

## Decisiones
- **Colores:** se siguen los tokens del proyecto (`design-system/ticketera/MASTER.md`), no los hex del board: el board
  todavia usa CTA naranja `#F97316` y grises zinc; MASTER (revision 6) define CTA = indigo `--cta` y grises slate. Los
  colores de zona son la escala indigo del board (`#4F46E5`, `#818CF8`, `#A5B4FC`, `#C7D2FE`), zona agotada `bg-muted`
  con texto `muted-foreground`.
- **Estados de asiento:** disponible (borde/relleno de color de la zona), seleccionado (`fill-primary` + check),
  ocupado (`fill-muted` + `cursor-not-allowed`, `aria-disabled`). Leyenda visible bajo el mapa.
- **Maximo 6 entradas por zona** (`TICKET_MAX_PER_ZONE`, igual al board). En zona numerada, al llegar a 6 los
  asientos disponibles no seleccionados quedan deshabilitados y se muestra el texto "Maximo 6 entradas por zona.".
- **Precios y plantillas por categoria**, derivados de `event.priceFrom` con un factor por zona (redondeo a 10). Asi
  cada evento del mock tiene un recinto funcional sin escribir un mock por evento. Para Bad Bunny (`priceFrom: 250`)
  da exactamente los precios del board: Norte 250, Oriente 320, Occidente 380, General 450, VIP 690.
- **Asientos ocupados deterministicos** (hash del id del asiento), no `Math.random`: evita hydration mismatch y hace
  los tests estables. Zonas `few-left` ~75% ocupadas, `available` ~25%.
- **Evento agotado** (`availability: "sold-out"`): todas las zonas quedan `sold-out`.
- **Store en memoria** (zustand sin `persist`): se resetea si cambia el evento. YAGNI hasta que haya checkout.

## Reuso detectado
- `src/components/ui/button.tsx` — CTA "Continuar", botones de zoom, botones del stepper.
- `src/components/ui/card.tsx` — contenedores "Elige tu zona", "Elige tus asientos", "Entradas", "Tu compra".
- `src/components/ui/badge.tsx` — badge "Ultimas entradas" / "Agotado".
- `src/modules/event`: `EventEntity`, `EventAvailability`, `EVENT_AVAILABILITY_LABEL`, `formatEventPrice`,
  `formatEventDate`, `EVENTS_MOCK`. `event-availability-badge.tsx` se reusa para el estado de cada zona.
- `src/lib/utils.ts` — `cn`.
- Patron de store de `event-filter.store.ts` (zustand `create<State>()`) y su test.
- `lucide-react`: `ArrowLeft`, `ArrowRight`, `Lock`, `Minus`, `Plus`, `ZoomIn`, `ZoomOut`, `RotateCcw`, `Check`.
- `SiteHeader` / `SiteFooter` sin cambios (solo se mueven de layout).
- shadcn no tiene "number stepper" ni "stepper de pasos" → `QuantityStepper` y `PurchaseHeader` se crean en
  `src/components/shared` (sin logica de negocio, props claras).
- Instalar: `npm install react-zoom-pan-pinch` (unica dependencia nueva).

## Contratos

### Tipos (`src/modules/ticket/types/ticket.types.ts`)
```ts
import type { EventAvailability } from "@/modules/event";

export type ZoneSeating = "general" | "numbered";
export type SeatStatus = "available" | "occupied";

export interface Seat {
  id: string;        // "<zoneId>-<row>-<number>", ej. "occidente-C-12"
  row: string;       // "A".."J"
  number: number;    // 1..seatsPerRow
  status: SeatStatus;
}

export interface ZoneGridArea { column: string; row: string } // valores CSS grid, ej. { column: "1", row: "1 / 4" }

export interface VenueZone {
  id: string;
  name: string;            // "Tribuna Occidente"
  shortName: string;       // "Occidente" (mobile)
  price: number;           // PEN, unidades
  availability: EventAvailability;
  seating: ZoneSeating;
  colorClassName: string;  // fondo de la zona, ej. "bg-[#818CF8] text-[#1E1B4B]"
  seatClassName: string;   // relleno del asiento disponible, ej. "fill-[#818CF8]"
  area: ZoneGridArea;
  seats: Seat[];           // [] si seating === "general"
}

export interface VenueLayout {
  id: "stadium" | "theater" | "general-admission";
  stageLabel: string;          // "Escenario" | "Escenario" | "Ingreso"
  stageArea: ZoneGridArea;
  gridTemplateColumns: string; // ej. "minmax(0,1fr) minmax(0,3fr) minmax(0,1fr)"
  gridTemplateRows: string;
  zones: VenueZone[];
}

export interface TicketLine {
  zoneId: string;
  zoneName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  seatLabels: string[]; // ["C12", "C13"]; [] en zona general
}
```

### Plantillas (`src/modules/ticket/mocks/venue.mock.ts`)
Plantillas sin precio (factor por zona) + `buildSeats`. Asignacion por categoria:
- `stadium` — `concerts`, `sports`, `festivals`: Escenario, Campo VIP (general, x2.76, **sold-out**), Campo General
  (general, x1.8), Tribuna Occidente (numerada 10 filas x 24, x1.52, **few-left**), Tribuna Oriente (numerada
  10 x 24, x1.28), Tribuna Norte (general, x1). Posiciones de grid iguales al board.
- `theater` — `theater`, `standup`, `cinema`, `family`, `conferences`: Escenario, Platea (numerada 12 x 20, x2.2),
  Palcos izquierda/derecha (general, x3, few-left), Mezzanine (numerada 6 x 22, x1.6), Galeria (general, x1).
- `general-admission` — `arts`, `fairs`: Ingreso + una zona "Entrada general" (general, x1).

### Utils (`src/modules/ticket/utils/ticket.utils.ts`)
```ts
export function buildSeats(zoneId: string, rows: number, seatsPerRow: number, occupancy: number): Seat[];
//  filas "A".. ; status "occupied" si hash(id) % 100 < occupancy*100. Deterministico.
export function getVenueLayout(event: EventEntity): VenueLayout;
//  plantilla segun categoria, price = Math.round(event.priceFrom * factor / 10) * 10 (la zona x1 = priceFrom),
//  si event.availability === "sold-out" -> todas las zonas sold-out.
export function getTicketLines(layout: VenueLayout, quantities: Record<string, number>,
  seatIds: Record<string, string[]>): TicketLine[];
//  en orden de layout.zones, solo zonas con quantity > 0; seatLabels ordenados por fila/numero.
export function getTicketTotals(lines: TicketLine[]): { quantity: number; amount: number };
export function formatTicketCount(quantity: number): string; // "1 entrada" | "3 entradas"
```

### Store (`src/modules/ticket/store/ticket-selection.store.ts`)
```ts
export interface TicketSelectionState {
  eventId: string | null;
  activeZoneId: string | null;
  quantities: Record<string, number>;  // solo zonas general
  seatIds: Record<string, string[]>;   // solo zonas numeradas
  startSelection: (eventId: string) => void; // si eventId cambia, resetea todo
  selectZone: (zoneId: string) => void;
  setQuantity: (zoneId: string, quantity: number) => void; // clamp 0..TICKET_MAX_PER_ZONE
  toggleSeat: (zoneId: string, seatId: string) => void;   // quita si esta; agrega solo si < max
  reset: () => void;
}
export const useTicketSelectionStore: UseBoundStore<StoreApi<TicketSelectionState>>;
```

### Constantes (`src/modules/ticket/constants/ticket.constants.ts`)
`TICKET_MAX_PER_ZONE = 6`, `SEAT_STATUS_LABEL` ("Disponible", "Seleccionado", "Ocupado").

### Componentes compartidos (`src/components/shared`)
```ts
// quantity-stepper.tsx
export interface QuantityStepperProps {
  value: number; min?: number; max: number; label: string; // label -> "Quitar una entrada de {label}"
  onChange: (value: number) => void; className?: string;
}
// purchase-header.tsx — header del flujo de compra (logo + pasos + "Compra segura"; en mobile: volver + "Paso N de 3" + barra de progreso)
export interface PurchaseHeaderProps { currentStep: 1 | 2 | 3; title: string; backHref: string; backLabel: string }
```

### Componentes del modulo (`src/modules/ticket/components`)
```ts
// zone-map.tsx — "use client". Grid CSS con layout.gridTemplate*, cada zona es <button aria-pressed>
//   con nombre (shortName < sm) y precio o "Agotado"; zona agotada disabled. Seleccionada: ring-2 ring-foreground.
export interface ZoneMapProps { layout: VenueLayout; activeZoneId: string | null; onSelectZone: (id: string) => void }

// seat-grid.tsx — "use client". SVG puro (sin zoom) de una zona numerada: letras de fila a los costados,
//   cada asiento <g role="checkbox" aria-checked aria-disabled tabIndex aria-label="Fila C, asiento 12">
//   con circle + Check si esta seleccionado; Enter/Espacio alternan. Indicador "Escenario" arriba.
export interface SeatGridProps {
  zone: VenueZone; selectedSeatIds: readonly string[]; maxReached: boolean; onToggleSeat: (seatId: string) => void;
}

// seat-map.tsx — "use client". Card "Elige tus asientos · {zone.name}": TransformWrapper/TransformComponent de
//   react-zoom-pan-pinch envolviendo <SeatGrid/>, botones Acercar/Alejar/Restablecer, leyenda de estados,
//   contador "N de 6 seleccionados". Alto fijo (~h-80 mobile, h-96 desktop).
export interface SeatMapProps extends SeatGridProps {}

// ticket-tier-list.tsx — card "Entradas": una fila por zona (color, nombre, precio c/u, badge Ultimas/Agotado).
//   general -> QuantityStepper; numerada -> boton "Elegir asientos" (selecciona la zona) + "N asientos" si hay.
//   Fila de la zona activa resaltada (bg-primary/5). Pie "Maximo 6 entradas por zona."
export interface TicketTierListProps {
  layout: VenueLayout; activeZoneId: string | null; quantities: Record<string, number>;
  seatIds: Record<string, string[]>; onSelectZone: (id: string) => void; onQuantityChange: (id: string, q: number) => void;
}

// purchase-summary.tsx — "use client". Desktop (lg+): aside sticky "Tu compra" con lineas
//   ("2 × Campo General  S/ 900", asientos debajo en muted), estado vacio con borde dashed, total grande y CTA.
//   Mobile (< lg): barra fixed bottom con "Total · N entradas", monto y CTA. CTA deshabilitado si no hay lineas.
export interface PurchaseSummaryProps { lines: TicketLine[]; checkoutHref: string }

// ticket-selection.tsx — "use client". Contenedor: conecta el store (startSelection en mount) con
//   ZoneMap + (SeatMap si la zona activa es numerada) + TicketTierList + PurchaseSummary. Unica pieza con estado.
export interface TicketSelectionProps { event: EventEntity; layout: VenueLayout }
```

### Barrel (`src/modules/ticket/index.ts`)
Exporta `TicketSelection`, `getVenueLayout`, `getTicketLines`, `getTicketTotals`, `useTicketSelectionStore`,
`TICKET_MAX_PER_ZONE` y los tipos.

### Event module
`src/modules/event/utils/event.utils.ts`: `export function getEventBySlug(events, slug): EventEntity | undefined;`
(+ export en `src/modules/event/index.ts`).

### Rutas (`src/app`)
```
src/app/layout.tsx                              # html/body/fuente; SIN SiteHeader/SiteFooter
src/app/(main)/layout.tsx                       # SiteHeader + <main className="flex-1"> + SiteFooter
src/app/(main)/page.tsx                         # mover src/app/page.tsx sin cambios (git mv)
src/app/(purchase)/layout.tsx                   # <main className="flex-1 bg-muted"> sin nav/footer
src/app/(purchase)/events/[slug]/tickets/page.tsx
//  generateStaticParams -> EVENTS_MOCK.map(({ slug }) => ({ slug }))
//  export default async function TicketsPage({ params }: PageProps<"/events/[slug]/tickets">)
//    const event = getEventBySlug(EVENTS_MOCK, (await params).slug); if (!event) notFound();
//    <PurchaseHeader currentStep={1} title="Elige tus entradas" backHref={`/events/${slug}`} backLabel="Volver al evento" />
//    encabezado del evento (imagen 64px, titulo, fecha · lugar) + <TicketSelection event layout={getVenueLayout(event)} />
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar `react-zoom-pan-pinch`; separar layouts en `(main)` y `(purchase)` moviendo la landing | package.json, package-lock.json, src/app/layout.tsx, src/app/(main)/layout.tsx, src/app/(main)/page.tsx, src/app/(purchase)/layout.tsx | - | S |
| T2 | Datos del modulo ticket: tipos, constantes, plantillas, utils + tests, store + test; `getEventBySlug` + test | src/modules/ticket/types/ticket.types.ts, src/modules/ticket/constants/ticket.constants.ts, src/modules/ticket/mocks/venue.mock.ts, src/modules/ticket/utils/ticket.utils.ts, src/modules/ticket/utils/ticket.utils.test.ts, src/modules/ticket/store/ticket-selection.store.ts, src/modules/ticket/store/ticket-selection.store.test.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts, src/modules/event/index.ts | T1 | S |
| T3 | Compartidos: `QuantityStepper` (+ test) y `PurchaseHeader` | src/components/shared/quantity-stepper.tsx, src/components/shared/quantity-stepper.test.tsx, src/components/shared/purchase-header.tsx | T1 | P1 |
| T4 | Mapa: `ZoneMap`, `SeatGrid` (+ test), `SeatMap` | src/modules/ticket/components/zone-map.tsx, src/modules/ticket/components/seat-grid.tsx, src/modules/ticket/components/seat-grid.test.tsx, src/modules/ticket/components/seat-map.tsx | T2 | P1 |
| T5 | `TicketTierList`, `PurchaseSummary`, `TicketSelection`, barrel y page | src/modules/ticket/components/ticket-tier-list.tsx, src/modules/ticket/components/purchase-summary.tsx, src/modules/ticket/components/ticket-selection.tsx, src/modules/ticket/index.ts, src/app/(purchase)/events/[slug]/tickets/page.tsx | T3, T4 | S |

Orden: T1 → T2 → [T3 ‖ T4] → T5.

**Tamaño:** ~22 archivos, por encima de la guia de ~8. Se mantiene en una sola spec porque la feature no es util
partida (sin store no hay mapa, sin resumen no hay pagina) y 8 de los archivos son tests, tipos o constantes.
Si se prefiere, T1+T2 pueden aprobarse como Fase 1 y T3-T5 como Fase 2.

## Criterios de aceptacion
- [ ] AC1: `/` sigue igual (header, landing, footer). `/events/bad-bunny-world-tour/tickets` muestra el header de
  compra (logo, pasos 1-2-3 con "Entradas" activo, "Compra segura") sin nav ni footer; en mobile, boton volver,
  "Paso 1 de 3 · Elige tus entradas" y barra de progreso al 33%.
- [ ] AC2: `/events/no-existe/tickets` responde 404.
- [ ] AC3: Bad Bunny muestra el mapa del estadio con las 5 zonas y precios S/ 690 (Agotado), 450, 380, 320, 250;
  la zona agotada no se puede seleccionar. `/events/el-fantasma-de-la-opera/tickets` muestra la plantilla teatro y
  `/events/feria-internacional-del-libro/tickets` la de admision general.
- [ ] AC4: Elegir una zona general (ej. Campo General) la resalta en el mapa y en la lista; con +/− cambia la cantidad
  entre 0 y 6 (− deshabilitado en 0, + en 6), y el resumen se actualiza en vivo.
- [ ] AC5: Elegir una zona numerada (desde el mapa o "Elegir asientos") abre "Elige tus asientos · <zona>" con el
  SVG de asientos, leyenda (Disponible / Seleccionado / Ocupado), zoom con botones, rueda y pinch, y pan arrastrando.
- [ ] AC6: Click, Enter o Espacio sobre un asiento disponible lo selecciona/deselecciona; los ocupados no reaccionan;
  con 6 seleccionados el resto de disponibles queda deshabilitado. Cada asiento tiene `aria-label` "Fila X, asiento N"
  y foco visible.
- [ ] AC7: El resumen lista una linea por zona con cantidad, nombre, monto y asientos ("Fila C: 12, 13"), total y
  "N entradas". Sin seleccion muestra el estado vacio y "Continuar" deshabilitado. Con seleccion, "Continuar" lleva a
  `/events/<slug>/checkout`.
- [ ] AC8: Desktop (>= 1024px): 2 columnas (mapa + lista | aside sticky). Mobile: una columna y barra fija abajo con
  total y "Continuar"; el contenido no queda tapado por la barra. Sin scroll horizontal de pagina en 375/768/1024/1440.
- [ ] AC9: CTA en `--cta` (indigo), sin naranja; `cursor-pointer` en todo lo clicable; foco visible.
- [ ] AC10: Cambiar a otro evento resetea la seleccion.
- [ ] AC11: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `ticket.utils.test.ts`: `buildSeats` (cantidad, ids, determinismo, ocupacion aproximada); `getVenueLayout`
  (plantilla por categoria, precios de Bad Bunny = 250/320/380/450/690, evento sold-out -> todas sold-out);
  `getTicketLines` (orden, omite cantidad 0, seatLabels ordenados, montos); `getTicketTotals`; `formatTicketCount`.
- `ticket-selection.store.test.ts`: `startSelection` resetea al cambiar de evento y no al repetir; `setQuantity`
  clampa 0..6; `toggleSeat` agrega/quita y respeta el maximo.
- `event.utils.test.ts`: `getEventBySlug` encuentra y devuelve `undefined`.
- `quantity-stepper.test.tsx`: +/− llaman `onChange`, disabled en min/max, aria-labels.
- `seat-grid.test.tsx`: click en disponible llama `onToggleSeat`; ocupado no; `aria-checked` refleja seleccion;
  con `maxReached` un disponible no seleccionado queda `aria-disabled`.
- Sin test: `ZoneMap`, `SeatMap`, `TicketTierList`, `PurchaseSummary`, `PurchaseHeader`, `TicketSelection`
  (presentacionales o composicion; la logica esta en utils/store testeados).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Colores del board (naranja, zinc) reemplazados por los tokens de MASTER.md (indigo, slate).
- Plantilla por categoria (no un recinto por evento) y precios por factor sobre `priceFrom`.
- Zonas numeradas: solo tribunas Occidente/Oriente (estadio) y Platea/Mezzanine (teatro).

## Estado
- Aprobacion humana: pendiente
- Fase: spec
- Log de review: -
