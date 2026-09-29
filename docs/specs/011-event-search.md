# 011 — Busqueda y listado de eventos

## Contexto
Feature "2 · Busqueda y listado" del diseño de Claude Design (`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`,
boards `Search.dc.html` y `SearchMobile.dc.html`). Hoy no hay pagina de listado: "Eventos" del header lleva a
`/#upcoming-events` y "Ver mas eventos" del detalle tambien.

Resultado esperado: en `/events` el usuario busca por texto, filtra por categoria, ciudad, mes y rango de precio,
ordena por fecha o precio y ve los resultados. Los filtros viven en la URL (`/events?q=lima&categories=concerts`),
asi se pueden compartir y los links del sitio pueden llegar pre-filtrados. Solo UI con mock data.

## Alcance
- Incluye:
  - shadcn `toggle` + `toggle-group` (orden por Fecha / Precio mas bajo).
  - Modelo de busqueda en el modulo `event`: tipos, constantes (rangos de precio, opciones de orden), utils puras
    para leer/escribir los filtros desde/hacia la URL, filtrar, ordenar y armar las opciones con contadores.
  - Pagina `/events` dentro de `(main)`:
    - Titulo "Explora eventos" + buscador (texto + boton Buscar).
    - Desktop: aside de filtros (Categoria y Ciudad con checkbox + contador, Fecha por mes y Precio desde con radio,
      "Limpiar") + columna de resultados (contador "N eventos", chips de filtros activos con quitar, orden, grilla).
    - Mobile: boton "Filtros" (con cantidad de filtros activos) que abre un `Sheet` con Ciudad/Fecha/Precio y pie
      "Limpiar" / "Ver N eventos"; fila horizontal de categorias como chips; orden como toggle; lista de resultados.
    - Estado vacio "No encontramos eventos con esos filtros" + "Limpiar filtros".
  - Links al listado: "Eventos" del header, "Ver mas eventos" de relacionados y la categoria del breadcrumb del
    detalle (pre-filtrada por categoria).
- Excluye:
  - Paginacion / scroll infinito (14 eventos en el mock).
  - Contadores "facetados" (el contador de cada opcion es sobre todos los eventos, igual que el board).
  - Cambiar la landing: su buscador y "Proximos eventos" siguen con el store actual (`event-filter.store`).
  - Autocompletado/sugerencias del buscador.
- Backlog: 012 auth, 013 mis entradas, 014 organizador.

## Decisiones
- **Estado en la URL, no en un store:** `useSearchParams` + `router.replace(url, { scroll: false })`. Es la fuente de
  verdad compartible y hace que un link como `/events?categories=theater` funcione sin logica extra. El componente
  cliente va dentro de `<Suspense>` en la page (lo pide Next para rutas prerenderizadas que leen `useSearchParams`).
- **Parametros:** `q` (texto), `categories` y `cities` (listas separadas por coma), `month` (`YYYY-MM`), `price`
  (`up-to-50` | `50-150` | `150-300` | `over-300`), `sort` (`date` | `price`). Valores invalidos se ignoran. Los
  valores por defecto no se escriben en la URL (`/events` limpio = sin filtros, orden por fecha).
- **Filtro de texto:** reusa la normalizacion del buscador de la landing (sin tildes, sin mayusculas) sobre titulo,
  lugar y ciudad; se aplica al enviar el formulario (boton Buscar / Enter), no en cada tecla.
- **Meses y ciudades:** se derivan del mock (meses con eventos, en orden; ciudades en orden alfabetico), no se
  hardcodean. Mes en hora de Lima (`EVENT_TIME_ZONE`). Etiqueta "noviembre 2026".
- **Precio:** sobre `priceFrom`; rangos como el board: hasta 50 (<= 50), 50-150 (> 50 y <= 150), 150-300, mas de 300.
- **Orden:** fecha ascendente (default) o precio ascendente (empate: fecha).
- **Cards:** se reusa `EventCard` (regla de reuso) en vez de la card nueva del board. Grilla 1 col mobile, 2 sm,
  3 lg (el aside ocupa la 4ta).
- **Colores:** tokens de MASTER.md (CTA indigo, no naranja). Chips de categoria activos `bg-primary text-primary-foreground`.

## Reuso detectado
- `src/components/ui`: `button`, `input`, `checkbox`, `radio-group`, `field` (FieldSet/FieldLegend/FieldLabel),
  `sheet` (panel de filtros mobile), `badge`, `separator`.
- `src/components/shared/empty-state.tsx` (estado sin resultados).
- `src/modules/event`: `EventCard`, `EVENT_CATEGORIES`, `EVENTS_MOCK`, `EVENT_LOCALE`, `EVENT_TIME_ZONE`,
  `formatEventPrice`, `getEventCategoryOption`, y los helpers internos `normalizeText`/`matchesQuery` de
  `event.utils.ts` (se exportan para reusarlos, no se duplican).
- `lucide-react`: `Search`, `SlidersHorizontal`, `X`, `ArrowUpDown`, `SearchX`.
- Instalar (via fuente oficial de GitHub, el registro esta bloqueado en este entorno, mismo metodo que 009/010):
  `toggle`, `toggle-group`.

