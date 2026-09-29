# 005 — Topbar estilo joinnus, seccion "Tendencias" y eliminar "Como funciona" (revision 4)

## Contexto
Revision 4 de la landing (`design-system/ticketera/pages/landing.md`, "Orden de secciones (revision 4, 2026-09-28 — en base a joinnus.com)"). El usuario reviso joinnus.com y pidio 3 cambios, ya decididos:

1. Rediseñar el Topbar de busqueda (`EventSearchBar`, spec 002) al patron de joinnus. Es solo un cambio de layout y estilo: la logica de filtrado no cambia.
2. Seccion nueva "Nuestras Tendencias" entre el Hero (spotlight) y Categorias: una fila horizontal de `EventCard` con los eventos marcados con un flag nuevo `isTrending`.
3. Eliminar la seccion "Como funciona" (spec 004): el componente, su montaje en la page y el link del navbar.

Resultado esperado: en `/` el orden queda Navbar → Topbar (nuevo estilo) → Spotlight → Tendencias → Categorias → Proximos eventos → Newsletter → Footer, sin codigo muerto ni anclas rotas.

## Alcance
- Incluye:
  - `EventSearchBar`: barra blanca unica con input (lupa, sin label visible), campos etiquetados "Fecha" y "Precio" (label arriba y valor abajo con chevron), `Separator` vertical entre campos desde md, boton circular de busqueda al final y "Limpiar" como link chico fuera de la barra. Mismo store, mismos Popover+Calendar y Popover+Slider, mismo comportamiento sticky.
  - `EventEntity.isTrending: boolean`, marcado en 6 eventos del mock.
  - `getTrendingEvents(events)` en `event.utils.ts`, con test.
  - Componente nuevo `TrendingEvents` (reusa `EventCard` tal cual), montado en la page entre Spotlight y Categorias.
  - Borrar `src/components/shared/how-it-works.tsx`, su import y montaje en `page.tsx`, el item `#how-it-works` de `NAV_LINKS` en `site-header.tsx`, y el link placeholder "Como funciona" de la columna "Sobre nosotros" en `site-footer.tsx` (decidido: se quita tambien, mismo criterio que el navbar — no dejar un link a un concepto que ya no existe).
- Excluye:
  - Cualquier cambio en `useEventFilterStore`, `filterEvents`, `formatDateRangeLabel` o en el contenido de los Popovers.
  - Submit real del buscador: el filtrado sigue siendo reactivo en tiempo real.
  - Cambios en `EventCard`, Spotlight, Categorias, Proximos eventos, Newsletter y Footer.
  - Que Tendencias responda a los filtros del Topbar: es una lista estatica, igual que el Spotlight.
- Backlog: franja de "Confianza" y ranking "Lo mas vendido" (descartado en landing.md). "Eventos destacados" (backlog de 001/002) queda cerrado por Tendencias.

Nota de tamaño: son 10 archivos (1 borrado), apenas por encima del limite de ~8. Se mantiene en una sola fase porque 4 de ellos son cambios de 1 a 6 lineas (tipo, barrel, `NAV_LINKS` y el borrado) y partirlo dejaria `page.tsx` y `index.ts` tocados en dos specs seguidas.

## Reuso detectado
- `src/modules/event/components/event-search-bar.tsx`: se reescribe el JSX sobre la misma logica. Se mantienen los selectores `useShallow` del store, `setQuery`/`setDateRange`/`setPriceRange`/`reset`, `Calendar mode="range" locale={es}`, el `Slider` con `EVENT_PRICE_RANGE`/`EVENT_PRICE_STEP` y su `onValueChange`, `formatDateRangeLabel`, `formatEventPrice` y el `<form onSubmit={preventDefault}>` del input.
- `src/components/ui/popover.tsx`: triggers con el patron `PopoverTrigger render={<Button ... />}`, ya en uso.
- `src/components/ui/button.tsx`:
  - Campos etiquetados: `variant="ghost"` con className de layout (`h-auto flex-col items-start`).
  - Boton circular: variant default, que en este proyecto ya es `bg-cta text-cta-foreground`, con `size="icon-lg"` + `rounded-full`. Se usa `render={<a href="#upcoming-events" />}` + `nativeButton={false}`, mismo patron que el CTA del spotlight.
  - "Limpiar": `variant="link" size="xs"`.
