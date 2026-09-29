# 015 — Mapa de asientos v2

## Contexto
Feedback del usuario sobre la spec 008: el mapa de asientos "se ve muy basico". Hoy hay dos piezas separadas: un
grid HTML de zonas rectangulares (`zone-map.tsx`) y, para zonas numeradas, un SVG aparte con filas rectas
(`seat-grid.tsx` + `seat-map.tsx`).

Referencias revisadas (patrones que usan Seats.io, Seatmap.pro y los casos de UX de ticketeras):
- Un solo mapa del recinto con la forma real del lugar: escenario, campo y tribunas en arco alrededor.
- Secciones coloreadas por precio, con leyenda de precios siempre visible. Lo agotado se distingue con textura
  (rayado), no solo con color.
- Tooltip al pasar el mouse o enfocar: seccion o asiento, precio y disponibilidad.
- Zoom a la seccion al elegirla. Al acercarse aparecen los asientos (nivel de detalle), en filas curvas que siguen la
  forma de la seccion.
- "Mejores asientos disponibles" para elegir rapido N asientos juntos, mas una lista de asientos elegidos que se
  pueden quitar.
- Mobile: pinch/pan, objetivos tactiles grandes. Teclado: navegacion con flechas entre asientos.

Fuentes: Seatmap.pro (features y guia de integracion), Filmgrail "Seat Selection UI: Case Studies", documentacion de
Seats.io.

## Alcance
- Incluye:
  - **Geometria de recinto:** cada zona tiene una forma (`rect` o `arc` = sector anular) dentro de un `viewBox`
    comun. Las plantillas `stadium`, `theater` y `general-admission` se redibujan:
    - `stadium`: escenario arriba, Campo VIP y Campo General en el campo, Tribuna Occidente y Oriente en arco a los
      costados y Tribuna Norte en arco al fondo.
    - `theater`: escenario en arco, Platea en abanico, Palcos a los costados, Mezzanine y Galeria en arcos detras.
    - `general-admission`: ingreso y un area unica.
  - **Asientos con coordenadas:** en zonas numeradas se calculan `x`, `y` y `rotation` por asiento siguiendo el arco
    (filas = radios, asientos = angulos). Los ids no cambian (`<zona>-<fila>-<numero>`), asi que el store y el
    checkout siguen funcionando.
  - **Componente unico `VenueMap`** (SVG + `react-zoom-pan-pinch`):
    - Vista general: secciones con color de su precio, etiqueta (nombre + "desde S/ X") y rayado si estan agotadas.
    - Hover/foco: la seccion se resalta y aparece un tooltip ("Tribuna Occidente · S/ 380 · 42 asientos libres" /
      "Campo General · S/ 450 · Disponible").
    - Click/Enter en una zona numerada: zoom animado a la seccion, se muestran sus asientos y aparece
      "← Volver al mapa". En zona general: se selecciona la zona (stepper en la lista, como hoy).
    - Asientos: circulos con estado (disponible con el color de la seccion, seleccionado con check, ocupado gris con
      rayado), tooltip "Fila C · Asiento 12 · S/ 380", `role="checkbox"`.
    - Teclado: una sola parada de tab para los asientos (roving tabindex); flechas izquierda/derecha recorren la fila,
      arriba/abajo cambian de fila; Enter/Espacio seleccionan.
    - Controles: acercar, alejar, restablecer.
  - **Panel de asientos** (debajo del mapa cuando hay una zona numerada activa): "Mejores asientos" con cantidad
    (1-6) que elige N asientos contiguos lo mas cerca posible del escenario y centrados; chips de asientos elegidos
    con quitar; contador "N de 6".
  - **Leyenda:** precios por color (una fila por zona con su precio) + estados (disponible, seleccionado, ocupado,
    agotado).
  - Se eliminan `zone-map.tsx`, `seat-map.tsx`, `seat-grid.tsx` y su test (reemplazados).
- Excluye:
  - Minimapa, vista 360°, lineas de vision, precios distintos por fila, asientos de movilidad reducida.
  - WebGL/canvas: los recintos del mock tienen cientos de asientos por seccion y solo se dibujan los de la seccion
    activa, SVG alcanza.
  - Cambiar el detalle de evento (spec 009) y el checkout (spec 010): siguen leyendo el mismo layout y la misma
    seleccion.

## Decisiones
- **Libreria:** se mantiene SVG propio + `react-zoom-pan-pinch` (ya elegido en la 008: accesible, SSR, sin canvas).
  Lo que se veia basico era el dibujo, no la libreria. Se usa `zoomToElement` para el zoom a la seccion.
  Alternativas revisadas otra vez: Seats.io y Seatmap.pro son SaaS pagos; las opciones open source para React siguen
  sin soporte de React 19 o abandonadas.
- **Geometria en datos, no en componentes:** `venue-geometry.ts` (funciones puras, testeadas) calcula el path de cada
  seccion, su centro para la etiqueta y la posicion de cada asiento. Los componentes solo dibujan.
