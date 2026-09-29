# 006 — Hero de 2 columnas: carousel simple + sidebar "Nuestras Tendencias" (revision 5, parte 1)

## Contexto
Revision 5 de la landing (`design-system/ticketera/pages/landing.md`, "Orden de secciones (revision 5, 2026-09-28 ...)", punto 3). El usuario pidio explicitamente, en base a joinnus.com:

- Borrar `EventSpotlight` (spec 003) y reemplazarlo por un hero de 2 columnas: carousel full-bleed simple de eventos `isFeatured` (columna principal) y un sidebar "Nuestras Tendencias" (columna lateral).
- El sidebar **reemplaza** a la seccion horizontal `TrendingEvents` (spec 005), que se borra completa.

Estas decisiones son firmes. Resultado esperado: en `/` el orden es Navbar → Topbar → Hero (carousel + sidebar) → Categorias → Proximos eventos → Newsletter → Footer, sin codigo ni tokens muertos.

**Corte en fases.** La revision 5 completa toca ~13 archivos, asi que se parte en 2 specs. Esta (006) cubre lo mas grande y riesgoso: el hero, los 2 componentes que se borran y la limpieza de tokens. La 007 (`docs/specs/007-category-circles-best-sellers.md`) cubre las categorias en circulos y "Lo mas vendido". La 007 se implementa **despues** de cerrar la 006, porque las dos tocan `index.ts` y `page.tsx`.

## Alcance
- Incluye:
  - Componente nuevo `HeroCarousel` (client, swiper): imagen + gradiente + headline fijo + CTA "Comprar entradas", con prev/next en un pill blanco (patron del spotlight).
  - Componente nuevo `TrendingSidebar` (server): titulo "Nuestras **Tendencias**" y una lista vertical compacta de eventos `isTrending` (miniatura + titulo + fecha). Cada item es un link a `#upcoming-events`.
  - Grid de 2 columnas en `page.tsx`: 1 columna en mobile (carousel arriba, sidebar abajo) y `md:grid-cols-[1fr_320px]`.
  - Borrar `event-spotlight.tsx` y `trending-events.tsx`, con sus exports del barrel.
  - Borrar los tokens `--spotlight-panel` / `--spotlight-panel-foreground` de `globals.css`.
- Excluye:
  - Cambios en `EventEntity`, el mock o `event.utils.ts`: `isTrending`, `getTrendingEvents` y `getFeaturedEvents` ya existen y se reusan tal cual.
  - Autoplay y pausa del carousel (ver Preguntas abiertas).
  - Controles prev/pause/next y rotacion automatica del sidebar: se usa scroll vertical interno (ver Decisiones).
  - Tira de miniaturas, precio, fecha, badges y "Ver detalles" del spotlight viejo.
  - Que el hero o el sidebar respondan a los filtros del Topbar.
- Backlog (spec 007): categorias en circulos con flechas, seccion "Lo mas vendido" con el flag `isBestSeller`. Franja de "Confianza" sigue en backlog.

## Decisiones
- **Sidebar con `overflow-y-auto`, sin autoplay ni controles.** Son 6 items. Una lista con altura fija y scroll interno los muestra todos sin JS, sin estado y sin pausa WCAG 2.2.2. landing.md deja evaluar esto; el patron autoplay + pausa se descarta por KISS. En desktop entran ~4 items visibles y en mobile ~3.
- **Sidebar como server component.** Son solo anclas, no necesita estado ni `setCategory`.
- **Carousel sin autoplay.** Es la "version simple de revision 2", que no tenia autoplay. Sin autoplay no hace falta el boton de pausa, y el pill queda en prev/next. Se reusa el patron de swiper del spotlight (`onSwiper` → `useState<SwiperClass>`, `slidePrev`/`slideNext` desde botones propios).
- **Grid en `page.tsx`.** Es layout puro, igual que los `div` contenedores que ya tiene la page. No se crea un componente `EventHero` solo para envolver 2 hijos (YAGNI).
- **Nombre `HeroCarousel`.** Retoma el nombre de la spec 002, ya que es la misma pieza simple. El archivo `hero-carousel.tsx` no existe hoy (lo borro la spec 003), asi que no hay conflicto.
- **Tokens `--spotlight-panel*`: se eliminan.** `grep` confirma que el unico consumidor es `event-spotlight.tsx` (`bg-spotlight-panel`, `text-spotlight-panel-foreground`), y ningun componente nuevo de la revision 5 los usa. Es el mismo criterio que se aplico con Embla en las specs 002/003. Se borran las 2 lineas de `@theme inline` (`--color-spotlight-panel*`, lineas ~16-17) y las 2 de `:root` (lineas ~80-81).

