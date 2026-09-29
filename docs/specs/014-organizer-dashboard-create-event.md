# 014 — Panel de organizador y crear evento

## Contexto
Ultima feature del diseño de Claude Design (`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`, boards
`OrgDashboard`, `OrgCreate` y sus versiones mobile: "8 · Panel de organizador" y "8 · Crear evento"). Hoy
"Vender entradas" del header apunta a `#`.

Resultado esperado: un area de organizador con su propio layout (sidebar en desktop, barra + menu en mobile) con:
- `/organizer`: resumen con indicadores (entradas vendidas, ingresos, eventos publicados) y "Mis eventos" con filtros
  Todos / Publicados / Borradores, progreso vendidas/capacidad e ingresos por evento.
- `/organizer/events/new`: formulario para crear un evento (informacion basica, fecha y lugar, imagen de portada,
  tipos de entrada con capacidad total) con vista previa en vivo, "Guardar borrador" y "Publicar evento". Los
  borradores se pueden reabrir con "Editar".

Requiere la sesion mock (spec 012). **Solo UI con mock data:** los eventos creados viven en el navegador y no se
agregan al catalogo publico.

## Alcance
- Incluye:
  - shadcn `textarea` (descripcion).
  - Modulo nuevo `src/modules/organizer`: tipos, constantes (navegacion), schema zod (borrador vs publicar) + test,
    store de eventos del organizador en `localStorage` + test, utils (indicadores, capacidad, precio desde, vista
    previa) + test, mocks (4 eventos de ejemplo: 3 publicados con ventas, 1 borrador) y componentes.
  - Grupo de rutas `(organizer)` con layout propio (sin `SiteHeader`/`SiteFooter`): sidebar con logo "Ticketera ·
    Organizadores", navegacion (Resumen, Mis eventos, Crear evento) y usuario + cerrar sesion; en mobile barra
    superior con boton de menu (`Sheet`). Guard de sesion (sin sesion → `/login?redirect=...`).
  - `/organizer` (dashboard) y `/organizer/events/new` (crear / `?draft=<id>` editar borrador).
  - Imagen de portada: click o arrastrar; JPG/PNG hasta 1 MB; se guarda como data URL; vista previa y "Quitar".
  - Tipos de entrada dinamicos: agregar / quitar (minimo 1), nombre, precio (S/) y cantidad; "Capacidad total".
  - "Vender entradas" del header (desktop y mobile) → `/organizer`.
- Excluye:
  - Publicar en el catalogo publico (landing/busqueda/detalle siguen usando `EVENTS_MOCK`).
  - Paginas "Ventas" y "Configuracion" del sidebar del board (no hay contenido diseñado: no se muestran).
  - Editar eventos publicados, eliminar eventos, roles organizador/comprador (cualquier usuario logueado entra).
  - Recorte/optimizacion de la imagen.
- Backlog: fin del roadmap de features del diseño. Pendientes generales: filtrar eventos pasados, prellenar checkout
  con el usuario, recuperar contraseña.

## Decisiones
- **Borrador vs publicar:** "Guardar borrador" solo exige el nombre (>= 3 caracteres). "Publicar evento" exige todo:
  nombre, categoria, descripcion (>= 20 caracteres), fecha futura, hora, lugar, ciudad, imagen y al menos un tipo de
  entrada con nombre, precio > 0 y cantidad >= 1 (cada fila se valida por separado). Errores en español bajo cada
  campo y foco al primero (mismo patron de checkout/auth, reusando `TextField` y `focusFormField`).
- **Persistencia:** `useOrganizerStore` (`localStorage`, `ticketera-organizer-events`) guarda los eventos creados
  por el usuario (`ownerEmail`). El dashboard muestra los de ejemplo + los del usuario; si un borrador de ejemplo se
  edita y guarda, la copia del store lo reemplaza (mismo id).
- **Ventas:** cada tipo de entrada guarda su `sold` (mock en los ejemplos, 0 en los creados). Ingresos = suma de
  `sold * precio` por tipo. Borradores muestran "—".