- **Mejores asientos:** fila mas cercana al escenario primero (A, B, ...); dentro de la fila, el bloque contiguo de N
  asientos disponibles cuyo centro este mas cerca del centro de la fila. Reemplaza la seleccion actual de esa zona.
- **Colores por precio:** se mantienen los tonos indigo por zona (de mas oscuro = mas caro a mas claro), con la
  leyenda de precios. Agotado: `fill` muted + patron rayado SVG. Contraste de etiquetas >= 4.5:1 (texto oscuro sobre
  tonos claros, blanco sobre oscuros).
- **Tooltip unico** posicionado sobre el mapa (no un tooltip por asiento): se alimenta del hover/foco actual.
- **Movimiento:** zoom animado 300 ms; con `prefers-reduced-motion` sin animacion.

## Reuso detectado
- `react-zoom-pan-pinch` (ya instalado), `src/components/ui/button.tsx`, `badge.tsx`, `card.tsx`.
- `src/modules/ticket`: store de seleccion, `getTicketLines`, `TicketTierList`, `PurchaseSummary`, `buildSeats`
  (se adapta para devolver coordenadas), constantes de maximo y leyenda.
- `src/modules/event`: `formatEventPrice`, `EVENT_AVAILABILITY_LABEL`.
- `lucide-react`: `ZoomIn`, `ZoomOut`, `RotateCcw`, `ArrowLeft`, `Check`, `X`, `Sparkles`.

## Contratos

### Tipos (`src/modules/ticket/types/ticket.types.ts`)
```ts
export type ZoneShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius?: number }
  | { kind: "arc"; cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number }; // grados, 0° = derecha, 90° = abajo
export interface Seat { id: string; row: string; number: number; status: SeatStatus; x: number; y: number; rotation: number }
export interface VenueZone {
  // ...campos actuales, sin `area` (grid) y con:
  shape: ZoneShape;
  fillColor: string;      // hex del tono de la zona (SVG fill)
  labelColor: string;     // hex del texto sobre ese tono (contraste AA)
}
export interface VenueLayout {
  id: VenueLayoutId;
  viewBox: { width: number; height: number };
  stage: { label: string; shape: ZoneShape };
  zones: VenueZone[];
}
```
`VenueZoneTemplate` agrega `rows`/`seatsPerRow` como hoy; la geometria de asientos se calcula al construir el layout.

### Geometria (`src/modules/ticket/utils/venue-geometry.ts`)
```ts
export function getShapePath(shape: ZoneShape): string;                  // "d" del <path>
export function getShapeCenter(shape: ZoneShape): { x: number; y: number }; // para la etiqueta
export function getShapeBounds(shape: ZoneShape): { x: number; y: number; width: number; height: number };
export function layoutSeats(shape: ZoneShape, rows: number, seatsPerRow: number): { row: number; number: number; x: number; y: number; rotation: number }[];
//  arc: filas de adentro (A, cerca del escenario) hacia afuera; asientos repartidos en el angulo con margen.
//  rect: grilla.
```

### Utils (`src/modules/ticket/utils/ticket.utils.ts`)
```ts
export function buildSeats(zoneId, shape, rows, seatsPerRow, occupancy): Seat[]; // ahora con x/y/rotation
export function findBestSeats(zone: VenueZone, quantity: number): string[];     // [] si no hay bloque contiguo
export function getAvailableSeatCount(zone: VenueZone): number;
```

### Store (`ticket-selection.store.ts`)
`setSeats(zoneId: string, seatIds: string[])` (nuevo, respeta el maximo): lo usa "Mejores asientos".

### Componentes (`src/modules/ticket/components`)
```ts
// venue-map.tsx — "use client". SVG del recinto + zoom. Props: layout, activeZoneId, selectedSeatIds (de la zona
//   activa), onSelectZone, onToggleSeat, onBack. Incluye patron rayado, tooltip, controles y navegacion por teclado.
// venue-legend.tsx — presentacional: precios por zona (color + nombre + precio o "Agotado") y estados de asiento.
// seat-picker-panel.tsx — "use client": mejores asientos (cantidad + boton), chips de elegidos con quitar, contador.
// ticket-selection.tsx — reemplaza ZoneMap + SeatMap por VenueMap + VenueLegend + SeatPickerPanel.
```
Se borran `zone-map.tsx`, `seat-map.tsx`, `seat-grid.tsx`, `seat-grid.test.tsx`.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Geometria + test | src/modules/ticket/utils/venue-geometry.ts, src/modules/ticket/utils/venue-geometry.test.ts | - | S |
| T2 | Tipos, plantillas redibujadas, `buildSeats` con coordenadas, `findBestSeats`, `setSeats` + tests | src/modules/ticket/types/ticket.types.ts, src/modules/ticket/mocks/venue.mock.ts, src/modules/ticket/utils/ticket.utils.ts, src/modules/ticket/utils/ticket.utils.test.ts, src/modules/ticket/store/ticket-selection.store.ts, src/modules/ticket/store/ticket-selection.store.test.ts | T1 | S |
| T3 | `VenueMap` (+ test de teclado/seleccion) | src/modules/ticket/components/venue-map.tsx, src/modules/ticket/components/venue-map.test.tsx | T2 | P1 |
| T4 | Leyenda y panel de asientos | src/modules/ticket/components/venue-legend.tsx, src/modules/ticket/components/seat-picker-panel.tsx | T2 | P1 |
| T5 | Integracion y limpieza | src/modules/ticket/components/ticket-selection.tsx, src/modules/ticket/components/ticket-tier-list.tsx, src/modules/ticket/components/zone-price-list.tsx, (borrar) zone-map.tsx, seat-map.tsx, seat-grid.tsx, seat-grid.test.tsx | T3, T4 | S |

