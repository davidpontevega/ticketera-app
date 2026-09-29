# 002 — Landing: navbar + topbar de busqueda, hero con swiper y categorias en Card

## Contexto
La spec 001 dejo la landing funcionando con mock data. Este es el requerimiento de la revision 2 del diseno (`design-system/ticketera/pages/landing.md`, seccion "Orden de secciones (revision 2, 2026-09-25)"), que es la fuente de verdad:
1. El hero pasa de shadcn `Carousel` (Embla) a **swiper**. Es una decision explicita del usuario.
2. El header se separa en **Navbar** (sin buscador) y en un **Topbar** de busqueda nuevo, sticky debajo del navbar y visible desde el primer render. El Topbar filtra `EVENTS_MOCK` de verdad por texto, rango de fecha y rango de precio.
3. Los filtros del Topbar se combinan con el filtro de categoria de "Proximos eventos". Todos se aplican con AND.
4. Se agregan categorias nuevas, cada una con al menos 1 evento en el mock, y `CategoryList` pasa a mostrar un `Card` shadcn por categoria.

Resultado esperado: el usuario escribe, elige fechas o precio en el Topbar (o hace click en una categoria) y la grilla "Proximos eventos" se actualiza al instante, sin requests de red.

## Alcance
- Incluye:
  - Instalar `swiper` y los shadcn `slider`, `popover` y `calendar`.
  - Reescribir `HeroCarousel` con swiper: flechas, bullets, teclado, loop y a11y. Se quita el buscador superpuesto; quedan el headline y el CTA.
  - Quitar el buscador de `SiteHeader`. El resto no cambia.
  - Crear el componente `EventSearchBar` (Topbar) con texto, rango de fecha (`Popover` + `Calendar`), rango de precio (`Popover` + `Slider`) y el boton "Limpiar".
  - Crear un store zustand del dominio event con **todos** los filtros, incluida la categoria, y una funcion pura `filterEvents` que los combina con AND.
  - Ajustar `UpcomingEvents` para que lea el store en vez del `useState` local.
  - Pasar de 6 a 10 categorias (4 nuevas), agregar 4 eventos al mock y convertir `CategoryList` en Cards. Al hacer click en una Card se fija la categoria en el store y se salta a `#upcoming-events`.
  - Eliminar `src/components/ui/carousel.tsx` y la dependencia `embla-carousel-react`: quedan sin uso (ver "Reuso detectado").
- Excluye: autoplay del swiper, busqueda server-side o por URL (`?q=`), sincronizar los filtros con la URL, estado visual "activo" en las Cards de categoria (el estado activo ya se ve en la tab), scroll automatico a resultados al tipear, dark mode y skeletons.
- Tamano: la fase supera la guia de ~8 archivos (son ~14 archivos de autor, sin contar los generados por shadcn ni el lockfile). El orquestador pidio mantener todo junto porque la mayoria son ediciones chicas sobre archivos que ya existen. Aun asi se respeta el limite de 5 tareas. Si hay que partir, la tarea que se separa es la parte de categorias: T2 (constantes, tipos y mock de categorias nuevas) y la mitad de T4 (`category-list.tsx`).
- Backlog (fases siguientes):
  - "Eventos destacados", "Franja de confianza" y "CTA final / Newsletter" (vienen del backlog de 001). "Eventos destacados" debe usar **swiper**, que ya estara instalado, y no volver a instalar Embla.
  - "Ver todas las categorias" si se decide limitar la cantidad visible (ver Preguntas abiertas).
  - Sincronizar los filtros con query params (`?q=&from=&to=&min=&max=&category=`) para links compartibles.
  - Autoplay del hero con control de pausa (WCAG 2.2.2).
  - Pagina de detalle, checkout, auth y API real (sin cambios respecto de 001).

