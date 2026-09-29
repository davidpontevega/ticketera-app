# 004 — Cards con badge de fecha, navbar, "Como funciona" y "Newsletter" (Fase 2 de revision 3)

## Contexto
Esta es la segunda mitad de la revision 3 de la landing (`design-system/ticketera/pages/landing.md`, "Orden de secciones (revision 3...)", puntos 1, 5, 6 y 7). La primera mitad es la spec 003 (spotlight y colores por categoria). Esta spec **depende de que 003 este implementada y aprobada**: usa `getEventCategoryOption`, los campos `textClassName` de `EventCategoryOption` y `EventAvailabilityBadge`, que crea 003.

Resultado esperado:
- Las cards de "Proximos eventos" muestran la fecha en un badge sobre la imagen y la categoria como texto de color.
- El navbar suma "Como funciona" y "Vender entradas", y "Iniciar sesion" pasa a ser un link de texto.
- La landing suma dos secciones nuevas: "Como funciona" (3 pasos) y "Newsletter" (solo UI).

## Alcance
- Incluye:
  - `EventCard`:
    - En la esquina superior izquierda de la imagen, el badge de categoria se reemplaza por un **badge de fecha** (mes abreviado + dia, fondo blanco).
    - La **categoria** pasa a texto de color arriba del titulo.
    - La card adopta `EventAvailabilityBadge` (003) y `getEventCategoryOption` (003) en lugar de la logica inline.
    - Nota: el badge de disponibilidad **ya esta** superpuesto arriba a la derecha de la imagen en el codigo actual (`event-card.tsx`, `absolute right-2 top-2`). No se "mueve": solo se reemplaza por el componente extraido.
  - Helper `formatEventDateBadge`.
  - `SiteHeader`:
    - Link "Como funciona" (`#how-it-works`).
    - Boton "Vender entradas" (`href="#"`).
    - "Iniciar sesion" pasa a link de texto, tanto en desktop como en el Sheet mobile.
  - Seccion nueva `HowItWorks` (3 pasos, linea punteada en desktop).
  - Seccion nueva `NewsletterSignup` (solo UI, `preventDefault`, boton en primary/indigo).
  - Montar ambas secciones en la page, despues de "Proximos eventos".
- Excluye:
  - Funcionalidad real de "Vender entradas", "Iniciar sesion" y la suscripcion (sin API ni validacion de envio; el `input type="email"` + `required` nativo alcanza).
  - Cambios en Topbar, spotlight, categorias, store y filtros.
  - Franja de "Confianza" (sigue en backlog segun landing.md).
- Backlog: franja de confianza, pagina de detalle, checkout, auth, API real y suscripcion real a newsletter.

