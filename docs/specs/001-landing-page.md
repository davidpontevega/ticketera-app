# 001 — Landing page (Etapa 1, mock data)

## Contexto
Ticketera es un marketplace de venta de entradas para eventos (referencias: ticketmaster.com, joinnus.com). En la Etapa 1 no hay backend ni auth: todo es mock o estatico. El objetivo es dejar aplicado el design system (tokens, fuente Poppins y primitivos shadcn) y construir la landing con mock data del modulo `event`, de forma que las paginas futuras se armen rapido reutilizando estas piezas.

Fuente de verdad de UI: `design-system/ticketera/MASTER.md` y `design-system/ticketera/pages/landing.md` (esta ultima tiene prioridad sobre MASTER en la landing).

## Alcance
- Incluye (Fase 1):
  - Base del proyecto: tokens de color, sombras y radios en `globals.css`; Poppins (400/500/600/700) global via `next/font/google`; `images.unsplash.com` en `remotePatterns`; instalacion de los primitivos shadcn; infraestructura de tests (Vitest + RTL).
  - Shell global en `layout.tsx`: `SiteHeader` sticky (logo, buscador desktop solo UI, links, "Iniciar sesion" outline, menu mobile con `Sheet`) y `SiteFooter` (columnas sobre nosotros, ayuda, legal, redes con iconos lucide, copyright).
  - Modulo `event`: tipos, mock (entre 8 y 12 eventos con imagenes de Unsplash), constantes de categorias y utilidades (filtro, formato).
  - Secciones de la landing, en este orden: **Hero** (carousel de destacados + buscador superpuesto + CTA), **Categorias** (chips con icono, `snap-x` en mobile y grid en desktop) y **Proximos eventos** (grid 2 → 4 columnas con `Tabs` para filtrar por categoria client-side).
- Excluye: dark mode, backend/API, auth real, busqueda funcional (los inputs son solo UI; el submit hace `preventDefault`), skeletons (se agregan solo si se nota jank), autoplay del carousel.
- Backlog (fases siguientes):
  - **Fase 2 (spec 002):** seccion "Eventos destacados" (carousel de `EventCard`, reutiliza `carousel` y `EventCard` de esta fase), "Franja de confianza" (3 columnas con icono + texto) y "CTA final / Newsletter" (input email, solo UI).
  - Que un chip de categoria preseleccione la tab en "Proximos eventos" (via `?category=` o store compartido). En Fase 1 el chip solo hace anchor a `#upcoming-events`.
  - Pagina de detalle de evento (`/events/[slug]`), checkout, auth real, busqueda real y "Vender entradas".
  - Servicio `event.service.ts` con axios cuando exista API (reemplaza al mock sin tocar componentes, porque estos reciben los datos por props).

## Reuso detectado
- `src/components/ui/button.tsx` — ya existe (shadcn style **base-nova**, sobre `@base-ui/react`). Se usa para los CTAs, la nav y los controles del carousel. Solo se cambian los estilos de la variant `default` (ver Contratos). **No tiene `asChild`**: para renderizar un link se usa `render={<Link href="..." />}` junto con `nativeButton={false}`.
- `src/lib/utils.ts` — `cn` (reexporta el paquete `cn`). Se usa en todos los componentes.
- `lucide-react` (ya instalado) — todos los iconos. No se instala otra libreria de iconos.
- `@base-ui/react` (ya instalado) — lo usan internamente `tabs` y `sheet`.
- `next/image` — imagenes de Unsplash. En Next 16 `priority` esta deprecado: usar `preload` solo en el primer slide del hero.
- `next/font/google` — Poppins; reemplaza a Geist y Geist_Mono, que se eliminan.
- shadcn a instalar (verificados en el registro con `npx shadcn@latest view`; hoy solo existe `button`):
  `npx shadcn@latest add card badge carousel tabs input separator sheet`
  - `carousel` agrega la dependencia `embla-carousel-react` (no se instala swiper).
  - `badge` base-nova trae las variants `default | secondary | destructive | outline | ghost | link`; **no tiene `success`**, se cubre con className (`bg-success text-success-foreground`).
  - `skeleton` no se instala (YAGNI, queda condicionado a que se note jank).
