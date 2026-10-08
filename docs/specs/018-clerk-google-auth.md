# 018 — Auth real con Clerk (email/password + Google) y sync de `users`

## Contexto
La auth actual es un mock en cliente (specs 012 y 016): cuentas en `localStorage` (`useAuthStore`, hash SHA-256
propio), Google via GIS/selector simulado sin verificar el JWT, y reset de contraseña con bandeja falsa
(`src/modules/dev`). No hay identidad en servidor ni proteccion real de rutas.

Decision del usuario (no negociable): **reemplazo total por Clerk**. Clerk gestiona email/password, Google (social
connection configurada en el dashboard de Clerk) y reset de contraseña con su propio flujo. La tabla `users` de la
spec 008 ya fue diseñada para esto (`clerk_id` unique) pero nada la puebla: esta spec cierra ese circuito con un
webhook.

Resultado esperado al terminar **todas** las fases: Clerk es la unica fuente de identidad; `users` (Postgres) es la
copia local para FKs (`orders.user_id`, `events.organizer_id`) y para el rol; las rutas privadas se protegen en
servidor con `clerkMiddleware` en `src/proxy.ts`; el codigo mock (store, forgot/reset, Google simulado, modulo `dev`)
desaparece.

### Arquitectura objetivo

```
Navegador ──(componentes Clerk <SignIn>/<SignUp>, useUser)──> Clerk (sesion, Google OAuth, reset)
   │                                                              │
   │ cookie de sesion Clerk                                       │ webhook user.created/updated/deleted
   v                                                              v  (firma Standard Webhooks)
src/proxy.ts (clerkMiddleware)                    src/app/api/webhooks/clerk/route.ts
   │ protege /organizer, /my-tickets, checkout     │ verifyWebhook() -> 400 si firma invalida
   v                                               v
paginas (src/app) -> modulos                      modules/user/services/user-sync.service.ts
                                                   │ upsert por clerk_id / soft delete
                                                   v
                                                  Postgres: users (role default 'customer')
```

- **Identidad:** Clerk (`userId` de Clerk = `users.clerk_id`).
- **Datos propios y rol:** tabla `users`. El webhook nunca escribe `role` ni `phone`: son datos de la app.
- **"Usuario actual" en cliente:** un unico hook puente `useCurrentUser()` en el modulo `auth` que adapta `useUser()`
  de Clerk al tipo existente `AuthUser { fullName; email }`. Asi los consumidores de negocio
  (`getCheckoutPrefill`, `getDemoOrders`, `event-form`) no cambian de tipo, solo de fuente.
- **Next 16:** `middleware.ts` esta deprecado y se llama `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
  Con carpeta `src/`, va en `src/proxy.ts`. Corre en runtime Node por defecto (no se configura `runtime`).
  `@clerk/nextjs@7.x` declara soporte para `next ^16.1.0-0` (instalado: 16.3.6).

### Fases

| Fase | Spec | Entrega | Estado de la app al terminar |
|------|------|---------|------------------------------|
| 1 | **esta (018)** | Clerk instalado + webhook + sync de `users` (incluye migracion `deleted_at`) | UI sigue en mock, sin regresiones. Usuarios creados en el Account Portal hospedado de Clerk aparecen en `users`. |
| 2 | 019 (backlog) | `ClerkProvider`, `src/proxy.ts` sin proteccion, `/login` y `/register` con `<SignIn>`/`<SignUp>`, `useCurrentUser()`, `UserMenu` con Clerk | Header y login reales. Organizer/checkout/my-tickets aun leen el store mock (estado intermedio: no desplegar a prod entre fase 2 y 3). |
| 3 | 020 (backlog) | Consumidores a `useCurrentUser()` + proteccion de rutas en `src/proxy.ts` | Toda la app usa Clerk. |
| 4 | 021 (backlog) | Borrado del mock: store, forgot/reset, Google simulado, `auth-signed-in`, modulo `dev` | Sin codigo mock de auth. |

La fase 1 va primero porque es independiente de la UI (no rompe nada) y valida lo mas riesgoso: credenciales,
firma del webhook y escritura en la base.

## Alcance
- Incluye (Fase 1):
  - Instalar `@clerk/nextjs` (7.x).
  - Env vars en `.env.example`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
    `CLERK_WEBHOOK_SIGNING_SECRET`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register`
    (las dos ultimas se usan desde la fase 2, se documentan ya para no tocar el archivo dos veces).
  - Columna `users.deleted_at` (soft delete) + migracion `0001` generada con `npm run db:generate`.
  - Servicio de sync `user-sync.service.ts` (mapeo Clerk -> fila, upsert por `clerk_id`, soft delete) + test.
  - Route handler `POST /api/webhooks/clerk` con `verifyWebhook` de `@clerk/nextjs/webhooks`.
  - README: setup de Clerk (app, Email+Password, Google, webhook, tunel local) reemplazando la seccion de
    `NEXT_PUBLIC_GOOGLE_CLIENT_ID` de la spec 016 (esa seccion queda marcada como obsoleta hasta la fase 4, donde se
    borra el boton GIS; ver T1).
