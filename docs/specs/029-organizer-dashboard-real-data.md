# 029 — Panel de organizador con datos reales y guard de rol en servidor

> Cubre la parte de `/organizer` de la fase 026 planificada en `docs/specs/024-user-roles-authorization.md`
> ("Fases", fila 2): guard `requireRole(ORGANIZER_AREA_ROLES)` en servidor y `OrganizerShell` sin el store mock. La
> proteccion de `/my-tickets`/checkout por sesion (resto de 026) queda fuera.

## Contexto
Pedido del usuario: "Como el listado de eventos es algo repetitivo en el proyecto crea un hook reutilizable con la
seguridad debida de roles y permisos y usalo en la web, en esta vista como seran datos reales muestra la informacion
real de entradas, ingresos y eventos publicados."

Estado actual:
- `/organizer` no tiene guard de rol. `src/app/(organizer)/layout.tsx:3-5` envuelve todo en `OrganizerShell`, que en
  `src/modules/organizer/components/organizer-shell.tsx:89-97` usa `useAuthStore` (store localStorage pre-Clerk) y
  `useIsClient` para redirigir en cliente. Con Clerk ese store siempre esta vacio, asi que el area queda en loop
  `/organizer` -> `/login` (estado conocido, 024 D5).
- `src/modules/organizer/components/organizer-dashboard.tsx:27-31` arma la lista con `ORGANIZER_EVENTS_MOCK` +
  `useOrganizerStore` filtrado por email, y `getOrganizerKpis` (`organizer.utils.ts:46-55`) suma `tiers[].sold` del mock.
- Datos reales en DB: `events` (`organizerId`, `status`, `slug`, `startsAt`, `city`, `imageUrl`) y `ticketTiers`
  (`eventId`, `totalStock`), sembrados por `scripts/seed-events.ts` (spec 025) con un organizador real.
