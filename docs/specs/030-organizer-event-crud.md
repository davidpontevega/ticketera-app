# 030 — CRUD de eventos en `/organizer` (Fase 1: publicar, despublicar, cancelar y eliminar en DB)

> Continua `docs/specs/029-organizer-dashboard-real-data.md` (lectura real de DB ya aprobada). Esta spec agrega las
> mutaciones. El CRUD completo no entra en una sesion: la Fase 1 cubre el ciclo de vida de los eventos que ya estan en
> DB (Update de estado + Delete) con la capa de seguridad completa; Create/Update de contenido (migrar `event-form.tsx`
> a DB) es la Fase 2 (ver Backlog).

## Contexto
Pedido del usuario: "ahora vamos a trabajar en el CRUD del evento dentro de la vista /organizer puedo ver el listado
pero como admin u organizador debo tener la capacidad de hacer el CRUD bajo ciertas restricciones de seguridad a nivel
de plataforma y los clientes."

Estado actual (verificado):
- Lectura: `listOrganizerEvents()` (`src/modules/organizer/services/organizer-events.service.ts:13-52`) llama a
  `requireRole(ORGANIZER_AREA_ROLES)` y acota con `organizerFilter` (linea 16): `organizer` ve solo
  `events.organizerId = viewer.id`; `admin`/`super_admin` ven todos.
- `customer` ya esta bloqueado del area: `src/app/(organizer)/layout.tsx` y cada page llaman a `requireRole`, que
  redirige a `/login` sin sesion y a `/` si el rol no esta permitido (`src/modules/user/services/user-access.service.ts:27-39`).
- **No existe ninguna mutacion de eventos contra la DB.** `event-form.tsx:69-70,106-113` guarda en `useOrganizerStore`
  (localStorage). No hay server actions ni servicios de escritura para `events`/`ticket_tiers`.
- La lista (`organizer-event-list.tsx:84,146-155`) solo tiene la accion "Ver evento" para publicados.
- Integridad: `orders.eventId` (`src/modules/order/db/order.table.ts:13`) tiene FK `onDelete: "restrict"`, pero el
  checkout nunca la llena (spec 029, Contexto); el vinculo real es `orders.eventSlug = events.slug` (texto, sin FK).
  **Postgres no impide hoy borrar un evento con ventas**: la proteccion tiene que estar en la aplicacion.
  `ticket_tiers` cae por cascada al borrar el evento (`ticket-tier.table.ts:7`); `order_items.ticketTierId` es
  `restrict` (`order-item.table.ts:13`) pero `order_items` esta vacio (spec 029).
- Next 16: las Server Actions son alcanzables por POST directo; hay que verificar auth dentro de cada una
  (`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md:32`,
  `node_modules/next/dist/docs/01-app/02-guides/data-security.md:291`). El guard del layout no protege una action.

Resultado esperado: desde "Mis eventos" un `organizer` puede publicar, despublicar, cancelar y eliminar **sus**
eventos; `admin`/`super_admin` pueden hacerlo sobre cualquiera. Cada accion verifica rol y propiedad en el servidor.
Un evento con ordenes `paid` o `pending` no se puede eliminar (se ofrece cancelar). Un `customer` que llame la action
por POST directo es redirigido sin tocar la DB.

## Alcance
- Incluye:
  - Servicio server-only de mutaciones con alcance por dueno (`getEventScope`, reutilizado por la lectura).
  - Server actions `changeEventStatusAction` y `deleteEventAction`, cada una con su propio `requireRole`.
  - Regla pura de transiciones de estado (`getEventStatusChangeError`).
  - Menu de acciones por fila en la lista + dialogo de confirmacion.
- Excluye:
  - Crear y editar contenido del evento en DB (Fase 2).
  - Que el catalogo publico (`/events/[slug]`, home, busqueda) respete `events.status` de la DB: hoy lee
    `EVENTS_MOCK` + localStorage (`src/app/(main)/events/[slug]/page.tsx:16-20`), no la DB. Ver pregunta 1.
  - Reembolsos o aviso a compradores al cancelar un evento.
  - Cambios de esquema/migraciones.
