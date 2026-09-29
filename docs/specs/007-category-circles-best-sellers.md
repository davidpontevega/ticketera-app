# 007 — Categorias en circulos con flechas y seccion "Lo mas vendido" (revision 5, parte 2)

## Contexto
Segunda parte de la revision 5 de la landing (`design-system/ticketera/pages/landing.md`, "Orden de secciones (revision 5 ...)", puntos 4 y 5). La parte 1 (hero y sidebar) esta en `docs/specs/006-hero-carousel-trending-sidebar.md`.

Cambios pedidos por el usuario, ya decididos:
1. `CategoryList` deja de usar `Card` rectangulares y pasa a circulos: el icono va dentro de un circulo con el pastel de su categoria de fondo y el label va debajo. Queda en una fila horizontal con flechas prev/next visibles en los extremos. Las flechas hacen scroll del contenedor y se suman al touch-scroll/snap, no lo reemplazan.
2. Seccion nueva "Lo mas vendido esta semana" entre Categorias y Proximos eventos. Es una fila horizontal de eventos con el flag nuevo `isBestSeller`, cada uno con un numero de ranking grande (indice + 1).

Resultado esperado: en `/` el orden es Navbar → Topbar → Hero → Categorias (circulos) → Lo mas vendido → Proximos eventos → Newsletter → Footer.

**Dependencia:** esta spec se implementa **despues** de cerrar la 006, porque las dos tocan `src/modules/event/index.ts` y `src/app/page.tsx`. Los contratos de page/barrel de abajo parten del estado que deja la 006.

## Alcance
- Incluye:
  - Rediseño de `category-list.tsx`: circulos + label + flechas con `scrollBy`. Se mantiene el `onClick={() => setCategory(id)}` + `href="#upcoming-events"`.
  - `EventEntity.isBestSeller: boolean`, marcado en 6 eventos del mock.
  - `getBestSellerEvents(events)` en `event.utils.ts`, con test.
  - Componente nuevo `BestSellerEvents` (server), que reusa `EventCard` **sin modificarlo** y pone el numero de ranking al costado de la card.
  - Barrel y page.
- Excluye:
  - Cambios en `EventCard`, `EVENT_CATEGORIES`, el store o los filtros.
  - Contador de ventas real u ordenamiento por ventas: el ranking es el orden del array filtrado.
  - Deshabilitar las flechas en los extremos del scroll (en el borde, `scrollBy` no hace nada).
  - Flechas en "Lo mas vendido": no se piden, usa touch-scroll/snap como la vieja Tendencias.
  - Que "Lo mas vendido" responda a los filtros del Topbar.
- Backlog: franja de "Confianza".

## Decisiones
- **Ranking al costado de `EventCard`, no superpuesto.** `EventCard` ya ocupa las 2 esquinas superiores de la imagen (badge de fecha arriba a la izquierda, disponibilidad arriba a la derecha). Un numero superpuesto taparia uno de los dos o obligaria a tocar `EventCard`. El wrapper es `<li className="flex items-end gap-2">`, con el numero grande a la izquierda y `EventCard className="h-full w-64 sm:w-72"` a la derecha. Es el patron de joinnus/"top 10", y `EventCard` queda sin cambios.
- **`<ol>` semantico y numero `aria-hidden`.** El orden de la lista ya comunica el ranking a lectores de pantalla. El numero es decorativo.
- **Flechas de categorias.** `useRef<HTMLUListElement>` + `scrollBy({ left: ±el.clientWidth * 0.8, behavior })`, con `behavior` `"auto"` si `prefers-reduced-motion: reduce` y `"smooth"` si no. Es logica inline en el componente: 2 handlers de una linea no justifican un hook.
- **Categorias en fila en todos los breakpoints.** Se quita el `sm:grid sm:grid-cols-3 md:grid-cols-5` actual, porque el patron nuevo es una fila horizontal. Con 10 categorias de ~96px, en 1280px entran casi todas y las flechas siguen visibles.
- **Icono del titulo:** `Star` de lucide. `Trophy` ya es el icono de la categoria "Deportes" y generaria confusion.

## Reuso detectado
- `src/modules/event/components/category-list.tsx`: se mantienen el selector `setCategory`, el `<a href="#upcoming-events" onClick>`, `EVENT_CATEGORIES` (`icon`, `bgClassName`, `textClassName`), el foco visible y el patron `snap-x snap-mandatory overflow-x-auto` + `shrink-0 snap-start`. Sale `Card`: ya no se importa en este archivo, pero sigue en uso en `EventCard`, asi que `card.tsx` no se toca.
- `src/components/ui/button.tsx`: flechas con `variant="outline" size="icon"` + `rounded-full` (mismo criterio de botones propios que el pill del hero).
- `lucide-react`: `ChevronLeft`, `ChevronRight` y `Star`.
- `src/modules/event/components/event-card.tsx`: reuso tal cual con `className`, igual que la vieja `TrendingEvents` (`w-64 shrink-0 snap-start sm:w-72` + `h-full`).
- Patron de seccion del `TrendingEvents` borrado en la 006: `section aria-labelledby` + `h2 font-heading text-2xl font-semibold` con la palabra clave en `text-primary`, `ul flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2`, y `null` si esta vacio.
- `getFeaturedEvents`/`getTrendingEvents` (`event.utils.ts`): `getBestSellerEvents` copia el patron (filtrar por flag).
- `event.utils.test.ts`: los tests de `getTrendingEvents` son el molde de los nuevos.
- No se instala nada. No hay nada aplicable en `src/hooks`, `src/store`, `src/lib` ni `src/components/shared`.