- Vitest: el proyecto **no lo tiene instalado** ni tiene script `test`. Se instala segun la guia `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`:
  `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`
- Nada reutilizable en `src/hooks`, `src/store`, `src/components/shared` ni `src/modules` (no existen todavia).
- `public/` — los SVG de scaffold de create-next-app no se reutilizan; AC1 ("no quedan restos del template") tambien cubre su eliminacion.

## Contratos

### Tokens (`src/app/globals.css`)
Se mantiene el patron actual (variables en `:root` mapeadas en `@theme inline`). Se reemplazan los valores oklch neutros por la paleta de MASTER.md usando **los nombres de shadcn**:

| Variable `:root` | Valor |
|---|---|
| `--primary` / `--primary-foreground` | `#4F46E5` / `#FFFFFF` |
| `--secondary` / `--secondary-foreground` | `#F1F5F9` / `#0F172A` |
| `--accent` / `--accent-foreground` | `#F1F5F9` / `#0F172A` (accent generico de shadcn para hover/focus de menus y dropdowns futuros; **no** es el naranja de CTA) |
| `--background`, `--card`, `--popover` | `#FFFFFF` |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `#0F172A` |
| `--muted` / `--muted-foreground` | `#F8FAFC` / `#64748B` |
| `--border`, `--input` | `#E2E8F0` |
| `--ring` | `#4F46E5` |
| `--destructive` | `#DC2626` |
| `--radius` | `0.5rem` (con esto `rounded-lg` = 8px y `rounded-xl` ≈ 11px, segun MASTER) |

Extensiones propias (nuevas en `:root` y mapeadas en `@theme inline`):
- `--cta: #F97316`, `--cta-foreground: #FFFFFF` → `--color-cta`, `--color-cta-foreground` (clases `bg-cta`, `text-cta`, `text-cta-foreground`). Es el "Accent/CTA" de MASTER y se usa **solo** para el boton de compra, el precio y el badge de urgencia ("Ultimas entradas"). Va separado de `--accent` para que los futuros primitivos shadcn que usan `bg-accent` en hover no salgan naranjas.
- `--success: #16A34A`, `--success-foreground: #FFFFFF` → `--color-success`, `--color-success-foreground`.
- `--destructive-foreground: #FFFFFF` → `--color-destructive-foreground`.
- Sombras `--shadow-sm|md|lg|xl` con los valores de MASTER, declaradas en `@theme` para que `shadow-md` etc. usen los valores del design system.
- `--font-sans: var(--font-poppins)` en `@theme inline` (hoy es una referencia circular, `var(--font-sans)`). Se elimina la linea `--font-mono` que apunta a Geist Mono.
- Se elimina el bloque `.dark { ... }` completo (solo modo claro). `@custom-variant dark` puede quedar, porque los primitivos de shadcn usan clases `dark:` inertes.
- Los tokens de chart y sidebar se dejan como estan (fuera de alcance).

### Button (`src/components/ui/button.tsx`)
Solo cambia la variant `default`: `bg-cta text-cta-foreground hover:bg-cta/90` (CTA naranja, segun MASTER; usa el token `cta` y no `accent`). `outline` se deja con texto `text-primary`. No se tocan las demas variants ni la logica.

### Fuente (`src/app/layout.tsx`)
```ts
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });
// <html lang="es" className={`${poppins.variable} h-full antialiased`}>
// <body className="min-h-full flex flex-col"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /></body>
export const metadata: Metadata; // title "Ticketera", description en espanol
```

### `next.config.ts`
```ts
images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] }
```
Forma de objeto, no `new URL("https://images.unsplash.com/**")`: ese patron normaliza `search` a `""` y bloquea las URLs de Unsplash con querystring (`?q=80&w=...`). Omitir `pathname`/`search` implica `**` (ver `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`, seccion `remotePatterns`).