- `src/components/ui/separator.tsx` (ya instalado, base-ui): `orientation="vertical"`, que ya aplica `w-px self-stretch`.
- `src/components/ui/input.tsx`: input de texto, sin borde dentro de la barra.
- `lucide-react`: `Search` (lupa del input y del boton circular) y `ChevronDown` (campos). Salen `CalendarDays` y `Wallet` del Topbar, porque en el patron joinnus el label de texto cumple esa funcion.
- `src/modules/event/components/event-card.tsx`: se reusa sin cambios (`{ event, className? }`). En Tendencias se le pasa `className="h-full"`.
- Patron de scroll horizontal `flex snap-x snap-mandatory gap-* overflow-x-auto` + `shrink-0 snap-start`: ya se usa en `category-list.tsx` y en las miniaturas de `event-spotlight.tsx`. No se usa swiper.
- `getFeaturedEvents` (`event.utils.ts`): `getTrendingEvents` copia su patron (filter por flag).
- Patron de componente de seccion que recibe `events` por props y devuelve `null` si esta vacio: `EventSpotlight`.
- Nada nuevo en `src/hooks`, `src/store` ni `src/lib`. No se instala nada de shadcn ni de npm.

## Contratos

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export interface EventEntity {
  // ...campos existentes sin cambios
  isFeatured: boolean; // se muestra en el hero
  isTrending: boolean; // se muestra en la seccion "Tendencias"
}
```
Como el campo es requerido, hay que agregar `isTrending: false` a los 3 objetos de `filterFixtureEvents` en `event.utils.test.ts` (si no, falla `tsc`).

### Mock (`src/modules/event/mocks/event.mock.ts`)
`isTrending: true` en 6 eventos de 6 categorias distintas (1 se solapa con `isFeatured`). El resto va con `false`.

| id | Evento | Categoria | isFeatured |
|----|--------|-----------|------------|
| 2 | Coldplay - Music of the Spheres | concerts | true |
| 4 | Final Copa Libertadores | sports | false |
| 5 | El Fantasma de la Opera | theater | false |
| 8 | Selvamonos Festival | festivals | false |
| 10 | George Lopez en vivo | standup | false |
| 14 | Summit Tecnologia y Negocios | conferences | false |

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export function getTrendingEvents(events: readonly EventEntity[]): EventEntity[];
//  events.filter((event) => event.isTrending). Mantiene el orden del input y no muta.
```

### Componentes
```ts
// src/modules/event/components/trending-events.tsx — server component (NUEVO, sin "use client")
export interface TrendingEventsProps { events: readonly EventEntity[] }
export function TrendingEvents({ events }: TrendingEventsProps): JSX.Element | null;
//  Si events.length === 0 -> null.
//  <section aria-labelledby="trending-events-title" className="py-8">
//   <h2 id="trending-events-title" className="font-heading text-2xl font-semibold">
//     Nuestras <span className="text-primary">Tendencias</span>
//   </h2>
//   <ul className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
//     <li key={event.id} className="w-64 shrink-0 snap-start sm:w-72">
//       <EventCard event={event} className="h-full" />
//     </li>
//   </ul>
//  </section>
```

