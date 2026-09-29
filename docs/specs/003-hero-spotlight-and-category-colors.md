# 003 — Hero "spotlight" de destacados y colores por categoria (Fase 1 de revision 3)

## Contexto
La revision 3 del diseno (`design-system/ticketera/pages/landing.md`, seccion "Orden de secciones (revision 3, 2026-09-25 — en base a mockup de usuario)", y `design-system/ticketera/MASTER.md`, secciones "Colores por categoria (revision 3...)" y "Color del panel spotlight del Hero") trae 6 cambios sobre la landing de 002. No entran en una sola sesion (~8 archivos / 5 tareas), asi que se parten en dos specs:
- **003 (esta, Fase 1):** el Hero "spotlight", que es el cambio mas grande y riesgoso y conviene aislarlo, y los colores pastel por categoria, que son un cambio chico y de alto impacto visual.
- **004 (Fase 2):** cards con badge de fecha y categoria de color, navbar, "Como funciona" y "Newsletter". Son independientes entre si y dependen de piezas que crea esta spec.

Resultado esperado: el hero full-bleed de 002 pasa a ser una tarjeta dividida (panel navy + imagen) que rota sola entre los eventos `isFeatured`. Tiene controles prev/pausa/next y debajo una tira de miniaturas sincronizada con el slide activo. Cada Card de categoria usa su propio color pastel.

## Alcance
- Incluye:
  - Tokens `--spotlight-panel` / `--spotlight-panel-foreground` en `globals.css`.
  - Colores por categoria (tabla de MASTER.md, 10 colores) como datos del dominio en `EVENT_CATEGORIES`.
  - Helper `getEventCategoryOption` para resolver una categoria por id. Hoy `event-card.tsx` hace el `find` inline y el spotlight seria el segundo consumidor (DRY).
  - Componente nuevo `EventSpotlight`, que reemplaza a `HeroCarousel` (se **borra** `hero-carousel.tsx`), con swiper + autoplay + pausa + tira de miniaturas.
  - Componente nuevo `EventAvailabilityBadge`, que extrae el badge de disponibilidad que hoy vive inline en `event-card.tsx`. Lo usa el spotlight ahora y la card lo adopta en 004.
  - `CategoryList` con fondo pastel e icono de color por categoria.
- Excluye:
  - **Topbar (`event-search-bar.tsx`): sin cambios.** Se reviso y no hace falta ningun ajuste cosmetico: sigue sticky `top-16`, y el spotlight ya no es full-bleed, asi que no hay solapamiento nuevo.
  - Cualquier cambio en `event-card.tsx`, `site-header.tsx` y `upcoming-events.tsx` (quedan para 004).
  - Link real de "Ver detalles" (`href="#"`, no hay pagina de detalle).
  - Tests de componentes con swiper (ver "Tests requeridos").
- Tamano: son 10 archivos de autor (1 se borra). Supera la guia de ~8 porque 4 son ediciones de pocas lineas (tokens, tipo, constantes, barrel/page). Se respeta el limite de 5 tareas. Si hay que recortar, T4 (`category-list.tsx`) pasa entera a 004.
- Backlog:
  - **Spec 004:** cards de "Proximos eventos" con badge de fecha y categoria como texto de color (adopta `EventAvailabilityBadge` y `getEventCategoryOption`), navbar ("Como funciona", "Vender entradas", "Iniciar sesion" como link), seccion "Como funciona" y seccion "Newsletter".
  - Franja de "Confianza" (sigue pendiente segun landing.md).
  - Pagina de detalle de evento (destino real de "Ver detalles"), checkout, auth y API.