### Tipos (`src/modules/event/types/event.types.ts`)
```ts
export type EventCategory = "concerts" | "sports" | "theater" | "festivals" | "family" | "standup";
export type EventAvailability = "available" | "few-left" | "sold-out";

export interface EventEntity {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  date: string;          // ISO 8601, ej. "2026-11-14T21:00:00-05:00"
  venue: string;         // "Estadio Nacional"
  city: string;          // "Lima"
  priceFrom: number;     // precio minimo en soles (PEN), en unidades y no en centimos; ej. 45 → "Desde S/ 45"
  imageUrl: string;      // https://images.unsplash.com/...
  availability: EventAvailability;
  isFeatured: boolean;   // se muestra en el hero
}

export type EventCategoryFilter = EventCategory | "all";

export interface EventCategoryOption {
  id: EventCategory;
  label: string;         // copy en espanol: "Conciertos", "Deportes", ...
  icon: LucideIcon;      // de lucide-react
}
```

### Constantes (`src/modules/event/constants/event.constants.ts`)
```ts
export const EVENT_CATEGORIES: readonly EventCategoryOption[]; // 6 categorias, en el orden de landing.md
export const EVENT_AVAILABILITY_LABEL: Record<EventAvailability, string>; // "Disponible" | "Ultimas entradas" | "Agotado"
export const EVENT_LOCALE = "es-PE";
export const EVENT_CURRENCY = "PEN"; // soles peruanos, simbolo "S/"
```

### Mock (`src/modules/event/mocks/event.mock.ts`)
```ts
export const EVENTS_MOCK: readonly EventEntity[]; // 8-12 eventos: todas las categorias, >=3 isFeatured, >=1 "few-left", >=1 "sold-out", fechas futuras
```
Se usa la carpeta `mocks/` (no esta en la lista de SETUP 1.3) porque los datos no son un service, un schema ni un tipo; se borra cuando exista la API.

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export function filterEventsByCategory(events: readonly EventEntity[], category: EventCategoryFilter): EventEntity[];
export function getFeaturedEvents(events: readonly EventEntity[]): EventEntity[];
export function formatEventDate(isoDate: string): string;   // Intl.DateTimeFormat(EVENT_LOCALE), ej. "sab, 14 nov · 21:00"
export function formatEventPrice(amount: number): string;   // Intl.NumberFormat(EVENT_LOCALE, { style: "currency", currency: EVENT_CURRENCY, minimumFractionDigits: 0 }) → "S/ 45"; con decimales, "S/ 45.50"
// El prefijo "Desde " lo agrega EventCard, no el helper.
```

### Componentes
```ts
// src/components/shared/site-header.tsx — "use client" (por el Sheet)
export function SiteHeader(): JSX.Element;
// src/components/shared/site-footer.tsx — server component
export function SiteFooter(): JSX.Element;

// src/modules/event/components/event-card.tsx — server-compatible
export interface EventCardProps { event: EventEntity; className?: string }
export function EventCard(props: EventCardProps): JSX.Element;
//  imagen 16:9 (next/image fill + sizes), badge de categoria, badge de disponibilidad
//  (success | accent | destructive), titulo h3, fecha + lugar en muted-foreground,
//  "Desde {formatEventPrice(priceFrom)}" en text-cta font-semibold, Button default (bg-cta) "Comprar entradas".
//  Badges de disponibilidad: available → bg-success text-success-foreground; few-left → bg-cta text-cta-foreground;
//  sold-out → variant "destructive".
//  Si availability === "sold-out": el boton queda disabled y la card sin hover/elevacion.

// src/modules/event/components/hero-carousel.tsx — "use client"
export interface HeroCarouselProps { events: readonly EventEntity[] }
export function HeroCarousel(props: HeroCarouselProps): JSX.Element;
//  Carousel full-bleed (opts loop), overlay con gradiente para el contraste, headline Display,
//  form de busqueda (Input + Button, preventDefault) y CTA "Comprar entradas" hacia #upcoming-events.
//  CarouselPrevious/Next posicionados dentro del hero (los defaults -left-12/-right-12 se salen del viewport).

// src/modules/event/components/category-list.tsx — server component
export function CategoryList(): JSX.Element; // usa EVENT_CATEGORIES; cada chip es un <a href="#upcoming-events">