## Reuso detectado
- `src/components/ui/input.tsx`: el texto libre del Topbar. Se reusa el patron del buscador que hoy esta en `SiteHeader` (icono `Search` absoluto + `pl-8`) y se muda al Topbar.
- `src/components/ui/button.tsx` (base-nova, **sin `asChild`**): triggers de los Popover, "Limpiar" y CTA del hero. Para el trigger se usa `render={<Button variant="outline" />}`.
- `src/components/ui/card.tsx`: la Card de categoria. `Card` es un `div` sin prop `render`, asi que el link `<a>` envuelve a la Card.
- `src/components/ui/tabs.tsx`: las tabs de categoria de `UpcomingEvents` siguen igual; solo cambia la fuente del valor.
- `src/modules/event/utils/event.utils.ts`: se reusan `filterEventsByCategory` (dentro de `filterEvents`), `getFeaturedEvents` (hero), `formatEventPrice` (label del rango de precio en el Topbar) y `EVENT_LOCALE`.
- `src/modules/event/constants/event.constants.ts`: `EVENT_CATEGORIES` se extiende. No se crea otra lista.
- `zustand` ^5.0.15 (ya instalado): el store de filtros. Va en `src/modules/event/store/` porque solo lo usa el dominio event. `src/store/` se reserva para estado compartido entre modulos.
- `date-fns` (lo instala `calendar` y tambien es dependencia de `react-day-picker`): se usan `startOfDay`/`endOfDay` en `filterEvents` y `format` si hace falta. No se escriben helpers de fecha propios.
- `lucide-react`: iconos nuevos verificados en la version instalada: `Clapperboard`, `Palette`, `Tent`, `Presentation`, `FerrisWheel`, `CalendarDays`, `Wallet`.
- shadcn, verificado con `npx shadcn@latest view slider popover calendar` (style `base-nova`):
  - `slider`: `@base-ui/react/slider`, sin dependencias npm nuevas. Soporta rango con `value: number[]` (renderiza un thumb por valor).
  - `popover`: `@base-ui/react/popover`, sin dependencias nuevas. El trigger usa `render`, no `asChild`.
  - `calendar`: agrega `react-day-picker@latest` (hoy **10.0.1**, peer `react >=16.8`, compatible con React 19.2) y `date-fns` (4.4.0). Tiene `registryDependencies: ["button"]` e importa `buttonVariants`, que ya exporta nuestro `button.tsx`. **Cuidado:** el CLI puede ofrecer sobrescribir `button.tsx`. Hay que responder **No** y no usar `--overwrite`, porque perderiamos la variant `default` = `cta` de la spec 001. Despues de instalar, `git diff src/components/ui/button.tsx` no debe mostrar cambios de esta tarea. Para el idioma se usa `import { es } from "react-day-picker/locale"`, export verificado en la v10.