## Reuso detectado
- `src/components/ui/badge.tsx`: badge de fecha (className `bg-card text-foreground shadow-sm`, dos lineas: mes y dia).
- `src/modules/event/components/event-availability-badge.tsx` (creado en 003): reemplaza el badge inline de la card, sin cambiar el comportamiento.
- `getEventCategoryOption` (003, `event.utils.ts`): label y `labelClassName` (campo nuevo de esta spec) de la categoria. Reemplaza el `EVENT_CATEGORIES.find(...)` inline de la card.
- `src/components/ui/button.tsx`:
  - "Vender entradas": `variant="secondary"` + className `bg-foreground text-background hover:bg-foreground/90`. El `secondary` del proyecto es gris claro (#F1F5F9) y landing.md pide oscuro. `cn` (paquete `cn`, reemplazo de clsx + tailwind-merge) resuelve el conflicto de clases.
  - "Suscribirme": variant default + className `bg-primary text-primary-foreground hover:bg-primary/90`. No se agrega una variant `primary` a `button.tsx` porque hay un solo consumidor (YAGNI).
- `src/components/ui/input.tsx`: email del newsletter.
- `src/components/ui/card.tsx`: no hace falta en "Como funciona". Los pasos son columnas simples sin borde, segun landing.md.
- `lucide-react`: `Search` (Buscar), `MousePointerClick` (Elegir; `Ticket` queda reservado para el logo) y `CreditCard` (Comprar). Los tres estan verificados en la version instalada.
- `NAV_LINKS` de `site-header.tsx`: se agrega un item y no se crea otra lista.
- Nada en `src/hooks`, `src/store` ni `src/lib` aplica.
- Ubicacion de las secciones nuevas: `src/components/shared/`. No pertenecen al dominio `event` (son contenido de marketing de la landing) y un modulo nuevo `marketing` con un archivo por seccion seria estructura de mas (YAGNI).

## Contratos

### Utilidades (`src/modules/event/utils/event.utils.ts`)
```ts
export interface EventDateBadgeParts { month: string; day: string }
export function formatEventDateBadge(isoDate: string): EventDateBadgeParts;
//  Intl.DateTimeFormat(EVENT_LOCALE, { month: "short" }) y { day: "numeric" }. Se usa
//  normalizeSpaces (ya existe en el archivo), se quita el punto final si Intl lo agrega ("nov." → "nov")
//  y el mes va en minusculas. La mayuscula la pone el CSS (uppercase). Ej.: "2026-11-14T21:00:00-05:00"
//  → { month: "nov", day: "14" }.
```
El tipo `EventDateBadgeParts` se exporta junto a la funcion. `event.types.ts` es owner de T1 solo para agregar `labelClassName` (ver abajo).

### Tipos y constantes (`event.types.ts`, `event.constants.ts`)
Se AGREGA un campo a `EventCategoryOption` (creado por 003). No se modifica ni elimina ningun campo existente: `textClassName` sigue siendo el color del icono en `CategoryList`.
```ts
// src/modules/event/types/event.types.ts
export interface EventCategoryOption {
  // ...campos existentes de 003 sin cambios (id, label, icon, bgClassName, textClassName)
  labelClassName: string; // color del label de categoria como texto sobre blanco (contraste >= 4.5:1), ej. "text-[#A16207]"
}
```
Valores en `EVENT_CATEGORIES` (literal de MASTER.md, columna "Texto sobre blanco (contraste AA)"):

| Categoria | `textClassName` (003, icono) | `labelClassName` (nuevo, texto) |
|---|---|---|
| Conciertos | `text-[#7C3AED]` | `text-[#7C3AED]` (violet-600, igual) |
| Deportes | `text-[#059669]` | `text-[#047857]` (emerald-700) |
| Teatro | `text-[#DC2626]` | `text-[#DC2626]` (red-600, igual) |
| Festivales | `text-[#EA580C]` | `text-[#C2410C]` (orange-700) |
| Familiar | `text-[#2563EB]` | `text-[#2563EB]` (blue-600, igual) |
| Standup | `text-[#CA8A04]` | `text-[#A16207]` (yellow-700) |
| Cine | `text-[#4F46E5]` | `text-[#4F46E5]` (indigo-600, igual) |
| Arte y cultura | `text-[#DB2777]` | `text-[#DB2777]` (pink-600, igual) |
| Ferias y exposiciones | `text-[#0D9488]` | `text-[#0F766E]` (teal-700) |
| Conferencias | `text-[#0891B2]` | `text-[#0E7490]` (cyan-700) |

### Componentes
```ts
// src/modules/event/components/event-card.tsx — server-compatible (misma firma)
//  Imagen: arriba a la izquierda un badge de fecha (absolute left-2 top-2, bg-card, rounded-lg,
//   shadow-sm, flex-col leading-none): mes (text-xs uppercase font-medium text-muted-foreground) y dia
//   (text-lg font-bold). Arriba a la derecha: <EventAvailabilityBadge availability=... className="absolute right-2 top-2" />.
//  Body: <p className={cn("text-sm font-medium", option.labelClassName)}>{option.label}</p> arriba del h3.
//   NO usar option.textClassName (tono -600, es el color del icono de CategoryList y no cumple 4.5:1
//   como texto en 5 categorias).
//  Se elimina el Badge de categoria sobre la imagen. Lo demas (fecha/lugar, precio, boton, estado
//  sold-out) no cambia.

// src/components/shared/site-header.tsx — "use client" (misma firma)
//  NAV_LINKS: Eventos (#upcoming-events), Categorias (#), Como funciona (#how-it-works).
//  Derecha en desktop: link de texto "Iniciar sesion" (<Link href="#">, text-sm font-medium
//   hover:text-primary cursor-pointer) + Button "Vender entradas" (ver Reuso) con render={<Link href="#" />}
//   nativeButton={false}.
//  Sheet mobile: los mismos 3 links, "Iniciar sesion" como link y "Vender entradas" como boton w-full.

// src/components/shared/how-it-works.tsx — server component (NUEVO)
export function HowItWorks(): JSX.Element;
//  <section id="how-it-works" className="scroll-mt-40 py-12">: el scroll-mt compensa navbar + Topbar
//  sticky, igual que #upcoming-events.
//  h2 "Como funciona" + subtitulo (muted-foreground), p. ej. "Consigue tus entradas en 3 simples pasos".
//  Pasos en una constante local HOW_IT_WORKS_STEPS (icon, title, description):
//    1 Buscar (Search) — "Encuentra eventos por nombre, fecha, lugar o precio."
//    2 Elegir (MousePointerClick) — "Revisa los detalles y elige tus entradas."
//    3 Comprar (CreditCard) — "Paga de forma segura y recibe tus entradas al instante."
//  Layout: <ol> grid gap-8 md:grid-cols-3. Cada paso: icono en un cuadrado size-14 rounded-xl
//   bg-primary/10 text-primary (icono aria-hidden), "Paso N" (text-sm text-primary font-medium),
//   h3 y texto muted.
//  Linea punteada: un elemento decorativo aria-hidden, hidden md:block, absolute, con
//   border-t-2 border-dashed border-border, a la altura del centro de los iconos y entre el primer y
//   el ultimo icono. En mobile los pasos se apilan y la linea no se ve.

// src/components/shared/newsletter-signup.tsx — "use client" (NUEVO; por el onSubmit)
export function NewsletterSignup(): JSX.Element;
//  <section className="bg-primary/10 py-12"> full-bleed con interior max-w-7xl mx-auto px-4 md:px-6.
//  h2 "No te pierdas ningun evento" + subtitulo (p. ej. "Recibe novedades y preventas en tu correo").
//  <form onSubmit={(e) => e.preventDefault()}> flex-col sm:flex-row gap-2 max-w-md:
//   <Input type="email" required placeholder="tu@email.com" aria-label="Correo electronico" />
//   <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">Suscribirme</Button>
//  Es la unica excepcion a "naranja = accion" de la landing (landing.md).
```

### Page (`src/app/page.tsx`)
```tsx
<EventSearchBar />
<div ...><EventSpotlight ... /></div>
<div ...><CategoryList /></div>
<div ...><UpcomingEvents ... /></div>
<div className="max-w-7xl mx-auto px-4 md:px-6"><HowItWorks /></div>
<NewsletterSignup />   {/* full-bleed, maneja su propio contenedor interno */}
```
Importa `HowItWorks` y `NewsletterSignup` desde `@/components/shared/...`. No hay barrel en shared, igual que con `SiteHeader`/`SiteFooter`.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | `formatEventDateBadge` con tests y `EventCard` con badge de fecha, categoria de color, `EventAvailabilityBadge` y `getEventCategoryOption`; ampliar el test de la card | src/modules/event/types/event.types.ts, src/modules/event/constants/event.constants.ts, src/modules/event/utils/event.utils.ts, src/modules/event/utils/event.utils.test.ts, src/modules/event/components/event-card.tsx, src/modules/event/components/event-card.test.tsx | spec 003 | P1 |
| T2 | Navbar: "Como funciona", "Vender entradas" e "Iniciar sesion" como link (desktop + Sheet) | src/components/shared/site-header.tsx | - | P1 |
| T3 | Seccion `HowItWorks` | src/components/shared/how-it-works.tsx | - | P1 |
| T4 | Seccion `NewsletterSignup` | src/components/shared/newsletter-signup.tsx | - | P1 |
| T5 | Montar `HowItWorks` y `NewsletterSignup` en la page | src/app/page.tsx | T3, T4 | S |

Orden: [T1 ‖ T2 ‖ T3 ‖ T4] → T5. Los archivos son disjuntos. `event.utils.ts` es del modulo `event` (no `src/lib`) y solo lo toca T1.
`event.types.ts` y `event.constants.ts` tambien los toco 003, que ya termino su implementacion: T1 parte de lo que dejo 003 y solo AGREGA `labelClassName` (tipo + 10 valores), sin modificar campos existentes. Si el review de 003 pide cambios sobre esos 2 archivos, T1 espera a que se cierren.

## Criterios de aceptacion
- [ ] AC1: En `/` el orden es Navbar → Topbar → Spotlight → Categorias → Proximos eventos → Como funciona → Newsletter → Footer.
- [ ] AC2: Cada card de evento tiene arriba a la izquierda de la imagen un badge blanco con mes abreviado en mayusculas y numero de dia (p. ej. "NOV" / "14"), y arriba a la derecha el badge de disponibilidad con los mismos colores que antes. El badge de categoria ya no esta sobre la imagen.
- [ ] AC3: Arriba del titulo de cada card se ve el nombre de la categoria con su `labelClassName` (columna "Texto sobre blanco (contraste AA)" de MASTER.md), no con `textClassName`.
- [ ] AC4: Las cards agotadas siguen con el boton disabled y sin elevacion en hover. Filtros y tabs sin regresiones.
- [ ] AC5: El navbar desktop muestra Eventos, Categorias y Como funciona, "Iniciar sesion" como link de texto (no boton con borde) y "Vender entradas" como boton oscuro. El Sheet mobile tiene los mismos items. "Como funciona" salta a `#how-it-works` sin que el titulo quede tapado por las barras sticky.
- [ ] AC6: "Como funciona" muestra titulo, subtitulo y 3 pasos (icono en cuadrado tintado, numero, titulo y texto). Desde md estan en fila y unidos por una linea punteada, que en mobile no se ve (pasos apilados).
- [ ] AC7: "Newsletter" es una banda con tinte indigo suave, con input email y boton "Suscribirme" indigo (no naranja). Al enviar con un email valido la pagina no recarga ni navega. Con un email invalido aparece la validacion nativa.
- [ ] AC8: Responsive en 375, 768, 1024 y 1440 px, sin scroll horizontal no intencional.
- [ ] AC9: Accesibilidad: el input tiene `aria-label`, los iconos decorativos y la linea punteada llevan `aria-hidden`, el foco es visible, los clicables tienen `cursor-pointer` y el contraste de texto es >= 4.5:1 (incluida la categoria de color via `labelClassName` en las 10 categorias).
- [ ] AC10: `npm run test` pasa.
- [ ] AC11: `npx tsc --noEmit` y `npm run lint` sin errores, y `npm run build` compila.

## Tests requeridos
- `src/modules/event/utils/event.utils.test.ts`: `formatEventDateBadge` devuelve `day` "14" y un `month` que matchea `/^nov/` sin punto final para una fecha de noviembre. Para no depender de la zona del runner, se usa una hora de mediodia.
- `src/modules/event/components/event-card.test.tsx` (se amplia, los 2 tests actuales se mantienen): renderiza el label de la categoria del evento, el dia del badge de fecha y el label de disponibilidad.
- Sin test: `SiteHeader`, `HowItWorks` y `NewsletterSignup` (presentacionales; el unico comportamiento es `preventDefault`).

## Preguntas abiertas
- **RESUELTO (2026-09-25): opcion (b), campo nuevo `labelClassName` (ver Contratos > Tipos y constantes).** Contraste del texto de categoria en la card. landing.md pide usar el color de icono de MASTER.md sobre fondo blanco. Pero varios quedan por debajo del 4.5:1 que exige MASTER.md para texto chico: yellow-600 `#CA8A04` (~2.9:1), orange-600 `#EA580C`, emerald-600 `#059669`, teal-600 `#0D9488` y cyan-600 `#0891B2` (~3.6-3.8:1). Opciones:
  - (a) Aceptar los colores tal cual (incumple WCAG AA en 5 categorias).
  - (b) **Default propuesto:** agregar a `EVENT_CATEGORIES` un tono -700 para texto (p. ej. `#A16207`, `#C2410C`, `#047857`, `#0F766E`, `#0E7490`). Esto suma `event.types.ts` y `event.constants.ts` a T1.
  - (c) Mostrar la categoria como badge pastel (fondo `bgClassName` + texto oscuro) en vez de texto de color.
- "Vender entradas" en negro/foreground (`bg-foreground`). Alternativa: navy `bg-spotlight-panel` (token de 003), para repetir el color del hero.
- Copys de "Como funciona" y "Newsletter" propuestos por la spec (el mockup no se transcribio literal). Se pueden ajustar al aprobar.

## Estado
- Aprobacion humana: aprobada (2026-09-25) — opcion (b) confirmada (tono -700 para texto de categoria, ver hex en MASTER.md), "Vender entradas" en negro/foreground confirmado
- Fase: aprobado
- Log de review:
  - Iteracion 1: APPROVED con 1 hallazgo menor (div hijo invalido de `<ol>` en HowItWorks, violacion axe rule `list`). Corregido post-approval.