- Excluye:
  - Cualquier cambio de UI, `ClerkProvider`, `src/proxy.ts` y proteccion de rutas (fases 2 y 3).
  - Promocion de rol (`organizer`/`admin`/`super_admin`): manual en DB por ahora.
  - Sincronizar `phone` desde Clerk (es dato de la app, lo captura el checkout).
  - Anonimizar email/nombre al borrar un usuario (GDPR): backlog.
  - Theming de componentes Clerk con los tokens de shadcn (`@clerk/themes`): backlog fase 2.
- Backlog (fases siguientes, detalle en "Contratos de fases siguientes"):
  - **Fase 2 (019):** `ClerkProvider` en `src/app/layout.tsx`; `src/proxy.ts` con `clerkMiddleware()` sin proteccion;
    `/login` y `/register` pasan a catch-all (`(auth)/login/[[...sign-in]]/page.tsx`,
    `(auth)/register/[[...sign-up]]/page.tsx`); `login-form.tsx`/`register-form.tsx` reescritos sobre
    `<SignIn>`/`<SignUp>` manteniendo `AuthTabs` y `?redirect=`; hook `useCurrentUser()` + test; `user-menu.tsx`
    con Clerk (`signOut`); barrel `auth/index.ts`. `site-header.tsx` no cambia (usa `UserMenu`).
  - **Fase 3 (020):** `organizer-shell.tsx`, `organizer-dashboard.tsx`, `event-form.tsx` (+ test),
    `checkout-form.tsx`, `my-tickets.tsx` (+ test) leen `useCurrentUser()`; `src/proxy.ts` protege
    `/organizer(.*)`, `/my-tickets`, `/events/:slug/checkout`, `/events/:slug/confirmation` con `auth.protect()`.
    `order.utils.ts` y `order.mock.ts` **no cambian** (solo reciben `AuthUser`, son logica de negocio).
    `order-confirmation.tsx` no cambia (solo importa `MY_TICKETS_PATH`).
  - **Fase 4 (021):** borrar `auth.store.ts` (+ test), `forgot-password-form.tsx`, `reset-password-form.tsx`,
    `google-sign-in-button.tsx`, `auth-divider.tsx`, `auth-signed-in.tsx`, `use-auth-form.ts`, `auth.schema.ts`
    (+ test), partes mock de `auth.utils.ts` (`hashPassword`, `decodeGoogleCredential`, `DEMO_ACCOUNT*`,
    `normalizeEmail` si queda sin uso) y de `auth.types.ts` (`AuthAccount`, `AuthResult`, `AuthProvider`, form
    values); rutas `(auth)/forgot-password`, `(auth)/reset-password`, `(main)/dev/*`; modulo `src/modules/dev`
    completo; link "Datos de prueba" de `site-footer.tsx`; seccion GIS del README.
  - Rol en la sesion (`publicMetadata.role` o lectura de `users.role` en servidor) para autorizar `/organizer` por
    rol: hoy cualquier usuario logueado entra, igual que con el mock.
  - Theming Clerk con shadcn, anonimizacion en `user.deleted`.

## Reuso detectado
- `src/modules/user/db/user.table.ts` (spec 008): tabla destino, ya con `clerkId` unique y `role` default
  `customer`. Solo se agrega `deletedAt`.
