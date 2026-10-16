# 044 — Favoritos de eventos y suscripcion al newsletter

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Dos features independientes entre si:
(a) un usuario logueado marca/desmarca eventos como favoritos (corazon en la tarjeta y en el detalle) y ve su lista en
`/favorites`;
(b) cualquier visitante deja su correo en el formulario de newsletter de la landing y queda guardado en la DB.
Referencias: `026` (proxy y `protected-routes.ts`), `040/043` (patron de action + servicio + `requireRole`/sesion),
`034` (datos de eventos por slug). Referencia del profesor (solo lectura, esquema distinto): modulo `favorite` con tabla
`event_favorite`, accion idempotente `favorite: true|false` y boton optimista; se adopta la idea de la accion
idempotente y de la unicidad `(user_id, event_id)`, no el codigo (usa react-query y Clerk directo; aqui no hay
`QueryClientProvider`).

## Hallazgos (verificado en codigo)
- Los corazones **ya existen como stubs sin efecto**: `event-card.tsx` (boton "Agregar a favoritos" con
  `preventDefault`) y `event-detail-actions.tsx` (`useState` local "Guardar evento", renderizado por
  `event-detail-hero.tsx`). Se reemplazan, no se crean nuevos.
- `src/components/shared/newsletter-signup.tsx` **ya existe** como stub (`onSubmit={e => e.preventDefault()}`) y se usa
  solo en `src/app/(main)/page.tsx` (landing). El pie (`site-footer.tsx`) no tiene formulario.
- `EventEntity.id` == `events.id` (uuid) (`toEventEntity`). `listEventsBySlugs(slugs)` (`event.service.ts`) devuelve
  `EventEntity[]` de cualquier estado, ordenado por `starts_at`.
- Usuario actual en DB: `getCurrentDbUser()` (null sin sesion o sin fila sincronizada) y `requireRole()`; ambos en
  `@/modules/user`. `users.id` es uuid; `users.deleted_at` marca soft delete.
- No hay `QueryClientProvider` ni `sonner`: el estado optimista se hace con React (`useOptimistic`/`useTransition`) y
  server actions.
- Login con retorno: `getAuthHref("/login", pathname)` -> `/login?redirect=...` (`@/modules/auth`, ya valida
  open-redirect con `getSafeRedirect`). `LoginForm` ya respeta `?redirect=`.
- `src/app/(main)/layout.tsx` ya es dinamico (lee `getCurrentDbUser()` para el header).
- `drizzle.config.ts` toma `./src/modules/*/db/*.table.ts`; `src/db/schema.ts` re-exporta las tablas para `db`.
- Drizzle omite el prefijo de tabla en selects/subconsultas de una sola tabla: calificar a mano si hay SQL crudo.
- Next 16: las server actions son alcanzables por POST directo; la sesion se verifica **dentro** de la accion
  (`01-app/01-getting-started/07-mutating-data.md`), no solo en la UI.

## Decisiones
1. **Dos modulos** (`src/modules/favorite`, `src/modules/newsletter`): dominios distintos, sin dependencia mutua.
2. **Favoritos — modelo**: tabla `favorites(user_id uuid FK users.id ON DELETE CASCADE, event_id uuid FK events.id
   ON DELETE CASCADE, created_at)` con **PK compuesta `(user_id, event_id)`** (es la clave unica; sin `id` surrogate,
   YAGNI) e indice por `event_id`. Archivo `src/modules/favorite/db/favorite.table.ts` (patron `*.table.ts`).
3. **Favoritos — operacion idempotente**: `setFavorite({ eventId, favorite })` (estado deseado, no "invertir"):
   `favorite=true` => `INSERT ... ON CONFLICT DO NOTHING`; `false` => `DELETE`. Reintentos o doble clic no rompen nada.
   Para `true` se exige que el evento exista y este `published` (select previo; si no => `not-found`; asi no se
   favorita un borrador/cancelado). Desmarcar siempre se permite.