// src/modules/event/components/upcoming-events.tsx — "use client"
export interface UpcomingEventsProps { events: readonly EventEntity[] }
export function UpcomingEvents(props: UpcomingEventsProps): JSX.Element;
//  <section id="upcoming-events">, Tabs ("Todos" + EVENT_CATEGORIES), estado local useState<EventCategoryFilter>("all"),
//  filterEventsByCategory, grid grid-cols-2 lg:grid-cols-4, mensaje vacio si no hay eventos en la categoria.
//  TabsList con overflow-x-auto en mobile (sin scroll horizontal de pagina).
```

### Barrel (`src/modules/event/index.ts`)
Exporta `HeroCarousel`, `CategoryList`, `UpcomingEvents`, `EventCard`, `EVENTS_MOCK`, `getFeaturedEvents` y los tipos publicos.

### Page (`src/app/page.tsx`)
Server component sin logica: `<HeroCarousel events={getFeaturedEvents(EVENTS_MOCK)} /> <CategoryList /> <UpcomingEvents events={EVENTS_MOCK} />`, cada seccion dentro de `max-w-7xl mx-auto px-4 md:px-6` (el hero es full-bleed).

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar los shadcn (`card badge carousel tabs input separator sheet`), las devDeps de Vitest y el script `"test": "vitest"`; crear `vitest.config.mts` (tsconfigPaths + react + jsdom); agregar `remotePatterns` de Unsplash | package.json, package-lock.json, src/components/ui/card.tsx, src/components/ui/badge.tsx, src/components/ui/carousel.tsx, src/components/ui/tabs.tsx, src/components/ui/input.tsx, src/components/ui/separator.tsx, src/components/ui/sheet.tsx, vitest.config.mts, next.config.ts | - | S |
| T2 | Tokens del design system en globals.css (paleta, success, destructive-foreground, sombras, font-sans, quitar `.dark`) y variant `default` de Button a `cta`. Nota: `--cta` (naranja #F97316, para compra, precio y urgencia) y `--accent` (#F1F5F9, generico de shadcn para hover de menus futuros) son **dos tokens separados**; no mapear el naranja a `--accent` | src/app/globals.css, src/components/ui/button.tsx | T1 | S |
| T3 | Nucleo del modulo event: tipos, constantes de categorias y disponibilidad, mock y utilidades con tests | src/modules/event/types/event.types.ts, src/modules/event/constants/event.constants.ts, src/modules/event/mocks/event.mock.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts | T2 | P1 |
| T4 | Shell compartido: SiteHeader (sticky, buscador desktop solo UI, Sheet mobile) y SiteFooter | src/components/shared/site-header.tsx, src/components/shared/site-footer.tsx | T2 | P1 |
| T5 | EventCard y seccion Proximos eventos (Tabs + filtro) con test de EventCard | src/modules/event/components/event-card.tsx, src/modules/event/components/event-card.test.tsx, src/modules/event/components/upcoming-events.tsx | T3 | P2 |
| T6 | Hero con carousel y buscador, y lista de categorias | src/modules/event/components/hero-carousel.tsx, src/modules/event/components/category-list.tsx | T3 | P2 |
| T7 | Barrel del modulo, page de la landing y layout con Poppins + header/footer | src/modules/event/index.ts, src/app/page.tsx, src/app/layout.tsx | T4, T5, T6 | S |

Orden de ejecucion: T1 → T2 → [T3 ‖ T4] → [T5 ‖ T6] → T7.
Nota: T4 no depende de T3, asi que T4 puede correr tambien en paralelo con P2 si conviene.

## Criterios de aceptacion
- [ ] AC1: `/` muestra, en este orden: header sticky, hero, categorias, proximos eventos y footer. No quedan restos del template de create-next-app.
- [ ] AC2: Todo el texto se renderiza en Poppins (verificable en DevTools > Computed > font-family). No quedan referencias a Geist en el codigo.
- [ ] AC3: Los colores coinciden con MASTER.md: CTA "Comprar entradas", precio y badge "Ultimas entradas" en naranja `#F97316` via el token `cta` (`--accent` no es naranja), links y tab activa en indigo `#4F46E5`, texto `#0F172A` sobre blanco. No existe el bloque `.dark` en globals.css.
- [ ] AC4: El hero muestra solo los eventos con `isFeatured`, con flechas prev/next visibles dentro del viewport y navegacion con las flechas del teclado. El primer slide usa `preload`.
- [ ] AC5: En "Proximos eventos", "Todos" muestra el mock completo. Al elegir una categoria se ven solo sus eventos; si no hay, aparece un mensaje de vacio. No hay requests de red.
- [ ] AC6: Cada card muestra imagen, categoria, titulo, fecha, lugar, "Desde S/ X" y un badge de disponibilidad (verde "Disponible", naranja "Ultimas entradas", rojo "Agotado"). Las cards agotadas tienen el boton disabled y no se elevan en hover.
- [ ] AC7: Las imagenes se sirven via `next/image` desde `images.unsplash.com` sin error de host no configurado.
- [ ] AC8: Responsive en 375, 768, 1024 y 1440 px: sin scroll horizontal de pagina (solo el intencional de las categorias con `snap-x` y de la TabsList). El grid tiene 2 columnas en mobile y 4 en `lg`. En mobile el header muestra el icono de menu, que abre un `Sheet` con los links.
- [ ] AC9: Accesibilidad: focus ring visible en todo elemento interactivo, `cursor-pointer` en los clicables, `alt` descriptivo en las imagenes, iconos solo de lucide (sin emojis) y botones de icono con `sr-only` o `aria-label`.
- [ ] AC10: `src/app/page.tsx` y `layout.tsx` no contienen logica de negocio ni mock data inline; importan desde `@/modules/event` y `@/components/shared`.
- [ ] AC11: `npm run test` pasa.
- [ ] AC12: `npx tsc --noEmit` y `npm run lint` sin errores. `npm run build` compila.

