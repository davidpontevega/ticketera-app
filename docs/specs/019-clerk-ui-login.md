# 019 — Clerk en la UI: ClerkProvider, proxy, login/registro y UserMenu (Fase 2 de 018)

## Contexto
Fase 2 del plan de `docs/specs/018-clerk-google-auth.md` (leer "Arquitectura objetivo" y "Fases"). La fase 1 dejo
`@clerk/nextjs@7.9.9` instalado, env vars documentadas y el webhook sincronizando `users`, pero la UI sigue en el
mock de `localStorage` (specs 012/016).

Esta fase conecta la UI a Clerk en el minimo de puntos: proveedor global, `src/proxy.ts` (sin proteger rutas),
`/login` y `/register` con `<SignIn>`/`<SignUp>` en las **mismas rutas** (reemplazo de contenido, no rutas nuevas),
un hook puente `useCurrentUser()` y el `UserMenu` del header leyendo la sesion real.

Resultado esperado: el usuario inicia sesion / se registra (email+password o Google) en `/login` y `/register`, vuelve
a la ruta indicada en `?redirect=` y el header muestra su nombre real de Clerk y permite cerrar sesion.

**Estado intermedio conocido (aceptado en 018):** organizer, checkout y my-tickets siguen leyendo el store mock hasta
la spec 020. Con esta fase ya no hay forma de loguearse en el mock (los formularios mock desaparecen de `/login` y
`/register`), asi que esas pantallas quedan sin sesion. No desplegar a prod entre 019 y 020 (ver Preguntas abiertas 1).

## Alcance
- Incluye:
  - Instalar `@clerk/localizations` y pasar `esES` a `ClerkProvider` (sitio en español; ver Contratos).
  - `ClerkProvider` en `src/app/layout.tsx`, dentro de `<body>`.
  - `src/proxy.ts` con `clerkMiddleware()` sin proteccion de rutas.
  - Mover `(auth)/login/page.tsx` -> `(auth)/login/[[...sign-in]]/page.tsx` y `(auth)/register/page.tsx` ->
    `(auth)/register/[[...sign-up]]/page.tsx` (catch-all: Clerk usa subrutas como `/login/factor-one`,
    `/login/sso-callback` para Google y el reset de contraseña propio).
  - `login-form.tsx` / `register-form.tsx` reescritos: `AuthTabs` + `<SignIn>` / `<SignUp>` respetando `?redirect=`.
  - Hook `useCurrentUser()` + test.
  - `user-menu.tsx` usa `useCurrentUser()`.
- Excluye:
  - Proteccion de rutas en `src/proxy.ts` y migrar `organizer-shell`, `organizer-dashboard`, `event-form`,
    `checkout-form`, `my-tickets`, `order.utils`, `order-confirmation` (fase 3, spec 020).
  - Borrar codigo mock: `auth.store.ts`, forgot/reset (rutas y formularios), `google-sign-in-button.tsx`,
    `auth-divider.tsx`, `auth-signed-in.tsx`, `use-auth-form.ts`, `auth.schema.ts`, modulo `dev`, exports mock del
    barrel (fase 4, spec 021). Tras esta fase varios quedan **sin uso** pero se conservan: es intencional.
  - `site-header.tsx`: **no cambia** (confirmado: solo renderiza `<UserMenu />` y `<UserMenu layout="sheet" />`).
  - Exportar `useCurrentUser` en el barrel `auth/index.ts`: en esta fase solo lo consume `user-menu.tsx` (mismo
    modulo). Se exporta en la spec 020 cuando lo usen otros modulos (YAGNI).
  - Theming de Clerk con tokens de shadcn (`appearance` / `@clerk/themes`).
- Backlog (fases siguientes): specs 020 y 021 segun "Backlog" y "Contratos de fases siguientes" de la spec 018, mas
  theming Clerk y export de `useCurrentUser` en el barrel (020).

## Reuso detectado
- `@clerk/nextjs` (ya instalado, 7.9.9): `ClerkProvider`, `SignIn`, `SignUp`, `useUser`, `useClerk` desde
  `@clerk/nextjs`; `clerkMiddleware` desde `@clerk/nextjs/server` (verificado en los `.d.ts`).
