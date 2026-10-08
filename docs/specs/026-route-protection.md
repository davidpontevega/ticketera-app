# 026 — Proteccion de rutas por sesion en `src/proxy.ts` (Trello P0-02)

Estado: implementada (pendiente AC3-AC5 manual)
Aprobacion humana: aprobada (2026-10-07, 4 preguntas abiertas aceptadas con la opcion propuesta)

> Numeracion: 026 estaba reservado por la 024 (fase 2, "proteccion de rutas") y esta libre. Esta spec la ocupa y
> cubre solo la parte de **proxy por sesion**; el `requireRole` en `/organizer` y `/admin` ya lo entregaron 027/029.

## Objetivo
Hoy `src/proxy.ts` es `clerkMiddleware()` sin proteccion: las paginas que exigen usuario solo estan protegidas por
guards en cliente (`MyTickets`) o por `requireRole` en servidor (solo `/organizer` y `/admin`). Se agrega una primera
barrera por sesion en el proxy, antes de renderizar, para `/my-tickets`, `/events/*/checkout`,
`/events/*/confirmation`, `/organizer` y `/admin`. Sin sesion -> redirect a `/login` con `redirect_url`.

Referencias: `docs/specs/024-user-roles-authorization.md` D1 ("el proxy no lee el rol: solo exige sesion,
`auth.protect()`") y "Contratos de fases siguientes > 026"; `docs/specs/018-clerk-google-auth.md` /
`019-clerk-ui-login.md` (proxy y `/login`); `docs/SYSTEM_DESIGN.md` fila "Autenticacion" y "Autorizacion". Next 16:
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (`proxy.ts` reemplaza a
`middleware.ts`; el archivo actual ya usa la convencion `proxy`, con export default de `clerkMiddleware`).

## Estado verificado en codigo
- `src/proxy.ts`: `clerkMiddleware()` con comentario "sin proteccion: la agrega la spec 020"; `config.matcher`
  estandar de Clerk (excluye `_next` y estaticos, incluye `/(api|trpc)(.*)`). No se toca el `matcher`.
- Defensa en profundidad ya existente (no se modifica):
  - `src/app/(organizer)/layout.tsx`: `await requireRole(ORGANIZER_AREA_ROLES)` (spec 029). Tambien en
    `organizer/events/new/page.tsx`.
  - `src/app/(admin)/admin/users/page.tsx`: `await requireRole(USER_ADMIN_ROLES)` (spec 027). No hay layout en `(admin)`.
  - `requireRole` (`src/modules/user/services/user-access.service.ts`): sin sesion -> `redirect("/login")`, rol
    insuficiente -> `redirect("/")`. Tambien se usa en server actions (`organizer-event.actions.ts`,
    `user-admin.actions.ts`).
- Rutas reales (`src/app`): `(main)/my-tickets`, `(purchase)/events/[slug]/{tickets,checkout,confirmation}`,
  `(organizer)/organizer`, `(admin)/admin/users`. `/events/[slug]/tickets` y `/events/[slug]` son publicas.
- `/api/checkout/session/route.ts` usa `auth()` y tolera `userId` nulo (checkout de invitado): **no** se protege.
  `/api/webhooks/{clerk,stripe}` los llama Clerk/Stripe sin sesion: **nunca** se protegen.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login` (`.env.example`), asi que `auth.protect()` redirige a
  `/login?redirect_url=<url-original>`.
- `LoginForm` lee `?redirect=` (propio), no `redirect_url`. El componente `<SignIn>` de Clerk si respeta
  `redirect_url` de la query y tiene prioridad sobre `fallbackRedirectUrl`; **verificar manualmente (AC5)** en vez de
  tocar `LoginForm`. Ver pregunta 1.

## Alcance
- Incluye:
  - Util `isProtectedRoute` (`createRouteMatcher`) con los patrones de rutas protegidas, testeable de forma aislada.
  - `src/proxy.ts`: `clerkMiddleware(async (auth, req) => { if (isProtectedRoute(req)) await auth.protect(); })`.
  - Tests del matcher (protegidas / publicas / webhooks / api checkout).
  - Actualizar la fila "Autenticacion" de `docs/SYSTEM_DESIGN.md` (proxy ahora protege por sesion; spec 026).
- No incluye:
  - Leer el rol en el proxy (decision D1 de 024: el rol se verifica en servidor con `requireRole`).
  - Quitar o cambiar `requireRole` en layouts/pages/actions existentes (se mantienen como defensa en profundidad).
  - Proteger `/events/[slug]/tickets`, `/api/checkout/*`, `/api/webhooks/*`, `/dev/*`.
  - Cambios en `LoginForm`/`RegisterForm`, en `requireRole` ni en el `config.matcher`.
  - Migrar `MyTickets` fuera de su guard cliente (spec 020).

## Reutilizar
- `createRouteMatcher` y `clerkMiddleware` de `@clerk/nextjs/server` (v7.9.9 instalado): sin matcher propio.
- `auth.protect()` de Clerk: hace el redirect a `NEXT_PUBLIC_CLERK_SIGN_IN_URL` con `redirect_url`; sin helper propio.
- `requireRole`, `ORGANIZER_AREA_ROLES`, `USER_ADMIN_ROLES` (modulo `user`): intactos.
- Estilo de tests: Vitest con `vitest.config.mts` (jsdom); `NextRequest` de `next/server` para construir requests.

## Archivos
| Archivo | Accion |
|---------|--------|
| `src/lib/protected-routes.ts` | nuevo: `export const isProtectedRoute = createRouteMatcher([...])` |
| `src/lib/protected-routes.test.ts` | nuevo |
| `src/proxy.ts` | modificar: usar `isProtectedRoute` + `auth.protect()`; quitar el comentario obsoleto |
| `docs/SYSTEM_DESIGN.md` | modificar: fila "Autenticacion" (y mencion en "Autorizacion" si aplica) |

Patrones propuestos (los tests fijan el comportamiento; ajustar si `createRouteMatcher` los interpreta distinto):
```ts
createRouteMatcher([
  "/my-tickets(.*)",
  "/events/:slug/checkout(.*)",
  "/events/:slug/confirmation(.*)",
  "/organizer(/.*)?",
  "/admin(/.*)?",
]);
```
`/organizer(/.*)?` y `/admin(/.*)?` (en vez de `(.*)`) para no atrapar rutas como `/organizers-info` o `/administrar`.

## Criterios de aceptacion
- AC1: `isProtectedRoute` es `true` para `/my-tickets`, `/events/rock-fest/checkout`, `/events/rock-fest/confirmation`,
  `/organizer`, `/organizer/events/new`, `/admin`, `/admin/users`.
- AC2: `isProtectedRoute` es `false` para `/`, `/events`, `/events/rock-fest`, `/events/rock-fest/tickets`, `/login`,
  `/register`, `/organizers-info`, `/api/webhooks/clerk`, `/api/webhooks/stripe`, `/api/checkout/session`.
- AC3: Sin sesion, un GET a `/my-tickets`, `/events/<slug>/checkout`, `/events/<slug>/confirmation`, `/organizer` y
  `/admin/users` responde redirect (307) a `/login?redirect_url=...` (verificable con `curl -I` sin cookie).
- AC4: `POST /api/webhooks/clerk` y `/api/webhooks/stripe` no pasan por `auth.protect()` (sin sesion siguen
  respondiendo segun su propia validacion de firma, no 307/404 del proxy); `POST /api/checkout/session` sin sesion
  sigue funcionando (checkout de invitado).
- AC5: Tras iniciar sesion desde ese redirect, el usuario vuelve a la URL original (verificacion manual; si `<SignIn>`
  no respeta `redirect_url`, abrir pregunta 1).
- AC6: `requireRole` en `(organizer)/layout.tsx`, `organizer/events/new/page.tsx` y `admin/users/page.tsx` permanece
  sin cambios (con sesion y rol `customer`, `/organizer` y `/admin/users` redirigen a `/`).
- AC7: `npm run lint`, `npx tsc --noEmit` y `npx vitest run` pasan.
- AC8: `docs/SYSTEM_DESIGN.md` refleja que el proxy exige sesion en esas rutas y el rol sigue verificandose en servidor.

## Tests requeridos
- `src/lib/protected-routes.test.ts` (Vitest): tabla `it.each` con `new NextRequest("http://localhost" + path)`
  cubriendo AC1 y AC2 (incluye el caso borde `/organizers-info` y subrutas de `/organizer` y `/admin`).
- `src/proxy.ts` no se testea unitariamente (es cableado de Clerk); se cubre con AC3-AC5 manual (`curl -I` y login).

## Tareas
### T1 — Matcher de rutas protegidas + tests
- Archivos: `src/lib/protected-routes.ts`, `src/lib/protected-routes.test.ts`
- Depende de: —
- Paralelizable: si (con T3)
- Cubre: AC1, AC2

### T2 — Cablear el proxy
- Archivos: `src/proxy.ts`
- Depende de: T1
- Paralelizable: no
- Cubre: AC3, AC4, AC5, AC6, AC7

### T3 — Documentar en SYSTEM_DESIGN
- Archivos: `docs/SYSTEM_DESIGN.md`
- Depende de: —
- Paralelizable: si (con T1)
- Cubre: AC8

Orden: (T1 ‖ T3) -> T2. 3 tareas, 4 archivos. No hay tarea T0 (sin dependencias nuevas ni cambios compartidos).

## Preguntas abiertas
1. **`redirect_url` vs `?redirect=`:** el proxy (Clerk) usa `redirect_url`; el flujo propio de la app (`LoginForm`,
   `getAuthHref`, `MyTickets`) usa `?redirect=`. Default: no tocar `LoginForm` y confiar en que `<SignIn>` honra
   `redirect_url` (AC5). Si no lo hace, fase extra: que `LoginForm` lea tambien `redirect_url` (una linea en
   `login-form.tsx`/`register-form.tsx`, pasando por `getSafeRedirect`). Confirmar si se prefiere hacerlo ya.
2. **`requireRole` sin sesion** redirige a `/login` sin parametro de retorno (queda como esta; el proxy ya cubre ese
   caso en la practica). Confirmar que no se quiere propagar el retorno tambien alli.
3. **Checkout de invitado:** `/events/*/checkout` y `/confirmation` pasan a exigir sesion, lo que elimina el checkout
   de invitado a nivel de paginas aunque `POST /api/checkout/session` siga aceptando `userId` nulo (spec 022).
   Es lo pedido en P0-02; confirmar que la API no debe exigir sesion tambien (fuera de alcance aqui).
4. **Retorno de Stripe:** la `success_url` de Stripe apunta a `/events/<slug>/confirmation`; el usuario ya tiene
   cookie de sesion al volver, por lo que no deberia redirigirse. Verificar en el flujo de pago de prueba.
5. `docs/SYSTEM_DESIGN.md` esta fuera de `docs/specs/`; se asigna a T3 para que lo edite el developer.

## Proximas fases
- Propagar `redirect_url`/`redirect` en `requireRole` (pregunta 2) si se decide.
- Spec 020 (migrar consumidores a `useCurrentUser()` y retirar el guard cliente de `MyTickets`) ahora puede apoyarse
  en el proxy.

## Log de review
- Iteracion 1 — PASS. tsc, eslint, vitest (486) OK. Pendiente prueba manual AC3-AC5 (curl -I 307, retorno tras login, webhooks/checkout sin redirect).