- **Acciones de la lista:** borrador → "Editar" (`/organizer/events/new?draft=<id>`); publicado de ejemplo que existe
  en el catalogo → "Ver evento" (`/events/<slug>`); publicado creado por el usuario → sin accion (no hay pagina publica).
- **Vista previa:** componente propio (no `EventCard`): tiene que mostrar datos incompletos con placeholders
  ("Nombre del evento", "Lugar · Ciudad", "S/ —") y `EventCard` exige un `EventEntity` completo.
- **Imagen:** data URL (FileReader) para que sobreviva al reload; limite de 1 MB por la cuota de `localStorage`.
- **Colores:** tokens de MASTER.md (CTA indigo). Badges "Publicado" `bg-success/10 text-success`, "Borrador"
  `bg-muted text-muted-foreground`.

## Reuso detectado
- `src/components/ui`: `button`, `input`, `native-select`, `field`, `badge`, `sheet`, `separator`.
- `src/components/shared`: `brand-logo`, `text-field`, `empty-state`; `src/lib/focus-form-field.ts`;
  `src/hooks/use-is-client.ts`.
- `src/modules/auth`: `useAuthStore`, `getAuthHref`, `getInitials`.
- `src/modules/event`: `EVENT_CATEGORIES`, `EVENTS_MOCK`, `getEventBySlug`, `getEventHref`, `formatEventPrice`,
  `formatEventDate`, `formatEventDateBadge`, `EventCategory`.
- Patron de guard de `my-tickets.tsx` (spec 013) y de formulario controlado + zod.
- `lucide-react`: `LayoutDashboard`, `CalendarDays`, `Plus`, `Ticket`, `Wallet`, `CalendarCheck`, `ImagePlus`,
  `Trash2`, `ArrowLeft`, `LogOut`, `Menu`, `X`.
- Instalar via fuente oficial de GitHub (metodo de 009-013): `textarea`.

## Contratos

### Tipos (`src/modules/organizer/types/organizer.types.ts`)
```ts
export type OrganizerEventStatus = "draft" | "published";
export interface OrganizerTicketTier { id: string; name: string; price: number; quantity: number; sold: number }
export interface OrganizerEvent {
  id: string; status: OrganizerEventStatus; ownerEmail: string | null; // null = ejemplo
  catalogSlug: string | null;           // evento de ejemplo que existe en EVENTS_MOCK
  name: string; category: EventCategory; description: string;
  date: string;                          // "YYYY-MM-DD" ("" si falta)
  time: string;                          // "HH:mm"
  venue: string; city: string; imageUrl: string; // data URL o https
  tiers: OrganizerTicketTier[]; updatedAt: string;
}
export interface EventFormTier { id: string; name: string; price: string; quantity: string } // valores de inputs
export interface EventFormValues {
  name: string; category: EventCategory; description: string; date: string; time: string;
  venue: string; city: string; imageUrl: string; tiers: EventFormTier[];
}
export type EventFormErrors = Partial<Record<string, string>>; // "name", "tiers.0.price", ...
export type OrganizerEventFilter = "all" | OrganizerEventStatus;
```

### Schema (`src/modules/organizer/schemas/event-form.schema.ts`)
```ts
export const EVENT_FORM_DEFAULT: EventFormValues;            // 2 tipos vacios, categoria "concerts"
export function validateEventForm(values: EventFormValues, mode: "draft" | "publish", now?: Date): EventFormErrors;
export function toOrganizerEvent(values, status, ownerEmail, id?): OrganizerEvent;   // parsea precios/cantidades
export function toEventFormValues(event: OrganizerEvent): EventFormValues;
```

### Store (`src/modules/organizer/store/organizer.store.ts`)
```ts
export interface OrganizerState {
  events: OrganizerEvent[];
  saveEvent: (event: OrganizerEvent) => void; // inserta o reemplaza por id
}
```

### Utils (`src/modules/organizer/utils/organizer.utils.ts`)
```ts
export function getEventCapacity(tiers): number;             // suma de cantidades
export function getEventSold(event): number;
export function getEventRevenue(event): number;              // sum(sold * price) por tipo
export function getEventPriceFrom(tiers): number | null;     // menor precio > 0
export function getOrganizerKpis(events): { sold: number; revenue: number; published: number };
export function getOrganizerEvents(stored, demo, ownerEmail): OrganizerEvent[]; // merge por id, del usuario + ejemplo
export function filterOrganizerEvents(events, filter): OrganizerEvent[];
export function createId(prefix: string): string;
```

