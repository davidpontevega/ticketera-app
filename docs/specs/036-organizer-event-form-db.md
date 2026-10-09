# 036 — Formulario de evento del organizador contra la DB (crear y editar) y retiro de `organizer.store`

Estado: implementada (pendiente verificacion manual con DB + Clerk)

## Estado
- Aprobacion humana: aprobada (2026-10-08, 6 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P1-07.

## Objetivo
Que `/organizer/events/new` cree el evento (y sus tipos de entrada) en `events` + `ticket_tiers`, y que
`/organizer/events/[id]/edit` lo edite, en vez de guardar en `organizer.store` (localStorage). Un evento publicado desde
el form aparece en el catalogo (035) porque 035 lee `events`/`ticket_tiers`. Se retira lo que queda huerfano
(`organizer.store`, `organizer.mock`, `OrganizerEvent`, `getOrganizerEvents`). Cierra la queja "no sabia donde agregar
tipos de entrada al publicar": hoy los tiers solo existen en localStorage.
Referencias: `030` (Fase 2 del backlog: `getEventScope`, `requireRole`, transiciones, borrado bloqueado por ordenes
`paid`/`pending`), `035` (D5 layout por tiers, D4 `doorsOpen`/`minAge`, P5 admision general), `033` (advisory lock por
slug en checkout), `031` (`is_featured`), `014`/`017` (form original y puente localStorage), `SYSTEM_DESIGN.md` (Base de
datos). Next 16: `node_modules/next/dist/docs/01-app/02-guides/forms.md` (acciones se verifican por POST directo),
`.../03-file-conventions/page.md` (`params` es Promise; `PageProps<'/organizer/events/[id]/edit'>`).

## Hallazgos (verificado en codigo)
- `event-form.tsx` guarda con `useOrganizerStore.saveEvent` (localStorage) y lee `useAuthStore` solo para `ownerEmail`.
  El borrador se abre con `?draft=<id>` (`useSearchParams`) buscando en store + `ORGANIZER_EVENTS_MOCK`. La page
  `new/page.tsx` ya hace `requireRole(ORGANIZER_AREA_ROLES)` y envuelve el form en `<Suspense>` solo por ese hook.
- Consumidores de lo que se retira (grep en `src`): `useOrganizerStore`/`organizer.store` solo en `event-form.tsx`,
  su test y `organizer/index.ts` (035 ya retiro `catalog`); `ORGANIZER_EVENTS_MOCK` en `event-form.tsx`,
  `event-form.schema.test.ts`, `organizer.utils.test.ts`; `getOrganizerEvents` en `organizer.utils.ts` (+test),
  `index.ts`, `event-form.tsx`; `toOrganizerEvent`/`toEventFormValues(OrganizerEvent)` en `event-form.schema.ts`
  (+test) y el form. Fuera de `src/modules/organizer` solo se importan `OrganizerShell`, `OrganizerDashboard`,
  `EventForm`, `ORGANIZER_PATH`, `ORGANIZER_NAV`. `useAuthStore` queda (lo usan otros modulos; no se toca).
- Esquema: `events` exige `address`, `latitude`, `longitude`, `venue_name`, `city`, `starts_at`, `image_url`,
  `description` NOT NULL; `slug` UNIQUE; `status` default `draft`; `organizer_id` nullable. `ticket_tiers`:
  `price numeric(10,2)`, `total_stock int`, FK `event_id` cascade. `order_items.ticket_tier_id` es `restrict` pero
  `order_items` no se llena (029/030). El form no pide `address`/coordenadas.
- Las ordenes se unen al evento por `orders.event_slug` (texto) y sus `lines[].zoneId` son: id de zona de plantilla
  (eventos sembrados) o `ticket_tiers.id` (eventos del panel, 035 D5). Por eso el **slug es inmutable** y los **ids de
  tier no se pueden cambiar si hay ordenes**.
- Checkout (033) serializa por `pg_advisory_xact_lock(hashtext(slug))` y lee ocupacion con
  `getTakenInventory(executor, slug)` (acepta `tx`). `updateEvent` reutiliza ese lock y esa funcion.
- `deleteEvent` (030) define "tiene ordenes" como `orders.event_slug = events.slug and status in ('paid','pending')`.
  Se reutiliza el mismo predicado.
- Portada: `EventCoverField` lee JPG/PNG como **data URL** (limite 1 MB, `EVENT_COVER_MAX_BYTES`) y el form valida
  "Sube una imagen de portada". `next.config.ts` solo permite `images.unsplash.com` en `remotePatterns`, pero
  `next/image` acepta `data:` y los consumidores de `organizer` ya usan `unoptimized` para ellos. El limite por defecto de
  Server Actions es 1 MB (`serverActions.md:59-77`): una portada de 1 MB en base64 (~1,33 MB) no cabe.
- No existe `slugify` en el proyecto (se fue con `catalog.utils.ts` en 035). `event.utils.ts` tiene `normalizeText`
  privado (tildes via NFD) que sirve de modelo.
- `CITY_COORDINATES` (`event-seed.utils.ts`) solo cubre 7 ciudades; el form acepta ciudad libre.
- `getEventStatusChangeError` (030) ya implementa fecha futura + >= 1 tier para `draft -> published`.

## Decisiones
1. **Fases**: una sola spec. Crear sin poder editar dejaria al organizador sin forma de arreglar un borrador (el
   `?draft=` desaparece al retirar el store), y retirar el store sin editar rompe "Editar borrador". Es alcanzable
   porque el servicio de escritura es unico y el form ya existe. Corte limpio si no alcanza la sesion: T1+T2 (backend,
   nada visible cambia) y luego T3+T4 juntas; **no** entregar T3 sin T4 ni T4 sin T3.
2. **Server actions** `createEventAction(values)` y `updateEventAction(eventId, values)` en
   `organizer-event.actions.ts` (se agregan al archivo existente de 030). Reciben **objeto serializable** (no `FormData`:
   el form tiene tiers dinamicos) tipado `EventFormValues` + `intent`. Cada una hace su propio `requireRole(ORGANIZER_AREA_ROLES)`,
   revalida en servidor con `validateEventForm` (no se confia en el cliente) y devuelve estado
   `{status:"success", eventId}` o `{status:"error", message, fieldErrors?}`; el cliente hace `router.push`. `revalidatePath(ORGANIZER_PATH)`
   como en 030 (catalogo es dinamico por request, 035 D10).
3. **Intent y estado**: `intent = "draft" | "publish"` (el `EventFormMode` existente).
   - Crear: `draft` -> `status draft`; `publish` -> `status published`. `organizer_id = viewer.id` (tambien para
     admin: el evento es suyo).
   - Editar `draft`: `draft` mantiene borrador; `publish` valida como publicar y pasa a `published`.
   - Editar `published`: solo guarda cambios y sigue `published` (el form muestra un unico boton "Guardar cambios" que
     usa `intent = "publish"`; despublicar sigue siendo el menu de 030). La fecha futura se exige **solo si cambio la
     fecha o el evento era borrador** (evita bloquear la correccion de un evento ya realizado).
   - Editar `cancelled`: no editable (`not-found` en servicio, `notFound()` en la page). `is_featured`,
     `is_trending`, `is_best_seller` no se tocan.
4. **Reglas de publicar** = 030: fecha futura y >= 1 tier. Se aplican con el esquema `publish` existente
   (`min(1)` tiers) y la regla de fecha de `validateEventForm`, mas una verificacion en el servicio con
   `getEventStatusChangeError` (reutilizado, sin duplicar la tabla de transiciones) para el caso `draft -> published`.
5. **Borrador**: ademas del nombre exige **fecha y hora** (`events.starts_at` es NOT NULL; mismo default que 030).
   Cambia `draftSchema` y el test "borrador solo con nombre". Campos de texto vacios se guardan como `""` (columnas
   NOT NULL, sin default). Un borrador sin tiers es valido.
6. **Slug**: se genera al crear con `slugify(title)` (minusculas, NFD sin tildes, no alfanumericos -> `-`, recorte) en
   `event-write.utils.ts`; si colisiona (`slug` o `slug-N`, consulta `like 'base%'` dentro de la transaccion) se
   agrega `-2`, `-3`... Titulo sin caracteres validos -> `evento`. **Inmutable**: editar el titulo no cambia el slug (las
   ordenes lo usan como FK textual). Carrera entre dos creaciones simultaneas con el mismo titulo: la restriccion UNIQUE
   falla y la action devuelve error generico "No se pudo guardar, intenta de nuevo" (`ponytail:` reintento automatico si
   aparece en la practica).
7. **Campos que el form no tiene** (`NOT NULL`): `address = venue`; `latitude/longitude` = `CITY_COORDINATES[city]`
   si existe, si no `"0"` (consistente con el backlog de 030; ninguna pantalla los lee todavia). `doors_open_at` y
   `min_age` siguen fuera (035 D4: `doorsOpen = fecha - 1h`, `minAge null`). Fecha/hora: `toEventIsoDate` (Lima,
   `-05:00`) al guardar y la conversion inversa (`toEventFormDateTime(startsAt)`, desplaza a hora de Lima) al editar;
   ambos en `event-write.utils.ts`, con tests.
8. **Categoria y plantilla de layout**: solo `category` (los 10 valores de `EVENT_CATEGORIES`, enum de DB). **Sin
   eleccion de plantilla**: los eventos del panel son admision general, con una zona por tier (035 D5/P5). Efecto
   conocido: si todos los tiers coinciden por nombre con zonas de la plantilla de la categoria y (numeradas) por stock,
   `buildVenueLayoutFromTiers` usa la plantilla; no se previene (no hay reglas de coincidencia por stock accidental en
   zonas numeradas; en zonas generales tomaria ids de plantilla). Es inocuo para ventas.
9. **Imagen de portada (decision)**: se mantiene la **subida como data URL guardada en `events.image_url`** (sin storage
   externo ni dependencias nuevas, ya funciona en form, preview, lista y `next/image`), bajando `EVENT_COVER_MAX_BYTES`
   a **500 KB** para que el body de la action quepa en 1 MB (no se toca `next.config.ts`), tal como propuso 030.
   Validacion en servidor: `imageUrl` empieza con `data:image/jpeg;base64,`/`data:image/png;base64,` o `https://`
   y su largo <= 700 000 caracteres. `ponytail:` techo: el catalogo (035) serializa hasta 200 `imageUrl` en el payload
   RSC; si crece, mover la portada a blob storage (Vercel Blob/S3) y guardar solo la URL. Alternativa (pregunta 1).
10. **Editar con ordenes (tiers)**: `updateEvent` corre en `db.transaction`, toma
    `pg_advisory_xact_lock(hashtext(slug))` (mismo lock que checkout, sin carrera con una compra) y calcula
    `hasOrders` con el predicado de `deleteEvent` (paid o pending, cualquier antiguedad). Si **hay ordenes**:
    - Campos de contenido editables: titulo, categoria, descripcion, fecha/hora, lugar, ciudad, portada.
    - Tiers **bloqueados**: si el payload no es identico a los actuales (mismo conjunto de ids de DB y mismos
      `name`/`price`/`quantity`) la action responde `error "tiers-locked"` ("Este evento tiene ventas: no se pueden
      cambiar tipos de entrada ni precios"). El form deshabilita los inputs de tiers y oculta agregar/quitar
      (`tiersLocked`). Razon: `lines[].zoneId` apunta a `tier.id` y el stock vendido se calcula contra esos ids;
      cambiar el nombre afectaria al emparejamiento con la plantilla de 035 y los precios de ordenes pendientes.
    - Es una regla gruesa a proposito (KISS); relajarla (subir stock, renombrar) es Proxima fase / pregunta 2.
    Si **no hay ordenes**: se reemplazan los tiers (delete all + insert, ids nuevos). Seguro: no hay `order_items`
    ni `lines` que referencien los ids. Si un `delete` falla por FK de `order_items` (hoy vacia) se devuelve
    `tiers-locked` en vez de un 500.
11. **Alcance por rol**: `getEventScope(viewer)` (030) en cargar/actualizar; evento ajeno o inexistente -> `not-found`
    ("No se encontro el evento o no tienes permiso"), igual que 030. En la page de edicion `notFound()`.
12. **Form sin stores**: `EventForm` recibe props `{ eventId?, status?, initialValues?, tiersLocked? }`; no usa
    `useAuthStore`, `useSearchParams` ni `useRouter().push` hacia otra cosa que `ORGANIZER_PATH`. Se quita el `<Suspense>`
    de `new/page.tsx`. El dueno ya no se envia desde el cliente (lo fija el servidor). `useTransition` para
    pendiente/deshabilitar botones; errores de servidor se muestran por campo (mismo mapa `errors`) o como `role="alert"`.
13. **Carga para editar**: `getEventForEdit(eventId, viewer)` (server-only) devuelve `{ values: EventFormValues,
    status, hasOrders }` con los tiers (`id` = uuid de DB, `price`/`quantity` como string); se llama desde la page
    (`await params` -> id, `z.uuid` para evitar consulta con basura -> `notFound()`).
14. **Menu de la lista**: nueva opcion "Editar" en `OrganizerEventActions` (`Link` a
    `/organizer/events/${id}/edit`) para `draft` y `published` (no `cancelled`). Constante
    `getOrganizerEditEventPath(id)` en `organizer.constants.ts`.
15. **Retiro**: se borran `store/organizer.store.ts`(+test), `mocks/organizer.mock.ts`; en `organizer.types.ts` los tipos
    `OrganizerEvent`/`OrganizerTicketTier` (y `OrganizerEventStatus` si no tiene otro uso); en `organizer.utils.ts`
    `getOrganizerEvents`; en el schema `toOrganizerEvent`/`toEventFormValues`; en `index.ts` sus exports.
    Los eventos que alguien guardo en localStorage con el form viejo **se pierden** (ya no aparecian en el catalogo
    desde 035; clave `ticketera-organizer-events` queda huerfana en su navegador, no se migra).

## Alcance
- Incluye: servicios de escritura (`createEvent`, `updateEvent`, `getEventForEdit`) con transaccion y lock; acciones
  `createEventAction`/`updateEventAction`; helpers puros (`slugify`, `toEventDbInput`, `toEventFormDateTime`);
  `draftSchema` con fecha/hora; form migrado a props + acciones; ruta `/organizer/events/[id]/edit`; opcion "Editar";
  portada 500 KB; retiro de store/mock/tipos/funciones huerfanas; tests; `SYSTEM_DESIGN.md`.
- No incluye (se difiere):
  - Plantillas de layout por categoria/estadio, asientos numerados en el form, `doors_open_at`/`min_age`,
    direccion y coordenadas reales (mapa / geocoding).
  - Subida de portada a storage externo.
  - Editar tiers de eventos con ventas; ediciones parciales (subir stock, renombrar).
  - `is_trending`/`is_best_seller` desde el form; preview de borradores para el dueno; auto-guardado.
  - Llenar `orders.event_id`/`order_items`; migrar localStorage antiguo.
  - Notificar a compradores si cambia fecha/lugar de un evento con ventas.

## Reutilizar
- `getEventScope`, `EventAdminViewer` (`organizer-event-admin.service.ts`); `getEventStatusChangeError` y
  `toEventIsoDate`/`createId` (`organizer.utils.ts`); `validateEventForm`, `createEmptyTier`, `createEventFormValues`,
  `EVENT_FORM_DEFAULT` (`event-form.schema.ts`); `EventFormValues`/`EventFormErrors`/`EventFormMode` (types).
- `requireRole`, `ORGANIZER_AREA_ROLES`, `getCurrentDbUser` (no hace falta: `requireRole` devuelve el usuario).
- `events`, `ticketTiers`, `orders` (tablas), `CITY_COORDINATES`, `getTakenInventory` (no necesario si basta
  `hasOrders`; el stock bloqueado cubre el caso), patron de advisory lock de `checkout.service.ts:102`.
- UI: `EventCoverField`, `EventTierFields`, `EventPreview`, `TextField`, `focusFormField`, `NativeSelect`, `Textarea`,
  `Button`, `DropdownMenuItem`. Nada nuevo de shadcn (`npx shadcn@latest search` no es necesario).
- Patrones de test: `organizer-event.actions.test.ts` y `organizer-event-admin.service.test.ts` (db mockeado),
  `event-form.test.tsx` actual (render + `fireEvent`).

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/organizer/utils/event-write.utils.ts` (+ `.test.ts`) | nuevo: `slugify`, `toEventDbInput(values, now)`, `toEventFormDateTime(date)`, `hasTiersChanged(current, next)` |
| `src/modules/organizer/types/event-write.types.ts` | nuevo: `SaveEventInput`, `SaveEventActionState`, `EventForEdit`, `SaveEventError` |
| `src/modules/organizer/schemas/event-form.schema.ts` (+ `.test.ts`) | borrador exige fecha/hora; quitar `toOrganizerEvent`/`toEventFormValues(OrganizerEvent)`; `intent`/imagen en servidor |
| `src/modules/organizer/services/organizer-event-write.service.ts` (+ `.test.ts`) | nuevo (`server-only`): `createEvent`, `updateEvent`, `getEventForEdit` |
| `src/modules/organizer/actions/organizer-event.actions.ts` (+ `.test.ts`) | agrega `createEventAction`, `updateEventAction` |
| `src/modules/organizer/components/event-form.tsx` (+ `.test.tsx`) | props, acciones, sin stores |
| `src/modules/organizer/components/event-tier-fields.tsx` | prop `locked` (inputs deshabilitados, sin agregar/quitar) |
| `src/modules/organizer/components/event-cover-field.tsx` | texto "hasta 500 KB" |
| `src/modules/organizer/components/organizer-event-actions.tsx` | opcion "Editar" |
| `src/modules/organizer/constants/organizer.constants.ts` | `EVENT_COVER_MAX_BYTES = 500 * 1024`, `getOrganizerEditEventPath` |
| `src/app/(organizer)/organizer/events/new/page.tsx` | sin `Suspense`; `<EventForm />` |
| `src/app/(organizer)/organizer/events/[id]/edit/page.tsx` | nuevo: carga con `getEventForEdit`, `notFound()` |
| `src/modules/organizer/store/organizer.store.ts` (+ `.test.ts`), `mocks/organizer.mock.ts` | **borrar** |
| `src/modules/organizer/types/organizer.types.ts`, `utils/organizer.utils.ts` (+ `.test.ts`), `index.ts` | quitar huerfanos (D15) |
| `docs/SYSTEM_DESIGN.md` | fila de la spec 036 |

Verificar antes de borrar: `grep -rnE "organizer.store|organizer.mock|useOrganizerStore|ORGANIZER_EVENTS_MOCK|getOrganizerEvents|toOrganizerEvent|OrganizerEvent\b|OrganizerTicketTier|OrganizerState" src`
sin resultados fuera de lo listado.

## Contratos
```ts
// organizer/types/event-write.types.ts
export type SaveEventError =
  | "not-found" | "tiers-locked" | "past-date" | "no-tiers" | "invalid-transition" | "unknown";
export interface SaveEventInput { values: EventFormValues; intent: EventFormMode }
export type SaveEventActionState =
  | { status: "success"; eventId: string }
  | { status: "error"; message: string; fieldErrors?: EventFormErrors };
export interface EventForEdit { values: EventFormValues; status: OrganizerDbEventStatus; hasOrders: boolean }

// organizer/utils/event-write.utils.ts (puro)
export function slugify(value: string): string; // "Festival de Verano!" -> "festival-de-verano"; "" -> "evento"
export function toEventDbInput(values: EventFormValues, coordinates?: { latitude: string; longitude: string }): {
  event: Omit<typeof events.$inferInsert, "slug" | "organizerId" | "status">;
  tiers: Array<Omit<typeof ticketTiers.$inferInsert, "eventId">>;
}; // address = venue, price toFixed(2), totalStock entero, startsAt Date
export function toEventFormDateTime(startsAt: Date): { date: string; time: string }; // hora de Lima
export function hasTiersChanged(
  current: readonly { id: string; name: string; price: string; totalStock: number }[],
  next: readonly EventFormTier[],
): boolean;

// organizer/services/organizer-event-write.service.ts (server-only)
export function createEvent(input: SaveEventInput, viewer: EventAdminViewer): Promise<{ ok: true; eventId: string } | { ok: false; error: SaveEventError }>;
export function updateEvent(eventId: string, input: SaveEventInput, viewer: EventAdminViewer): Promise<{ ok: true } | { ok: false; error: SaveEventError }>;
export function getEventForEdit(eventId: string, viewer: EventAdminViewer): Promise<EventForEdit | null>; // null: no existe, fuera de alcance o cancelled

// actions (use server)
export async function createEventAction(input: SaveEventInput): Promise<SaveEventActionState>;
export async function updateEventAction(eventId: string, input: SaveEventInput): Promise<SaveEventActionState>;
```
Mensajes de error de acciones (mapa `SAVE_ERRORS`, estilo de 030): `tiers-locked` -> "Este evento tiene ventas: no se
pueden cambiar tipos de entrada ni precios"; `past-date` -> "Elige una fecha futura"; `no-tiers` -> "Agrega al menos
un tipo de entrada"; `unknown` -> "No se pudo guardar, intenta de nuevo".

## Criterios de aceptacion
- AC1: `slugify` quita tildes/simbolos/espacios multiples, minuscula, recorta guiones y devuelve `"evento"` si queda vacio;
  `createEvent` agrega `-2`, `-3` si el slug ya existe y nunca modifica el slug en `updateEvent`.
- AC2: `toEventDbInput` produce `address = venue`, `price` con 2 decimales, `totalStock` entero, `startsAt` correcto en
  hora de Lima, coordenadas de `CITY_COORDINATES` o `"0"`; `toEventFormDateTime(toEventIsoDate(d, t))` devuelve `d`/`t`.
- AC3: `createEventAction` con `publish` y datos validos inserta `events` (`status published`, `organizer_id` del usuario
  actual) y sus `ticket_tiers` en una sola transaccion; con `draft` y solo nombre+fecha+hora inserta borrador sin tiers;
  borrador sin fecha/hora devuelve `fieldErrors`; publicar sin tiers, con fecha pasada o sin portada devuelve
  `fieldErrors` y no escribe.
- AC4: ambas acciones llaman `requireRole(ORGANIZER_AREA_ROLES)` antes de cualquier otra cosa (un `customer` por POST
  directo es redirigido y la DB no se toca) y validan en servidor aunque el cliente ya valido.
- AC5: `updateEvent` de un `organizer` sobre un evento ajeno, inexistente o `cancelled` devuelve `not-found`;
  `admin`/`super_admin` pueden editar cualquiera (`getEventScope`).
- AC6: editar un evento **sin ordenes** reemplaza titulo/campos y tiers (borra los viejos, inserta los nuevos), mantiene
  slug, `is_featured` y flags, y `updated_at` cambia.
- AC7: editar un evento **con ordenes** `paid` o `pending`: cambios de contenido se guardan; cualquier cambio en tiers
  (alta, baja, nombre, precio, cantidad) devuelve `tiers-locked` sin escribir; un payload con tiers identicos guarda.
  El lock `pg_advisory_xact_lock(hashtext(slug))` se toma antes de calcular `hasOrders`.
- AC8: `draft -> published` desde el form respeta 030 (fecha futura y >= 1 tier); un `published` ya realizado se puede
  editar sin cambiar la fecha; `published` nunca vuelve a `draft` por el form.
- AC9: un evento creado con `publish` aparece en `/events` y su detalle `/events/<slug>` (035) y es comprable con los
  precios/stock de sus tiers (layout de admision general); un `draft` da 404 en publico.
- AC10: `/organizer/events/[id]/edit` carga los valores del evento (fecha y hora de Lima, tiers con precio/cantidad),
  `notFound()` para id no-uuid, inexistente, ajeno o cancelado; con ordenes los inputs de tiers estan deshabilitados y
  sin botones de agregar/quitar.
- AC11: la lista del organizador muestra "Editar" para `draft` y `published` (no `cancelled`) enlazando a la ruta de edicion.
- AC12: la portada tiene limite 500 KB en cliente y el servidor rechaza `imageUrl` que no sea `data:image/jpeg|png;base64`
  o `https://` o que supere 700 000 caracteres.
- AC13: `EventForm` no importa `useOrganizerStore`, `useAuthStore`, `useSearchParams` ni `ORGANIZER_EVENTS_MOCK`; el grep de
  "Archivos" no encuentra `organizer.store`, `organizer.mock`, `OrganizerEvent` (tipo), `getOrganizerEvents` ni
  `toOrganizerEvent` en `src`; `index.ts` ya no exporta `useOrganizerStore`.
- AC14: `tsc`, `eslint`, `vitest` y `next build` pasan. Verificacion manual (DB + Clerk, rol organizer): crear
  borrador -> editar -> publicar -> aparece en catalogo -> comprar una entrada -> editar el titulo OK, intentar cambiar
  un precio muestra el mensaje de bloqueo; otro organizador recibe 404 al abrir la URL de edicion.

## Tests requeridos
(Vitest, junto al archivo)
- `event-write.utils.test.ts`: `slugify` (tildes, simbolos, vacio, espacios), `toEventDbInput` (AC2, ciudad sin
  coordenadas), `toEventFormDateTime` ida y vuelta con `toEventIsoDate`, `hasTiersChanged` (igual, nombre, precio,
  cantidad, alta, baja).
- `event-form.schema.test.ts`: borrador exige nombre+fecha+hora; publicar igual que antes; se elimina lo de `toOrganizerEvent`.
- `organizer-event-write.service.test.ts` (db mockeado, patron de `organizer-event-admin.service.test.ts`): slug
  unico con sufijo, insercion de evento + tiers, `organizerId`, `not-found` por scope/cancelled, `tiers-locked` con
  ordenes, guardado con tiers identicos, lock tomado antes del chequeo, reemplazo de tiers sin ordenes, transicion
  a `published` (`past-date`, `no-tiers`), publicado ya realizado editable.
- `organizer-event.actions.test.ts`: `requireRole` primero, validacion de campos y portada, mapa de errores, `revalidatePath`
  en exito, sin escritura si falla la validacion.
- `event-form.test.tsx`: crear (muestra errores y enfoca el primero, llama a `createEventAction` con `publish`/`draft` y
  navega a `/organizer`), editar (precarga valores, llama a `updateEventAction` con el id, titulo "Editar evento"), `tiersLocked`
  deshabilita inputs, error de servidor visible. Mock de `next/navigation` y de las acciones.
- `organizer.utils.test.ts`: se quitan los casos de `getOrganizerEvents` y se reemplaza el uso de
  `ORGANIZER_EVENTS_MOCK` por fixtures locales.
- No automatizable sin DB/Clerk (manual): AC9, AC10 (404 reales), AC14.

## Tareas
### T1 — Helpers puros, tipos y esquema
- Archivos: `src/modules/organizer/utils/event-write.utils.ts` (+ `.test.ts`), `src/modules/organizer/types/event-write.types.ts`,
  `src/modules/organizer/schemas/event-form.schema.ts` (+ `.test.ts`)
- Depende de: —
- Paralelizable: no (base de T2)
- Cubre: AC1 (slugify), AC2, AC12 (validacion de portada en esquema), AC3 (reglas de borrador)
- Nota: al quitar `toOrganizerEvent`/`toEventFormValues(OrganizerEvent)` el `event-form.tsx` actual deja de compilar hasta
  T3; `tsc` global se evalua al cerrar T3/T4.

### T2 — Servicio de escritura y server actions
- Archivos: `src/modules/organizer/services/organizer-event-write.service.ts` (+ `.test.ts`),
  `src/modules/organizer/actions/organizer-event.actions.ts` (+ `.test.ts`)
- Depende de: T1
- Paralelizable: no
- Cubre: AC1 (slug unico/inmutable), AC3, AC4, AC5, AC6, AC7, AC8

### T3 — UI: form, ruta de edicion y menu
- Archivos: `src/modules/organizer/components/event-form.tsx` (+ `.test.tsx`), `event-tier-fields.tsx`,
  `event-cover-field.tsx`, `organizer-event-actions.tsx`, `src/modules/organizer/constants/organizer.constants.ts`,
  `src/app/(organizer)/organizer/events/new/page.tsx`, `src/app/(organizer)/organizer/events/[id]/edit/page.tsx`
- Depende de: T2
- Paralelizable: no
- Cubre: AC9 (manual), AC10, AC11, AC12 (cliente), AC13 (form)

### T4 — Retiro de store/mock/huerfanos y docs
- Archivos: borrar `src/modules/organizer/store/organizer.store.ts` (+ `.test.ts`), `src/modules/organizer/mocks/organizer.mock.ts`;
  editar `src/modules/organizer/types/organizer.types.ts`, `src/modules/organizer/utils/organizer.utils.ts` (+ `.test.ts`),
  `src/modules/organizer/index.ts`, `docs/SYSTEM_DESIGN.md`
- Depende de: T3 (el form deja de importarlos)
- Paralelizable: no
- Cubre: AC13, AC14

Orden: T1 -> T2 -> T3 -> T4. Cada archivo pertenece a una sola tarea. Un solo desarrollador por tarea; no hay
paralelismo util porque cada una consume el contrato de la anterior (los contratos de arriba permiten arrancar T3 contra
tipos mientras T2 termina si se desea).

## Preguntas abiertas
1. **Portada**: default = data URL de hasta 500 KB en `events.image_url` (D9, sin dependencias). Riesgo: el listado
   publico (200 eventos) transporta esas cadenas. Alternativas: (a) URL externa `https` (campo de texto) + ampliar
   `remotePatterns` (toca `next.config.ts`; cualquier host o lista cerrada), (b) blob storage (dependencia nueva).
   ¿Se acepta el default o se prefiere (a)?
2. **Tiers con ventas**: default = bloqueo total (D10). ¿Se permite al menos subir `quantity` o renombrar? Costo: validar
   `quantity >= vendido+pendiente` por tier y recalcular el emparejamiento con plantilla (035).
3. **Borrador exige fecha y hora** (D5, por `starts_at NOT NULL`). Alternativa: permitir borrador solo con nombre usando
   una fecha placeholder (`now() + 1 año`), a costa de datos falsos. ¿Se acepta exigirlas?
4. **Editar la fecha de un evento con ventas**: default = permitido sin avisar a compradores. ¿Se bloquea o se avisa?
5. **Ciudad sin coordenadas** guarda `"0"/"0"` (nadie las lee hoy). ¿Basta o se quiere validar la ciudad contra
   `CITY_COORDINATES` (lista cerrada de 7 ciudades)?
6. **Admin editando eventos ajenos** (`getEventScope` lo permite): se mantiene `organizer_id` original (no se reasigna).
   ¿Correcto?

## Proximas fases
- Edicion parcial de tiers con ventas (subir stock/renombrar), plantillas de layout y asientos numerados desde el form.
- `doors_open_at`/`min_age` (migracion, 035 P1), direccion y coordenadas reales, geocoding en el mapa.
- Portada en storage externo; recorte de imagen.
- `orders.event_id` + `order_items` (permite que Postgres proteja borrados/ediciones de tiers y calcular ventas por tier).
- Notificar a compradores ante cambios de fecha/lugar.

## Log de review
- Iteracion 1 — FAIL: AC8 (cliente rechazaba fecha pasada en un published ya realizado) y AC12 (https abierto vs next.config.ts solo images.unsplash.com). Menores corregidos: update con ne(cancelled)+returning; cotas max de price/quantity.
- Iteracion 2 — FAIL: IMAGE_URL_PATTERN sin ancla final (espacios, control, basura tras el prefijo).
- Iteracion 3 — PASS. vitest organizer (139), tsc, eslint y npm run build OK. Pendiente manual con DB+Clerk: AC9 (evento creado y publicado aparece en /events y es comprable; draft da 404 publico), AC10 (404 reales y precarga en /organizer/events/[id]/edit), AC14 (crear -> editar -> publicar -> comprar -> tiers bloqueados), subir portada real. No hechos (YAGNI, decididos): largo maximo de description/venue/city; validacion runtime de intent/values; el update filtra por id y no por .for(update) salvo el ne(cancelled).