## Contratos

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export interface EventEntity {
  // ...campos existentes sin cambios
  isBestSeller: boolean; // se muestra en la seccion "Lo mas vendido"
}
```
Como el campo es requerido, hay que agregar `isBestSeller: false` a los 3 objetos de `filterFixtureEvents` en `event.utils.test.ts` (si no, falla `tsc`).

### Mock (`src/modules/event/mocks/event.mock.ts`)
`isBestSeller: true` en 6 eventos, ninguno solapado con `isTrending`, para no repetir lo que ya muestra el sidebar. El resto va con `false`. El ranking sale del orden del mock:

| Ranking | id | Evento | Categoria | availability |
|---------|----|--------|-----------|--------------|
| 1 | 1 | Bad Bunny - World Tour | concerts | available |
| 2 | 3 | Peru vs Brasil - Eliminatorias | sports | available |
| 3 | 6 | Romeo y Julieta | theater | sold-out |
| 4 | 7 | Vive Latino Peru | festivals | available |
| 5 | 9 | Disney on Ice | family | few-left |
| 6 | 13 | Feria Internacional del Libro | fairs | available |

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export function getBestSellerEvents(events: readonly EventEntity[]): EventEntity[];
//  events.filter((event) => event.isBestSeller). Mantiene el orden del input y no muta.
```

### Componentes
```ts
// src/modules/event/components/best-seller-events.tsx — server component (NUEVO)
export interface BestSellerEventsProps { events: readonly EventEntity[] }
export function BestSellerEvents({ events }: BestSellerEventsProps): JSX.Element | null;
//  events.length === 0 -> null.
//  <section aria-labelledby="best-seller-events-title" className="py-8">
//    <h2 id="best-seller-events-title" className="flex items-center gap-2 font-heading text-2xl font-semibold">
//      <Star aria-hidden className="size-6 text-primary" />
//      <span>Lo mas <span className="text-primary">vendido</span> esta semana</span></h2>
//    <ol className="mt-6 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2">
//      <li key={event.id} className="flex shrink-0 snap-start items-end gap-2">
//        <span aria-hidden className="font-heading text-7xl leading-none font-bold text-primary">{index + 1}</span>
//        <EventCard event={event} className="h-full w-64 sm:w-72" />
//      </li>
//    </ol>
//  </section>
```

```ts
// src/modules/event/components/category-list.tsx — "use client" (misma firma: CategoryList())
//  <div className="flex items-center gap-2 py-4">
//    <Button variant="outline" size="icon" className="shrink-0 cursor-pointer rounded-full"
//            aria-label="Categorias anteriores" onClick={() => scroll(-1)}><ChevronLeft aria-hidden /></Button>
//    <ul ref={listRef} className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
//      <li key={id} className="shrink-0 snap-start">
//        <a href="#upcoming-events" onClick={() => setCategory(id)}
//           className="group flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl p-1 text-center
//                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
//          <span className={`flex size-20 items-center justify-center rounded-full transition-all duration-200
//                 group-hover:ring-2 group-hover:ring-primary motion-safe:group-hover:-translate-y-0.5 ${bgClassName}`}>
//            <Icon aria-hidden className={`size-8 ${textClassName}`} /></span>
//          <span className="line-clamp-2 text-sm font-medium text-foreground">{label}</span>
//        </a>
//      </li>
//    </ul>
//    <Button ... aria-label="Categorias siguientes" onClick={() => scroll(1)}><ChevronRight aria-hidden /></Button>
//  </div>
//  function scroll(direction: -1 | 1): void  // local, no exportada
//    listRef.current?.scrollBy({ left: direction * listRef.current.clientWidth * 0.8,
//      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
```
Las clases son orientativas. Lo obligatorio es: circulo con pastel e icono saturado, label debajo en `text-foreground`, flechas siempre visibles a los costados, snap/touch-scroll intacto, y sin scroll horizontal de pagina en 375px.

### Barrel (`src/modules/event/index.ts`)
Agregar `export { BestSellerEvents }`, `export type { BestSellerEventsProps }` y `getBestSellerEvents` al bloque de utils.

### Page (`src/app/page.tsx`)
Insertar entre el bloque de `CategoryList` y el de `UpcomingEvents`:
```tsx
<div className="max-w-7xl mx-auto px-4 md:px-6">
  <BestSellerEvents events={getBestSellerEvents(EVENTS_MOCK)} />