### Mocks (`src/modules/organizer/mocks/organizer.mock.ts`)
`ORGANIZER_EVENTS_MOCK`: Vive Latino Peru (publicado, 7 420 / 8 000), Romeo y Julieta (publicado, 312 / 420),
Disney on Ice (publicado, 414 / 1 200) —con `catalogSlug`— y "Feria Familiar de Verano" (borrador, 0 / 1 500).

### Componentes (`src/modules/organizer/components`)
```ts
organizer-shell.tsx        // "use client": guard + sidebar/topbar + Sheet mobile + usuario/cerrar sesion; children
organizer-dashboard.tsx    // "use client": titulo + "Crear evento", <OrganizerKpis/>, <OrganizerEventList/>
organizer-kpis.tsx         // presentacional: 3 tarjetas (dl)
organizer-event-list.tsx   // presentacional: filtros (aria-pressed), filas (desktop tabla / mobile cards), progreso
event-form.tsx             // "use client": contenedor del formulario (crear/editar ?draft=), guardar/publicar
event-tier-fields.tsx      // presentacional: filas de tipos de entrada + agregar/quitar + capacidad total
event-cover-field.tsx      // "use client": dropzone/click, validacion tipo/tamaño, preview, quitar
event-preview.tsx          // presentacional: tarjeta de vista previa con placeholders
```