Orden: T1 → T2 → [T3 ‖ T4] → T5. ~17 archivos (4 se borran).

## Criterios de aceptacion
- [ ] AC1: `/events/bad-bunny-world-tour/tickets` muestra un solo mapa del estadio: escenario arriba, Campo VIP y
  Campo General en el campo, tribunas Occidente/Oriente en arco a los costados y Norte en arco al fondo, cada una con
  su color, nombre y "desde S/ X". Campo VIP (agotado) se ve rayado y no se puede elegir.
- [ ] AC2: El teatro (`/events/el-fantasma-de-la-opera/tickets`) muestra escenario en arco, Platea en abanico, Palcos,
  Mezzanine y Galeria; la Feria del Libro muestra el area unica.
- [ ] AC3: Hover o foco en una seccion la resalta y muestra el tooltip con precio y disponibilidad.
- [ ] AC4: Click/Enter en una tribuna hace zoom animado a esa seccion y muestra sus asientos en filas curvas; aparece
  "Volver al mapa" que vuelve a la vista general. Zoom con botones, rueda y pinch sigue funcionando.
- [ ] AC5: Asientos: hover/foco muestra "Fila X · Asiento N · S/ precio"; click/Enter/Espacio selecciona; ocupados
  no reaccionan; con 6 elegidos el resto queda deshabilitado. Flechas recorren fila y cambian de fila; una sola parada
  de tab para el bloque de asientos.
- [ ] AC6: "Mejores asientos" con cantidad 2 elige 2 asientos contiguos disponibles en la fila mas cercana al
  escenario; los chips los muestran y se pueden quitar uno por uno.
- [ ] AC7: Leyenda con precio y color de cada zona y los estados (disponible, seleccionado, ocupado, agotado).
- [ ] AC8: El resumen, el detalle de evento y el checkout siguen funcionando igual (mismas lineas, asientos y montos).
- [ ] AC9: Mobile (375): el mapa entra completo, se puede hacer pinch/pan y tocar secciones y asientos; sin scroll
  horizontal de pagina.
- [ ] AC10: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `venue-geometry.test.ts`: path de `rect` y `arc` (empieza con `M`, cierra con `Z`), centro dentro de los limites,
  `layoutSeats` devuelve `rows * seatsPerRow` posiciones dentro de los limites de la forma, fila A mas cerca del
  centro del arco que la ultima.
- `ticket.utils.test.ts` (se amplia): asientos con coordenadas, `findBestSeats` (fila mas cercana, contiguos,
  centrados, respeta ocupados, [] si no hay bloque), `getAvailableSeatCount`; precios de Bad Bunny siguen iguales.
- `ticket-selection.store.test.ts`: `setSeats` reemplaza y respeta el maximo.
- `venue-map.test.tsx`: click en seccion numerada llama `onSelectZone`; con zona activa, click/Enter en asiento
  llama `onToggleSeat`; flecha derecha mueve el foco al siguiente asiento; ocupado no llama.

## Preguntas abiertas
Ninguna bloquea.

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - `VenueZone` reemplaza `colorClassName`/`seatClassName`/`area` por `shape`, `fillColor` y `labelColor`; los
    swatches de la lista de entradas y del detalle usan `fillColor`.
  - Las filas interiores de un arco llevan menos asientos (distancia minima entre asientos de 14 unidades): en la
    platea del teatro las primeras filas se superponian.
  - Mezzanine pasa de 22 a 28 asientos por fila (el arco nuevo es mas ancho).
  - `selectZone` acepta `null` ("Volver al mapa").
  - Los asientos se dibujan en un grupo aparte (no dentro del boton de la zona) para no anidar controles.
  - Mobile: el mapa tiene alto automatico en la vista general y 440 px al hacer zoom a una seccion; el zoom espera
    80 ms a que la libreria mida el nuevo tamaño. Etiquetas de zona mas grandes en mobile (sin el precio, que queda
    en la leyenda y el tooltip).
- Verificacion: 179 tests, `tsc`, `lint` y `build` OK. En Chromium: estadio y teatro con formas en arco, zona agotada
  rayada y no seleccionable, tooltip de zona y de asiento, zoom animado a la tribuna/platea, mejores asientos (B11,
  B12) + chips, seleccion manual, resumen con asientos, "Volver al mapa"; mobile con zoom a la seccion; regresion de
  detalle, seleccion -> checkout -> confirmacion sin errores; sin scroll horizontal ni errores de consola.
- Log de review: -
