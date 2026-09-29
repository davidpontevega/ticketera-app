# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/ticketera/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Ticketera
**Generated:** 2026-09-25 (revised manually — light mode only, single font Poppins, tonos suaves)
**Category:** Ticketing / Event Marketplace
**Referencia visual:** ticketmaster.com, joinnus.com
**Mode Support:** Light only (no dark mode en esta etapa)

---

## Global Rules

### Color Palette

Paleta moderna, monocolor de marca (indigo, usado tambien para las CTAs desde revision 6) para no sobrecargar. Fondo blanco, texto casi negro. Basada en resultados de `--domain color` (Marketplace P2P) ajustada a modo claro puro y menor saturacion.

**Revision 6 (2026-09-28):** se elimino el naranja (`#F97316`) como color de CTA/accion — al usuario no le gustaba. El token `--cta` ahora vale lo mismo que `--primary` (`#4F46E5`), monocolor en vez de dos acentos. Decision del usuario tras comparar alternativas (indigo unico vs rosa vs verde esmeralda — se descartaron rosa por repetir el significado de la categoria "Arte y cultura" y verde por confundirse con el badge "Disponible").

| Role | Hex | CSS Variable | Uso |
|------|-----|--------------|-----|
| Primary | `#4F46E5` | `--color-primary` | Marca, links activos, nav highlight, botones secundarios importantes |
| On Primary | `#FFFFFF` | `--color-on-primary` | Texto sobre primary |
| Secondary | `#F1F5F9` | `--color-secondary` | Fondos de badges/botones neutros |
| On Secondary | `#0F172A` | `--color-on-secondary` | Texto sobre secondary |
| Accent/CTA | `#4F46E5` (revision 6, antes `#F97316`) | `--color-cta` | Boton "Comprar entradas", buscador, precios, badges de urgencia — mismo hex que Primary |
| On Accent/CTA | `#FFFFFF` | `--color-cta-foreground` | Texto sobre cta |
| Background | `#FFFFFF` | `--color-background` | Fondo general |
| Foreground | `#0F172A` | `--color-foreground` | Texto principal |
| Card | `#FFFFFF` | `--color-card` | Fondo de tarjetas de evento |
| Card Foreground | `#0F172A` | `--color-card-foreground` | Texto en tarjetas |
| Muted | `#F8FAFC` | `--color-muted` | Fondos alternos de seccion (zebra) |
| Muted Foreground | `#64748B` | `--color-muted-foreground` | Texto secundario/meta (fecha, lugar) |
| Border | `#E2E8F0` | `--color-border` | Bordes de cards/inputs |
| Success | `#16A34A` | `--color-success` | "Entradas disponibles", confirmaciones |
| Destructive | `#DC2626` | `--color-destructive` | "Agotado", errores |
| On Destructive | `#FFFFFF` | `--color-on-destructive` | Texto sobre destructive |
| Ring | `#4F46E5` | `--color-ring` | Focus ring (accesibilidad teclado) |

**Nota:** `success` no es token nativo de shadcn (solo primary/secondary/accent/destructive) — se agrega como extension propia en `globals.css`, no romper naming de shadcn existente.

### Colores por categoria (revision 3, 2026-09-25)

Cada categoria tiene un tinte pastel propio (fondo del chip) + un color saturado (icono, dentro de circulo blanco). Referencia visual: mockup de usuario. Sin repetir hue entre las 10 categorias:

| Categoria | Fondo chip | Icono (circulo, sobre blanco) | Texto sobre blanco (contraste AA) | Notas |
|---|---|---|---|---|
| Conciertos | `#EDE9FE` (violet-100) | `#7C3AED` (violet-600) | `#7C3AED` (violet-600, ya cumple ~5.6:1) | |
| Deportes | `#D1FAE5` (emerald-100) | `#059669` (emerald-600) | `#047857` (emerald-700) | 600 solo no cumple 4.5:1 como texto |
| Teatro | `#FEE2E2` (red-100) | `#DC2626` (red-600) | `#DC2626` (red-600, ya cumple ~4.8:1) | |
| Festivales | `#FFEDD5` (orange-100) | `#EA580C` (orange-600) | `#C2410C` (orange-700) | 600 solo no cumple 4.5:1 como texto |
| Familiar | `#DBEAFE` (blue-100) | `#2563EB` (blue-600) | `#2563EB` (blue-600, ya cumple ~5.2:1) | |
| Standup | `#FEF9C3` (yellow-100) | `#CA8A04` (yellow-600) | `#A16207` (yellow-700) | 600 solo no cumple ni de cerca (~2.9:1) |
| Cine | `#E0E7FF` (indigo-100) | `#4F46E5` (indigo-600, = primary) | `#4F46E5` (indigo-600, ya cumple ~4.6:1) | distinto hue de Conciertos para no repetir |
| Arte y cultura | `#FCE7F3` (pink-100) | `#DB2777` (pink-600) | `#DB2777` (pink-600, ya cumple ~4.6:1) | |
| Ferias y exposiciones | `#CCFBF1` (teal-100) | `#0D9488` (teal-600) | `#0F766E` (teal-700) | 600 solo no cumple 4.5:1 como texto |
| Conferencias | `#CFFAFE` (cyan-100) | `#0891B2` (cyan-600) | `#0E7490` (cyan-700) | 600 solo no cumple 4.5:1 como texto |

Regla: **el icono en el circulo blanco del chip de categoria SIEMPRE usa el tono `-600`** (columna "Icono"). **El texto de categoria suelto sobre fondo blanco/card (spec 004, cards de "Proximos eventos") usa la columna "Texto sobre blanco"** (5 categorias necesitan `-700` en vez de `-600` para cumplir 4.5:1; las otras 5 ya cumplen con el mismo `-600` del icono). Se implementa como constante propia del dominio (ej `EVENT_CATEGORY_COLORS` o campos extra en `EventCategoryOption`: `bgClassName`, `iconClassName`, `textClassName`), no como tokens CSS globales de shadcn (son datos, no theme).