- Backlog (fases siguientes):
  - **Fase 2 — Create/Update de contenido en DB** (defaults ya propuestos para no reabrirlos):
    `saveEventAction` + servicio con `db.transaction` (insert/update de `events` + reemplazo de `ticket_tiers`);
    ruta dedicada `/organizer/events/[id]/edit` (Server Component carga el evento con `getEventScope`, pasa valores al
    form; reemplaza el `?draft=` + `useSearchParams`); `event-form.tsx` sin `useOrganizerStore`/`useAuthStore`;
    slug inmutable tras crear (`slugify` de `@/modules/catalog` + sufijo) porque las ventas se unen por slug; el
    borrador exige ademas fecha y hora (`events.startsAt` es NOT NULL); `address = venue` y coordenadas de
    `CITY_COORDINATES` (`event-seed.utils.ts:10`) o `"0"`; portada base64 en `events.imageUrl` bajando
    `EVENT_COVER_MAX_BYTES` a 500 KB para que el body quepa en el limite de 1 MB de Server Actions
    (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:59-77`)
    sin tocar `next.config.ts`; validacion en servidor reutilizando `validateEventForm`. Accion "Editar" en el menu.
  - Fase 3 — catalogo publico leyendo `events` de la DB (respeta draft/cancelled) y retiro de `organizer.store.ts` /
    `organizer.mock.ts`.
  - Llenar `orders.event_id` en el checkout para que el `restrict` de Postgres proteja el borrado (022 backlog).
  - Hook generico `useActionState` + callback en `src/hooks` si aparece un tercer consumidor (hoy
    `use-user-admin-action.ts` y el dialogo de esta spec).

## Decisiones (default propuesto; confirmar al aprobar)

### D1 — Alcance por rol = el mismo de la lectura
`organizer` muta solo eventos con `organizerId = viewer.id`; `admin`/`super_admin` mutan cualquiera (incluidos los de
`organizerId = null`). Se extrae `getEventScope(viewer)` y `listOrganizerEvents` lo usa, asi lectura y escritura no
pueden divergir. Un evento fuera de alcance responde igual que uno inexistente (`not-found`): no revela que existe.

### D2 — Defensa en profundidad
Cada action llama `requireRole(ORGANIZER_AREA_ROLES)` como primera linea (antes de parsear), y el servicio pone el
alcance en el `WHERE` de la misma sentencia `UPDATE`/`DELETE`. El `eventId` viene del cliente y nunca se confia: zod
`uuid` + scope en SQL.

### D3 — Transiciones de estado
| Accion | Desde | Hacia | Condicion extra |
|--------|-------|-------|-----------------|
| Publicar | `draft` | `published` | `startsAt` futuro y al menos un `ticket_tier` |
| Despublicar | `published` | `draft` | - |
| Cancelar | `draft`, `published` | `cancelled` | - (permitido con ventas) |

`cancelled` es terminal: sin publicar/despublicar (solo eliminar, si no tiene ordenes). El `UPDATE` incluye
`status = <estado leido>` en el `WHERE` para no pisar un cambio concurrente; 0 filas -> `not-found`.
Publicar desde la lista basta en Fase 1 porque todos los eventos de DB vienen del seed completos; la validacion de
contenido completo queda en el form de Fase 2.

### D4 — Borrado protegido por ordenes
`DELETE` solo si no existe ninguna orden con `eventSlug = events.slug` y `status in ('paid','pending')` (`pending`
= pago de Stripe en curso). Condicion `NOT EXISTS` en la misma sentencia `DELETE ... RETURNING` (atomico, sin
ventana entre check y borrado). Si devuelve 0 filas y el evento existe en el alcance -> `has-orders`, con mensaje
"Este evento tiene ventas: cancelalo en vez de eliminarlo". Ordenes `failed`/`cancelled` no bloquean (quedan
huerfanas por slug, sin FK; aceptado).

### D5 — Confirmacion con `Dialog` existente, no `alert-dialog`
Mismo patron que el borrado de usuarios en `src/modules/user/components/user-dialog.tsx` (`Dialog` de
`src/components/ui/dialog.tsx`, base-ui). Consistencia con el proyecto y 0 instalaciones. Si se prefiere el
`alert-dialog` de shadcn (`npx shadcn@latest add alert-dialog`, solo agrega `src/components/ui/alert-dialog.tsx`;
`@base-ui/react` ya esta en `package.json`), es la pregunta 3.

### D6 — Sin hook nuevo
El dialogo usa `useActionState` directo. `useUserAdminAction` esta tipado a `UserAdminActionState` y vive en otro
modulo; generalizarlo ahora toca el modulo `user` por un solo consumidor nuevo (ver Backlog).

## Reuso detectado
- `src/modules/user/services/user-access.service.ts:27` `requireRole` + `ORGANIZER_AREA_ROLES`
  (`user.constants.ts:8`) y tipo `UserEntity` — exportados por `@/modules/user`.
- `src/modules/user/actions/user-admin.actions.ts` — patron completo de action (guard -> `safeParse` ->
  servicio -> mapa de mensajes -> `revalidatePath`) y `toFieldErrors`.
- `src/modules/user/actions/user-admin.actions.test.ts` — patron de test (mocks + `await import` despues de mocks).
- `src/modules/organizer/services/organizer-events.service.test.ts` — mock de `server-only` y `@/lib/db` con builder
  encadenable (extender con `update`/`delete`).
- `src/modules/user/schemas/user-admin.schema.ts` — un schema zod por accion + tipo inferido; usa
  `userRoleEnum.enumValues` de la tabla (aqui `eventStatusEnum.enumValues`, `event.table.ts:18`).
- `src/modules/user/components/user-dialog.tsx` — patron `Dialog` + estado por modo + form con `action`.
- `src/components/ui/dropdown-menu.tsx`, `dialog.tsx`, `button.tsx`, `field.tsx` (`FieldError`) — UI del menu.
- `ORGANIZER_PATH` (`organizer.constants.ts:5`) para `revalidatePath`; `getEventHref` de `@/modules/event` para
  "Ver evento"; `STATUS_LABEL` ya existe en `organizer-event-list.tsx:22`.
- `src/lib/db.ts` (`db`, postgres-js: soporta `db.transaction`, usado en `scripts/seed-events.ts:66`; Fase 1 no lo
  necesita).

## Contratos

```ts
// src/modules/organizer/types/organizer.types.ts (agregar)
export type EventStatusChangeError = "invalid-transition" | "past-date" | "no-tiers";

export type EventAdminActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"eventId" | "status", string>> };