4. **Favoritos — autorizacion/IDOR**: la action obtiene el usuario con `getCurrentDbUser()` en servidor; el `userId`
   **nunca** viene del cliente. Sin sesion => la action devuelve `{ status: "unauthenticated" }` (no `redirect`, para
   que la UI mande a login con retorno). Cualquier rol logueado puede tener favoritos (no solo `customer`). Todas las
   consultas filtran por `user_id = usuario actual`; no hay lectura de favoritos ajenos.
5. **Favoritos — estado en UI sin tocar cada pagina**: un `FavoritesProvider` (cliente) montado en
   `src/app/(main)/layout.tsx` recibe `userId?`/`favoriteEventIds` (una consulta por request, solo si hay sesion) y
   expone `useFavorite(eventId)`. `FavoriteButton` lo consume: asi `EventCard` (usado en 5+ sitios) y el detalle no
   necesitan props nuevas de datos. El estado vive en el provider (se actualiza al instante y sobrevive a la navegacion
   cliente dentro del layout); rollback si la action falla.
6. **Sin sesion**: `FavoriteButton` hace `router.push(getAuthHref("/login", pathnameActual+search))`; tras login vuelve
   a la misma pagina. No se aplica el favorito automaticamente tras el login (el usuario vuelve a pulsar). Las paginas
   publicas **no** entran al proxy.
7. **Lista**: ruta `/favorites` **protegida** (se agrega `"/favorites(.*)"` a `protected-routes.ts`, y su test).
   `listFavoriteEventSlugs(userId)` hace JOIN `favorites`-`events` con `events.status = 'published'` y
   `starts_at >= now()` (mismo criterio del catalogo), orden `favorites.created_at DESC`; la page convierte slugs a
   `EventEntity` con `listEventsBySlugs` y respeta el orden devuelto por el servicio de favoritos. Cancelados,
   borradores y eventos pasados **no se listan** (la fila se conserva; si se republica, reaparece). Estado vacio con
   `EmptyState` + enlace a `/events`. Enlace "Mis favoritos" en `UserMenu` (inline y sheet).
8. **Newsletter — modelo**: tabla `newsletter_subscribers(id uuid PK, email text NOT NULL UNIQUE, created_at)`. Email
   normalizado (`trim` + `toLowerCase`) por zod antes de guardar; unicidad en DB sobre el valor normalizado.
9. **Newsletter — idempotente sin revelar**: `INSERT ... ON CONFLICT (email) DO NOTHING`; la action devuelve siempre
   `success` con el mismo mensaje ("Listo, te avisaremos de novedades") exista o no el correo. Email invalido => error
   de validacion (eso no revela datos de otros).
10. **Newsletter — spam basico barato**: campo honeypot oculto (`website`, `tabIndex=-1`, `autoComplete="off"`,
    `aria-hidden`); si llega con valor, la action responde `success` sin insertar. Sin rate limit (no hay
    infraestructura; ver Riesgos). Email limitado a 254 caracteres.
11. **Newsletter — SIN envio de correo**: no hay proveedor; solo se persiste el correo. **Baja/unsubscribe: diferida**
    (no hay correos, por lo tanto tampoco enlace de baja; se disenara junto con el envio, anadiendo un token). Se
    documenta como riesgo de privacidad (ver Riesgos).
12. **Newsletter — ubicacion**: la seccion `NewsletterSignup` ya esta en la landing; se **mueve** a
    `src/modules/newsletter/components/newsletter-signup.tsx` y se conecta a la action. **No** se duplica en el pie
    (la landing basta; ver pregunta 2).
13. **Sin react-query, sin zustand**: el estado de favoritos es un `useState` en el provider; `useActionState` para el
    formulario del newsletter.

## Alcance
- Incluye: migracion `0010` con `favorites` y `newsletter_subscribers`; modulo `favorite` (tabla, schema zod,
  servicio, action, provider, boton, page `/favorites`); corazon real en `EventCard` y en el detalle; proteccion de
  `/favorites`; enlace "Mis favoritos" en el menu de usuario; modulo `newsletter` (tabla, schema, servicio, action,
  componente movido y conectado, honeypot); tests.
