# 031 — Hero de la landing con eventos reales + destacar desde el panel de organizador

Estado: implementada
Aprobacion humana: aprobada

## Objetivo
Pedido del usuario: "Usar datos reales en la landing page. Agregar una opcion en el panel de admin para poder
destacar los eventos y estos sean parte del carousel del Hero [...] poder marcar esta opcion de destacado tanto
desde el listado como al entrar a editar un evento."

Hallazgo clave (cambia el alcance esperado): la columna `events.is_featured` **ya existe** en la base de datos
(`src/modules/event/db/event.table.ts:34`, migrada; el seed la llena desde `EVENTS_MOCK`,
`src/modules/event/utils/event-seed.utils.ts:47`). **No se necesita migracion nueva.** Lo que falta es: (a) que el
Hero de la landing lea esa columna desde la DB en vez de `EVENTS_MOCK`, y (b) una mutacion para que un organizador
cambie `is_featured` de sus eventos.

Patron de referencia (reutilizar, no reinventar): `docs/specs/030-organizer-event-crud.md` ya implementada
(`src/modules/organizer/services/organizer-event-admin.service.ts`, `.../actions/organizer-event.actions.ts`)
resuelve el mismo problema para `events.status` (scope por rol + action + dialogo). Esta spec agrega `is_featured`
al mismo molde. `docs/specs/029-organizer-dashboard-real-data.md` define `OrganizerEventSummary` y
`listOrganizerEvents()`, que tambien se tocan aqui (una columna mas).

Estado actual relevante:
- `src/app/(main)/page.tsx:21` usa `getFeaturedEvents(EVENTS_MOCK)` (util pura sobre el mock) para el
  `<HeroCarousel />`. El resto del catalogo publico (`TrendingSidebar`, `BestSellerEvents`,
  `CatalogUpcomingEvents`) tambien usa mocks/localStorage (`use-catalog-events.ts`); migrarlo completo es la
  "Fase 3" ya anotada en el backlog de la spec 029 y **no** es parte de este pedido (solo pide el Hero).
- `HeroCarousel` (`src/modules/event/components/hero-carousel.tsx`) ya devuelve `null` si `events.length === 0`
  (linea 25): el fallback "sin destacados -> no se muestra el Hero" ya existe, no hay que construirlo.
- El panel de organizador (`organizer-event-list.tsx`) no tiene columna ni control de "Destacado". No existe una
  pagina de edicion de contenido del evento contra DB: `event-form.tsx` (creacion) sigue en `localStorage`
  (Fase 2 de la spec 030, backlog, no implementada). Por eso "marcar destacado al entrar a editar un evento" no
  tiene hoy una pagina de edicion donde vivir — ver Alcance y Preguntas abiertas.

## Alcance
- Incluye:
  - Servicio publico (sin auth, server-only) que lee de `events` los que tienen `is_featured = true` y
    `status = 'published'`, para el Hero de la landing.
  - `src/app/(main)/page.tsx` pasa a `async` y usa ese servicio para `<HeroCarousel />` (solo el Hero; el resto de
    la pagina sigue igual).
  - Columna `is_featured` expuesta en `OrganizerEventSummary` / `listOrganizerEvents()`.
  - Mutacion `setEventFeatured` (servicio) + `setEventFeaturedAction` (server action), mismo patron de scope por
    rol que `changeEventStatus`/`deleteEvent` (030).
  - Control "Destacado" en el listado de `/organizer` (toggle por fila).
- No incluye:
  - Migracion de base de datos (la columna ya existe).
  - Migrar el resto del catalogo publico (busqueda, `/events`, tendencias, mas vendidos) a la DB: siguen en mock
    (Fase 3 de la 029, fuera de este pedido).
  - Pagina de edicion de contenido de un evento contra DB (Fase 2 de la 030): no existe hoy, construirla completa
    esta fuera de esta sesion. Ver Preguntas abiertas 1 y Proximas fases.
  - Validar que un evento deba estar `published` para poder marcarse como destacado: se permite marcar cualquier
    estado; el Hero igual solo muestra los que ademas estan `published` (filtro en el servicio de lectura, D1).
  - Limite configurable o reordenable manualmente del carousel (orden y tope fijos, ver D2).