// src/modules/organizer/schemas/event-admin.schema.ts
import { eventStatusEnum } from "@/modules/event/db/event.table";
export const changeEventStatusSchema = z.object({
  eventId: z.uuid("Evento invalido"),
  status: z.enum(eventStatusEnum.enumValues, "Estado invalido"),
});
export const deleteEventSchema = z.object({ eventId: z.uuid("Evento invalido") });
export type ChangeEventStatusInput = z.infer<typeof changeEventStatusSchema>;
export type DeleteEventInput = z.infer<typeof deleteEventSchema>;

// src/modules/organizer/utils/organizer.utils.ts (agregar; pura, tabla D3)
export function getEventStatusChangeError(
  event: { status: OrganizerDbEventStatus; startsAt: Date; tierCount: number },
  target: OrganizerDbEventStatus,
  now?: Date, // default new Date()
): EventStatusChangeError | null;

// src/modules/organizer/services/organizer-event-admin.service.ts
import "server-only";
export type EventAdminViewer = Pick<UserEntity, "id" | "role">;
export function getEventScope(viewer: EventAdminViewer): SQL | undefined;
//   organizer -> eq(events.organizerId, viewer.id); admin/super_admin -> undefined
export async function changeEventStatus(
  input: ChangeEventStatusInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: "not-found" | EventStatusChangeError }>;
//   1) select status, startsAt, tierCount WHERE id AND scope  -> sin fila: not-found
//   2) getEventStatusChangeError(...) -> error
//   3) update events set status, updatedAt = now() WHERE id AND scope AND status = <leido> returning id
//      -> 0 filas: not-found
export async function deleteEvent(
  input: DeleteEventInput,
  viewer: EventAdminViewer,
): Promise<{ ok: true } | { ok: false; error: "not-found" | "has-orders" }>;
//   1) select slug WHERE id AND scope -> sin fila: not-found
//   2) delete events WHERE id AND scope AND NOT EXISTS(orders eventSlug = slug AND status in paid|pending)
//      returning id -> 0 filas: has-orders
// No se exporta desde src/modules/organizer/index.ts (server-only; mismo motivo que 029 AC7).

// src/modules/organizer/services/organizer-events.service.ts (cambio de 1 linea)
//   organizerFilter = getEventScope(viewer)