- `src/modules/auth/types/auth.types.ts` — `AuthUser { fullName; email }` es el tipo de salida del hook (no se crea
  otro).
- `src/modules/auth/utils/auth.utils.ts` — `getSafeRedirect` (anti open-redirect para `fallbackRedirectUrl`),
  `getAuthHref` (links cruzados login<->register y link "Iniciar sesion" del `UserMenu`), `getNameFromEmail`
  (fallback de nombre, mismo criterio que `mapClerkUser` de la spec 018), `getInitials` (avatar del `UserMenu`).
- `src/modules/auth/components/auth-tabs.tsx` — tabs login/registro arriba del componente Clerk, sin cambios.
- `src/modules/auth/components/auth-layout.tsx` + `src/app/(auth)/layout.tsx` — layout de las paginas, sin cambios.
- `src/components/ui/dropdown-menu.tsx`, `button.tsx` — siguen en `UserMenu`.
- `src/hooks/use-is-client.ts` — deja de usarse en `UserMenu` (lo reemplaza `isLoaded`); se conserva porque lo usan
  otros componentes.
- No se usa `<UserButton>` de Clerk: el `UserMenu` existente ya cubre el diseño (avatar con iniciales, "Mis
  entradas", variante `sheet` mobile) y `UserButton` no soporta esa variante.
- shadcn: no hay componente de auth/sign-in que aplique (Clerk provee la UI).
- `src/components/shared`: nada aplicable.

## Contratos

### Dependencias (`package.json`)
```json
{ "dependencies": { "@clerk/localizations": "^4.x" } }
```
Decision de idioma: **se instala y usa `esES`** (sitio 100% en español, `<html lang="es">`). `@clerk/localizations`
depende de `@clerk/shared ^4.37.1`, la misma version ya instalada por `@clerk/nextjs`. Si el install choca con el
conflicto preexistente `@types/node` vs `vitest` (desviacion 1 de la spec 018), usar `--legacy-peer-deps` igual que
en 018. Variante regional (`esMX`, etc.) ajustable al aprobar; no bloquea.

### `src/app/layout.tsx`
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
// <html ...><body className="min-h-full flex flex-col">
//   <ClerkProvider localization={esES}>{children}</ClerkProvider>
// </body></html>
```
Sin `dynamic` (las paginas siguen estaticas donde lo eran). `metadata`, fuente y clases se mantienen.

### `src/proxy.ts`
```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(); // sin proteccion: la agrega la spec 020

export const config = {
  matcher: [
    // matcher recomendado por Clerk: excluye internals de Next y estaticos
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```
Convencion Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`): con
carpeta `src/`, el archivo va en `src/proxy.ts` (mismo nivel que `app`), export default o named `proxy`; runtime
Node por defecto, no se configura `runtime`. `/api/webhooks/clerk` pasa por el proxy pero nunca se protege (018).

### `src/modules/auth/hooks/use-current-user.ts` ("use client")
```ts
import type { UserResource } from "@clerk/shared/types"; // o el tipo que exponga useUser().user en 7.x
import type { AuthUser } from "../types/auth.types";

export interface CurrentUser {
  user: AuthUser | null;        // null sin sesion o mientras carga
  isLoaded: boolean;            // useUser().isLoaded; reemplaza useIsClient (evita hydration mismatch)
  signOut: () => Promise<void>; // useClerk().signOut(); Clerk navega luego a afterSignOutUrl (default "/")
}

// Puro, exportado para test. email = primaryEmailAddress?.emailAddress ?? emailAddresses[0]?.emailAddress,
// en minusculas; sin email -> null. fullName = user.fullName trim; vacio -> getNameFromEmail(email).
export function toAuthUser(user: UserResource | null | undefined): AuthUser | null;

export function useCurrentUser(): CurrentUser;
```

### `src/modules/auth/components/user-menu.tsx` (cambio)
- `useIsClient()` + `useAuthStore` -> `const { user, isLoaded, signOut } = useCurrentUser()`.
- Condicion del link "Iniciar sesion": `!isLoaded || !user` (antes `!isClient || !user`). Mismo href/onClick.
- "Cerrar sesion" (dropdown y `sheet`): `onClick={() => void signOut()}`.
- Props (`UserMenuProps`), `MY_TICKETS_PATH`, `UserAvatar` y markup: sin cambios.

### `login-form.tsx` / `register-form.tsx` (reescritura, mismos nombres exportados `LoginForm` / `RegisterForm`)
```tsx
"use client";
// const redirect = useSearchParams().get("redirect");
// <>
//   <AuthTabs current="/login" />
//   <SignIn path="/login" signUpUrl={getAuthHref("/register", redirect)}
//           fallbackRedirectUrl={getSafeRedirect(redirect)} />
// </>
// RegisterForm: <AuthTabs current="/register" /> + <SignUp path="/register"
//   signInUrl={getAuthHref("/login", redirect)} fallbackRedirectUrl={getSafeRedirect(redirect)} />
```
- `fallbackRedirectUrl` (no `forceRedirectUrl`): asi el `?redirect_url=` que pondra `auth.protect()` en la fase 3
  tiene precedencia sin tocar estos archivos.
- Ya no importan store, `useAuthForm`, schema, `GoogleSignInButton`, `AuthDivider`, `AuthSignedIn`,
  `DEMO_ACCOUNT` ni `DEV_INBOX_PATH` (quedan sin uso hasta la fase 4). Google y "olvide mi contraseña" los provee el
  propio componente Clerk (Google segun la social connection del dashboard).
- Con sesion activa, Clerk (modo single-session) redirige solo al `fallbackRedirectUrl`: reemplaza a
  `AuthSignedIn`.

### Paginas
- `src/app/(auth)/login/[[...sign-in]]/page.tsx`: contenido identico al `login/page.tsx` actual (metadata +
  `<Suspense>` + `<LoginForm />`; el Suspense sigue siendo necesario por `useSearchParams` en `LoginForm`/`AuthTabs`).
  Se **borra** `src/app/(auth)/login/page.tsx` (dos `page.tsx` en `/login` chocan con el catch-all opcional).
- `src/app/(auth)/register/[[...sign-up]]/page.tsx`: idem con `RegisterForm`; se borra `register/page.tsx`.

### Env / build
Sin cambios en `.env.example` (las 5 vars ya estan desde 018, incluidas `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login` y
`NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register`). Desde esta fase `npm run build` y `npm run dev` **requieren**
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` en `.env.local` (ClerkProvider/proxy los leen).

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar `@clerk/localizations` | package.json, package-lock.json | - | S |
| T2 | `ClerkProvider` con `esES` en el root layout | src/app/layout.tsx | T1 | P1 |
| T3 | `src/proxy.ts` con `clerkMiddleware()` sin proteccion + matcher | src/proxy.ts | - | P1 |
| T4 | Hook `useCurrentUser` + `toAuthUser` + test; `UserMenu` pasa a usarlo | src/modules/auth/hooks/use-current-user.ts, src/modules/auth/hooks/use-current-user.test.ts, src/modules/auth/components/user-menu.tsx | - | P1 |
| T5 | Login/registro con Clerk: reescribir forms y mover paginas a catch-all (borrar las `page.tsx` viejas) | src/modules/auth/components/login-form.tsx, src/modules/auth/components/register-form.tsx, src/app/(auth)/login/page.tsx (borrar), src/app/(auth)/login/[[...sign-in]]/page.tsx, src/app/(auth)/register/page.tsx (borrar), src/app/(auth)/register/[[...sign-up]]/page.tsx | - | P1 |

Orden: T1 -> {T2 ‖ T3 ‖ T4 ‖ T5}. T3, T4 y T5 no dependen de T1 (pueden arrancar ya); T2 si (importa
`@clerk/localizations`). Archivos disjuntos entre tareas. 5 tareas; 9 archivos escritos a mano (+ lockfile y 2
borrados): pasa levemente el tope de ~8 porque 2 `page.tsx` son movimientos sin cambio de contenido.

## Criterios de aceptacion
- [ ] AC1: Con keys de Clerk en `.env.local`, `/login` muestra `AuthTabs` + `<SignIn>` en español; `/register`
  muestra `AuthTabs` + `<SignUp>` en español. Las tabs conservan `?redirect=`.
- [ ] AC2: Registrarse con email+password y con Google desde `/register?redirect=/events` termina en `/events` con
  sesion activa. Iniciar sesion desde `/login?redirect=/events/<slug>` vuelve a esa ruta. `?redirect=https://evil.com`
  o `//evil.com` cae en `/`.
- [ ] AC3: Subrutas de Clerk (`/login/factor-one`, `/login/sso-callback`, flujo "¿Olvidaste tu contraseña?" de Clerk)
  renderizan dentro de `AuthLayout` sin 404.
- [ ] AC4: Header con sesion Clerk: `UserMenu` muestra iniciales, nombre y email del usuario de Clerk (desktop
  dropdown y `sheet` mobile). "Cerrar sesion" cierra la sesion de Clerk y el header vuelve a "Iniciar sesion".
  Sin sesion, "Iniciar sesion" lleva a `/login?redirect=<ruta actual con query>` como antes.
- [ ] AC5: Sin parpadeo ni hydration warning en el header: mientras `isLoaded` es `false` se muestra el link
  "Iniciar sesion" (igual que el SSR actual).
- [ ] AC6: `src/proxy.ts` existe, no existe `src/middleware.ts`, y ninguna ruta redirige por auth (`/organizer`,
  `/my-tickets`, checkout siguen comportandose segun el store mock). `POST /api/webhooks/clerk` sigue respondiendo
  igual que en 018 (400 con firma invalida).
- [ ] AC7: `site-header.tsx`, los 7 archivos de fase 3 listados en Excluye y el codigo mock de fase 4 no tienen
  cambios (`git diff --stat` no los lista).
- [ ] AC8: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` (con keys) sin errores.

## Tests requeridos
- `use-current-user.test.ts` (Vitest + RTL `renderHook`, `vi.mock("@clerk/nextjs")`):
  - `toAuthUser`: `null`/`undefined` -> `null`; usa `primaryEmailAddress` aunque no sea el primero de
    `emailAddresses`; sin primario cae al primero; email en minusculas; sin `fullName` (o solo espacios) usa
    `getNameFromEmail`; sin ningun email -> `null`.
  - `useCurrentUser`: con `isLoaded: false` devuelve `{ user: null, isLoaded: false }`; con usuario mapea a
    `AuthUser`; `signOut()` llama a `useClerk().signOut`.
- `user-menu.tsx`: opcional (condicional simple, cubierto por AC4/AC5). `login-form`/`register-form`, layout y proxy:
  sin test unitario (glue de componentes de Clerk; se validan en AC1-AC3 y AC6).

## Preguntas abiertas
Ninguna bloquea; defaults tomados, ajustables al aprobar:
1. **Loop posible entre fase 2 y 3.** `organizer-shell` y `my-tickets` redirigen a `/login?redirect=...` cuando el
   store mock no tiene usuario; si hay sesion Clerk, `<SignIn>` redirige de vuelta y se forma un ciclo
   `/organizer <-> /login`. Sin sesion Clerk se ve el login normal, pero tras loguear no se puede entrar (el mock
   sigue vacio). Default: aceptarlo como estado intermedio de desarrollo (018 ya lo declara "no desplegar") y
   ejecutar la spec 020 inmediatamente despues. Alternativa: adelantar a esta spec el cambio de esos dos componentes
   a `useCurrentUser()` (+2 archivos, rompe el limite de alcance y mezcla fases).
2. **Destino tras cerrar sesion:** default de Clerk (`/`). El mock se quedaba en la pagina actual. Si se prefiere
   mantener la pagina: `signOut({ redirectUrl: pathname })`, cambio de una linea en el hook.
3. **Localizacion `esES`** (España). Alternativas `esMX`/`esUY` si se prefiere español latinoamericano.

## Estado
- Aprobacion humana: aprobada (2026-09-30)
- Log de review:
  - 2026-09-30 reviewer iter 1: APPROVED. AC6-AC8 verificados (tsc/lint/test 224/build ok; proxy.ts sin proteccion;
    sin middleware.ts; sin colision de rutas; AC7 limpio). AC1-AC5 revisados solo en el codigo: falta probarlos con
    keys reales de Clerk. Pendiente: commitear la fase 018 por separado de la 019.
- Fase: aprobado
- Decisiones de aprobacion: loop /organizer<->/login entre 019 y 020 se acepta como estado dev temporal (spec 020 se
  ejecuta enseguida despues); localizacion `esES` confirmada.