## Reutilizar
- `src/modules/organizer/services/organizer-event-admin.service.ts`: `getEventScope`, patron de `changeEventStatus`
  (select con scope -> `update ... where id and scope returning id`) — se clona para `setEventFeatured`.
- `src/modules/organizer/actions/organizer-event.actions.ts`: `toFieldErrors`, `RELEVANT_FIELDS`, patron de action
  (`requireRole` -> `safeParse` -> servicio -> `revalidatePath(ORGANIZER_PATH)`).
- `src/modules/user`: `requireRole`, `ORGANIZER_AREA_ROLES`.
- `src/modules/event/components/hero-carousel.tsx`: ya maneja el caso "sin eventos" (`return null`); solo cambia el
  tipo de su prop `events`.
- `src/lib/db.ts` (`db`), operadores `and`/`eq`/`asc` de `drizzle-orm` (ya usados en los servicios existentes).
- `lucide-react` (`Star`), ya es dependencia del proyecto (usado en otros iconos del panel).
- No se instala nada de shadcn nuevo: el control de la lista es un boton (icono), igual que
  `OrganizerEventActions` ya usa `Button variant="ghost" size="icon-sm"`.

## Archivos
Nuevos:
- `src/modules/event/services/featured-event.service.ts`
- `src/modules/event/services/featured-event.service.test.ts`
- `src/modules/organizer/components/organizer-event-featured-toggle.tsx`

Modificados:
- `src/modules/event/types/event.types.ts` (tipo `FeaturedEvent`)
- `src/modules/event/components/hero-carousel.tsx` (prop `events` mas angosta)
- `src/modules/event/index.ts` (export de tipo `FeaturedEvent`)
- `src/app/(main)/page.tsx` (async, Hero con datos reales)
- `src/modules/organizer/types/organizer.types.ts` (`isFeatured` en `OrganizerEventSummary`; `"featured"` en
  `fieldErrors` de `EventAdminActionState`)
- `src/modules/organizer/schemas/event-admin.schema.ts` (`setEventFeaturedSchema`)
- `src/modules/organizer/utils/organizer.utils.ts` + `.test.ts` (`OrganizerEventRow`/`summarizeOrganizerEvents`
  incluyen `isFeatured`)
- `src/modules/organizer/services/organizer-event-admin.service.ts` + `.test.ts` (`setEventFeatured`)
- `src/modules/organizer/services/organizer-events.service.ts` (selecciona `isFeatured`)
- `src/modules/organizer/actions/organizer-event.actions.ts` + `.test.ts` (`setEventFeaturedAction`)
- `src/modules/organizer/components/organizer-event-list.tsx` (columna/control "Destacado")

## Decisiones (default propuesto; confirmar al aprobar)

### D1 — Que entra al Hero
`is_featured = true` **y** `status = 'published'` (un destacado en borrador o cancelado no se publicita). Orden
`starts_at` ascendente (el mas proximo primero) y tope `LIMIT 8` (numero arbitrario, solo para no mandar un
carousel sin fin si algun dia hay muchos destacados). Sin destacados -> el Hero no se renderiza (comportamiento ya
existente de `HeroCarousel`, no se toca).

### D2 — Forma de los datos del Hero
`HeroCarousel` solo usa `id`, `slug`, `title`, `imageUrl`, `date`, `venue`, `city` (no `priceFrom`, `availability`,
`description`, etc., que requerirían unir `ticket_tiers` y no estan en el pedido). Se define un tipo propio
`FeaturedEvent` con esos campos (en vez de forzar el `EventEntity` completo del mock) y se angosta
`HeroCarouselProps.events` a `readonly FeaturedEvent[]`. Unico consumidor de `HeroCarousel` hoy es
`src/app/(main)/page.tsx` (verificado), así que el cambio de tipo no rompe nada mas.

### D3 — El servicio de lectura del Hero no usa `requireRole`
Es una pagina publica (`/`): no hay `viewer`. Solo filtra por `is_featured`/`status`, igual que cualquier query de
catalogo publico. No se exporta desde `src/modules/event/index.ts` (ese barrel lo importa `HeroCarousel`, que es
`"use client"`; `import "server-only"` ahi rompe el bundle cliente, mismo motivo documentado en
`organizer-events.service.ts`). La page lo importa por ruta directa.