## Reuso detectado
- `src/modules/event/components/event-spotlight.tsx` (se borra), de donde se reciclan estos patrones:
  - swiper: `Swiper`/`SwiperSlide` de `swiper/react`, modulos `Keyboard` y `A11y` de `swiper/modules`, `import "swiper/css"`, `loop`, `keyboard={{ enabled: true, onlyInViewport: true }}`, `a11y={{ prevSlideMessage: "Evento anterior", nextSlideMessage: "Evento siguiente" }}`, y `onSwiper` guardando la instancia en `useState<SwiperClass | null>`.
  - El pill de controles `absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-full bg-white p-1 shadow-md` con `Button variant="ghost" size="icon-sm"`, `ChevronLeft`/`ChevronRight` y `aria-label`. Sin el boton de pausa.
  - `next/image` con `fill`, `object-cover` y `preload={index === 0}`.
  - CTA `Button render={<a href="#upcoming-events" />} nativeButton={false}`.
  - La miniatura de la tira (`relative size-16 rounded-lg` + `Image fill sizes="64px" alt=""` + `line-clamp-1` + `formatEventDate`) es la base del item del sidebar.
- Spec 002 (`hero-carousel` de revision 2): la capa fija encima del swiper con `pointer-events-none`, con `h1` y el CTA en `pointer-events-auto`, y el gradiente sobre la imagen.
- `src/modules/event/components/trending-events.tsx` (se borra): del titulo se reusan el markup `Nuestras <span className="text-primary">Tendencias</span>` y el patron `aria-labelledby`. El item con `EventCard` **no** se reusa, porque el sidebar pide items compactos y no cards completas.
- `src/modules/event/utils/event.utils.ts`: `getFeaturedEvents`, `getTrendingEvents` y `formatEventDate`, sin cambios.
- `src/components/ui/button.tsx`: CTA y botones del pill.
- `lucide-react`: `ChevronLeft` y `ChevronRight`.
- No se instala nada (npm ni shadcn). No hay nada aplicable en `src/hooks`, `src/store`, `src/lib` ni `src/components/shared`.

## Contratos

### Componentes
```ts
// src/modules/event/components/hero-carousel.tsx — "use client" (NUEVO)
export interface HeroCarouselProps { events: readonly EventEntity[] }
export function HeroCarousel({ events }: HeroCarouselProps): JSX.Element | null;
//  events.length === 0 -> null.
//  <section aria-label="Eventos destacados" aria-roledescription="carrusel"
//           className="relative overflow-hidden rounded-xl shadow-xl">
//    <Swiper modules={[Keyboard, A11y]} loop keyboard={...} a11y={...} onSwiper={setSwiper}
//            className="h-72 md:h-[420px]">
//      SwiperSlide por evento: <div className="relative h-full"> <Image src alt={event.title} fill
//        sizes="(min-width: 768px) 70vw, 100vw" className="object-cover" preload={index === 0} />
//        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
//    </Swiper>
//    Capa fija (absolute inset-0 z-10 pointer-events-none, flex flex-col justify-end gap-4 p-6 md:p-10 text-white):
//      <h1 className="text-[28px] md:text-[40px] font-bold leading-tight">Descubre tu proximo evento</h1>
//      <Button className="pointer-events-auto w-fit" render={<a href="#upcoming-events" />} nativeButton={false}>
//        Comprar entradas</Button>
//    Pill prev/next (absolute bottom-4 right-4 z-20, bg-white rounded-full, reusado del spotlight):
//      "Evento anterior" -> swiper?.slidePrev(), "Evento siguiente" -> swiper?.slideNext(). cursor-pointer.
//  El pill no se solapa con el CTA en 375px: el CTA queda abajo a la izquierda y el pill abajo a la derecha.
//  Si no entran, el pill se oculta en mobile (hidden md:flex); el swipe tactil cubre la navegacion.
```