- `src/modules/user/types/user.types.ts`: `NewUser`/`UserEntity` se reusan (se infieren solos, no se editan).
- `src/lib/db.ts`: cliente drizzle singleton, se reusa tal cual.
- `drizzle.config.ts` + scripts `db:generate`/`db:migrate`: se reusan para la migracion `0001`.
- `@clerk/nextjs/webhooks` -> `verifyWebhook(req)`: verifica la firma (Standard Webhooks, el mismo esquema de Svix) y
  lee `CLERK_WEBHOOK_SIGNING_SECRET` por defecto. Por eso **no se instala `svix`** (ver Preguntas abiertas 1).
- Tipos `UserJSON`, `WebhookEvent` de `@clerk/nextjs/webhooks` (no se redefinen).
- Para fases 2-4 (referencia): `AuthLayout`, `AuthTabs`, `getAuthHref`, `getSafeRedirect`, `getInitials`,
  `getNameFromEmail`, `MY_TICKETS_PATH`, tipo `AuthUser` y `ui/dropdown-menu`/`ui/sheet`/`ui/button` se mantienen.
  `useIsClient` deja de ser necesario en `UserMenu` (lo reemplaza `isLoaded` de Clerk).
- No hay nada en `src/hooks`, `src/components/shared` ni shadcn que cubra webhooks o sync: no aplica UI en fase 1.

## Contratos

### Dependencias (`package.json`)
```json
{ "dependencies": { "@clerk/nextjs": "^7.9.9" } }
```

### `.env.example` (se agrega, `DATABASE_URL` se mantiene)
```
# Clerk (https://dashboard.clerk.com -> API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
# Clerk -> Webhooks -> endpoint /api/webhooks/clerk -> Signing Secret
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx
# Rutas propias de sign-in/up (se usan desde la fase 2)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
```

### `src/modules/user/db/user.table.ts` (cambio)
```ts
// se agrega a users:
deletedAt: timestamp("deleted_at"), // null = activo. Soft delete: orders.user_id es RESTRICT (spec 008)
```
Migracion esperada (`drizzle/0001_*.sql`): `ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;`

Decision: **soft delete**, no `DELETE`. `orders.user_id -> users.id` es `RESTRICT` para preservar historial
financiero (spec 008); un `DELETE` fallaria con FK violation para cualquier usuario con compras y Clerk reintentaria
el webhook indefinidamente.

### `src/modules/user/services/user-sync.service.ts` (server-only, solo lo importa el route handler)
```ts
import type { UserJSON, WebhookEvent } from "@clerk/nextjs/webhooks";
import type { NewUser } from "../types/user.types";

export type ClerkUserFields = Pick<NewUser, "clerkId" | "email" | "fullName">;

// Puro. email = primary_email_address_id resuelto en email_addresses (fallback: el primero), en minusculas.
// fullName = `${first_name} ${last_name}` trim; si queda vacio -> getNameFromEmail(email) de @/modules/auth
//   (si se prefiere no acoplar user -> auth, ver Preguntas abiertas 3).
// Lanza Error si el usuario no tiene ningun email (no deberia pasar con Email+Password/Google).
export function mapClerkUser(data: UserJSON): ClerkUserFields;

// insert ... onConflictDoUpdate({ target: users.clerkId, set: { email, fullName, deletedAt: null, updatedAt: now } })
// Nunca toca role ni phone. Idempotente: sirve para created, updated, reintentos y eventos fuera de orden.
export async function upsertUserFromClerk(data: UserJSON): Promise<void>;

// update users set deleted_at = now, updated_at = now where clerk_id = $1. Sin fila -> no-op.
export async function softDeleteUserByClerkId(clerkId: string): Promise<void>;

// Despacha: user.created | user.updated -> upsert; user.deleted (con data.id) -> soft delete; otros -> ignora.
export async function handleClerkWebhookEvent(event: WebhookEvent): Promise<void>;
```
Barrel `src/modules/user/index.ts` suma: `export { handleClerkWebhookEvent } from "./services/user-sync.service";`

### `src/app/api/webhooks/clerk/route.ts`
```ts
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { handleClerkWebhookEvent } from "@/modules/user";

export async function POST(request: NextRequest): Promise<Response>;
// verifyWebhook(request) lanza -> 400 "Invalid signature" (no se toca la DB)
// handleClerkWebhookEvent lanza (DB caida, mapeo sin email) -> 500 (Clerk reintenta) + console.error
// ok o evento ignorado -> 200
```
Sin logica de negocio en el handler (SETUP 1.1). No requiere `export const dynamic`: los `POST` no se cachean.
Nota para fase 2/3: el matcher de `src/proxy.ts` puede incluir `/api/*`, pero `/api/webhooks/clerk` **nunca** se
agrega a las rutas protegidas (Clerk llama sin sesion).

