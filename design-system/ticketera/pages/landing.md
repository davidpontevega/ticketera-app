# Landing Page Overrides

> **PROJECT:** Ticketera
> **Generated:** 2026-09-25 (revised manualmente — patron marketplace, no conferencia unica)
> **Page Type:** Landing / Marketplace de eventos
> **Etapa:** 1 — solo UI con mock data (sin backend, sin auth real)

> ⚠️ Reglas aqui **sobrescriben** `design-system/ticketera/MASTER.md`. Todo lo no listado aqui usa Master.

---

## Layout Overrides

- **Max width contenido:** 1280px (`max-w-7xl mx-auto px-4 md:px-6`)
- **Patron base:** `marketplace-directory` (adaptado de Ticketmaster/Joinnus) — no el patron "Event/Conference" (ese es para un solo evento/conferencia con speakers/agenda, no aplica: aca vendemos entradas a MUCHOS eventos distintos).

### Orden de secciones (revision 5, 2026-09-28 — mas cambios de joinnus.com, a pedido explicito del usuario pese a que el orquestador recomendo NO hacer estos 2 en la revision 4)

1. **Navbar** — sin cambios.
2. **Topbar de busqueda** — sin cambios respecto a revision 4 (patron joinnus, sticky, misma logica).
3. **Hero — REEMPLAZA al "spotlight" de revision 3** (se borra `EventSpotlight`, decision explicita del usuario pese a que se recomendo mantenerlo). Layout de 2 columnas en desktop (`grid md:grid-cols-[1fr_320px] gap-4` o similar), 1 columna en mobile (imagen arriba, sidebar abajo):
   - **Columna principal:** carousel full-bleed simple de eventos `isFeatured` (imagen + overlay con gradiente + headline fijo + CTA "Comprar entradas", SIN el panel navy con precio/fecha/badges del spotlight viejo — es la version simple que ya se habia construido en revision 2, antes del spotlight). Sigue usando **swiper** (ya instalado, se reusa el patron de navegacion con botones propios).
   - **Columna sidebar ("Nuestras Tendencias"):** **REEMPLAZA a la seccion horizontal "Tendencias" de revision 4** (se borra esa seccion completa, no se duplica). Titulo "Nuestras" (normal) + "Tendencias" (`--color-primary`) + controles prev/pause/next chicos (mismo patron del pill blanco que ya se resolvio para el spotlight, reusar criterio). Lista VERTICAL compacta de 2-3 eventos con `isTrending: true` visibles a la vez (imagen chica + titulo + fecha corta, sin precio/CTA — son items clicables que llevan a `#upcoming-events`, no tarjetas completas tipo `EventCard`). Si hay mas de 2-3 trending, rota entre ellos (mismo criterio de autoplay+pausa que tenia el spotlight, o simplemente scroll vertical interno con `overflow-y-auto` si son pocos — evaluar en la spec cual es mas simple dado que ya no hay spotlight de referencia).
4. **Categorias — REDISEÑADAS al patron de joinnus:** de `Card` rectangular con icono a **circulos** (icono dentro de circulo, con el pastel de fondo de MASTER.md aplicado al circulo en vez de a un rectangulo) + label debajo, en una fila horizontal con **flechas prev/next visibles** en los extremos (botones que hacen scroll del contenedor, ademas del scroll tactil/snap que ya existe — no reemplaza el touch-scroll, lo complementa, mismo criterio que las flechas del spotlight/hero).
5. **"Lo mas vendido"** [NUEVO, en base a joinnus.com "Lo mas vendido esta semana"] — seccion nueva entre Categorias y Proximos eventos. Titulo con icono de estrella/trofeo + "Lo mas " + "vendido" (`--color-primary`) + " esta semana". Fila horizontal con scroll (mismo patron que las categorias/tendencias viejas: `flex overflow-x-auto snap-x`) de eventos marcados con un flag nuevo `isBestSeller: boolean` en `EventEntity` (mismo patron que `isFeatured`/`isTrending`), cada uno mostrado con un numero de ranking grande (1, 2, 3...) superpuesto o al costado de la card (usa el indice+1 del array filtrado, no un contador de ventas real — no hay backend). Reusa `EventCard` si el numero de ranking se puede agregar como overlay externo sin modificar ese componente (ideal, ver "Reuso"); si no entra limpio, evaluar en la spec.
6. **Proximos eventos** — sin cambios.
7. ~~**Como funciona**~~ — sigue eliminada (revision 4).
8. **Newsletter / CTA final** — sin cambios.
9. **Footer** — sin cambios.

**Backlog:** franja de "Confianza" sigue sin agregarse.

---

## Color Overrides

- Categorias: circulo con el pastel de MASTER.md como fondo, icono con el color saturado (`textClassName`) de esa categoria, label en `text-foreground` debajo.
- Badge disponibilidad en card: `success` (disponible), `accent` (ultimas entradas / precio), `destructive` (agotado — card en este caso pierde hover y boton queda disabled).
- Franja de confianza: iconos en `--color-primary`, fondo `--color-muted` o blanco, sin colores nuevos.

**Nota revision 5:** el token `--spotlight-panel`/`--spotlight-panel-foreground` (MASTER.md, agregado en revision 3 para el panel navy del hero) queda SIN USO al borrar `EventSpotlight` — evaluar en la spec si se elimina de `globals.css` (mismo criterio que se aplico con `carousel`/Embla en la revision 3: no dejar tokens muertos, salvo que algun otro componente nuevo de esta revision lo reuse).

---

## Componentes shadcn a instalar (`npx shadcn@latest add <name>`)

Verificado que NO existen ya en `src/components/ui` (proyecto nuevo, carpeta vacia salvo lo que traiga el template). Reuso obligatorio de estos primitivos, no crear desde cero:

| Componente | Uso |
|---|---|
| `button` | CTAs, nav, filtros |
| `card` | Card de evento, categoria |
| `badge` | Categoria, precio, disponibilidad |
| `tabs` | Filtro de categoria en "Proximos eventos" |
| `input` | Buscador de texto (Topbar) |
| `popover` + `calendar` | Filtro de fecha (Topbar) |
| `slider` | Filtro de rango de precio (Topbar) |
| `separator` | Divisores de seccion/footer |
| `sheet` | Menu mobile (nav lateral) |
| `skeleton` | Placeholder de imagen mientras carga (opcional, solo si se nota jank con imagenes remotas) |

**Iconos:** `lucide-react` ya esta en `package.json` — reusar, no instalar otra libreria de iconos.

**Slider/carousel (revision 2):** decision del usuario, se instala `swiper` para el Hero. El `carousel` de shadcn (Embla, instalado en Fase 1) queda sin uso una vez migrado el Hero — evaluar en la spec si se elimina (`src/components/ui/carousel.tsx` + dependencia `embla-carousel-react`) para no dejar codigo muerto, salvo que se use en otra seccion (ej "Eventos destacados" del backlog, en cuyo caso se mantiene).

**Imagenes:** de internet (Unsplash), vía `next/image` — agregar `images.unsplash.com` a `remotePatterns` en `next.config.ts`.

---

## Anti-Patterns especificas de esta pagina

- No usar el patron de "Event/Conference Landing" (speakers/agenda/sponsors) — no aplica a un marketplace multi-evento.
- No slider infinito sin controles: el Hero con swiper debe tener flechas/paginacion + soporte teclado.
- 10 categorias es el limite aceptado para esta pagina (excepcion documentada a la regla general de 6-8, ver spec 002) — no seguir sumando categorias sin evaluar paginacion o "Ver todas".