```ts
// src/modules/event/components/event-search-bar.tsx — "use client" (misma firma: EventSearchBar())
//  Contenedor externo sin cambios: sticky top-16 z-40 border-b bg-background + max-w-7xl mx-auto px-4 md:px-6 py-3.
//  Layout interno: flex flex-col gap-1 md:flex-row md:items-center md:gap-3
//   1. Barra (flex-1): flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm
//      md:flex-row md:items-center md:gap-2 md:rounded-full md:pl-2
//      a. <form onSubmit={preventDefault} className="md:flex-1"> con lupa absoluta + <Input type="search"
//         aria-label="Buscar eventos" placeholder="Busca tu proximo evento" className="border-0 bg-transparent
//         pl-8 shadow-none" /> (se mantiene el focus-visible ring del Input).
//      b. <Separator orientation="vertical" className="hidden h-8 self-center md:block" />
//      c. Fila de campos + boton (flex items-center gap-2; en mobile ocupa todo el ancho):
//         - Popover fecha: PopoverTrigger render={<Button variant="ghost" className="h-auto flex-1 flex-col
//           items-start gap-0 px-3 py-1 md:flex-none" />} con <FilterFieldLabel label="Fecha"
//           value={formatDateRangeLabel(dateRange)} />. PopoverContent/Calendar IDENTICOS a los actuales.
//         - <Separator orientation="vertical" className="hidden h-8 self-center md:block" />
//         - Popover precio: mismo trigger con <FilterFieldLabel label="Precio"
//           value={`${formatEventPrice(minPrice)} – ${formatEventPrice(maxPrice)}`} />. PopoverContent/Slider IDENTICOS.
//         - Boton circular: <Button size="icon-lg" className="shrink-0 rounded-full" aria-label="Ver resultados"
//           render={<a href="#upcoming-events" />} nativeButton={false}><Search aria-hidden /></Button>
//           Solo hace scroll a #upcoming-events (ancla nativa). No tiene onClick ni submit.
//   2. "Limpiar": <Button variant="link" size="xs" onClick={reset} className="self-end text-muted-foreground
//      md:self-auto">Limpiar filtros</Button>. Queda fuera de la barra: debajo a la derecha en mobile y a la
//      derecha de la barra desde md.
//
//  Helper LOCAL (no exportado, mismo archivo) para no duplicar el markup de los 2 campos:
function FilterFieldLabel(props: { label: string; value: string }): JSX.Element;
//   <span className="text-xs text-muted-foreground">{label}</span>
//   <span className="flex items-center gap-1 text-sm font-medium">
//     <span className="max-w-[140px] truncate">{value}</span><ChevronDown aria-hidden className="size-4" />
//   </span>
```
Los valores de clase son orientativos. Lo obligatorio es el patron visual (barra blanca unica, labels arriba en `muted-foreground`, valor en `font-medium` con chevron, separadores solo desde md, boton circular cta al final y limpiar sin competir visualmente), mantener la logica intacta y que no haya scroll horizontal en 375px.

### Navbar (`src/components/shared/site-header.tsx`)
```ts
const NAV_LINKS = [
  { href: "#upcoming-events", label: "Eventos" },
  { href: "#", label: "Categorias" },
] as const
```
Nada mas cambia: el Sheet mobile usa la misma constante.

### Barrel (`src/modules/event/index.ts`)
Agregar `export { TrendingEvents }`, `export type { TrendingEventsProps }` y `getTrendingEvents` al bloque de utils.

### Page (`src/app/page.tsx`)
```tsx
<EventSearchBar />
<div className="max-w-7xl mx-auto px-4 md:px-6"><EventSpotlight events={getFeaturedEvents(EVENTS_MOCK)} /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><TrendingEvents events={getTrendingEvents(EVENTS_MOCK)} /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><CategoryList /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><UpcomingEvents events={EVENTS_MOCK} /></div>
<NewsletterSignup />
```
Se elimina el import de `HowItWorks` y su bloque.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Rediseño visual del Topbar (misma logica, `FilterFieldLabel` local, boton circular y limpiar como link) | src/modules/event/components/event-search-bar.tsx | - | P1 |
| T2 | `isTrending` en tipo y mock, `getTrendingEvents` con test y fixtures del test actualizadas | src/modules/event/types/event.types.ts, src/modules/event/mocks/event.mock.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts | - | P1 |
| T3 | Componente `TrendingEvents` (usa `EventEntity` y `EventCard` existentes, recibe events por props) | src/modules/event/components/trending-events.tsx | - | P1 |
| T4 | Eliminar "Como funciona": borrar el componente, sacar el link del navbar y del footer | src/components/shared/how-it-works.tsx (borrar), src/components/shared/site-header.tsx, src/components/shared/site-footer.tsx | - | P1 |
| T5 | Barrel y page: exportar `TrendingEvents`/`getTrendingEvents`, montar Tendencias y quitar `HowItWorks` | src/modules/event/index.ts, src/app/page.tsx | T2, T3, T4 | S |