- No incluye (diferido):
  - Envio de correos, confirmacion double opt-in, baja/unsubscribe, panel admin de suscriptores, exportacion.
  - Contador publico de favoritos por evento, notificaciones al favorito (cambio de fecha, cancelacion), compartir
    lista, orden/filtros en `/favorites`, paginacion (el limite practico es el techo del catalogo).
  - Aplicar el favorito automaticamente tras login.
  - Rate limiting / captcha.
  - Newsletter en el pie de pagina (pregunta 2).
  - Cambios en `proxy.ts` (solo en `protected-routes.ts`).

## Reutilizar
- `getCurrentDbUser`, `UserEntity` (`@/modules/user`); `db` (`@/lib/db`); `pgErrorCode` (`@/lib/pg-error`) si se
  captura la FK.
- `getAuthHref` (`@/modules/auth`) para login con retorno.
- `listEventsBySlugs` (`@/modules/event/services/event.service`, por ruta directa: arrastra `server-only`/`db`),
  `EventCard`, `getEventHref` (`@/modules/event`).
- `EmptyState` (`@/components/shared/empty-state`), `Button`, `Input`, `Field` (shadcn ya instalados; no hay que
  instalar nada).
- Patron de action: `venue.actions.ts` (`"use server"`, `safeParse`, `console.error` + mensaje generico, estado
  discriminado) y su test (`vi.mock("@/modules/user")`); patron de tabla: `*.table.ts` + re-export en `src/db/schema.ts`;
  grilla de tarjetas: `event-search-results.tsx` (`<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">`).