## Contratos

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export type EventSortOption = "date" | "price";
export type EventPriceBucket = "up-to-50" | "50-150" | "150-300" | "over-300";
export interface EventSearchParams {
  query: string;
  categories: EventCategory[];
  cities: string[];
  month: string | null;          // "2026-11"
  price: EventPriceBucket | null;
  sort: EventSortOption;
}
export interface EventFilterOption { value: string; label: string; count: number }
```

### Constantes (`src/modules/event/constants/event.constants.ts`)
```ts
export const EVENT_PRICE_BUCKETS: readonly { value: EventPriceBucket; label: string; min: number; max: number }[];
//  min exclusivo, max inclusivo (Infinity en "over-300"); labels "Hasta S/ 50", "S/ 50 – 150", ...
export const EVENT_SORT_OPTIONS: readonly { value: EventSortOption; label: string }[]; // "Fecha", "Precio mas bajo"
export const EVENT_SEARCH_DEFAULT: EventSearchParams;
```

### Utils (`src/modules/event/utils/event-search.utils.ts`)
```ts
export function parseEventSearchParams(params: URLSearchParams): EventSearchParams; // ignora valores invalidos
export function toEventSearchQueryString(params: EventSearchParams): string;        // sin defaults, "" si todo default
export function searchEvents(events: readonly EventEntity[], params: EventSearchParams): EventEntity[]; // filtra + ordena
export function getEventMonthKey(isoDate: string): string;                           // "2026-11" en hora de Lima
export function getCategoryFilterOptions(events): EventFilterOption[];               // 10 categorias con count
export function getCityFilterOptions(events): EventFilterOption[];                   // ciudades del mock, A-Z
export function getMonthFilterOptions(events): EventFilterOption[];                  // meses con eventos, en orden
export function countActiveFilters(params: EventSearchParams): number;               // categorias+ciudades+mes+precio (sin q ni sort)
export function toggleValue<T>(values: readonly T[], value: T): T[];                 // agrega o quita
```
`event.utils.ts` exporta `matchesQuery` (hoy privado) para reusarlo.

### Componentes (`src/modules/event/components`)
```ts
// event-search.tsx — "use client". Contenedor: lee useSearchParams, parsea, calcula resultados y opciones, y
//   actualiza la URL con router.replace. Compone el resto. Unico componente con acceso a router/URL.
export interface EventSearchProps { events: readonly EventEntity[] }

// event-search-form.tsx — "use client". <form role="search"> con Input type=search y boton Buscar;
//   estado local del texto, onSubmit(query).
export interface EventSearchFormProps { defaultQuery: string; onSubmit: (query: string) => void }

// event-search-filters.tsx — presentacional. FieldSets: Categoria (opcional, oculta en mobile), Ciudad (checkbox +
//   count), Fecha y Precio desde (RadioGroup con "Cualquier ..." como primera opcion).
export interface EventSearchFiltersProps {
  params: EventSearchParams; categoryOptions?: EventFilterOption[]; cityOptions: EventFilterOption[];
  monthOptions: EventFilterOption[]; onChange: (params: EventSearchParams) => void;
}

// event-search-toolbar.tsx — presentacional. "N eventos" (aria-live), chips de filtros activos con boton quitar
//   (aria-label "Quitar filtro X"), ToggleGroup de orden. En mobile: boton "Filtros (n)" que abre el Sheet con
//   <EventSearchFilters/> y pie "Limpiar" / "Ver N eventos", y fila de chips de categorias (aria-pressed).
export interface EventSearchToolbarProps { /* params, resultCount, opciones, onChange, onClear */ }