</div>
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | `isBestSeller` en tipo y mock, `getBestSellerEvents` con test, fixtures del test actualizadas | src/modules/event/types/event.types.ts, src/modules/event/mocks/event.mock.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts | spec 006 cerrada | P1 |
| T2 | `BestSellerEvents` nuevo (`EventCard` sin cambios + numero de ranking al costado, `<ol>`) | src/modules/event/components/best-seller-events.tsx | spec 006 cerrada | P1 |
| T3 | `CategoryList` rediseñado: circulos + label + flechas con `scrollBy` | src/modules/event/components/category-list.tsx | spec 006 cerrada | P1 |
| T4 | Barrel y page: exportar y montar "Lo mas vendido" entre Categorias y Proximos eventos | src/modules/event/index.ts, src/app/page.tsx | T1, T2 | S |

Orden: [T1 ‖ T2 ‖ T3] → T4. Los archivos son disjuntos. T2 no depende de T1: solo tipa con `EventEntity` y recibe los eventos por props, sin leer `isBestSeller`. T3 no toca barrel ni page (`CategoryList` mantiene su firma).

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar → Topbar → Hero → Categorias → Lo mas vendido → Proximos eventos → Newsletter → Footer.
- [ ] AC2: Cada categoria se ve como un circulo (~80px) con su pastel de fondo y su icono en el color saturado, con el label debajo en `text-foreground` (los largos, como "Ferias y exposiciones", en hasta 2 lineas y sin desbordar). No quedan `Card` en `category-list.tsx`.
- [ ] AC3: Las categorias estan en una sola fila horizontal en 375, 768, 1024 y 1440 px, con touch-scroll y snap funcionando.
- [ ] AC4: Hay flechas visibles a izquierda y derecha de la fila. Al clickearlas, la fila se desplaza ~80% de su ancho en esa direccion (suave, o instantaneo con `prefers-reduced-motion`). Tienen `aria-label`, foco visible y `cursor-pointer`.
- [ ] AC5: Al clickear una categoria se fija el filtro y se hace scroll a "Proximos eventos", igual que antes (tab activa correcta, sin regresion).
- [ ] AC6: "Lo mas vendido" muestra un icono estrella + "Lo mas " + "vendido" en `--color-primary` + " esta semana", y una fila horizontal con scroll y snap de los 6 eventos `isBestSeller`, en el orden del mock, cada uno con su numero 1-6 grande en `--color-primary` a la izquierda de un `EventCard` sin modificar. El numero no tapa los badges de la card. "Romeo y Julieta" (#3) aparece como Agotado, con el boton disabled.
- [ ] AC7: El ranking es una `<ol>` y los numeros son `aria-hidden`. `event-card.tsx` no tiene cambios.
- [ ] AC8: No hay scroll horizontal de pagina en 375, 768, 1024 ni 1440 px.
- [ ] AC9: `npm run test` pasa, incluidos los tests nuevos de `getBestSellerEvents`.
- [ ] AC10: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila.

## Tests requeridos
- `src/modules/event/utils/event.utils.test.ts` (se amplia; los tests actuales se mantienen):
  - `getBestSellerEvents(EVENTS_MOCK)` devuelve al menos un evento y todos tienen `isBestSeller === true`.
  - Con un input sin eventos best seller devuelve `[]`.
  - Agregar `isBestSeller: false` a las 3 fixtures de `filterFixtureEvents`.
- Sin test:
  - `BestSellerEvents` es presentacional: mapea a `EventCard`, que ya tiene test, y agrega `index + 1`.
  - `CategoryList` delega en `scrollBy` nativo, que jsdom no implementa, y en `setCategory`, que ya esta cubierto por `event-filter.store.test.ts`.

## Preguntas abiertas
Ninguna bloquea. Estos son los defaults tomados, ajustables al aprobar:
- **Eventos marcados como best seller:** los 6 de la tabla, elegidos sin solaparse con Tendencias. Incluye un agotado (#3) a proposito, para que se vea el estado disabled. Se puede cambiar la seleccion o el orden.
- **Flechas en mobile:** siempre visibles, como pide el requerimiento. Le quitan ~80px de ancho a la fila en 375px. La alternativa es ocultarlas en mobile (`hidden sm:inline-flex`) y dejar solo el swipe.

## Estado
- Aprobacion humana: aprobada (2026-09-28) — se implementa despues de cerrar la spec 006
- Fase: aprobado
- Log de review:
  - Iteracion 1: APPROVED. 2 notas menores sin accion (sin historial git para diff; responsive 375/768/1024/1440 no probado en navegador real, solo por lectura de codigo).