```ts
// src/modules/event/components/trending-sidebar.tsx — server component (NUEVO, sin "use client")
export interface TrendingSidebarProps { events: readonly EventEntity[] }
export function TrendingSidebar({ events }: TrendingSidebarProps): JSX.Element | null;
//  events.length === 0 -> null.
//  <aside aria-labelledby="trending-sidebar-title"
//         className="flex h-80 flex-col rounded-xl border bg-card p-4 md:h-[420px]">
//    <h2 id="trending-sidebar-title" className="font-heading text-xl font-semibold">
//      Nuestras <span className="text-primary">Tendencias</span></h2>
//    <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
//      <li key={event.id}>
//        <a href="#upcoming-events" className="flex cursor-pointer items-center gap-3 rounded-lg p-2
//           transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
//          <div className="relative size-16 shrink-0"><Image src alt="" fill sizes="64px" className="rounded-lg object-cover" /></div>
//          <div className="flex min-w-0 flex-col gap-0.5">
//            <span className="line-clamp-2 text-sm font-medium">{event.title}</span>
//            <span className="text-xs text-muted-foreground">{formatEventDate(event.date)}</span>
//          </div>
//        </a>
//      </li>
//    </ul>
//  </aside>
//  Sin precio, sin CTA, sin EventCard. La altura del aside coincide con el carousel en desktop (420px).
```
Las clases son orientativas. Lo obligatorio es el comportamiento: 2 columnas desde md, las 2 con la misma altura en desktop, scroll vertical interno en el sidebar y cero scroll horizontal de pagina.

### Estilos (`src/app/globals.css`)
Se eliminan exactamente estas 4 lineas y nada mas:
```css
  --color-spotlight-panel: var(--spotlight-panel);
  --color-spotlight-panel-foreground: var(--spotlight-panel-foreground);
  --spotlight-panel: #1e1b4b;
  --spotlight-panel-foreground: #ffffff;
```

### Barrel (`src/modules/event/index.ts`)
- Quitar `EventSpotlight`, `EventSpotlightProps`, `TrendingEvents` y `TrendingEventsProps`.
- Agregar `HeroCarousel`, `HeroCarouselProps`, `TrendingSidebar` y `TrendingSidebarProps`.
- `getFeaturedEvents` y `getTrendingEvents` se mantienen.