// event-search-results.tsx — presentacional. Grilla de EventCard o EmptyState con "Limpiar filtros".
export interface EventSearchResultsProps { events: readonly EventEntity[]; onClear: () => void }
```

### Ruta (`src/app/(main)/events/page.tsx`)
```tsx
export const metadata: Metadata = { title: "Explora eventos | Ticketera" };
export default function EventsPage() {
  // <Suspense fallback={<skeleton de grilla/>}><EventSearch events={EVENTS_MOCK} /></Suspense>
}
```

### Links
- `site-header.tsx`: "Eventos" → `/events`.
- `related-events.tsx`: "Ver mas eventos" → `/events?categories=<categoria del evento>` (recibe la categoria por props).
- `event-detail-hero.tsx`: miga de categoria → `/events?categories=<categoria>`.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | shadcn `toggle` y `toggle-group` | src/components/ui/toggle.tsx, src/components/ui/toggle-group.tsx | - | S |
| T2 | Tipos, constantes, utils de busqueda + tests; exportar `matchesQuery` | src/modules/event/types/event.types.ts, src/modules/event/constants/event.constants.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event-search.utils.ts, src/modules/event/utils/event-search.utils.test.ts | - | S |
| T3 | Formulario, filtros y resultados | src/modules/event/components/event-search-form.tsx, src/modules/event/components/event-search-filters.tsx, src/modules/event/components/event-search-results.tsx | T2 | P1 |
| T4 | Toolbar (chips, orden, sheet mobile) | src/modules/event/components/event-search-toolbar.tsx | T1, T2 | P1 |
| T5 | Contenedor + test, barrel, page y links | src/modules/event/components/event-search.tsx, src/modules/event/components/event-search.test.tsx, src/modules/event/index.ts, src/app/(main)/events/page.tsx, src/components/shared/site-header.tsx, src/modules/event/components/related-events.tsx, src/modules/event/components/event-detail-hero.tsx, src/app/(main)/events/[slug]/page.tsx | T3, T4 | S |

Orden: T1 → T2 → [T3 ‖ T4] → T5. ~19 archivos.

## Criterios de aceptacion
- [ ] AC1: `/events` muestra "Explora eventos", el buscador, los filtros y los 14 eventos ordenados por fecha.
  "Eventos" del header lleva ahi.
- [ ] AC2: Buscar "lima" (o "LIMA", o con tildes) y enviar filtra por titulo/lugar/ciudad y escribe `?q=lima` en la URL.
- [ ] AC3: Marcar categorias y ciudades (multiple), elegir mes y rango de precio filtra en vivo (AND entre grupos, OR
  dentro de cada grupo), actualiza la URL y el contador "N eventos"; cada opcion muestra su contador.
- [ ] AC4: Cada filtro activo aparece como chip; quitar el chip quita el filtro. "Limpiar" deja `/events` sin params
  (conserva la busqueda de texto solo si se limpian filtros desde el aside/sheet; "Limpiar filtros" del estado vacio
  limpia todo).
- [ ] AC5: "Precio mas bajo" ordena por `priceFrom` ascendente y escribe `sort=price`; "Fecha" vuelve al default.
- [ ] AC6: Abrir `/events?categories=theater&price=50-150` (o recargar con filtros) muestra el estado filtrado; params
  invalidos se ignoran sin error.
- [ ] AC7: Sin resultados: "No encontramos eventos con esos filtros" + "Limpiar filtros".
- [ ] AC8: Mobile: "Filtros" con cantidad de activos abre el panel (Ciudad, Fecha, Precio) con "Limpiar" y
  "Ver N eventos"; chips de categorias en fila horizontal con scroll; orden accesible; sin scroll horizontal de pagina
  en 375/768/1024/1440.
- [ ] AC9: Desde el detalle, la miga de categoria y "Ver mas eventos" llevan a `/events?categories=<categoria>`.
- [ ] AC10: Checkbox/radios con label asociado y foco visible; `cursor-pointer`; CTA indigo.
- [ ] AC11: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores (sin error de
  "useSearchParams should be wrapped in a suspense boundary").

## Tests requeridos
- `event-search.utils.test.ts`: parse (defaults, listas, valores invalidos ignorados, categorias desconocidas fuera);
  `toEventSearchQueryString` (omite defaults, ida y vuelta parse ↔ string); `searchEvents` (texto normalizado,
  categorias OR, AND entre grupos, mes en hora de Lima, cada rango de precio con bordes 50/150/300, orden por fecha y
  por precio con desempate); opciones (10 categorias con count que suma 14; ciudades A-Z; meses en orden);
  `countActiveFilters`; `toggleValue`.
- `event-search.test.tsx`: con `useSearchParams`/`useRouter` mockeados: renderiza el contador segun la URL, marcar
  una categoria llama `router.replace` con `?categories=...`, y el estado vacio aparece con filtros sin resultados.
- Sin test: form, filtros, toolbar y resultados (presentacionales sobre utils testeadas).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Se reusa `EventCard` en vez de la card nueva del board (con icono de lugar y boton "Ver entradas").
- El buscador de la landing sigue filtrando "Proximos eventos" en la misma pagina (no redirige a `/events`).
- Contadores no facetados (como el board).

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - Helper extra `getEventSearchHref(overrides)` + `EVENT_SEARCH_PATH` en `event-search.utils.ts` (con test), usado
    por el contenedor y los links (header usa `/events` directo).
  - `EventSearchFilters` recibe `idPrefix`: el aside desktop y el sheet mobile pueden estar en el DOM a la vez.
  - "Limpiar filtros"/"Limpiar todo" limpian texto y filtros pero conservan el orden elegido; "Limpiar" del
    aside/sheet limpia solo los filtros del panel.
  - `EmptyState` suma `titleAs` (`h1` por defecto, `h2` en `/events`, que ya tiene su `h1`).
  - Etiqueta de mes capitalizada ("Noviembre 2026").
  - Fix de datos: la direccion de "Noche de Cine Clasico" decia Arequipa y el evento es en Trujillo.
- Verificacion: 121 tests, `tsc`, `lint` y `build` OK (`/events` prerenderizada estatica, sin error de Suspense). En
  Chromium: header -> /events, busqueda "LIMA", categorias OR + ciudad + precio (AND), chips, orden por precio, estado
  vacio + limpiar, params invalidos, miga de categoria del detalle, chips de categoria y sheet de filtros en mobile;
  sin scroll horizontal a 375/1440 ni errores de consola.
- Log de review: -