### D4 — Donde vive el control de "destacado" en el organizer (ver Preguntas abiertas 1)
Por ahora solo existe el **listado** (`organizer-event-list.tsx`); no hay pagina de edicion de contenido contra DB
todavia (Fase 2 de la 030 sigue sin construir). Default: el toggle del listado es la unica superficie de esta fase;
"marcar al editar" queda para cuando exista esa pagina (Proximas fases), donde se reutiliza la misma action sin
archivos nuevos.

### D5 — Mutacion sin dialogo de confirmacion
A diferencia de publicar/cancelar/eliminar (030), destacar/quitar destacado no es destructivo ni irreversible: el
boton de la fila envia el formulario directo (sin `Dialog`), como un toggle. Mismo patron `useActionState` que
`ConfirmDialogBody`, pero sin modal.

## Criterios de aceptacion
- AC1: La home (`/`) muestra en el Hero solo eventos con `is_featured = true` y `status = 'published'` en la DB,
  ordenados por `starts_at` ascendente, maximo 8. Si no hay ninguno, la seccion del Hero no se renderiza (sin
  error).
- AC2: El contenido de cada slide (titulo, fecha, venue+ciudad, imagen, link "Comprar entradas") sale de columnas
  reales de `events` (no de `EVENTS_MOCK`) para los eventos destacados.
- AC3: En `/organizer`, cada fila del listado tiene un control "Destacado" (icono/boton) que refleja
  `events.is_featured` del evento. Un `organizer` solo puede cambiarlo en sus propios eventos; `admin`/`super_admin`
  en cualquiera. Al activarlo/desactivarlo, la fila se actualiza (via `revalidatePath`) sin recargar manualmente.
- AC4: Un `organizer` que envia `setEventFeaturedAction` con el `eventId` de un evento de otro organizador no
  cambia la DB (mismo scope que `changeEventStatus`/`deleteEvent`, verificable en el test del servicio).
- AC5: Sin sesion o con rol `customer`, invocar `setEventFeaturedAction` redirige (`requireRole`) sin tocar la DB.
- AC6: Un `eventId` invalido (no uuid) o un `featured` fuera de `"true"/"false"` devuelve `status: "error"` con
  `fieldErrors` y no llama al servicio.
- AC7: Marcar como destacado un evento `draft` o `cancelled` no falla (la regla D1 solo afecta la lectura del
  Hero, no la mutacion).
- AC8: `src/modules/event/services/featured-event.service.ts` y
  `src/modules/organizer/services/organizer-event-admin.service.ts` no se exportan desde el barrel de su modulo;
  `npm run build` no falla por `server-only` en bundles cliente.
- AC9: `npx tsc --noEmit`, `npm run lint` y `npx vitest run` sin errores.

## Tests requeridos
- `featured-event.service.test.ts` (nuevo; mock `server-only` + `@/lib/db` con `select/from/where/orderBy/limit`
  encadenable, patron de `organizer-events.service.test.ts`):
  - la query filtra por `is_featured = true` y `status = 'published'` (verificar los argumentos del `where`);
  - aplica `limit(8)`;
  - mapea `startsAt` (Date) a `date` (ISO string) en el resultado.
- `organizer.utils.test.ts` (actualizar): `summarizeOrganizerEvents` conserva `isFeatured` de `OrganizerEventRow`
  en el `OrganizerEventSummary` resultante (true y false).
- `organizer-event-admin.service.test.ts` (agregar): `setEventFeatured` — sin fila en el scope -> `not-found` sin
  llamar `update`; con fila -> `update` llamado con `isFeatured` del input y `{ ok: true }`; respeta `getEventScope`
  (organizer vs admin), mismo patron que los tests existentes de `changeEventStatus`.
- `organizer-event.actions.test.ts` (agregar): `setEventFeaturedAction` — `requireRole` primero (si lanza, no se
  llama el servicio); input invalido -> `fieldErrors` sin llamar al servicio; exito -> `revalidatePath(ORGANIZER_PATH)`
  y mensaje distinto segun `featured` true/false; error `not-found` -> mensaje correspondiente.
- `organizer-event-list.tsx` / `organizer-event-featured-toggle.tsx`: opcional (UI simple, condicional solo en el
  icono segun `isFeatured`); no se exige test RTL salvo que el reviewer lo pida.