### Page (`src/app/page.tsx`)
```tsx
<EventSearchBar />
<div className="max-w-7xl mx-auto px-4 md:px-6">
  <div className="grid gap-4 py-8 md:grid-cols-[1fr_320px]">
    <HeroCarousel events={getFeaturedEvents(EVENTS_MOCK)} />
    <TrendingSidebar events={getTrendingEvents(EVENTS_MOCK)} />
  </div>
</div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><CategoryList /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><UpcomingEvents events={EVENTS_MOCK} /></div>
<NewsletterSignup />
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | `HeroCarousel` nuevo (swiper simple, capa fija h1 + CTA, pill prev/next reciclado del spotlight) | src/modules/event/components/hero-carousel.tsx | - | P1 |
| T2 | `TrendingSidebar` nuevo (titulo + lista vertical compacta con `overflow-y-auto`) | src/modules/event/components/trending-sidebar.tsx | - | P1 |
| T3 | Integracion y limpieza: borrar spotlight y trending-events, quitar los tokens `--spotlight-panel*`, actualizar el barrel y montar el grid de 2 columnas en la page | src/modules/event/components/event-spotlight.tsx (borrar), src/modules/event/components/trending-events.tsx (borrar), src/app/globals.css, src/modules/event/index.ts, src/app/page.tsx | T1, T2 | S |

Orden: [T1 ‖ T2] → T3. T1 y T2 tienen archivos disjuntos y solo dependen de tipos/utils que ya existen. T3 es serial porque toca archivos compartidos (`globals.css`, barrel, page) y borra los consumidores de los tokens en el mismo paso, sin dejar estados intermedios rotos.

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar → Topbar → Hero (carousel + sidebar) → Categorias → Proximos eventos → Newsletter → Footer. No queda ninguna seccion horizontal "Tendencias" ni el spotlight con panel navy.
- [ ] AC2: `event-spotlight.tsx` y `trending-events.tsx` no existen, y `grep -rE "EventSpotlight|\bTrendingEvents\b|spotlight-panel|event-spotlight|trending-events" src` no devuelve nada (nota: `getTrendingEvents`, la funcion util, SI debe seguir existiendo y se usa en `\bTrendingEvents\b` con limite de palabra para no matchearla por error).
- [ ] AC3: Desde md el hero son 2 columnas: carousel a la izquierda y sidebar de ~320px a la derecha, con la misma altura (420px). En mobile es 1 columna, con el carousel arriba y el sidebar abajo.
- [ ] AC4: El carousel muestra solo los eventos `isFeatured` (4 en el mock). Cada slide es imagen full-bleed con gradiente, y encima el h1 fijo "Descubre tu proximo evento" y el CTA "Comprar entradas", que lleva a `#upcoming-events`. No hay precio, fecha, badges ni panel navy.
- [ ] AC5: Los botones prev/next del pill blanco cambian de slide (con loop), tienen `aria-label`, foco visible y `cursor-pointer`. El swipe tactil y las flechas del teclado tambien navegan. El CTA es clicable (no queda tapado por la capa `pointer-events-none`) y no se solapa con el pill en 375, 768 y 1440 px.
- [ ] AC6: El sidebar muestra el titulo "Nuestras" en color normal y "Tendencias" en `--color-primary`, y los 6 eventos `isTrending` como items compactos (miniatura 64px, titulo de hasta 2 lineas, fecha en `muted-foreground`), sin precio ni boton. La lista hace scroll vertical interno sin agrandar el aside.
- [ ] AC7: Cada item del sidebar es un link a `#upcoming-events`, con hover (`bg-muted`), foco visible y `cursor-pointer`.
- [ ] AC8: Responsive en 375, 768, 1024 y 1440 px, sin scroll horizontal de pagina.
- [ ] AC9: `npm run test` pasa (los tests actuales siguen verdes; esta spec no agrega tests).
- [ ] AC10: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila.

## Tests requeridos
- No se agregan tests. `HeroCarousel` usa swiper, que no funciona bien en jsdom (mismo criterio que en las specs 002 y 003), y no tiene logica propia fuera de prev/next. `TrendingSidebar` es presentacional (mapea eventos a links). La logica de datos (`getFeaturedEvents`, `getTrendingEvents`, `formatEventDate`) ya tiene tests en `event.utils.test.ts`.

## Preguntas abiertas
Ninguna bloquea. Estos son los defaults tomados, ajustables al aprobar:
- **Autoplay del carousel:** excluido (la version simple de revision 2 no lo tenia, y agregarlo obliga a sumar el boton de pausa por WCAG 2.2.2). Si se quiere, se agrega en T1 reciclando `Autoplay` + `handleTogglePlay` + el boton Pause/Play del spotlight.
- **Controles del sidebar:** landing.md menciona prev/pause/next chicos en el sidebar. Se reemplazan por scroll vertical interno (ver Decisiones). Si se quieren igual, es una tarea extra con swiper vertical.
- **Nota para el orquestador (fuera del ownership de esta spec):** `design-system/ticketera/MASTER.md` (seccion "Color del panel 'spotlight' del Hero (revision 3)") sigue documentando `--spotlight-panel`. Conviene marcarlo como eliminado en la revision 5.

## Estado
- Aprobacion humana: aprobada (2026-09-28)
- Fase: aprobado
- Log de review:
  - Iteracion 1: APPROVED. 1 hallazgo [spec] (comando grep de AC2 no filtraba `getTrendingEvents`), corregido en el texto de la spec, sin impacto en codigo.