### Rutas (`src/app/(organizer)`)
```
layout.tsx                        # <OrganizerShell>{children}</OrganizerShell>
organizer/page.tsx                # metadata "Panel de organizador | Ticketera"; <OrganizerDashboard/>
organizer/events/new/page.tsx     # metadata "Crear evento | Ticketera"; <Suspense><EventForm/></Suspense> (lee ?draft=)
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | shadcn `textarea` | src/components/ui/textarea.tsx | - | S |
| T2 | Datos: tipos, constantes, schema (+ test), store (+ test), utils (+ test), mocks | src/modules/organizer/types/organizer.types.ts, src/modules/organizer/constants/organizer.constants.ts, src/modules/organizer/schemas/event-form.schema.ts, src/modules/organizer/schemas/event-form.schema.test.ts, src/modules/organizer/store/organizer.store.ts, src/modules/organizer/store/organizer.store.test.ts, src/modules/organizer/utils/organizer.utils.ts, src/modules/organizer/utils/organizer.utils.test.ts, src/modules/organizer/mocks/organizer.mock.ts | - | S |
| T3 | Layout del organizador | src/modules/organizer/components/organizer-shell.tsx | T2 | P1 |
| T4 | Dashboard | src/modules/organizer/components/organizer-dashboard.tsx, src/modules/organizer/components/organizer-kpis.tsx, src/modules/organizer/components/organizer-event-list.tsx | T2 | P1 |
| T5 | Formulario de evento + test | src/modules/organizer/components/event-form.tsx, src/modules/organizer/components/event-form.test.tsx, src/modules/organizer/components/event-tier-fields.tsx, src/modules/organizer/components/event-cover-field.tsx, src/modules/organizer/components/event-preview.tsx | T1, T2 | P1 |
| T6 | Barrel, rutas y link del header | src/modules/organizer/index.ts, src/app/(organizer)/layout.tsx, src/app/(organizer)/organizer/page.tsx, src/app/(organizer)/organizer/events/new/page.tsx, src/components/shared/site-header.tsx | T3, T4, T5 | S |

Orden: T1 → T2 → [T3 ‖ T4 ‖ T5] → T6. ~24 archivos.

## Criterios de aceptacion
- [ ] AC1: "Vender entradas" del header lleva a `/organizer`; sin sesion redirige a `/login?redirect=/organizer` y
  vuelve tras ingresar.
- [ ] AC2: Layout propio: sidebar con "Ticketera · Organizadores", Resumen / Mis eventos / Crear evento
  (`aria-current` en la activa) y usuario con cerrar sesion; en mobile barra superior + menu en `Sheet`.
- [ ] AC3: `/organizer` muestra "Resumen", 3 indicadores (entradas vendidas, ingresos, eventos publicados) calculados
  sobre los eventos, y "Mis eventos" con filtros Todos / Publicados / Borradores (`aria-pressed`) y por evento:
  imagen, nombre, fecha · ciudad, estado, vendidas / capacidad con barra, ingresos ("—" en borradores) y accion.
- [ ] AC4: `/organizer/events/new`: secciones Informacion basica, Fecha y lugar, Imagen de portada y Tipos de
  entrada; la vista previa se actualiza en vivo (nombre, categoria, fecha, lugar, precio desde, imagen).
- [ ] AC5: Tipos de entrada: agregar y quitar filas (quitar deshabilitado con 1), capacidad total en vivo.
- [ ] AC6: Imagen: click o arrastrar; rechaza no JPG/PNG o > 1 MB con mensaje; muestra preview y "Quitar".
- [ ] AC7: "Publicar evento" con el formulario incompleto muestra los errores (incluidos los de cada tipo de entrada)
  y enfoca el primero; completo, guarda como publicado y vuelve a `/organizer`, donde aparece con 0 vendidas y los
  indicadores actualizados. "Guardar borrador" solo exige el nombre.
- [ ] AC8: "Editar" de un borrador abre el formulario con sus datos (`?draft=<id>`, titulo "Editar borrador"); guardar
  o publicar actualiza ese evento (no lo duplica).
- [ ] AC9: Lo creado sobrevive al reload (`localStorage`) y es por usuario (otro usuario no lo ve).
- [ ] AC10: Sin scroll horizontal en 375/768/1024/1440; labels asociados, foco visible, CTA indigo.
- [ ] AC11: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `event-form.schema.test.ts`: borrador solo exige nombre; publicar exige cada campo, fecha futura, imagen y tipos
  (errores por fila `tiers.N.campo`); `toOrganizerEvent`/`toEventFormValues` ida y vuelta.
- `organizer.store.test.ts`: `saveEvent` inserta y reemplaza por id; persiste en `localStorage`.
- `organizer.utils.test.ts`: capacidad, vendidas, ingresos, precio desde (ignora 0), indicadores, merge de ejemplo +
  usuario por id y por dueño, filtros.
- `event-form.test.tsx` (router mockeado): publicar vacio muestra errores; agregar/quitar tipo actualiza la capacidad;
  guardar borrador con nombre llama `saveEvent` y navega a `/organizer`.

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Los eventos publicados por el organizador no aparecen en la landing/busqueda (seria el siguiente paso si se quiere).
- "Ventas" y "Configuracion" no se muestran en el sidebar hasta tener diseño.
- Cualquier usuario logueado puede entrar al panel.

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - Helpers extra: `toEventIsoDate` y `createId` en `organizer.utils.ts`; `createEmptyTier` y
    `createEventFormValues` en el schema (ids nuevos por formulario).
  - En la lista, un evento sin hora (borrador) muestra solo la fecha larga, para no mostrar "12:00 a. m.".
  - El `Sheet` mobile del panel se controla con estado y se cierra al navegar (envolver los links en `SheetClose`
    los metia dentro de un boton).
  - Header: "Vender entradas" usa la constante `ORGANIZER_PATH` del modulo.
  - Imagen del borrador de ejemplo: se reusa una foto del mock existente.
- Verificacion: 167 tests, `tsc`, `lint` y `build` OK (`/organizer` y `/organizer/events/new` estaticas). En Chromium:
  "Vender entradas" sin sesion -> login -> panel; indicadores (8,146 / S/ 1,691,660 / 3); filtro Borradores; publicar
  vacio -> 13 errores con foco en el nombre; imagen .txt y > 1 MB rechazadas; PNG valido con preview y "Quitar";
  capacidad 600 y vista previa en vivo; publicar -> vuelve al panel con "Eventos publicados 4" y la fila en 0/600;
  editar borrador de ejemplo y guardar no duplica; reload conserva; otro usuario no ve lo creado; mobile con menu
  lateral que se cierra al navegar; sin scroll horizontal ni errores de consola.
- Log de review: -