// src/modules/organizer/actions/organizer-event.actions.ts
"use server";
export async function changeEventStatusAction(
  prev: EventAdminActionState, formData: FormData,
): Promise<EventAdminActionState>;
export async function deleteEventAction(
  prev: EventAdminActionState, formData: FormData,
): Promise<EventAdminActionState>;
// Ambas: const viewer = await requireRole(ORGANIZER_AREA_ROLES) primero; safeParse(Object.fromEntries(formData));
// servicio(parsed.data, viewer); exito -> revalidatePath(ORGANIZER_PATH).
// Mensajes:
//   not-found: "No se encontro el evento o no tienes permiso"
//   invalid-transition: "Este evento no admite ese cambio de estado"
//   past-date: "No se puede publicar un evento con fecha pasada"
//   no-tiers: "Agrega al menos un tipo de entrada antes de publicar"
//   has-orders: "Este evento tiene ventas: cancelalo en vez de eliminarlo"
//   exito: "Evento publicado" | "Evento despublicado" | "Evento cancelado" | "Evento eliminado"

// src/modules/organizer/components/organizer-event-actions.tsx ("use client")
export interface OrganizerEventActionsProps {
  event: Pick<OrganizerEventSummary, "id" | "slug" | "title" | "status">;
}
// DropdownMenu (trigger icon button, aria-label "Acciones de <title>") con items segun estado:
//   published: Ver evento (getEventHref), Despublicar, Cancelar evento, Eliminar
//   draft:     Publicar, Cancelar evento, Eliminar
//   cancelled: Eliminar
// Cada item de mutacion abre un Dialog de confirmacion con <form action> (hidden eventId [+ status]);
// error -> FieldError/mensaje dentro del dialogo; success -> cierra el dialogo. El form se monta con
// key={mode + event.id} para reiniciar useActionState entre aperturas.

// src/modules/organizer/components/organizer-event-list.tsx
// La ultima columna renderiza <OrganizerEventActions event={event} /> en cada fila (reemplaza el Link
// "Ver evento", que pasa al menu). Props publicas sin cambios.
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Tipos `EventStatusChangeError`/`EventAdminActionState`, schemas zod, util `getEventStatusChangeError` + tests | src/modules/organizer/types/organizer.types.ts, src/modules/organizer/schemas/event-admin.schema.ts, src/modules/organizer/utils/organizer.utils.ts, src/modules/organizer/utils/organizer.utils.test.ts | - | S |
| T2 | Servicio `organizer-event-admin.service.ts` (`getEventScope`, `changeEventStatus`, `deleteEvent`) + test; `listOrganizerEvents` usa `getEventScope` | src/modules/organizer/services/organizer-event-admin.service.ts, src/modules/organizer/services/organizer-event-admin.service.test.ts, src/modules/organizer/services/organizer-events.service.ts | T1 | P1 |
| T3 | Server actions `changeEventStatusAction`, `deleteEventAction` + test | src/modules/organizer/actions/organizer-event.actions.ts, src/modules/organizer/actions/organizer-event.actions.test.ts | T1, T2 | S |
| T4 | Componente `OrganizerEventActions` (menu + dialogo) | src/modules/organizer/components/organizer-event-actions.tsx | T1, T3 | P2 |
| T5 | Lista: menu de acciones por fila en lugar del link "Ver evento" | src/modules/organizer/components/organizer-event-list.tsx | T4 | S |

Orden: T1 -> T2 -> T3 -> T4 -> T5. El action importa el servicio y el componente importa el action, asi que el
paralelismo real es nulo; `P1`/`P2` quedan como grupos de un elemento (pueden correr como seriales). 11 archivos (8 de producto + 3 tests), mismo
tamano que la 029. `organizer-dashboard.tsx`, `index.ts`, `event-form.tsx` y las pages no se tocan.

## Criterios de aceptacion
- [ ] AC1: Como `organizer`, en "Mis eventos" cada fila tiene un boton "Acciones de <titulo>" con los items de la
  tabla de Contratos segun el estado; un evento `published` ya no muestra el link suelto "Ver evento" (esta en el menu).
- [ ] AC2: "Despublicar" un evento publicado lo deja con badge "Borrador" tras confirmar, y "Publicar" lo devuelve a
  "Publicado" (si su fecha es futura y tiene tiers); los KPIs "Eventos publicados" se actualizan sin recargar manual
  (`revalidatePath`). Publicar un borrador con fecha pasada muestra "No se puede publicar un evento con fecha pasada"
  y no cambia la DB.
- [ ] AC3: "Cancelar evento" deja el badge "Cancelado", el evento solo aparece en el filtro "Todos" y su menu solo
  ofrece "Eliminar". Funciona aunque tenga ordenes pagadas.
- [ ] AC4: "Eliminar" un evento sin ordenes `paid`/`pending` (por `event_slug`) borra la fila de `events` y sus
  `ticket_tiers` (cascada). Con al menos una orden `paid` o `pending`, muestra "Este evento tiene ventas: cancelalo en
  vez de eliminarlo" y la fila sigue en DB.