- **Hallazgo que cambia el calculo pedido por el orquestador:** las ventas reales NO escriben `order_items` ni
  `orders.event_id`. `checkout.service.ts:74-82` inserta la orden con `eventSlug`, `lines` (jsonb `TicketLine[]`) y
  `totalAmount`; `event_id` queda null y `order_items` vacio (spec 022, decision "lines/buyer en jsonb mientras no
  existan ticket_tiers en DB"). Sumar `order_items` daria siempre 0. Las metricas se calculan desde `orders` con
  `status = 'paid'` unidas por `orders.event_slug = events.slug` (el seed conserva el slug del mock).

Resultado esperado: un usuario con rol `super_admin | admin | organizer` entra a `/organizer` y ve sus eventos de la DB
con entradas vendidas, ingresos y conteo de publicados reales. Sin sesion -> `/login`; rol `customer` -> `/`.

## Alcance
- Incluye:
  - Guard en servidor: `requireRole(ORGANIZER_AREA_ROLES)` en `(organizer)/layout.tsx` (para obtener el `viewer`) y en
    cada page del area (`/organizer`, `/organizer/events/new`), porque el layout no se re-ejecuta en navegacion
    (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1358`).
  - `OrganizerShell` recibe `viewer` por props (patron `AdminShell`) y cierra sesion con Clerk `SignOutButton`; se
    elimina `useAuthStore`, `useIsClient` y el redirect cliente.
  - Servicio de lectura `listOrganizerEvents()` (server-only, aplica el rol y acota por `organizerId = viewer.id`).
  - Util pura `summarizeOrganizerEvents` (une eventos + ordenes pagadas) y `getOrganizerKpis` sobre el nuevo tipo.
  - Dashboard, lista y KPIs consumen datos reales.
- Excluye:
  - Crear/editar eventos en DB: `event-form.tsx`, `organizer.store.ts`, `organizer.mock.ts` y `/organizer/events/new`
    siguen con localStorage (solo se agrega el guard a esa page).
  - Migrar el catalogo publico (`modules/catalog/hooks/use-catalog-events.ts`) a la DB.
  - Endpoint HTTP, TanStack Query o hook cliente (ver D1).
  - Proteccion de `/my-tickets`, checkout y `src/proxy.ts` (resto de 026).
- Backlog (fases siguientes):
  - Llenar `orders.event_id` / `order_items` en el checkout y calcular metricas por SQL `GROUP BY` (022 backlog).
  - Vista de todos los eventos para `admin`/`super_admin` (pregunta 2).
  - `cache()` de React en `requireRole` para no repetir la query de usuario entre layout y page.
  - Crear/editar eventos en DB desde el formulario.

## Decisiones (default propuesto; confirmar al aprobar)

### D1 — "Hook reutilizable" = funcion de lectura en servidor, no hook cliente
El pedido dice "hook". Un hook React corre en el cliente y **no puede aplicar seguridad por si mismo**: la
autorizacion siempre la hace el servidor. Para un hook cliente habria que crear un route handler
`GET /api/organizer/events` (con `requireRole` adentro), un `QueryClientProvider` (no existe ninguno en `src/`;
`@tanstack/react-query` esta en `package.json:21` pero no se usa) y el hook `useQuery`: 3 archivos de infraestructura
y una segunda superficie HTTP para exponer datos que la page ya tiene en el servidor.
Default: **`listOrganizerEvents()` en `services/organizer-events.service.ts`**, reutilizable desde cualquier Server
Component o server action. Lleva la seguridad adentro (llama a `requireRole` y obtiene el `organizerId` de la sesion;
no recibe un id del llamador, asi que no se puede pedir eventos ajenos). Mismo patron que `listUsers` + `/admin/users`.
Si el usuario quiere literalmente un `useX()` cliente, es la pregunta 1 (+3 archivos).

### D2 — Fuente de las metricas
- `sold` = suma de `quantity` de las `lines` de las ordenes `paid` del evento (reusa `getTicketTotals(lines).quantity`
  de `@/modules/ticket`).
- `revenue` = suma de `Number(orders.totalAmount)` de esas ordenes (PEN).
- `capacity` = suma de `ticketTiers.totalStock` del evento.
- Union orden-evento por `orders.eventSlug = events.slug` (ver Contexto). Ordenes `pending|failed|cancelled` no cuentan.
- KPIs: `sold` y `revenue` suman todos los eventos del organizador; `published` cuenta `status = 'published'`.

### D3 — Eventos locales (`useOrganizerStore`) salen del dashboard
El dashboard muestra solo eventos de la DB. Los creados con el formulario (localStorage) dejan de aparecer en
`/organizer` (siguen en el catalogo via `use-catalog-events.ts` y editables por `?draft=`). Mezclarlos falsearia los
KPIs "reales", que es lo que pide el usuario. Ver pregunta 3.

### D4 — Alcance por rol
Cada viewer ve solo los eventos con `organizerId = viewer.id`, tambien `admin`/`super_admin` (pregunta 2).

## Reuso detectado
- `src/modules/user/services/user-access.service.ts:27` `requireRole` + `ORGANIZER_AREA_ROLES`
  (`user.constants.ts:8`) — guard de layout, pages y servicio. Exportados en `@/modules/user`.
- `src/modules/admin/components/admin-shell.tsx:84-104` — patron de `viewer` por props + `SignOutButton` de
  `@clerk/nextjs` para el logout.
- `src/app/(admin)/admin/users/page.tsx` — patron page async: `requireRole` -> servicio -> componente.
- `src/lib/db.ts` (`db`), tablas `events`, `ticketTiers`, `orders` (imports directos de `modules/*/db/*.table.ts`,
  igual que `scripts/seed-events.ts`).
- `@/modules/ticket` `getTicketTotals` — cantidad de entradas de un `TicketLine[]`.
- `@/modules/event` `formatEventDate`, `formatEventPrice`, `getEventHref` — ya usados por la lista.
- `organizer-kpis.tsx` — **sin cambios**: su prop `OrganizerKpis` (`sold`, `revenue`, `published`) se mantiene.
- `filterOrganizerEvents` (`organizer.utils.ts:71`) — se generaliza, no se duplica.
- `import "server-only"` + `vi.mock("server-only", () => ({}))` — patron de `checkout.service.ts:1` y su test.
- `getInitials` de `@/modules/auth` — sigue en el shell.
- No hay shadcn nuevo: la lista y los KPIs se mantienen con su markup actual.

## Contratos

```ts
// src/modules/organizer/types/organizer.types.ts (agregar)
export type OrganizerDbEventStatus = "draft" | "published" | "cancelled"; // = events.status

export interface OrganizerEventSummary {
  id: string;
  slug: string;
  title: string;
  status: OrganizerDbEventStatus;
  startsAt: string; // ISO (serializable a client components)
  city: string;
  imageUrl: string;
  capacity: number;
  sold: number;
  revenue: number; // PEN
}
// OrganizerEventFilter no cambia ("all" | "draft" | "published"); "cancelled" solo aparece en "all".

// src/modules/organizer/utils/organizer.utils.ts
export interface OrganizerEventRow {          // fila de la query de eventos
  id: string; slug: string; title: string; status: OrganizerDbEventStatus;
  startsAt: Date; city: string; imageUrl: string; capacity: number;
}
export interface PaidOrderRow {               // fila de la query de ordenes pagadas
  eventSlug: string; totalAmount: string; lines: readonly TicketLine[];
}
export function summarizeOrganizerEvents(
  events: readonly OrganizerEventRow[],
  paidOrders: readonly PaidOrderRow[],
): OrganizerEventSummary[];                   // conserva el orden de `events`; sin ordenes -> sold 0, revenue 0
export function getOrganizerKpis(
  events: readonly Pick<OrganizerEventSummary, "sold" | "revenue" | "status">[],
): OrganizerKpis;                             // cambia de firma (antes OrganizerEvent[])
export function filterOrganizerEvents<T extends { status: string }>(
  events: readonly T[], filter: OrganizerEventFilter,
): T[];
// Se eliminan getEventSold y getEventRevenue (sin consumidores tras esta spec) y sus asserts en el test.
// getOrganizerEvents, getEventCapacity, getEventPriceFrom, toEventIsoDate, createId no cambian (los usa event-form).

// src/modules/organizer/services/organizer-events.service.ts
import "server-only";
// 1) const viewer = await requireRole(ORGANIZER_AREA_ROLES)
// 2) eventos WHERE events.organizerId = viewer.id ORDER BY startsAt DESC,
//    capacity = coalesce((select sum(total_stock) from ticket_tiers where event_id = events.id), 0)::int
// 3) si hay eventos: orders (eventSlug, totalAmount, lines) WHERE status = 'paid' AND eventSlug IN (slugs)
// 4) return summarizeOrganizerEvents(rows, paidOrders)
// ponytail: agrega ordenes en memoria; pasar a SUM/GROUP BY en SQL cuando el volumen lo pida o existan order_items.
export async function listOrganizerEvents(): Promise<OrganizerEventSummary[]>;
// NO se exporta desde src/modules/organizer/index.ts: el barrel lo importan client components
// (modules/catalog/hooks/use-catalog-events.ts, catalog/components/local-event-pages.tsx) y "server-only" romperia
// ese bundle. Las pages lo importan por ruta: "@/modules/organizer/services/organizer-events.service".

// src/modules/organizer/components/organizer-shell.tsx
export interface OrganizerShellProps {
  viewer: Pick<UserEntity, "fullName" | "email">; // import type desde @/modules/user
  children: ReactNode;
}

// src/modules/organizer/components/organizer-dashboard.tsx ("use client" por el estado del filtro)
export interface OrganizerDashboardProps { events: readonly OrganizerEventSummary[] }

// src/modules/organizer/components/organizer-event-list.tsx
export interface OrganizerEventListProps {
  events: readonly OrganizerEventSummary[];
  filter: OrganizerEventFilter;
  onFilterChange: (filter: OrganizerEventFilter) => void;
}
// Fila: title, formatEventDate(startsAt) + city, imageUrl, badge (Publicado | Borrador | Cancelado),
// sold / capacity + progressbar, revenue ("—" en borrador), accion "Ver evento" -> getEventHref(slug) solo si
// published (los borradores de DB no son editables en el form local: sin accion).
```

Routing (sin logica de negocio):

```tsx
// src/app/(organizer)/layout.tsx
export default async function OrganizerLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireRole(ORGANIZER_AREA_ROLES);
  return <OrganizerShell viewer={{ fullName: viewer.fullName, email: viewer.email }}>{children}</OrganizerShell>;
}
// src/app/(organizer)/organizer/page.tsx
//   const events = await listOrganizerEvents();  return <OrganizerDashboard events={events} />;
// src/app/(organizer)/organizer/events/new/page.tsx
//   async; await requireRole(ORGANIZER_AREA_ROLES) antes del <Suspense><EventForm /></Suspense> actual.
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Tipo `OrganizerEventSummary`; utils `summarizeOrganizerEvents`, `getOrganizerKpis` (nueva firma), `filterOrganizerEvents` generico; borrar `getEventSold`/`getEventRevenue`; actualizar tests | src/modules/organizer/types/organizer.types.ts, src/modules/organizer/utils/organizer.utils.ts, src/modules/organizer/utils/organizer.utils.test.ts | - | S |
| T2 | Servicio `listOrganizerEvents` (server-only, requireRole, 2 queries) + test | src/modules/organizer/services/organizer-events.service.ts, src/modules/organizer/services/organizer-events.service.test.ts | T1 | P1 |
| T3 | Dashboard y lista sobre `OrganizerEventSummary` (sin mock/store/useAuthStore) | src/modules/organizer/components/organizer-dashboard.tsx, src/modules/organizer/components/organizer-event-list.tsx | T1 | P1 |
| T4 | `OrganizerShell` con `viewer` por props + `SignOutButton`; quitar `useAuthStore`, `useIsClient`, redirect y skeleton | src/modules/organizer/components/organizer-shell.tsx | - | P1 |
| T5 | Routing: layout async con `requireRole` + viewer; page `/organizer` con `listOrganizerEvents`; guard en `/organizer/events/new` | src/app/(organizer)/layout.tsx, src/app/(organizer)/organizer/page.tsx, src/app/(organizer)/organizer/events/new/page.tsx | T2, T3, T4 | S |

Orden: T1 -> (T2 ‖ T3 ‖ T4) -> T5. 5 tareas, 11 archivos (9 de producto + 2 tests). Supera en 1 el tope de ~8 por el
guard de `/organizer/events/new` (una linea), que no se puede omitir: al quitar el guard cliente del shell esa page
quedaria abierta. `organizer-kpis.tsx` e `index.ts` no se tocan.

## Criterios de aceptacion
- [ ] AC1: Sin sesion, `/organizer` y `/organizer/events/new` redirigen a `/login`; con rol `customer`, a `/`; con
  `organizer`, `admin` o `super_admin` renderizan (verificable con `curl -I` sin cookie -> 307 a `/login`).
- [ ] AC2: El sidebar y el drawer muestran `fullName` y `email` del usuario de la DB; el boton "Cerrar sesion" cierra la
  sesion de Clerk y vuelve a `/`. Ya no hay loop `/organizer` <-> `/login` ni skeleton de hidratacion.
- [ ] AC3: Con el organizador de `SEED_ORGANIZER_EMAIL` (seed 025), "Mis eventos" lista exactamente sus filas de
  `events` (mismo conteo que `select count(*) from events where organizer_id = <id>`), ordenadas por `starts_at` desc.
  Otro usuario `organizer` sin eventos ve "No hay eventos en esta vista." y KPIs en 0.
- [ ] AC4: "Entradas vendidas" = suma de `quantity` de `lines` de las ordenes `paid` cuyos `event_slug` pertenecen a
  sus eventos; "Ingresos" = suma de su `total_amount`; "Eventos publicados" = eventos con `status = 'published'`.
  Tras pagar una compra de prueba con Stripe, los tres valores de ese evento/KPI suben al recargar. Ordenes
  `pending`/`failed`/`cancelled` no cambian los numeros.
- [ ] AC5: Cada fila muestra `sold / capacity` con capacity = suma de `total_stock` de sus `ticket_tiers`; "Ver evento"
  apunta a `/events/<slug>` solo en publicados; un evento `cancelled` muestra badge "Cancelado" y solo aparece en el
  filtro "Todos".
- [ ] AC6: `organizer-dashboard.tsx`, `organizer-event-list.tsx` y `organizer-shell.tsx` no importan
  `ORGANIZER_EVENTS_MOCK`, `useOrganizerStore`, `useAuthStore` ni `useIsClient`.
- [ ] AC7: `listOrganizerEvents` no se exporta desde `src/modules/organizer/index.ts` y `npm run build` no falla por
  `server-only` en bundles cliente.
- [ ] AC8: `/organizer/events/new` sigue funcionando como antes (guardar borrador/publicar en localStorage).
- [ ] AC9: `npx tsc --noEmit`, `npm run lint` y `npx vitest run` sin errores.

## Tests requeridos
- `organizer.utils.test.ts` (actualizar):
  - `summarizeOrganizerEvents`: suma `sold` (via lines) y `revenue` (totalAmount string -> number) solo del evento
    con el slug correspondiente; evento sin ordenes -> 0/0; conserva orden y `capacity`; `startsAt` sale como ISO.
  - `getOrganizerKpis`: totales de sold/revenue y `published` ignorando `draft`/`cancelled`.
  - `filterOrganizerEvents`: con summaries, `"published"` excluye `cancelled`, `"all"` lo incluye.
  - Quitar los asserts de `getEventSold`/`getEventRevenue`; los de `getOrganizerEvents`/`toEventIsoDate` se mantienen.
- `organizer-events.service.test.ts` (nuevo; mocks `server-only`, `@/lib/db`, `@/modules/user` como en
  `user-admin.service.test.ts` / `checkout.service.test.ts`):
  - llama a `requireRole` con `ORGANIZER_AREA_ROLES` antes de consultar la DB;
  - sin eventos devuelve `[]` y no consulta `orders`;
  - con eventos devuelve el resultado de unir filas + ordenes (verifica un `sold`/`revenue`).
- Componentes: opcional (presentacionales). No se exige test del shell.

## Preguntas abiertas
1. **"Hook" (D1):** default = funcion de servidor `listOrganizerEvents()` con el guard adentro. Si se quiere un hook
   cliente `useOrganizerEvents()` (TanStack Query + `GET /api/organizer/events` + `QueryClientProvider`), son +3
   archivos y se agrega como fase 2 reutilizando el mismo servicio. Confirmar.
2. **Alcance por rol (D4):** default = cada uno ve solo sus eventos (`organizerId = viewer.id`), tambien admin y super
   admin (que hoy no tienen eventos propios y verian el panel vacio). Alternativa: `admin`/`super_admin` ven todos.
   Es la misma pregunta abierta 3 de la 024 ("si admin deberia ver todos los eventos").
3. **Eventos locales (D3):** default = dejan de mostrarse en el dashboard. Alternativa: listarlos debajo como
   "Borradores locales" sin sumar a los KPIs (+1 componente).
4. **Union por slug (D2):** las metricas dependen de que `orders.event_slug` coincida con `events.slug` (cierto hoy
   por el seed 025). Si un evento de DB cambia de slug, sus ventas previas dejan de contarse hasta que el checkout
   escriba `orders.event_id`. Default: aceptar.

## Estado
- Aprobacion humana: aprobada (2026-10-02)
- Fase: APPROVED
- Log de review: Iteracion 1 — APPROVED. 2 hallazgos menores sin bloquear (ver historial del reviewer): test de orden requireRole/query en organizer-events.service.test.ts, comentario desactualizado en organizer-dashboard.tsx:22.