Orden: [T1 ‖ T2 ‖ T3 ‖ T4] → T5. Los archivos son disjuntos. T3 no depende de T2: solo tipa con `EventEntity` y no lee `isTrending`. Despues de T4 y hasta que termine T5, `page.tsx` importa un archivo borrado. Por eso `tsc`/`build` se verifican recien al cerrar T5.

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar → Topbar → Spotlight → Tendencias → Categorias → Proximos eventos → Newsletter → Footer. No hay seccion "Como funciona".
- [ ] AC2: El Topbar es una sola barra blanca (borde + sombra suave, pill desde md) con: input con lupa y sin label visible; campo "Fecha" (label chico en `muted-foreground`, valor en `font-medium`, p. ej. "Cualquier fecha", con chevron); campo "Precio" (p. ej. "S/ 0 – S/ 500", con chevron); separadores verticales entre input, fecha y precio solo desde md; y boton circular naranja (cta) con icono lupa al final.
- [ ] AC3: "Limpiar filtros" se ve como link de texto chico fuera de la barra y sigue reseteando query, fecha, precio y categoria.
- [ ] AC4: Sin regresiones de filtrado: al tipear, elegir un rango de fechas en el Calendar o mover el Slider, "Proximos eventos" se filtra en tiempo real igual que antes y los labels de los campos reflejan el valor elegido. El Topbar sigue sticky debajo del navbar.
- [ ] AC5: El boton circular tiene `aria-label`, foco visible y `cursor-pointer`. Al activarlo se hace scroll a "Proximos eventos" sin recargar ni enviar nada.
- [ ] AC6: "Tendencias" muestra el titulo "Nuestras" en color normal y "Tendencias" en `--color-primary`, y una fila horizontal con scroll y snap de los 6 eventos con `isTrending`, renderizados con `EventCard` sin modificar (badge de fecha, disponibilidad, precio, boton; el agotado sigue disabled si hubiera uno). Las cards de la fila tienen la misma altura.
- [ ] AC7: El navbar (desktop y Sheet mobile) muestra solo "Eventos" y "Categorias". El footer ya no tiene el link "Como funciona". No queda ninguna referencia a `how-it-works`/`HowItWorks` en `src/` y el archivo `how-it-works.tsx` no existe.
- [ ] AC8: Responsive en 375, 768, 1024 y 1440 px, sin scroll horizontal de pagina no intencional. En mobile los campos Fecha/Precio y el boton circular quedan en una fila propia debajo del input, sin separadores.
- [ ] AC9: `npm run test` pasa.
- [ ] AC10: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila.

## Tests requeridos
- `src/modules/event/utils/event.utils.test.ts` (se amplia; los tests actuales se mantienen):
  - `getTrendingEvents(EVENTS_MOCK)` devuelve al menos un evento y todos tienen `isTrending === true`.
  - Con un input sin eventos trending devuelve `[]`.
  - Agregar `isTrending: false` a las 3 fixtures de `filterFixtureEvents`.
- Sin test: `TrendingEvents` (presentacional, solo mapea a `EventCard`, que ya tiene test) y `EventSearchBar` (el cambio es solo de layout; la logica esta cubierta por `event-filter.store.test.ts` y los tests de `filterEvents`/`formatDateRangeLabel`). `SiteHeader` no lleva test (presentacional).

## Preguntas abiertas
- No hay preguntas bloqueantes. Decisiones por defecto que se pueden ajustar al aprobar:
  - Boton circular: hace scroll a `#upcoming-events` con un ancla nativa (sin logica). La alternativa es que sea puramente decorativo.
  - "Limpiar filtros" siempre visible (no solo con filtros activos), para no sumar logica de "filtros sucios".
  - Se quitan los iconos `CalendarDays`/`Wallet` de los triggers porque el label "Fecha"/"Precio" los reemplaza, como en joinnus.
  - Placeholder "Busca tu proximo evento" (landing.md). El actual es "Buscar eventos, lugares o ciudades...".
- Resuelto por el usuario (2026-09-28): el footer SI se ajusta (se quita el link "Como funciona"), pese a que landing.md decia "Footer sin cambios" — es una excepcion puntual, mismo criterio de consistencia que el navbar.

## Estado
- Aprobacion humana: aprobada (2026-09-28) — footer tambien pierde el link "Como funciona"
- Fase: aprobado
- Log de review:
  - Iteracion 1: APPROVED. 2 notas menores sin accion (sin historial git para diff — src/modules no esta trackeado; ancho justo en 375px con rango de fecha largo, no verificado en navegador real).