## Reuso detectado
- `swiper` 14.2.0 (ya instalado): `Swiper`/`SwiperSlide` de `swiper/react`. Modulos de `swiper/modules`: `Autoplay`, `Keyboard` y `A11y`. Solo se importa `swiper/css`. `Navigation` y `Pagination` ya no hacen falta: los controles prev/next son botones propios que llaman a la instancia (mismo criterio que la desviacion aceptada en 002), y la tira de miniaturas reemplaza a los bullets.
  - API de autoplay verificada en `node_modules/swiper/modules/autoplay/autoplay.d.ts`: `autoplay.start()`, `autoplay.stop()`, `autoplay.running`, `pauseOnMouseEnter` y `disableOnInteraction`. El boton de pausa usa `stop()`/`start()` y no `pause()`/`resume()`. Motivo: `pauseOnMouseEnter` usa `pause`/`resume` por dentro, y al sacar el mouse reanudaria una pausa que puso el usuario.
  - **Modulo `Thumbs`: evaluado y descartado.** Existe (`swiper/modules/thumbs`). Pide una **segunda instancia** de swiper para la tira y marca la activa con la clase `swiper-slide-thumb-active`. El click lo maneja con el evento `tap` de swiper sobre `div` de slide, que no son focusables ni operables con teclado (se verifico en `modules/thumbs.mjs`, `onThumbClick`). Para que fuera accesible habria que agregar `button`s internos y de todas formas guardar la instancia en estado. La sincronizacion manual es mas simple y accesible: un `useState<number>` actualizado en `onSlideChange` (`swiper.realIndex`) y `<button>` nativos que llaman a `swiper.slideToLoop(i)`, con `aria-current`. Son ~3 lineas y usan un solo swiper.
- `src/components/ui/button.tsx`: CTA "Comprar entradas" (variant `default` = cta), "Ver detalles" (`variant="outline"` con clases claras sobre fondo oscuro) y controles prev/pausa/next (`variant="ghost" size="icon-sm"` dentro del pill blanco). Los links usan `render={<a href="..." />}` + `nativeButton={false}` (base-nova, sin `asChild`).
- `src/components/ui/badge.tsx`: "Destacado" (clases `bg-cta text-cta-foreground`), categoria en el panel y disponibilidad (via `EventAvailabilityBadge`).
- `src/components/ui/card.tsx`: la Card de categoria no cambia de estructura, solo de colores.
- `src/modules/event/utils/event.utils.ts`: `getFeaturedEvents` (page), `formatEventDate` y `formatEventPrice` (panel y miniaturas).
- `src/modules/event/constants/event.constants.ts`: `EVENT_CATEGORIES` se extiende con los colores (no se crea una constante paralela) y `EVENT_AVAILABILITY_LABEL` se reusa en el badge extraido.
- `next/image`: imagen del slide (`fill`, `preload` solo en index 0) y miniaturas (`fill`, `sizes="96px"`).
- `lucide-react`: `ChevronLeft`, `ChevronRight`, `Pause`, `Play`, `CalendarDays`, `MapPin`.
- El store `useEventFilterStore` no se toca. Solo usa `EventCategory`/`EventCategoryFilter` y no `EventCategoryOption` (verificado con grep), asi que extender la opcion no lo afecta.
- Nada reutilizable en `src/hooks`, `src/store`, `src/lib` (solo `cn`) ni `src/components/shared` para carruseles o badges.

## Contratos