- [ ] AC5: Un `organizer` que envia `changeEventStatusAction`/`deleteEventAction` con el `eventId` de un evento de
  otro organizador recibe "No se encontro el evento o no tienes permiso" y la DB no cambia (verificable en el test del
  servicio: el `WHERE` incluye `getEventScope`). `admin`/`super_admin` pueden operar sobre cualquier evento.
- [ ] AC6: Sin sesion o con rol `customer`, invocar cualquiera de las dos actions redirige (`requireRole`) y no se
  llama al servicio ni a la DB (test dedicado por action).
- [ ] AC7: Un `eventId` que no es uuid o un `status` fuera del enum devuelve `status: "error"` con `fieldErrors` y no
  llama al servicio.
- [ ] AC8: `organizer-event-admin.service.ts` y las actions no se exportan desde `src/modules/organizer/index.ts`;
  `npm run build` no falla por `server-only`.
- [ ] AC9: `npx tsc --noEmit`, `npm run lint` y `npx vitest run` sin errores.

## Tests requeridos
- `organizer.utils.test.ts` (agregar): `getEventStatusChangeError` — draft->published ok con fecha futura y tiers;
  `past-date`; `no-tiers`; published->draft ok; draft|published->cancelled ok; cancelled->cualquiera y
  draft->draft `invalid-transition`.
- `organizer-event-admin.service.test.ts` (nuevo; mocks `server-only`, `@/lib/db` con `select`/`update`/`delete`
  encadenables):
  - `getEventScope`: `organizer` -> condicion definida; `admin` y `super_admin` -> `undefined`.
  - `changeEventStatus`: sin fila -> `not-found` sin llamar `update`; transicion invalida -> error sin `update`;
    exito -> `update` llamado y `{ ok: true }`; `update` sin filas -> `not-found`.
  - `deleteEvent`: sin fila -> `not-found` sin llamar `delete`; `delete` devuelve `[]` -> `has-orders`; devuelve una
    fila -> `{ ok: true }`.
- `organizer-event.actions.test.ts` (nuevo; patron `user-admin.actions.test.ts`):
  - por action: `requireRole` con `ORGANIZER_AREA_ROLES`; si `requireRole` lanza (redirect), el servicio no se llama;
  - input invalido -> `fieldErrors` sin llamar al servicio;
  - el servicio recibe el `viewer` devuelto por `requireRole`;
  - mapeo de cada error a su mensaje; exito -> `revalidatePath(ORGANIZER_PATH)` y mensaje segun el estado destino.
- `organizer-event-actions.tsx`: opcional (items por estado es condicional; si se agrega, un test RTL de items para
  `published`/`draft`/`cancelled`).

## Preguntas abiertas
1. **Efecto publico del estado:** en Fase 1, publicar/despublicar/cancelar cambia `events.status` y el panel, pero el
   catalogo publico sigue leyendo `EVENTS_MOCK`, asi que un evento sembrado despublicado o cancelado **sigue visible y
   comprable en `/events/<slug>`**. Default: aceptarlo en Fase 1 y resolverlo en Fase 3 (catalogo desde DB). Si debe
   bloquearse ya, minimo: guard en checkout que rechace slugs con `events.status != 'published'` (+2 archivos).
2. **Que significa "restricciones para los clientes":** default = (a) `customer` sin acceso a ninguna action (D2) y
   (b) no se borran eventos con compras de clientes (D4). Si ademas implica avisar/reembolsar a compradores al
   cancelar, es una fase aparte (Stripe refunds).
3. **Confirmacion (D5):** default `Dialog` existente. Alternativa: instalar `alert-dialog` de shadcn (+1 archivo ui).
4. **Despublicar con ventas:** default = permitido (pausa la venta, las entradas vendidas siguen validas). Alternativa:
   bloquearlo como el borrado.
5. **Orden de fases:** default = Fase 1 estados + borrado, Fase 2 crear/editar en DB. Si se prefiere priorizar
   crear/editar (el formulario sigue guardando en localStorage mientras tanto), se invierte.

## Estado
- Aprobacion humana: aprobada (2026-10-02)
- Fase: APPROVED
- Log de review: Iteracion 1 — CHANGES_REQUESTED (AC5 bloqueante: test no verificaba scope real en el WHERE; +2 menores: guard antes de parseo, DRY del dialogo). Iteracion 2 — APPROVED. 1 hallazgo menor residual sin bloquear: test del caso admin solo confirma ausencia del id, no los params exactos.