- `src/components/shared/newsletter-signup.tsx` (se mueve; su markup se conserva).
- Tests de referencia: `event-card.test.tsx`, `protected-routes.test.ts`, `venue.actions.test.ts`,
  `venue.schema.test.ts`.

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/favorite/db/favorite.table.ts` | nuevo: tabla `favorites` (PK `(user_id, event_id)`, FKs cascade, indice `event_id`) |
| `src/modules/newsletter/db/newsletter-subscriber.table.ts` | nuevo: tabla `newsletter_subscribers` (email unico) |
| `src/db/schema.ts` | agrega 2 `export *` |
| `drizzle/0010_*.sql` + `drizzle/meta/*` | generado con `npx drizzle-kit generate` (NO se aplica) |
| `src/lib/protected-routes.ts` + `protected-routes.test.ts` | agrega `/favorites(.*)` y caso en el test |
| `src/modules/favorite/schemas/favorite.schema.ts` + `.test.ts` | `setFavoriteSchema` (`eventId` uuid, `favorite` boolean) |
| `src/modules/favorite/types/favorite.types.ts` | `FavoriteActionState` (`success | unauthenticated | not-found | error`) |
| `src/modules/favorite/services/favorite.service.ts` + `.test.ts` | `server-only`: `setFavorite`, `listFavoriteEventIds`, `listFavoriteEventSlugs` |
| `src/modules/favorite/actions/favorite.actions.ts` + `.test.ts` | `setFavoriteAction` |
| `src/modules/favorite/components/favorites-provider.tsx` | provider cliente + `useFavorite` |
| `src/modules/favorite/components/favorite-button.tsx` + `.test.tsx` | boton corazon (`aria-pressed`, login si anonimo) |
| `src/modules/favorite/index.ts` | barrel **solo cliente-seguro** (`FavoritesProvider`, `FavoriteButton`); servicio por ruta directa |
| `src/modules/event/components/event-card.tsx` + `event-card.test.tsx` | reemplaza el stub por `FavoriteButton` |
| `src/modules/event/components/event-detail-actions.tsx` + `event-detail-hero.tsx` | `FavoriteButton` en lugar del `useState`; pasa `eventId` |
| `src/app/(main)/layout.tsx` | carga ids favoritos (si hay sesion) y monta `FavoritesProvider` |
| `src/app/(main)/favorites/page.tsx` | page servidor: usuario, slugs, `listEventsBySlugs`, grilla de `EventCard` |
| `src/modules/auth/components/user-menu.tsx` | enlace "Mis favoritos" (inline y sheet) |
| `src/modules/newsletter/schemas/newsletter.schema.ts` + `.test.ts` | `subscribeSchema` (email normalizado, honeypot) |
| `src/modules/newsletter/services/newsletter.service.ts` + `.test.ts` | `server-only`: `subscribe(email)` |
| `src/modules/newsletter/actions/newsletter.actions.ts` + `.test.ts` | `subscribeAction` |
| `src/modules/newsletter/components/newsletter-signup.tsx` + `.test.tsx` | movido desde shared y conectado |
| `src/modules/newsletter/index.ts` | exporta `NewsletterSignup` |
| `src/components/shared/newsletter-signup.tsx` | **se elimina** |
| `src/app/(main)/page.tsx` | cambia el import de `NewsletterSignup` |

## Criterios de aceptacion
- AC1: la migracion `0010` solo crea `favorites` (PK `(user_id, event_id)`, FK a `users` y `events` con
  `ON DELETE CASCADE`, indice por `event_id`) y `newsletter_subscribers` (`email` UNIQUE); no toca otras tablas. No se
  aplica (lo hace el usuario con `npm run db:migrate`).
- AC2: `setFavoriteSchema` acepta `{eventId: uuid, favorite: boolean}` y rechaza `eventId` no uuid o `favorite` no
  booleano.
- AC3: `setFavorite` con `favorite=true` inserta con `ON CONFLICT DO NOTHING`; llamarlo dos veces deja una sola fila y
  no falla. Con `favorite=false` borra solo la fila `(userId, eventId)`; borrar una inexistente no falla.
- AC4: `setFavorite(true)` sobre un evento inexistente, `draft` o `cancelled` devuelve `not-found` y no inserta.
  `setFavorite(false)` funciona en cualquier estado.
- AC5: `setFavoriteAction` sin sesion (o sin fila `users`) devuelve `unauthenticated` sin tocar el servicio; con sesion
  llama al servicio con el `id` del usuario obtenido en servidor (el input no puede aportar `userId`); payload invalido
  devuelve `error` sin llamar al servicio; ante excepcion devuelve `error` generico y loguea.
- AC6: `listFavoriteEventSlugs(userId)` devuelve solo favoritos de ese usuario, de eventos `published` y futuros, orden
  `created_at DESC`; un usuario no ve favoritos de otro (el `WHERE` incluye `user_id`).
- AC7: `/favorites` esta en `isProtectedRoute` (y `/favorites/x` tambien); sin sesion el proxy redirige a login. La
  page muestra la grilla de `EventCard` o el `EmptyState` con enlace a `/events` si no hay favoritos.
- AC8: `FavoriteButton` con sesion: refleja el estado inicial (`aria-pressed`), cambia al instante al pulsar, llama a la
  action con el estado deseado y **revierte** si la action falla; se deshabilita mientras la accion esta pendiente. Sin
  sesion: no llama a la action y navega a `/login?redirect=<ruta actual>`.
- AC9: `EventCard` y el detalle del evento muestran el `FavoriteButton` real; pulsar el corazon de una tarjeta **no**
  navega al detalle (el enlace de la tarjeta no se dispara).
- AC10: `UserMenu` muestra "Mis favoritos" -> `/favorites` solo con sesion.
- AC11: `subscribeSchema` normaliza `"  Ana@Correo.COM "` a `"ana@correo.com"`, rechaza vacio, formato invalido y
  mas de 254 caracteres.
- AC12: `subscribe` inserta con `ON CONFLICT DO NOTHING`; suscribir dos veces el mismo correo (incluso con distinta
  capitalizacion) no falla y deja una fila.
- AC13: `subscribeAction` devuelve el mismo estado `success` para correo nuevo y repetido; con honeypot lleno devuelve
  `success` **sin** llamar al servicio; con email invalido devuelve `error` con mensaje de campo sin llamar al servicio;
  ante excepcion devuelve `error` generico y loguea.
- AC14: `NewsletterSignup` muestra mensaje de exito tras suscribir, mensaje de error de validacion, deshabilita el boton
  mientras envia, y el honeypot no es visible ni enfocable. Se renderiza en la landing y el stub de `shared` ya no
  existe (sin imports colgantes).
- AC15: `tsc`, `eslint` y `vitest` pasan. Verificacion manual (con migracion aplicada): marcar corazon logueado ->
  recargar -> sigue marcado -> aparece en `/favorites`; desmarcar -> desaparece; anonimo pulsa corazon -> login ->
  vuelve; cancelar el evento en admin -> desaparece de `/favorites`; suscribir un correo dos veces -> una fila.

## Tests requeridos
(Vitest, junto al archivo)
- `favorite.schema.test.ts` (AC2); `newsletter.schema.test.ts` (AC11).
- `favorite.service.test.ts` con `db` mockeado: insert con conflicto ignorado, delete acotado, `not-found` por estado,
  filtro por `user_id` (AC3, AC4, AC6). `newsletter.service.test.ts`: insert con `onConflictDoNothing` (AC12).
- `favorite.actions.test.ts` (`@/modules/user`, servicio y `next/cache` mockeados): AC5. `newsletter.actions.test.ts`:
  AC13.
- `favorite-button.test.tsx` (RTL, action y `next/navigation` mockeados, dentro de `FavoritesProvider`): estados inicial,
  optimista, rollback, anonimo -> login (AC8). `newsletter-signup.test.tsx` (AC14). `event-card.test.tsx` se ajusta
  (el boton ahora es "Agregar a favoritos"/estado via provider; AC9).
- `protected-routes.test.ts`: casos `/favorites` y `/favorites/x` (AC7).
- No automatizable sin DB real (manual): AC1 aplicada, AC15.

## Tareas
### T0 — Tablas, migracion y ruta protegida
- Archivos: `src/modules/favorite/db/favorite.table.ts`, `src/modules/newsletter/db/newsletter-subscriber.table.ts`,
  `src/db/schema.ts`, `drizzle/0010_*.sql`, `drizzle/meta/*`, `src/lib/protected-routes.ts`,
  `src/lib/protected-routes.test.ts`
- Depende de: —
- Paralelizable: no (bloquea a T1 y T2)
- Cubre: AC1, AC7 (proxy)
- Nota: el developer solo ejecuta `npx drizzle-kit generate`, revisa que el SQL sea el esperado (numero `0010`) y
  **no** ejecuta `db:migrate`.

### T1 — Favoritos: schema, servicio, action
- Archivos: `src/modules/favorite/schemas/favorite.schema.ts` y `.test.ts`, `src/modules/favorite/types/favorite.types.ts`,
  `src/modules/favorite/services/favorite.service.ts` y `.test.ts`, `src/modules/favorite/actions/favorite.actions.ts`
  y `.test.ts`
- Depende de: T0
- Paralelizable: si (con T2)
- Cubre: AC2, AC3, AC4, AC5, AC6

### T2 — Newsletter completo
- Archivos: `src/modules/newsletter/schemas/newsletter.schema.ts` y `.test.ts`,
  `src/modules/newsletter/services/newsletter.service.ts` y `.test.ts`,
  `src/modules/newsletter/actions/newsletter.actions.ts` y `.test.ts`,
  `src/modules/newsletter/components/newsletter-signup.tsx` y `.test.tsx`, `src/modules/newsletter/index.ts`,
  `src/components/shared/newsletter-signup.tsx` (eliminar), `src/app/(main)/page.tsx`
- Depende de: T0
- Paralelizable: si (con T1)
- Cubre: AC11, AC12, AC13, AC14

### T3 — Favoritos: provider, boton y corazones existentes
- Archivos: `src/modules/favorite/components/favorites-provider.tsx`, `src/modules/favorite/components/favorite-button.tsx`
  y `.test.tsx`, `src/modules/favorite/index.ts`, `src/modules/event/components/event-card.tsx`,
  `src/modules/event/components/event-card.test.tsx`, `src/modules/event/components/event-detail-actions.tsx`,
  `src/modules/event/components/event-detail-hero.tsx`, `src/app/(main)/layout.tsx`
- Depende de: T1
- Paralelizable: no (con T4: T4 necesita el corazon en las tarjetas)
- Cubre: AC8, AC9
- Nota: el layout llama a `listFavoriteEventIds` por ruta directa (servicio `server-only`); el barrel `index.ts` no
  exporta nada de servidor.

### T4 — Pagina /favorites y enlace en el menu
- Archivos: `src/app/(main)/favorites/page.tsx`, `src/modules/auth/components/user-menu.tsx`
- Depende de: T1, T3
- Paralelizable: no
- Cubre: AC6 (uso), AC7 (page), AC10

Orden: T0 -> (T1 || T2) -> T3 -> T4. Archivos disjuntos entre todas las tareas.

## Preguntas abiertas
1. Favoritos de eventos pasados/cancelados: default = no se listan (la fila se conserva). Alternativa: borrarlos o
   mostrarlos como "no disponible" (como hace Mis entradas).
2. Newsletter tambien en el pie de pagina: default = **no**, solo la seccion de la landing (ya existe). Agregarlo al
   `site-footer` es un componente compacto extra; confirmar si se quiere.
3. Baja/unsubscribe y confirmacion double opt-in: default = diferidas hasta que exista un proveedor de correo. Hasta
   entonces la baja es manual (DELETE en DB).
4. Rol que puede favoritar: default = cualquier usuario logueado (no solo `customer`).
5. Aplicar el favorito pendiente tras login: default = no (el usuario vuelve a pulsar el corazon).

## Riesgos
- **Privacidad**: se guardan correos sin consentimiento verificable ni baja (sin envio no hay uso, pero hay dato
  personal). Mitigacion: no exponer la tabla en ningun endpoint; definir baja antes de enviar el primer correo.
- **Spam/abuso**: el honeypot solo frena bots simples; sin rate limit se puede inflar la tabla. Aceptado por ahora.
- **Estado del provider vs servidor**: los ids de favoritos se cargan en el layout; si el usuario favorita desde otra
  pestana no se refleja hasta recargar. Aceptado.
- **Layout dinamico**: la consulta de favoritos se anade a cada request de `(main)` con sesion (una consulta indexada
  por PK). Bajo.
- **Migracion**: `0010` debe aplicarse antes de probar; sin ella la action de favoritos falla con error generico.

## Proximas fases
- Envio de correos de newsletter + baja con token + double opt-in.
- Newsletter en el pie; panel admin de suscriptores.
- Notificaciones a quien favoritó (cambio de fecha/cancelacion), contador de favoritos por evento.
- Rate limiting en acciones publicas.

## Log de review
- Reviewer: FAIL (8 suites rotas: la cadena barrel event -> EventCard -> FavoriteButton -> action -> servicio con server-only lanzaba en Vitest). Corregido con alias de `server-only` al stub vacio del paquete en vitest.config.mts. Ademas: el layout (main) degrada a corazones vacios si falla la carga de favoritos (p. ej. migracion 0010 sin aplicar).
- Verificacion final: eslint y tsc limpios, vitest 89 archivos / 900 tests. `npm run build` no se pudo ejecutar dentro del worktree (Turbopack no admite el symlink de node_modules; con webpack falla por falta de .env): correrlo tras integrar en main. Pendiente manual: aplicar migracion 0010 y probar corazones, /favorites y newsletter.