### Tokens (`src/app/globals.css`)
```css
:root { --spotlight-panel: #1e1b4b; --spotlight-panel-foreground: #ffffff; }
@theme inline { --color-spotlight-panel: var(--spotlight-panel); --color-spotlight-panel-foreground: var(--spotlight-panel-foreground); }
/* clases: bg-spotlight-panel, text-spotlight-panel-foreground */
```

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export interface EventCategoryOption {
  id: EventCategory;
  label: string;
  icon: LucideIcon;
  bgClassName: string;   // fondo pastel del chip, ej. "bg-[#EDE9FE]"
  textClassName: string; // color saturado (icono / texto de categoria), ej. "text-[#7C3AED]"
}
```
Las clases son strings literales completos para que Tailwind v4 las detecte al escanear el `.ts`. Se usan hex arbitrarios, y no `bg-violet-100`, porque la paleta por defecto de Tailwind v4 es oklch y no coincide exacto con los hex de MASTER.md. Son datos del dominio y no tokens de theme (MASTER.md lo pide asi).

### Constantes (`src/modules/event/constants/event.constants.ts`)
`EVENT_CATEGORIES` mantiene orden, ids, labels e iconos. Solo se agregan los colores de MASTER.md:

| id | bgClassName | textClassName |
|---|---|---|
| concerts | `bg-[#EDE9FE]` | `text-[#7C3AED]` |
| sports | `bg-[#D1FAE5]` | `text-[#059669]` |
| theater | `bg-[#FEE2E2]` | `text-[#DC2626]` |
| festivals | `bg-[#FFEDD5]` | `text-[#EA580C]` |
| family | `bg-[#DBEAFE]` | `text-[#2563EB]` |
| standup | `bg-[#FEF9C3]` | `text-[#CA8A04]` |
| cinema | `bg-[#E0E7FF]` | `text-[#4F46E5]` |
| arts | `bg-[#FCE7F3]` | `text-[#DB2777]` |
| fairs | `bg-[#CCFBF1]` | `text-[#0D9488]` |
| conferences | `bg-[#CFFAFE]` | `text-[#0891B2]` |

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export function getEventCategoryOption(category: EventCategory): EventCategoryOption;
//  Busca en EVENT_CATEGORIES. Todas las EventCategory tienen opcion (lo cubre un test), asi que no
//  devuelve undefined. Si no la encuentra lanza Error (es un error de programacion, no un caso de UI).
```

### Componentes
```ts
// src/modules/event/components/event-availability-badge.tsx — server-compatible (NUEVO)
export interface EventAvailabilityBadgeProps { availability: EventAvailability; className?: string }
export function EventAvailabilityBadge(props: EventAvailabilityBadgeProps): JSX.Element;
//  Misma logica y estilos que el badge inline actual de event-card.tsx:
//  available → bg-success text-success-foreground; few-left → bg-cta text-cta-foreground;
//  sold-out → variant "destructive". Texto: EVENT_AVAILABILITY_LABEL[availability].
//  event-card.tsx NO se toca en esta spec (lo adopta 004).

// src/modules/event/components/event-spotlight.tsx — "use client" (NUEVO, reemplaza hero-carousel.tsx)
export interface EventSpotlightProps { events: readonly EventEntity[] }
export function EventSpotlight(props: EventSpotlightProps): JSX.Element;
//  <section aria-label="Eventos destacados" aria-roledescription="carrusel" className="py-8">
//   con <h1 className="sr-only">Descubre tu proximo evento</h1>. La pagina sigue teniendo un h1: el
//   titulo de 002 se va con el hero full-bleed. El titulo de cada evento es h2.
//  Estado: swiper (instancia, via onSwiper), activeIndex (number, via onSlideChange → realIndex),
//   isPlaying (boolean).
//  <Swiper modules={[Autoplay, Keyboard, A11y]} loop
//    autoplay={{ delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true }}
//    keyboard={{ enabled: true, onlyInViewport: true }}
//    a11y={{ prevSlideMessage: "Evento anterior", nextSlideMessage: "Evento siguiente" }}
//    className="overflow-hidden rounded-xl shadow-xl">
//  Reduced motion: en onSwiper, si matchMedia("(prefers-reduced-motion: reduce)").matches
//   → swiper.autoplay.stop() y isPlaying = false.
//  Slide (uno por evento, alto fijo para que todos midan igual):
//   flex-col md:flex-row md:h-[420px]. En mobile el panel va arriba y la imagen abajo, asi el pill de
//   controles (abajo a la derecha) siempre cae sobre la imagen.
//   - Panel (md:w-1/2, bg-spotlight-panel text-spotlight-panel-foreground, p-6 md:p-10):
//     Badge "Destacado" (bg-cta text-cta-foreground) + Badge de categoria
//     (getEventCategoryOption(...).label, variant="outline" border-white/30 text-white; NO se usan
//     los colores pastel aca porque algunos no dan contraste en badge pequeno, ej. yellow-600 sobre
//     yellow-100), contador "{index + 1}/{events.length}" (text-sm, opacity), h2 con el titulo (H2 de
//     MASTER), fecha (CalendarDays + formatEventDate) y lugar (MapPin + venue, city) con iconos
//     aria-hidden, "Desde {formatEventPrice(priceFrom)}" (font-semibold), Button default "Comprar
//     entradas" → #upcoming-events y Button outline "Ver detalles" → "#" (bg-transparent, border y
//     texto blancos, hover:bg-white/10). Botones sin wrap a 375px (flex-wrap si hace falta).
//   - Imagen (relative, h-56 md:h-auto md:w-1/2): next/image fill object-cover,
//     sizes="(min-width: 768px) 50vw, 100vw", alt = event.title, preload={index === 0}.
//     <EventAvailabilityBadge className="absolute right-3 top-3" />.
//  Controles (absolute bottom-4 right-4 z-10, pill bg-white rounded-full shadow-md, fuera de los
//   slides para que no se dupliquen con los clones del loop): 3 botones con aria-label
//   "Evento anterior" (swiper.slidePrev()), "Pausar rotacion"/"Reanudar rotacion" con icono
//   Pause/Play (toggle: isPlaying ? autoplay.stop() : autoplay.start()) y "Evento siguiente"
//   (swiper.slideNext()). cursor-pointer, foco visible.
//  Tira de miniaturas (debajo del Swiper, mt-4): <ul> flex gap-3 overflow-x-auto snap-x (en mobile
//   el scroll horizontal es intencional) con un <li> por evento. Cada item es un
//   <button type="button" aria-label={`Ver ${title}`} aria-current={i === activeIndex || undefined}
//   onClick={() => swiper?.slideToLoop(i)}> con imagen size-16/rounded-lg (next/image fill,
//   sizes="64px"), titulo (line-clamp-1, font-medium, text-sm) y fecha (formatEventDate, text-xs
//   muted-foreground). Indicador de la activa: borde inferior/ring text-primary
//   (ej. border-b-2 border-primary), las demas border-transparent con hover:border-border.
//   Muestra TODOS los destacados, incluido el activo, para que el indicador tenga sentido.
//  Si events.length === 0 → return null.

// src/modules/event/components/category-list.tsx — "use client" (misma firma)
export function CategoryList(): JSX.Element;
//  Misma estructura, layout, link, onClick y hover que 002. Cambia solo el color:
//  Card con className de bgClassName (se quita el ring-foreground/10 neutro si no se ve; el hover
//  ring-primary se mantiene). El circulo del icono pasa de bg-primary/10 a bg-white, y el icono de
//  text-primary a textClassName. Label en text-foreground (contraste OK sobre todos los pasteles).
```

### Barrel (`src/modules/event/index.ts`)
Se quitan `HeroCarousel`/`HeroCarouselProps` y se agregan `EventSpotlight` y `EventSpotlightProps`. `getEventCategoryOption` y `EventAvailabilityBadge` no se exportan (solo los usa el modulo; YAGNI).

### Page (`src/app/page.tsx`)
```tsx
<EventSearchBar />
<div className="max-w-7xl mx-auto px-4 md:px-6"><EventSpotlight events={getFeaturedEvents(EVENTS_MOCK)} /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><CategoryList /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><UpcomingEvents events={EVENTS_MOCK} /></div>
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Tokens `--spotlight-panel(-foreground)` en `:root` y mapeo en `@theme inline` | src/app/globals.css | - | S |
| T2 | Colores por categoria: campos `bgClassName`/`textClassName` en `EventCategoryOption`, tabla de MASTER en `EVENT_CATEGORIES`, helper `getEventCategoryOption` con tests | src/modules/event/types/event.types.ts, src/modules/event/constants/event.constants.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts | - | S |
| T3 | `EventAvailabilityBadge` extraido y `EventSpotlight` nuevo (swiper + autoplay + pausa + miniaturas); borrar `hero-carousel.tsx` | src/modules/event/components/event-availability-badge.tsx, src/modules/event/components/event-spotlight.tsx, src/modules/event/components/hero-carousel.tsx (borrar) | T1, T2 | P1 |
| T4 | `CategoryList` con fondo pastel e icono de color por categoria | src/modules/event/components/category-list.tsx | T2 | P1 |
| T5 | Barrel (HeroCarousel → EventSpotlight) y page con el spotlight dentro del contenedor | src/modules/event/index.ts, src/app/page.tsx | T3, T4 | S |

Orden: T1 → T2 → [T3 ‖ T4] → T5. T1 y T2 no dependen entre si, pero T1 toca un archivo compartido (`globals.css`) y queda serial por regla. Entre T3 y T5 el build queda roto a proposito, porque `index.ts` todavia exporta el `hero-carousel` borrado. T5 lo cierra; se verifica tsc/lint/build al final.

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar → Topbar (sticky, sin cambios de 002) → Spotlight → Categorias → Proximos eventos → Footer. `hero-carousel.tsx` no existe y `grep -r HeroCarousel src` no devuelve nada.
- [ ] AC2: El spotlight muestra un evento `isFeatured` a la vez en una tarjeta dividida: panel `#1E1B4B` a la izquierda (arriba en mobile) con "Destacado", categoria, contador "N/M", titulo, fecha, lugar, "Desde S/ X", "Comprar entradas" (naranja, lleva a `#upcoming-events`) y "Ver detalles" (outline claro), e imagen a la derecha (abajo en mobile) con el badge de disponibilidad arriba a la derecha.
- [ ] AC3: Rota sola cada ~6 s en loop. El boton de pausa detiene la rotacion y cambia a "Reanudar rotacion" (icono Play). Al pasar el mouse la rotacion se pausa y al salir retoma, salvo que el usuario la haya pausado con el boton. Con `prefers-reduced-motion: reduce` arranca pausado.
- [ ] AC4: Prev/next (botones y flechas del teclado con el foco fuera de inputs) cambian de slide. Los controles estan en un pill blanco abajo a la derecha, sobre la imagen, en 375/768/1440, y no tapan el CTA ni el texto del panel.
- [ ] AC5: Debajo hay una tira con una miniatura (imagen + titulo + fecha) por cada evento destacado. La del slide activo tiene indicador visible y `aria-current="true"`, y se actualiza con autoplay, prev/next y teclado. Click o Enter en una miniatura va a ese evento.
- [ ] AC6: La pagina tiene exactamente un `h1` (sr-only en el spotlight) y cada titulo de slide es `h2`.
- [ ] AC7: Las 10 Cards de categoria usan el fondo pastel y el color de icono exactos de MASTER.md (se verifica en DevTools, p. ej. Conciertos `#EDE9FE` / `#7C3AED`), con el icono dentro de un circulo blanco. Click, hover y layout se comportan como en 002.
- [ ] AC8: Filtros, store y tabs de "Proximos eventos" se comportan igual que en 002 (sin regresiones). `event-card.tsx`, `event-search-bar.tsx` y `site-header.tsx` no tienen cambios en el diff.
- [ ] AC9: Responsive en 375, 768, 1024 y 1440 px, sin scroll horizontal de pagina salvo los intencionales (miniaturas y categorias en mobile, TabsList).
- [ ] AC10: Accesibilidad: todos los botones de icono tienen `aria-label`, los iconos decorativos llevan `aria-hidden`, el foco es visible, los clicables tienen `cursor-pointer` y las imagenes tienen `alt`.
- [ ] AC11: `npm run test` pasa.
- [ ] AC12: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila.

## Tests requeridos
Vitest + React Testing Library, junto al archivo.
- `src/modules/event/utils/event.utils.test.ts` (se amplia; lo existente se mantiene):
  - `getEventCategoryOption` devuelve la opcion correcta para un id (p. ej. `"concerts"` → label "Conciertos").
  - Todas las categorias usadas en `EVENTS_MOCK` y todos los ids de `EVENT_CATEGORIES` resuelven sin lanzar.
  - Cada opcion de `EVENT_CATEGORIES` tiene `bgClassName` que empieza con `bg-[#` y `textClassName` que empieza con `text-[#`, y no hay colores repetidos entre categorias.
- `event-card.test.tsx` no cambia y tiene que seguir pasando.
- Sin test: `EventSpotlight` (swiper no funciona bien en jsdom; su logica propia es cableado de 3 lineas contra la API de swiper y se verifica con AC3 a AC5), `EventAvailabilityBadge` (presentacional; su mapeo ya lo cubre indirectamente `event-card.test.tsx` cuando 004 lo adopte) y `CategoryList` (presentacional).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados que el humano puede cambiar al aprobar:
- **Modulo `Thumbs` de swiper descartado** en favor de sincronizacion manual con `<button>` nativos (ver "Reuso detectado"), por accesibilidad de teclado y para no tener un segundo swiper. Si se prefiere `Thumbs`, se cambia solo dentro de T3.
- **h1 sr-only**: la revision 3 no define un titular visible en el hero. Default: `h1` "Descubre tu proximo evento" solo para lectores de pantalla. Alternativa: un titular visible encima del spotlight.
- **Miniaturas**: landing.md dice "de los demas eventos destacados" y el pedido del orquestador dice "TODOS". Se toman todos, incluido el activo, porque el indicador de activo lo requiere.
- **Badge de categoria en el panel navy** en estilo neutro (outline blanco) y no pastel, por contraste. El color por categoria se ve en las Cards de categoria (esta spec) y en el texto de las cards de evento (004).
- **Delay de autoplay** 6000 ms (valor tomado por defecto).

## Estado
- Aprobacion humana: aprobada (2026-09-25)
- Fase: aprobado
- Log de review:
  - Iteracion 1: CHANGES_REQUESTED (boton "Ver detalles" ilegible por falta de bg-transparent, foco invisible en miniaturas). Corregido.
  - Iteracion 2: APPROVED.