## Tareas
### T1 — Hero de la landing con datos reales
- Archivos: src/modules/event/types/event.types.ts, src/modules/event/services/featured-event.service.ts, src/modules/event/services/featured-event.service.test.ts, src/modules/event/components/hero-carousel.tsx, src/modules/event/index.ts, src/app/(main)/page.tsx
- Depende de: —
- Paralelizable: sí
- Cubre: AC1, AC2, AC8 (parte event), AC9

### T2 — Tipos, schema y util de "featured" en organizer
- Archivos: src/modules/organizer/types/organizer.types.ts, src/modules/organizer/schemas/event-admin.schema.ts, src/modules/organizer/utils/organizer.utils.ts, src/modules/organizer/utils/organizer.utils.test.ts
- Depende de: —
- Paralelizable: sí (con T1)
- Cubre: base de AC3, AC6; tests de utils

### T3 — Servicio de mutación y lectura (`setEventFeatured`, `listOrganizerEvents` con `isFeatured`)
- Archivos: src/modules/organizer/services/organizer-event-admin.service.ts, src/modules/organizer/services/organizer-event-admin.service.test.ts, src/modules/organizer/services/organizer-events.service.ts
- Depende de: T2
- Paralelizable: no (serial tras T2; puede correr en paralelo con T1)
- Cubre: AC3 (datos), AC4, AC7, AC8 (parte organizer)

### T4 — Server action `setEventFeaturedAction`
- Archivos: src/modules/organizer/actions/organizer-event.actions.ts, src/modules/organizer/actions/organizer-event.actions.test.ts
- Depende de: T3
- Paralelizable: no
- Cubre: AC4, AC5, AC6

### T5 — Control "Destacado" en el listado del organizer
- Archivos: src/modules/organizer/components/organizer-event-featured-toggle.tsx, src/modules/organizer/components/organizer-event-list.tsx
- Depende de: T4
- Paralelizable: no
- Cubre: AC3

Orden: (T1 ‖ T2) -> T3 -> T4 -> T5. T1 es independiente y puede terminarse en paralelo con toda la cadena T2-T5.

## Preguntas abiertas
1. **"Al entrar a editar un evento" (D4):** hoy no existe una pagina de edicion de contenido de evento contra DB
   (Fase 2 de `docs/specs/030-organizer-event-crud.md` sigue sin implementarse; `event-form.tsx` solo crea
   borradores en `localStorage`). Default de esta spec: el toggle solo vive en el listado. Alternativas: (a)
   esperar a que se construya la pagina de edicion (Fase 2 de 030) y agregar ahi el mismo checkbox reutilizando
   `setEventFeaturedAction` (0 archivos nuevos en ese momento, trivial); (b) si se quiere "editar" ya, la opcion
   mas barata sin construir la pagina completa es un modal/drawer de edicion minimo ad-hoc — no incluido aqui por
   YAGNI (dupicaria trabajo de la 030 Fase 2). Recomendado: (a).
2. **Orden y tope del carousel (D1):** default `starts_at` ascendente, `LIMIT 8`. Si se prefiere otro orden (ej.
   `updated_at` desc, "recien destacados primero") o sin tope, se ajusta en una linea.
3. **Destacar eventos no publicados (D1/AC7):** default = permitido en la DB (no se bloquea en el toggle), pero no
   aparecen en el Hero hasta que ademas esten `published`. Si se prefiere bloquear el toggle para `draft`/`cancelled`
   (deshabilitarlo en la UI), es un cambio chico en T5 (+ condicion en el boton).

## Próximas fases
- Agregar el checkbox "Destacado" en la pagina de edicion de contenido del evento, cuando exista (Fase 2 de
  `docs/specs/030-organizer-event-crud.md`): reutiliza `setEventFeaturedAction` sin cambios.
- Migrar el resto del catalogo publico (`/events`, busqueda, tendencias, mas vendidos) de `EVENTS_MOCK` a la DB
  (Fase 3 ya anotada en `docs/specs/029-organizer-dashboard-real-data.md`).

## Log de review
- Sin review formal registrado; codigo y tests presentes (comprobado en P1-09, 2026-10-10). Suite completa (552 tests), tsc, eslint y build en verde.