## Tests requeridos
Vitest + React Testing Library, cada test junto a su archivo.
- `src/modules/event/utils/event.utils.test.ts` (obligatorio):
  - `filterEventsByCategory`: con `"all"` devuelve todos, con una categoria devuelve solo esa, con una categoria sin eventos devuelve `[]`, y no muta el array de entrada.
  - `getFeaturedEvents`: devuelve solo `isFeatured`.
  - `formatEventPrice(45)` contiene `"S/"` y `"45"` y no contiene `".00"`. `formatEventDate` contiene el dia y el mes. Se usan aserciones con `toContain` o regex para no depender del espacio duro que inserta Intl.
- `src/modules/event/components/event-card.test.tsx` (tiene comportamiento condicional): con `sold-out` renderiza "Agotado" y el boton esta disabled; con `available` renderiza "Disponible" y el boton esta habilitado. Se usan aserciones nativas (`toHaveProperty("disabled", true)`) para no sumar `@testing-library/jest-dom`.
- Sin test: `SiteHeader`, `SiteFooter`, `CategoryList` y `HeroCarousel` (presentacionales o comportamiento delegado a shadcn/Embla). `UpcomingEvents` delega el filtrado a `filterEventsByCategory`, que ya esta testeada.

## Preguntas abiertas
Ninguna. Resueltas por el usuario (2026-09-25):
- Moneda: soles peruanos, `es-PE`, simbolo `S/` (ej. "Desde S/ 45").
- Color: se separa `--cta` (naranja) de `--accent` (generico de shadcn).
- Logo: texto "Ticketera" + icono `Ticket` de lucide-react como placeholder.
- Links de la nav y del footer sin destino: `href="#"` en Fase 1.

## Estado
- Aprobacion humana: aprobada (2026-09-25)
- Fase: aprobado
- Log de review:
  - Iteracion 1: CHANGES_REQUESTED (overlay del hero repetido por slide, cursor-pointer faltante, tab activa sin color primary, fecha pasada en mock, aria-hidden faltante, contrato next.config.ts desactualizado, restos de scaffold en public/). Todo corregido.
  - Iteracion 2: CHANGES_REQUESTED (overlay fijo del hero se solapaba con titulo por-slide y con las flechas prev/next). Corregido.
  - Iteracion 3: APPROVED.