### ~~Color del panel "spotlight" del Hero~~ (revision 3, DEPRECADO en revision 5)

- ~~`--spotlight-panel: #1E1B4B` / `--spotlight-panel-foreground: #FFFFFF`~~ — token creado en revision 3 para el panel navy del `EventSpotlight`. En revision 5 se borra `EventSpotlight` (hero pasa a carousel simple + sidebar "Tendencias") y este token queda sin uso — se elimina de `globals.css` en `docs/specs/006-hero-carousel-trending-sidebar.md`. Se deja esta entrada tachada como registro historico, no como token vigente.

### Typography

- **Fuente unica del proyecto:** Poppins (headings y body, para toda la app, no solo landing).
- **Pesos usados:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
- **Google Fonts URL:** https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap
- Alternativa: usar `next/font/google` con `Poppins({ subsets: ["latin"], weight: ["400","500","600","700"] })` en `src/app/layout.tsx` (preferido sobre `@import` CSS: evita layout shift, self-hosted por Next).

**Escala tipografica:**

| Uso | Tamano | Peso | Line-height |
|-----|--------|------|-------------|
| Display (hero headline) | 48px / 32px mobile | 700 | 1.1 |
| H1 (titulo de seccion) | 36px / 28px mobile | 600 | 1.2 |
| H2 (subtitulo de seccion) | 28px / 22px mobile | 600 | 1.25 |
| H3 (titulo de card) | 20px | 600 | 1.3 |
| Body | 16px | 400 | 1.5 |
| Small / meta (fecha, lugar, categoria) | 14px | 500 | 1.4 |
| Boton | 16px | 600 | 1 |

Reglas: nunca texto body menor a 14px legible; contraste minimo 4.5:1 (foreground `#0F172A` sobre background `#FFFFFF` cumple sin problema).

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Gaps ajustados |
| `--space-sm` | `8px` | Gaps de icono, spacing inline |
| `--space-md` | `16px` | Padding estandar |
| `--space-lg` | `24px` | Padding de seccion (mobile) |
| `--space-xl` | `32px` | Gaps grandes |
| `--space-2xl` | `48px` | Margenes de seccion |
| `--space-3xl` | `64px` | Padding de hero (desktop) |

### Shadow Depths (modo claro)

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.05)` | Elevacion sutil |
| `--shadow-md` | `0 4px 6px rgba(15,23,42,0.08)` | Cards, botones |
| `--shadow-lg` | `0 10px 15px rgba(15,23,42,0.10)` | Dropdowns, sheets |
| `--shadow-xl` | `0 20px 25px rgba(15,23,42,0.12)` | Hero, cards destacadas |

---

## Component Specs (Tailwind v4 + shadcn, no CSS a mano salvo tokens)

### Buttons

- Primary CTA (comprar/ver entradas): `bg-accent text-on-accent hover:opacity-90` — variant `default` de shadcn `Button` remapeado a `--color-accent`.
- Secondary: variant `outline` de shadcn `Button`, border `--color-border`, texto `--color-primary`.
- Transicion: `transition-colors duration-200`.
- Radius: `rounded-lg` (8px) para botones e inputs, `rounded-xl` (12px) para cards.

### Cards (evento)

- Fondo `--color-card`, `rounded-xl`, `shadow-md`, hover `shadow-lg` + `-translate-y-0.5`, `transition-all duration-200`, `cursor-pointer`.
- Imagen 16:9 arriba, badge de categoria/precio superpuesto, titulo H3, meta (fecha/lugar) en `muted-foreground`.

### Inputs (buscador)

- `border-border rounded-lg px-4 py-3 text-base`, focus: `ring-2 ring-ring outline-none`.

---

## Style Guidelines

**Style:** Modern & Clean Marketplace (variante suave de "Vibrant & Block-based" — se baja intensidad y saturacion para no sobrecargar; un solo acento fuerte: naranja de CTA).

**Keywords:** limpio, moderno, alto contraste texto/fondo, un solo acento de color, cards con sombra suave, iconografia SVG consistente (lucide-react, ya instalado).

**Key Effects:** hover con leve elevacion y color shift (200ms), sin animaciones decorativas complejas en esta etapa (YAGNI — landing estatica con mock data).

---

## Anti-Patterns (Do NOT Use)

- Sin feedback de disponibilidad (siempre mostrar "Disponible" / "Ultimas entradas" / "Agotado").
- Sin costos ocultos: si se muestra precio, mostrar "desde $X" claro.
- Mala experiencia mobile: nada de scroll horizontal no intencional, categorias como carrusel horizontal SI es intencional (con scroll-snap).
- Emojis como iconos — usar SVG (lucide-react).
- Falta de `cursor-pointer` en elementos clicables.
- Estados de foco invisibles (accesibilidad teclado).
- Texto gris sobre gris (usar `muted-foreground` `#64748B` sobre `background`/`card` blanco, nunca sobre `muted` sin verificar contraste).

---

## Pre-Delivery Checklist

- [ ] No emojis como iconos (usar lucide-react)
- [ ] `cursor-pointer` en todo elemento clicable
- [ ] Hover states con transicion (150-300ms)
- [ ] Contraste texto 4.5:1 minimo (modo claro)
- [ ] Focus states visibles (`ring`)
- [ ] `prefers-reduced-motion` respetado si se agregan animaciones
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] Sin contenido oculto detras de navbar fijo
- [ ] Sin scroll horizontal no intencional en mobile
- [ ] Una sola fuente (Poppins) en todo el proyecto, cargada via `next/font/google`