- `swiper` **14.2.0** (ultima estable, sin peerDependencies). En React se usa `swiper/react` (`Swiper`, `SwiperSlide`) y los modulos salen de `swiper/modules`. Los CSS se importan desde el mismo componente client (`import "swiper/css"`, `"swiper/css/navigation"`, `"swiper/css/pagination"`). Next 16 App Router permite importar hojas de estilo de paquetes externos en cualquier archivo de `app`/componentes colocados (`node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, "External stylesheets"), asi que no hace falta tocar `globals.css` ni `layout.tsx`. Hay que tener en cuenta que el CSS de swiper **no tiene layer** y le gana a las utilidades de Tailwind v4 en las propiedades que define. La personalizacion se hace con las variables `--swiper-*` (por ejemplo `[--swiper-navigation-color:#fff]`), no pisando clases `.swiper-*`.
- `carousel` shadcn / Embla: `grep` confirma que el unico consumidor es `hero-carousel.tsx`. Despues de migrar el hero queda sin uso. El unico consumidor futuro era "Eventos destacados" (backlog), que usara swiper para no mantener dos librerias de slider. Por eso se elimina (T5).
- Nada reutilizable en `src/hooks`, `src/store` ni `src/components/shared` para filtros o estado.

## Contratos

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export type EventCategory =
  | "concerts" | "sports" | "theater" | "festivals" | "family" | "standup"
  | "cinema" | "arts" | "fairs" | "conferences"; // nuevas

// Compatible estructuralmente con DateRange de react-day-picker (from requerido, puede ser undefined).
// El tipo es propio para que el dominio no dependa de la libreria de UI.
export interface EventDateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export type EventPriceRange = [min: number, max: number];

export interface EventFilters {
  query: string;                        // texto libre sobre title/venue/city
  category: EventCategoryFilter;        // "all" | EventCategory
  dateRange: EventDateRange | undefined;
  priceRange: EventPriceRange;          // inclusivo, sobre priceFrom
}
```
El resto de los tipos de 001 no cambia.

### Constantes (`src/modules/event/constants/event.constants.ts`)
```ts
export const EVENT_CATEGORIES: readonly EventCategoryOption[]; // 10, en este orden:
//  concerts "Conciertos" Music · sports "Deportes" Trophy · theater "Teatro" Drama
//  festivals "Festivales" PartyPopper · family "Familiar" FerrisWheel (reemplaza a Users, que es generico)
//  standup "Standup" MicVocal · cinema "Cine" Clapperboard · arts "Arte y cultura" Palette
//  fairs "Ferias y exposiciones" Tent · conferences "Conferencias" Presentation
//  Sin iconos repetidos. Ticket queda reservado para el logo.
export const EVENT_PRICE_RANGE: EventPriceRange = [0, 500]; // limites del Slider (el mock va de 60 a 320)
export const EVENT_PRICE_STEP = 10;
export const EVENT_FILTERS_DEFAULT: EventFilters; // { query: "", category: "all", dateRange: undefined, priceRange: EVENT_PRICE_RANGE }
```

### Mock (`src/modules/event/mocks/event.mock.ts`)
Se suman 4 eventos (ids "11" a "14"), uno por categoria nueva, con fechas futuras, `isFeatured: false` y precios variados dentro de [0, 500]. Tienen que variar las ciudades (no solo Lima) para que el filtro de texto por city se pueda probar a mano. Imagenes de Unsplash con respuesta 200 verificada (el developer revisa visualmente que el contenido sea coherente y la cambia si no lo es):
- cinema: `photo-1489599849927-2ee91cede3ba`
- arts: `photo-1460661419201-fd4cecdf8a8b`
- fairs: `photo-1533900298318-6b8da08a523e`
- conferences: `photo-1540575467063-178a50c2df87`

Formato de URL: el mismo que en 001 (`?q=80&w=1200&auto=format&fit=crop`).

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export function filterEvents(events: readonly EventEntity[], filters: EventFilters): EventEntity[];
//  AND entre los 4 criterios. No muta la entrada.
//  - query: trim, case-insensitive e insensible a tildes (normalize("NFD") + quitar \p{Diacritic}).
//    Matchea si esta contenido en title, venue o city. Si query esta vacio no filtra.
//  - category: delega en filterEventsByCategory.
//  - dateRange: si es undefined o from es undefined no filtra. Si no, se incluye el evento cuando
//    startOfDay(from) <= date <= endOfDay(to ?? from) (hora local, date-fns).
//    Con solo from se filtra ese dia.
//  - priceRange: min <= priceFrom <= max (inclusivo).
export function formatDateRangeLabel(range: EventDateRange | undefined): string;
//  undefined o sin from → "Cualquier fecha"; solo from (o from == to en el mismo dia) → "14 nov";
//  rango → "14 nov – 20 nov". Usa Intl.DateTimeFormat(EVENT_LOCALE, { day: "numeric", month: "short" }).
```
`filterEventsByCategory`, `getFeaturedEvents`, `formatEventDate` y `formatEventPrice` no cambian.

### Store (`src/modules/event/store/event-filter.store.ts`)
```ts
import { create } from "zustand";

export interface EventFilterState extends EventFilters {
  setQuery: (query: string) => void;
  setCategory: (category: EventCategoryFilter) => void;
  setDateRange: (range: EventDateRange | undefined) => void;
  setPriceRange: (range: EventPriceRange) => void;
  reset: () => void; // vuelve a EVENT_FILTERS_DEFAULT, incluida la categoria
}

export const useEventFilterStore = create<EventFilterState>()((set) => ({ /* ...EVENT_FILTERS_DEFAULT + setters */ }));
```
- Sin `persist` ni `devtools` (YAGNI).
- SSR: el store es un singleton de modulo. Es seguro porque el estado inicial es estatico y solo se modifica en el cliente (en el server nadie llama a los setters ni lo inicializa con datos del request). Si en el futuro se inicializa con datos del server, hay que migrar al patron de store por request con Context.
- Consumo en zustand v5: para leer varios campos juntos se usa `useShallow` (`import { useShallow } from "zustand/react/shallow"`). Un selector que devuelve un objeto nuevo sin `useShallow` provoca un loop de re-render en v5.

### Componentes
```ts
// src/components/shared/site-header.tsx — "use client" (sin cambios de firma)
export function SiteHeader(): JSX.Element;
//  Se elimina el <form> de busqueda y los imports de Input y Search. Todo lo demas queda igual:
//  sticky top-0 z-50, h-16, border-b, logo, links, "Iniciar sesion", Sheet mobile.

// src/modules/event/components/event-search-bar.tsx — "use client" (NUEVO, el Topbar)
export function EventSearchBar(): JSX.Element;
//  Contenedor: sticky top-16 z-40 border-b bg-background (debajo del navbar h-16 z-50). Se renderiza
//  desde el primer paint, no depende del scroll. Interior max-w-7xl mx-auto px-4 md:px-6 py-3,
//  flex-col gap-2 en mobile y md:flex-row md:items-center.
//  - Input type="search" con icono Search, placeholder "Buscar eventos, lugares o ciudades...",
//    aria-label "Buscar eventos", value = query, onChange = setQuery. El <form> hace preventDefault.
//  - Popover de fecha: PopoverTrigger render={<Button variant="outline" />} con CalendarDays y
//    formatDateRangeLabel(dateRange). Contenido: <Calendar mode="range" selected={dateRange}
//    onSelect={setDateRange} locale={es} numberOfMonths={1} />.
//  - Popover de precio: trigger con Wallet y "{formatEventPrice(min)} – {formatEventPrice(max)}".
//    Contenido: <Slider min={EVENT_PRICE_RANGE[0]} max={EVENT_PRICE_RANGE[1]} step={EVENT_PRICE_STEP}
//    value={priceRange} onValueChange={...} aria-label="Rango de precio" />. onValueChange de Base UI
//    entrega `number | readonly number[]`: se aplica setPriceRange solo si es un array de 2 elementos.
//  - Button variant="ghost" "Limpiar" → reset().
//  Sin scroll horizontal en 375px: en mobile el input ocupa una fila y los 3 botones van en la siguiente.

// src/modules/event/components/hero-carousel.tsx — "use client" (misma firma que 001)
export interface HeroCarouselProps { events: readonly EventEntity[] }
export function HeroCarousel(props: HeroCarouselProps): JSX.Element;
//  <Swiper modules={[Navigation, Pagination, Keyboard, A11y]} loop navigation
//    pagination={{ clickable: true }} keyboard={{ enabled: true, onlyInViewport: true }}
//    a11y={{ prevSlideMessage: "Evento anterior", nextSlideMessage: "Evento siguiente",
//            paginationBulletMessage: "Ir al evento {{index}}" }}>
//  Un SwiperSlide por evento con la misma imagen/overlay/alto que 001 (next/image fill, sizes 100vw,
//  preload solo en index 0). Colores con variables: [--swiper-navigation-color:#fff],
//  [--swiper-pagination-color:var(--color-primary)] y bullets inactivos visibles sobre la imagen.
//  Capa fija encima (pointer-events-none, como hoy): h1 "Descubre tu proximo evento" + CTA
//  "Comprar entradas" → #upcoming-events (pointer-events-auto). SE ELIMINA el form de busqueda.
//  Ni las flechas ni los bullets se solapan con el h1 o el CTA en 375/768/1440. Si hace falta, las
//  flechas se ocultan en mobile (el swipe tactil y los bullets cubren la navegacion).
//  No se usa autoplay.

// src/modules/event/components/category-list.tsx — "use client" (antes server; ahora escribe en el store)
export function CategoryList(): JSX.Element;
//  Por cada EVENT_CATEGORIES: <a href="#upcoming-events" onClick={() => setCategory(id)}
//  className="group cursor-pointer rounded-xl focus-visible:ring-2 ..."> que envuelve <Card> con icono
//  grande (size-8 o size-10, text-primary, dentro de un circulo bg-primary/10) + label font-medium.
//  Hover visible: ring-primary + shadow-md + motion-safe:-translate-y-0.5, transition 150-300ms.
//  Layout: mobile flex snap-x snap-mandatory overflow-x-auto (Cards shrink-0) y sm:grid
//  sm:grid-cols-3 md:grid-cols-5 (10 categorias = 2 filas de 5 en desktop).

// src/modules/event/components/upcoming-events.tsx — "use client" (misma firma que 001)
export interface UpcomingEventsProps { events: readonly EventEntity[] }
export function UpcomingEvents(props: UpcomingEventsProps): JSX.Element;
//  Se elimina useState. filters = useEventFilterStore(useShallow(s => ({ query, category, dateRange,
//  priceRange }))) y setCategory = useEventFilterStore(s => s.setCategory). Tabs value = category.
//  Resultado: filterEvents(events, filters). Mensaje vacio: "No encontramos eventos con esos filtros."
//  <section id="upcoming-events" className="scroll-mt-40 py-12">: el scroll-mt evita que navbar + Topbar
//  sticky tapen el titulo al saltar al ancla (ajustar el valor a la altura real en mobile).
```

### Barrel (`src/modules/event/index.ts`)
Se agrega `export { EventSearchBar } from "./components/event-search-bar";`. El store y `filterEvents` no se exportan porque ningun consumidor fuera del modulo los necesita (YAGNI).

### Page (`src/app/page.tsx`)
Server component sin logica. El orden sigue landing.md rev. 2 (el Navbar esta en el layout):
```tsx
<EventSearchBar />
<HeroCarousel events={getFeaturedEvents(EVENTS_MOCK)} />
<div className="max-w-7xl mx-auto px-4 md:px-6"><CategoryList /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><UpcomingEvents events={EVENTS_MOCK} /></div>
```
`EventSearchBar` es hijo directo de `<main>` (en el layout), asi que el `sticky` cubre todo el alto de la pagina. `layout.tsx` no cambia.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar dependencias: `npm install swiper` y `npx shadcn@latest add slider popover calendar`. Responder **No** a sobrescribir `button.tsx` y despues verificar que `button.tsx` no cambio | package.json, package-lock.json, src/components/ui/slider.tsx, src/components/ui/popover.tsx, src/components/ui/calendar.tsx | - | S |
| T2 | Nucleo de filtros del dominio: tipos nuevos, 4 categorias + constantes de precio/filtros, 4 eventos mock, `filterEvents` + `formatDateRangeLabel` con tests y el store zustand con test | src/modules/event/types/event.types.ts, src/modules/event/constants/event.constants.ts, src/modules/event/mocks/event.mock.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts, src/modules/event/store/event-filter.store.ts, src/modules/event/store/event-filter.store.test.ts | T1 | S |
| T3 | Quitar el buscador de las ubicaciones viejas: hero migrado a swiper sin form de busqueda, y Navbar sin buscador | src/modules/event/components/hero-carousel.tsx, src/components/shared/site-header.tsx | T1 | P1 |
| T4 | Consumidores del store: Topbar `EventSearchBar` nuevo, `UpcomingEvents` leyendo el store y `CategoryList` con Cards que fijan la categoria | src/modules/event/components/event-search-bar.tsx, src/modules/event/components/upcoming-events.tsx, src/modules/event/components/category-list.tsx | T2 | P1 |
| T5 | Integracion y limpieza: exportar `EventSearchBar` en el barrel, montarlo en la page, borrar `carousel.tsx` y `npm uninstall embla-carousel-react` | src/modules/event/index.ts, src/app/page.tsx, src/components/ui/carousel.tsx (borrar), package.json, package-lock.json | T3, T4 | S |

Orden: T1 → T2 → [T3 ‖ T4] → T5. T3 solo depende de T1 (swiper), asi que puede arrancar en paralelo con T2 si conviene.

Nota de ownership: `package.json` y `package-lock.json` los tocan T1 (install) y T5 (uninstall). Es una excepcion deliberada a "un archivo, una tarea": las dos son seriales y nunca corren a la vez. El orquestador pidio que la limpieza de Embla sea una tarea propia, y hacerla en T1 romperia `hero-carousel.tsx` hasta que termine T3.

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar (sticky top-0) → Topbar → Hero → Categorias → Proximos eventos → Footer. El Topbar se ve desde el primer render y al scrollear queda pegado justo debajo del Navbar, sin hueco ni solapamiento visible.
- [ ] AC2: El Navbar ya no tiene input de busqueda (ni en desktop ni en el Sheet mobile). Logo, links, "Iniciar sesion" y menu mobile funcionan igual que en 001.
- [ ] AC3: El hero usa swiper (`swiper/react`) y ya no tiene buscador superpuesto. Muestra solo los eventos `isFeatured`, con flechas y bullets clickeables, navegacion con las flechas del teclado (cuando el foco no esta en un input), loop y el primer slide con `preload`. Flechas y bullets no se solapan con el h1 ni con el CTA en 375/768/1440.
- [ ] AC4: Al escribir en el Topbar (por ejemplo "arequipa" u "opera") la grilla muestra solo los eventos cuyo titulo, lugar o ciudad lo contienen, sin distinguir mayusculas ni tildes.
- [ ] AC5: Al elegir un rango de fechas la grilla muestra solo los eventos dentro del rango, con los dias extremos incluidos. El trigger muestra el rango elegido ("14 nov – 20 nov") o "Cualquier fecha". El calendario esta en espanol.
- [ ] AC6: Al mover el Slider de precio (2 thumbs) la grilla muestra solo los eventos con `priceFrom` dentro del rango, extremos incluidos. El trigger muestra "S/ X – S/ Y".
- [ ] AC7: Los filtros se combinan con AND con la tab de categoria. Por ejemplo, tab "Deportes" + texto "final" muestra solo "Final Copa Libertadores". Si nada coincide aparece "No encontramos eventos con esos filtros.". "Limpiar" restaura todos los filtros, incluida la tab "Todos".
- [ ] AC8: Hay 10 categorias, sin iconos repetidos, y cada una tiene al menos 1 evento en el mock (ninguna tab de categoria vacia sin filtros de Topbar). Cada categoria se muestra en un `Card` con icono grande y hover visible (ring/sombra/elevacion). Al hacer click se salta a `#upcoming-events` con esa tab activa y el titulo de la seccion no queda tapado por las barras sticky.
- [ ] AC9: `src/components/ui/carousel.tsx` no existe, `embla-carousel-react` no esta en `package.json` y `grep -ri embla src` no devuelve nada. `button.tsx` conserva la variant `default` = `bg-cta`.
- [ ] AC10: Responsive en 375, 768, 1024 y 1440 px: sin scroll horizontal de pagina, salvo el intencional de las Cards de categoria en mobile y de la TabsList.
- [ ] AC11: Accesibilidad: todos los controles del Topbar tienen label o aria-label, el Slider y el Calendar se pueden operar con teclado, el foco es visible, los clicables tienen `cursor-pointer` y los iconos decorativos llevan `aria-hidden`.
- [ ] AC12: `src/app/page.tsx` sigue sin logica ni mock inline y solo importa desde `@/modules/event`.
- [ ] AC13: `npm run test` pasa.
- [ ] AC14: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila sin errores ni warnings de CSS de swiper.

## Tests requeridos
Vitest + React Testing Library, cada test junto a su archivo.
- `src/modules/event/utils/event.utils.test.ts` (se amplia; los tests de 001 se mantienen):
  - `filterEvents` con `EVENT_FILTERS_DEFAULT` devuelve todos los eventos y no muta la entrada.
  - query: matchea title, venue y city. No distingue mayusculas ni tildes ("ÓPERA" encuentra "Opera"). Los espacios alrededor se ignoran.
  - dateRange: dia `from` inclusivo, dia `to` inclusivo, solo `from` = ese dia, `from` undefined = no filtra. Se usan eventos de fixture con hora de mediodia y `Date` construidas con `new Date(y, m, d)` (hora local) para que el resultado no dependa de la zona horaria del runner.
  - priceRange: extremos inclusivos.
  - Combinacion AND: categoria + query + precio reduce al resultado esperado. Sin coincidencias devuelve `[]`.
  - `formatDateRangeLabel`: undefined → "Cualquier fecha", solo from → contiene el dia, rango → contiene los dos dias. Las aserciones usan `toContain`/regex.
- `src/modules/event/store/event-filter.store.test.ts` (obligatorio): cada setter actualiza su campo sin tocar los demas y `reset()` vuelve a `EVENT_FILTERS_DEFAULT`. Se usa `useEventFilterStore.getState()` / `.setState(...)` fuera de React y se resetea en `beforeEach`.
- Sin test: `EventSearchBar`, `CategoryList` y `HeroCarousel` (el cableado es presentacional y la logica vive en `filterEvents` y en el store, que ya tienen test; swiper no funciona bien en jsdom). `UpcomingEvents` delega en `filterEvents`. `event-card.test.tsx` no cambia.

## Preguntas abiertas
Ninguna bloquea. Hay defaults tomados que el humano puede cambiar al aprobar:
- **Cantidad de categorias vs. anti-pattern de landing.md** ("No mas de 6-8 categorias visibles a la vez; si son mas, 'Ver todas'"). El requerimiento pide sumar categorias y quedan 10. Default: se muestran las 10 en 2 filas de 5 en desktop, porque el pedido explicito del usuario prevalece sobre la guia generica. La alternativa es mostrar 8 + "Ver todas" (se suma a esta fase: 1 boton y estado local en `CategoryList`).
- **Click en Card de categoria fija la tab** (item del backlog de 001). Se incluye porque, con el store, cuesta 1 linea y la Card con hover sugiere que es accionable. Si no se quiere, la Card vuelve a ser solo un ancla.
- **Autoplay del hero**: excluido. landing.md menciona el autoplay como motivo para elegir swiper, pero el requerimiento no lo pide y exige control de pausa (WCAG 2.2.2). Si se quiere, se agrega a T3 con el modulo `Autoplay` y `pauseOnMouseEnter`.
- **Icono de "Familiar"**: se cambia `Users` por `FerrisWheel` porque `Users` es generico. Si se prefiere no tocar las categorias existentes, se deja `Users`.
- **Desactualizacion de `landing.md`** (no bloquea y queda fuera del ownership de esta spec): la seccion "4. Eventos destacados" dice "`Carousel` horizontal" y el anti-pattern dice "`carousel` ... via Embla". Tras esta spec deberian decir swiper. Hay dos secciones numeradas "4." y la seccion "CTA Placement" dice "Buscador en Hero es el CTA principal", pero ahora el buscador vive en el Topbar. Se sugiere que el orquestador lo corrija.

## Estado
- Aprobacion humana: aprobada (2026-09-25) — 10 categorias en 2 filas confirmado, click en categoria fija filtro + scrollea confirmado
- Fase: aprobado
- Log de review:
  - Iteracion 1: CHANGES_REQUESTED (bullets inactivos del swiper invisibles sobre el degradado, riesgo de wrap en Topbar a 375px). Corregido.
  - Iteracion 2: APPROVED.
- Desviacion registrada (no bloqueante): `hero-carousel.tsx` usa botones prev/next propios (`.hero-carousel-prev/next` + `navigation.prevEl/nextEl`) en vez de la navigation nativa de swiper con `--swiper-navigation-color`, para controlar con Tailwind el ocultamiento en mobile sin pelear con el CSS no-layered de swiper. Funciona y no repite el problema de solapamiento resuelto en spec 001; se acepta la desviacion sobre el contrato original.