### Configuracion manual en Clerk (README, T1)
1. Crear aplicacion en dashboard.clerk.com; habilitar **Email + Password** y **Google** (User & Authentication ->
   Social connections). En desarrollo Clerk provee credenciales de Google compartidas; en produccion se cargan Client
   ID/Secret propios de Google Cloud en el dashboard de Clerk (no en el repo).
2. Copiar keys a `.env.local`.
3. Webhooks -> Add endpoint `https://<host>/api/webhooks/clerk`, eventos `user.created`, `user.updated`,
   `user.deleted`; copiar el Signing Secret a `CLERK_WEBHOOK_SIGNING_SECRET`.
4. Local: exponer `localhost:3000` con un tunel (`ngrok http 3000` o `cloudflared tunnel --url
   http://localhost:3000`) y usar esa URL en el endpoint. Clerk no puede llamar a `localhost` directo: sin tunel no
   se puede verificar AC2-AC4 en local (la pestaña "Testing" del endpoint sirve para reenviar eventos por el tunel).
5. `npm run db:migrate` para aplicar `0001`.

### Contratos de fases siguientes (referencia, no se implementan aqui)
```ts
// Fase 2 — src/modules/auth/hooks/use-current-user.ts ("use client")
export interface CurrentUser {
  user: AuthUser | null; // null si no hay sesion
  isLoaded: boolean;     // reemplaza useIsClient para evitar parpadeo/hydration
  signOut: () => Promise<void>;
}
export function useCurrentUser(): CurrentUser; // useUser() + useClerk().signOut, mapea a AuthUser

// Fase 2 — login-form.tsx / register-form.tsx
// <SignIn path="/login" signUpUrl={getAuthHref("/register", redirect)}
//         fallbackRedirectUrl={getSafeRedirect(redirect)} />  (idem SignUp con signInUrl)
// Clerk ademas respeta ?redirect_url= cuando el proxy redirige por auth.protect().

// Fase 3 — src/proxy.ts
// const isProtectedRoute = createRouteMatcher(["/organizer(.*)", "/my-tickets",
//   "/events/(.*)/checkout", "/events/(.*)/confirmation"]);
// export default clerkMiddleware(async (auth, req) => { if (isProtectedRoute(req)) await auth.protect(); });
// export const config = { matcher: [<matcher recomendado por Clerk: excluye _next y estaticos>, "/(api|trpc)(.*)"] };
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar `@clerk/nextjs`; env vars en `.env.example`; README: seccion "Autenticacion con Clerk" (pasos 1-5 de arriba) y marcar la seccion de `NEXT_PUBLIC_GOOGLE_CLIENT_ID` como obsoleta (se elimina en fase 4) | package.json, package-lock.json, .env.example, README.md | - | S |
| T2 | Columna `deletedAt` en `users` y generar migracion `0001` con `npm run db:generate` (no editar el SQL a mano) | src/modules/user/db/user.table.ts, drizzle/0001_*.sql, drizzle/meta/* (generados) | - | P1 |
| T3 | Servicio de sync + test | src/modules/user/services/user-sync.service.ts, src/modules/user/services/user-sync.service.test.ts | T1, T2 | S |
| T4 | Route handler del webhook + export en barrel de `user` | src/app/api/webhooks/clerk/route.ts, src/modules/user/index.ts | T3 | S |

Orden: T1 ‖ T2 -> T3 -> T4. T2 es paralelo a T1 (archivos disjuntos, sin dependencia). 4 tareas, 7 archivos
escritos a mano + lockfile y migracion generados.

## Criterios de aceptacion
- [ ] AC1: `npm run db:generate` produce `drizzle/0001_*.sql` con solo `ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;` y `npm run db:migrate` lo aplica sin errores. `npm run db:verify` sigue pasando.
- [ ] AC2: Con keys reales y tunel: registrarse en el Account Portal de Clerk (email/password **y** con Google) crea una fila en `users` con `clerk_id`, `email` en minusculas, `full_name` y `role = 'customer'`. (Verificable por el usuario con su cuenta de Clerk; no en este entorno.)
- [ ] AC3: Cambiar nombre o email en Clerk actualiza `full_name`/`email` y `updated_at` de la misma fila; `role` y `phone` editados a mano en la DB se conservan.
- [ ] AC4: Borrar el usuario en Clerk deja la fila con `deleted_at` no nulo (no se borra). Reenviar el mismo evento es no-op y responde 200.
- [ ] AC5: `POST /api/webhooks/clerk` con firma invalida o sin headers `svix-*`/`webhook-*` responde 400 y no escribe en la DB. Evento de otro tipo (ej. `session.created`) responde 200 sin escribir.
- [ ] AC6: La UI no cambia: login/registro mock, header, organizer y checkout funcionan igual que antes (sin `ClerkProvider` ni `proxy.ts` en esta fase).
- [ ] AC7: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores (el build no requiere keys de Clerk en esta fase).

## Tests requeridos
- `user-sync.service.test.ts` (Vitest, `vi.mock("@/lib/db")`):
  - `mapClerkUser`: usa el email primario aunque no sea el primero del array; normaliza a minusculas; arma
    `fullName` con nombre + apellido; sin nombre cae a `getNameFromEmail`; sin emails lanza.
  - `handleClerkWebhookEvent`: `user.created` y `user.updated` llaman al upsert con los campos mapeados y sin `role`;
    `user.deleted` llama al soft delete con `data.id`; otro tipo no toca la DB.
- Route handler: sin test unitario (es glue de 10 lineas; firma y DB se validan en AC2-AC5).

## Preguntas abiertas
Ninguna bloquea; defaults tomados, ajustables al aprobar:
1. **`svix` no se instala.** Se pidio, pero `@clerk/nextjs/webhooks` ya trae `verifyWebhook` (verificacion Standard
   Webhooks, mismo esquema y headers que Svix) y es la via oficial actual de Clerk. Instalar `svix` solo duplicaria
   eso. Si igual se quiere `svix` explicito, es un cambio de 3 lineas en el route handler.
2. **Soft delete (`deleted_at`)** en vez de `DELETE` en `user.deleted`, por el `RESTRICT` de `orders.user_id`. La
   alternativa (borrar solo si no tiene ordenes) deja dos comportamientos distintos para el mismo evento.
3. **`mapClerkUser` reusa `getNameFromEmail` de `@/modules/auth`** (DRY). Crea una dependencia `user -> auth`; en
   fase 4 `auth` deja de importar nada de `user`, asi que no hay ciclo. Si se prefiere `user` sin dependencias, el
   fallback seria el propio email.
4. **Idioma de los componentes Clerk (fase 2):** por defecto salen en ingles. Para español hace falta
   `@clerk/localizations` (`esES` en `ClerkProvider`). Se decide al especificar la fase 2; no afecta esta fase.
5. **Rutas a proteger (fase 3):** propuesta `/organizer(.*)`, `/my-tickets`, checkout y confirmation. Confirmar si
   `/events/:slug/tickets` (seleccion de asientos) debe seguir publico (propuesta: si).

## Estado
- Aprobacion humana: aprobada (2026-09-30)
- Fase: aprobado
- Log de review:
  - 2026-09-30 reviewer it.1: APPROVED. tsc/lint/test(215)/build ok. AC1 parcial (generate sin diffs, SQL solo ALTER
    deleted_at; migrate/verify sin DATABASE_URL), AC2-AC4 no verificables en entorno, AC5-AC7 ok. 3 hallazgos
    menores corregidos tras el approve: guard `if (event.data.id)` en `user.deleted`
    (`user-sync.service.ts:57`), cast/anotacion redundantes removidos (`:13`, `:54`). Re-verificado: tsc, lint y
    tests (8/8 user-sync) en verde.
- Desviaciones:
  1. `npm install --legacy-peer-deps` en T1: conflicto preexistente `@types/node ^20` (fijado en `devDependencies`
     del proyecto) vs `vitest@5.0.2` (pide `^22 || >=24`). No relacionado a Clerk, no se tocaron devDependencies.
  2. `UserJSON` y `WebhookEvent` se importan de `@clerk/nextjs/server` en vez de `@clerk/nextjs/webhooks`:
     `/webhooks` reexporta `WebhookEvent` pero no `UserJSON` (v7.9.9); se unifican ambos imports en `/server`.
     `verifyWebhook` si se mantiene importado de `/webhooks`.
