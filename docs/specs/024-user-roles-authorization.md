# 024 — Roles en DB: super admin, rol por invitacion y autorizacion en servidor

> Numeracion: 020/021 estan reservadas por la spec 018 (fases 3 y 4 de Clerk, backlog) y 023 por la 022 (UI de pago).
> Esta spec arranca en 024 y redistribuye parte del alcance de 020 (ver "Decisiones > D5").

## Contexto
Pedido del usuario: conectar la autenticacion de Clerk con la base para manejar roles y permisos; el super admin
(`pontevegadavid@gmail.com`) debe poder **crear** administradores y organizadores y gestionar sus roles; preparar un
seed de eventos (sin ejecutarlo).

Estado actual (specs 018/019, implementadas):
- `users.role` (`super_admin | admin | organizer | customer`, default `customer`) existe pero **nada lo escribe**: el
  webhook de Clerk (`user-sync.service.ts`) nunca toca `role`. Hoy todos los usuarios son `customer`.
- `src/proxy.ts` es `clerkMiddleware()` sin proteccion. No hay ninguna verificacion de rol en servidor.
- La app esta en estado mixto: login real con Clerk, pero `organizer-shell`, `organizer-dashboard`, `event-form`,
  `checkout-form` y `my-tickets` siguen leyendo el store mock `useAuthStore` (confirmado con grep).

El pedido completo (rol en DB + proteccion de rutas por rol + gestion de usuarios via Clerk Backend API + UI + seed)
excede una sesion. Esta spec es la **Fase 1**: el rol pasa a tener fuente de verdad y forma de leerse en servidor.
No cambia nada visible.

### Fases

| Fase | Spec | Entrega | Estado de la app al terminar |
|------|------|---------|------------------------------|
| 1 | **024 (esta)** | Webhook asigna rol (super admin por email, rol de invitacion via `public_metadata`); DAL `getCurrentDbUser()` / `requireRole()`; constantes de permisos | Sin cambios visibles. `users.role` correcto para super admin e invitados. |
| — | 025 (escrita, independiente) | Seed de eventos del mock en `events`/`ticket_tiers` (script, no se ejecuta) | Sin cambios visibles. |
| 2 | 026 (backlog) | Proteccion de rutas: proxy por sesion + `requireRole` en paginas `/organizer`; `OrganizerShell` con `useCurrentUser()` | `/organizer` solo para staff; `/my-tickets`, checkout y confirmation exigen sesion. |
| 3 | 027 (backlog) | `/admin/users` (solo super admin): listar usuarios, invitar admin/organizador, cambiar rol | El super admin gestiona usuarios desde la app. |
| 4 | 020 (backlog, alcance reducido) | Migrar `organizer-dashboard`, `event-form` (+test), `checkout-form`, `my-tickets` (+test) a `useCurrentUser()` | Ningun consumidor lee el store mock. |
| 5 | 021 (backlog, sin cambios) | Borrado del codigo mock de auth | Sin mock. |

Orden de dependencia: 024 -> 026 -> 027. 025 no depende de nadie. 020 puede ir despues de 026 en cualquier momento.

## Decisiones (bloquean la aprobacion; cada una tiene default propuesto)

### D1 — Donde vive el rol y como se lee
- **Fuente de verdad unica: `users.role` en Postgres.** Se lee en servidor en cada request que lo necesita:
  `auth()` de Clerk -> `userId` -> `SELECT ... FROM users WHERE clerk_id = $1 AND deleted_at IS NULL` (indice unique
  de `clerk_id`, una query por render de pagina protegida).
- **Donde se verifica:** en las paginas server y en las server actions, via `requireRole()` (DAL). **No en layouts**
  (la guia `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, "Layouts and auth checks", lo
  desaconseja: no se re-renderizan al navegar y no impiden que se rendericen los segmentos hijos ni las actions).
- **El proxy no lee el rol:** solo exige sesion (`auth.protect()`, fase 026). Asi el proxy no hace queries a la DB en
  cada request.
- **Cliente:** no hay hook de rol en cliente en esta fase. Si una UI necesita el rol (ej. mostrar un link a
  `/admin/users`), la page server lo pasa como prop. Ocultar UI nunca reemplaza el chequeo en servidor.
- **Alternativa descartada:** espejar el rol en `publicMetadata` de Clerk y exponerlo en el session token
  (`sessionClaims.metadata.role`, el RBAC documentado por Clerk). Evita la query, pero: (a) dos fuentes de verdad que
  hay que mantener sincronizadas en cada cambio de rol (fallo parcial DB ok / Clerk falla = desincronizado);
  (b) requiere configurar a mano el session token en el dashboard; (c) el claim queda cacheado hasta que se refresca
  el token, asi que un rol revocado sigue valido un rato. Se reconsidera si algun dia el proxy necesita el rol.

### D2 — Como se vuelve `super_admin` `pontevegadavid@gmail.com`
- Constante `SUPER_ADMIN_EMAIL` en `user.constants.ts` (pedido explicito del usuario; ver Preguntas abiertas 6).
- En `mapClerkUser`: si el email primario normalizado es `SUPER_ADMIN_EMAIL` **y** esta verificado
  (`verification.status === "verified"` en `email_addresses`), el rol resuelto es `super_admin`. Exigir verificacion
  es defensa en profundidad: nadie obtiene el rol registrando ese correo sin probar que es suyo.
- En `upsertUserFromClerk`: el `INSERT` lleva el rol resuelto; el `SET` del conflicto incluye `role: "super_admin"`
  **solo** cuando el rol resuelto es `super_admin`. Cubre alta nueva y fila ya existente (que hoy es `customer`).
  Ningun otro rol se escribe en el conflicto, asi que el webhook nunca pisa cambios hechos desde la app.
- **Nunca degrada:** si el super admin cambia su email primario, conserva el rol (correccion manual en DB si hiciera
  falta). Clerk no permite dos cuentas con el mismo email verificado, asi que solo una cuenta puede tenerlo.
- **Bootstrap de la cuenta existente** (si `pontevegadavid@gmail.com` ya esta en `users` como `customer`): no hay
  script ni migracion de datos. El rol se aplica en el siguiente `user.updated`: editar el nombre en Clerk, o en el
  dashboard de Clerk -> Webhooks -> endpoint -> mensaje `user.*` de esa cuenta -> **Replay**. Paso documentado en AC2.

### D3 — Como el super admin crea admins y organizadores
- **Invitaciones de Clerk** (`clerkClient.invitations.createInvitation({ emailAddress, publicMetadata: { role },
  redirectUrl })`, tipado en `@clerk/backend` `InvitationApi.d.ts`). Clerk envia el email; el invitado se registra
  con `<SignUp>` en `/register` (el componente consume el ticket de invitacion solo); al aceptar, Clerk copia el
  `publicMetadata` de la invitacion al `public_metadata` del usuario y lo manda en `user.created`.
- **Esta spec** implementa solo el lado receptor: `mapClerkUser` lee `public_metadata.role`; si es un rol asignable
  (`admin | organizer | customer`) ese es el rol inicial, si no `customer`. `super_admin` **nunca** se acepta por
  metadata (solo D2). El rol de metadata solo se usa en el `INSERT` (alta), nunca en el `SET` del conflicto: despues
  del alta la DB manda y los cambios del super admin (027) no se pisan con metadata vieja. `public_metadata` solo se
  escribe con la Backend API (secret key), por eso es confiable.
- La creacion de la invitacion (servicio + server action + UI) es la fase 027.
- Usuario que ya se registro solo (es `customer`): no se invita (Clerk rechaza invitar un email existente); se le
  cambia el rol desde la lista (027).
- **Alternativas descartadas:**
  - `clerkClient.users.createUser({ emailAddress, password })`: el super admin tendria que inventar una contraseña y
    hacersela llegar al invitado por otro canal (inseguro, sin cambio forzado), y no sirve para quien usa Google.
  - Tabla propia `pending_role_assignments(email, role)` aplicada en el webhook: duplica lo que la invitacion de Clerk
    ya guarda, agrega migracion y hay que limpiarla.

### D4 — Permisos
El enum de 4 roles **es** el modelo de permisos (sin tabla de permisos granular: nadie la pide hoy, YAGNI; ver
Preguntas abiertas 5). Matriz:

| Capacidad | super_admin | admin | organizer | customer |
|-----------|:-----------:|:-----:|:---------:|:--------:|
| Gestionar usuarios y roles (`/admin/users`, 027) | si | no | no | no |
| Panel de organizador (`/organizer`, 026) | si | si | si | no |
| Comprar / ver sus entradas (requiere sesion, 026) | si | si | si | si |

Se expresa como constantes (`USER_ADMIN_ROLES`, `ORGANIZER_AREA_ROLES`) que se pasan a `requireRole()`. Cambiar un
permiso = cambiar una constante.

### D5 — Relacion con las specs 020 y 021 (backlog de la 018)
- 020 estaba planeada como: migrar 5 consumidores a `useCurrentUser()` + proteger rutas por sesion en `src/proxy.ts`.
  La proteccion por sesion sola quedaria obsoleta enseguida (el pedido exige rol), asi que **la proteccion de rutas
  sale de 020 y pasa a 026**, que la hace una sola vez por sesion (proxy) + rol (paginas). Tambien pasa a 026
  `organizer-shell.tsx`, porque es el guard cliente del area `/organizer` y sin migrarlo el area queda en loop
  `/organizer` <-> `/login` (estado aceptado en 019).
- **020 queda reducida** a migrar `organizer-dashboard`, `event-form` (+test), `checkout-form`, `my-tickets` (+test)
  a `useCurrentUser()`. Se escribe cuando toque; no se crea ahora.
- **021 sin cambios** (borrado del mock), despues de 020.
- No se edita la spec 018 (aprobada); esta seccion es la referencia vigente del reparto.

### D6 — Seed
Spec separada **025** (`docs/specs/025-seed-events-from-mocks.md`): independiente de los roles salvo que el script
valida que el organizador destino tenga `role = 'organizer'` (columna que ya existe).

## Alcance
- Incluye (Fase 1):
  - Constantes de roles y permisos del modulo `user` (incluye `SUPER_ADMIN_EMAIL`).
  - Tipos `UserRole` y `AssignableRole`.
  - `mapClerkUser` resuelve el rol (D2 + D3); `upsertUserFromClerk` lo escribe segun D2.
  - Servicio server `user-access.service.ts`: `getCurrentDbUser()`, `requireRole()` (+ test).
  - Barrel `src/modules/user/index.ts`.
- Excluye:
  - Cambios en `src/proxy.ts`, paginas o componentes (026).
  - Crear invitaciones, listar usuarios, cambiar roles desde la app (027).
  - Espejar el rol en Clerk `publicMetadata` (D1).
  - Migraciones: no hay cambios de schema.
- Backlog: 026, 027, 020 reducida, 021 (tabla "Fases"); contratos de referencia en "Contratos de fases siguientes".

## Reuso detectado
- `src/modules/user/db/user.table.ts`: `users`, `userRoleEnum` — sin cambios (el enum ya tiene los 4 roles).
- `src/modules/user/types/user.types.ts`: `UserEntity`, `NewUser` — se agregan dos alias de tipo, nada mas.
- `src/modules/user/services/user-sync.service.ts` + test: se extiende `mapClerkUser`/`upsertUserFromClerk`; el
  despacho de eventos y el soft delete no cambian. Los helpers de test (`buildUserJson`, mocks de `db`) se reusan.
- `src/lib/db.ts`: cliente drizzle, sin cambios.
- `@clerk/nextjs/server`: `auth()` (userId en servidor) y, en 027, `clerkClient()`. Tipo `UserJSON` ya trae
  `public_metadata` y `email_addresses[].verification`.
- `next/navigation` `redirect()`: funciona en server components y server actions. No se usa `forbidden()` /
  `unauthorized()` porque requieren el flag experimental `authInterrupts`.
- No se instala `server-only` (no esta en el proyecto): `user-access.service.ts` solo se importa desde paginas y
  actions server, igual que `user-sync.service.ts` hoy.
- Nada en `src/hooks`, `src/components/*` ni shadcn aplica: esta fase no tiene UI.

## Contratos

### `src/modules/user/types/user.types.ts` (se agrega)
```ts
export type UserRole = UserEntity["role"]; // "super_admin" | "admin" | "organizer" | "customer"
export type AssignableRole = Exclude<UserRole, "super_admin">; // lo que se puede invitar/asignar desde la app
```

### `src/modules/user/constants/user.constants.ts` (nuevo)
```ts
import type { AssignableRole, UserRole } from "../types/user.types";

export const SUPER_ADMIN_EMAIL = "pontevegadavid@gmail.com"; // en minusculas: se compara con el email normalizado

export const ASSIGNABLE_ROLES = ["admin", "organizer", "customer"] as const satisfies readonly AssignableRole[];

// Matriz de permisos (D4)
export const USER_ADMIN_ROLES = ["super_admin"] as const satisfies readonly UserRole[];
export const ORGANIZER_AREA_ROLES = ["super_admin", "admin", "organizer"] as const satisfies readonly UserRole[];
```

### `src/modules/user/services/user-sync.service.ts` (cambio)
```ts
export type ClerkUserFields = Pick<NewUser, "clerkId" | "email" | "fullName"> & { role: UserRole };

// Igual que hoy + role:
//   1. email primario normalizado === SUPER_ADMIN_EMAIL y su verification.status === "verified" -> "super_admin"
//   2. si no, public_metadata.role incluido en ASSIGNABLE_ROLES -> ese rol
//   3. si no -> "customer"
// Puro (sin DB). public_metadata ausente/null/no-objeto o role invalido (incluido "super_admin") -> regla 3.
export function mapClerkUser(data: UserJSON): ClerkUserFields;

// insert(users).values(fields)  <- incluye role
//   .onConflictDoUpdate({ target: users.clerkId,
//     set: { email, fullName, deletedAt: null, updatedAt: now, ...(fields.role === "super_admin" ? { role } : {}) } })
// Sigue sin tocar phone. Idempotente.
export async function upsertUserFromClerk(data: UserJSON): Promise<void>;
// softDeleteUserByClerkId y handleClerkWebhookEvent: sin cambios.
```

### `src/modules/user/services/user-access.service.ts` (nuevo, server)
```ts
import type { UserEntity, UserRole } from "../types/user.types";

// auth() -> sin userId -> null.
// SELECT * FROM users WHERE clerk_id = userId AND deleted_at IS NULL LIMIT 1 -> fila o null
// (null tambien si el webhook todavia no creo la fila o el usuario esta soft-deleted).
export async function getCurrentDbUser(): Promise<UserEntity | null>;

// Sin sesion (auth().userId null) -> redirect("/login").
// Sesion sin fila activa o role no incluido en `allowed` -> redirect("/").
// OK -> devuelve la fila (la page/action reusa id/role sin otra query).
// Uso: primera linea de cada page y server action protegida (D1). Nunca en layouts.
export async function requireRole(allowed: readonly UserRole[]): Promise<UserEntity>;
```

### `src/modules/user/index.ts` (se agrega)
```ts
export { getCurrentDbUser, requireRole } from "./services/user-access.service";
export {
  ASSIGNABLE_ROLES,
  ORGANIZER_AREA_ROLES,
  SUPER_ADMIN_EMAIL,
  USER_ADMIN_ROLES,
} from "./constants/user.constants";
export type { AssignableRole, UserRole } from "./types/user.types";
```
El barrel de `user` es solo de servidor (exporta tablas y servicios con `db`); ningun componente cliente lo importa.

### Contratos de fases siguientes (referencia, no se implementan aqui)
```ts
// 026 — src/proxy.ts
// const isProtectedRoute = createRouteMatcher(["/organizer(.*)", "/admin(.*)", "/my-tickets",
//   "/events/(.*)/checkout", "/events/(.*)/confirmation"]);
// export default clerkMiddleware(async (auth, req) => { if (isProtectedRoute(req)) await auth.protect(); });
// /api/webhooks/* nunca se protege. /events/:slug/tickets sigue publico (pregunta 5 de la 018).
// 026 — (organizer)/organizer/page.tsx y organizer/events/new/page.tsx: async, `await requireRole(ORGANIZER_AREA_ROLES)`.
// 026 — organizer-shell.tsx: useCurrentUser() (user + signOut) en vez de useAuthStore; se elimina su redirect cliente
//        y el gate useIsClient (el guard es el servidor). auth/index.ts exporta useCurrentUser.

// 027 — src/modules/user/services/user-admin.service.ts (server)
export async function listUsers(): Promise<UserEntity[]>; // activos, created_at desc
export async function inviteUser(
  input: { email: string; role: AssignableRole },
  context: { origin: string },
): Promise<{ ok: true } | { ok: false; error: "already-registered" | "invitation-failed" }>;
// email ya en users activo -> already-registered (se cambia el rol, no se invita)
// clerkClient().invitations.createInvitation({ emailAddress, publicMetadata: { role }, redirectUrl: `${origin}/register` })
export async function changeUserRole(input: { userId: string; role: AssignableRole }): Promise<boolean>;
// UPDATE users SET role, updated_at WHERE id = $1 AND role <> 'super_admin' AND deleted_at IS NULL -> false si 0 filas
// (el super admin no se degrada a si mismo ni nadie asigna super_admin: AssignableRole lo excluye)
// 027 — src/modules/user/schemas/user-admin.schema.ts: inviteUserSchema { email: z.email(), role: z.enum(ASSIGNABLE_ROLES) },
//        changeUserRoleSchema { userId: z.uuid(), role: z.enum(ASSIGNABLE_ROLES) }
// 027 — src/modules/user/actions/user-admin.actions.ts ("use server"): inviteUserAction, changeUserRoleAction
//        (useActionState); cada una: await requireRole(USER_ADMIN_ROLES) -> safeParse -> service -> revalidatePath("/admin/users")
// 027 — shadcn `table` (npx shadcn@latest add table); src/app/(main)/admin/users/page.tsx con requireRole(USER_ADMIN_ROLES)
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Tipos `UserRole`/`AssignableRole` y constantes de roles/permisos | src/modules/user/types/user.types.ts, src/modules/user/constants/user.constants.ts | - | S |
| T2 | Resolucion de rol en `mapClerkUser` + escritura en `upsertUserFromClerk` (D2, D3) + tests | src/modules/user/services/user-sync.service.ts, src/modules/user/services/user-sync.service.test.ts | T1 | P1 |
| T3 | DAL `getCurrentDbUser`/`requireRole` + test | src/modules/user/services/user-access.service.ts, src/modules/user/services/user-access.service.test.ts | T1 | P1 |
| T4 | Exports en el barrel de `user` | src/modules/user/index.ts | T2, T3 | S |

Orden: T1 -> (T2 ‖ T3) -> T4. 4 tareas, 7 archivos, sin migraciones.

## Criterios de aceptacion
- [ ] AC1: Tests de `user-sync.service` cubren la tabla de resolucion de rol (ver "Tests requeridos") y pasan.
- [ ] AC2 (manual, con Clerk y tunel): login con `pontevegadavid@gmail.com` deja su fila con `role = 'super_admin'`.
  Cuenta nueva: al registrarse. Cuenta ya existente: tras editar el nombre en Clerk o hacer Replay de un mensaje
  `user.*` de esa cuenta en el dashboard de Clerk.
- [ ] AC3 (manual): una invitacion creada con la Backend API con `public_metadata: {"role":"organizer"}`
  (`curl -X POST https://api.clerk.com/v1/invitations -H "Authorization: Bearer $CLERK_SECRET_KEY"
  -H "Content-Type: application/json" -d '{"email_address":"x@example.com","public_metadata":{"role":"organizer"}}'`)
  y aceptada con `/register` crea la fila con `role = 'organizer'`. Con `{"role":"super_admin"}` queda `customer`.
- [ ] AC4 (manual): cambiar a mano en DB el rol de ese invitado a `admin` y luego editar su nombre en Clerk: el rol
  sigue `admin` (el metadata viejo no lo pisa). Un usuario sin metadata registrado normalmente queda `customer`.
- [ ] AC5: `requireRole` redirige a `/login` sin sesion, a `/` sin fila activa o con rol no permitido, y devuelve la
  fila cuando el rol esta permitido (cubierto por tests).
- [ ] AC6: Ningun cambio visible en la UI; `src/proxy.ts`, paginas y componentes no se tocan.
- [ ] AC7: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `user-sync.service.test.ts` (extender el existente; `buildUserJson` gana `publicMetadata` y estado de verificacion
  del email):
  - `mapClerkUser`: `SUPER_ADMIN_EMAIL` verificado (tambien con mayusculas en Clerk) -> `super_admin`; el mismo email
    sin verificar -> `customer`; `SUPER_ADMIN_EMAIL` como email **no** primario -> no es super admin;
    `public_metadata.role` `organizer`/`admin` -> ese rol; `super_admin` o valor desconocido o metadata ausente ->
    `customer`; super admin gana sobre metadata.
  - `upsertUserFromClerk` / `handleClerkWebhookEvent`: `values` incluye `role`; el `set` del conflicto incluye
    `role: "super_admin"` solo para el super admin y **no** incluye `role` para invitados ni customers. Se actualiza
    el test existente "sin role" a la nueva expectativa.
- `user-access.service.test.ts` (`vi.mock("@clerk/nextjs/server")` para `auth`, `vi.mock("@/lib/db")`,
  `vi.mock("next/navigation")` con `redirect` que lanza): sin sesion -> `null` / redirect `/login`; sesion sin fila ->
  `null` / redirect `/`; rol fuera de `allowed` -> redirect `/`; rol permitido -> devuelve la fila; la query filtra
  `deleted_at IS NULL`.

## Preguntas abiertas
Bloqueantes (default propuesto en "Decisiones"; aprobar la spec = aceptar los defaults):
1. **D1 — rol leido de Postgres en servidor**, sin espejo en `publicMetadata`/session token.
2. **D3 — invitaciones de Clerk** con `publicMetadata.role`, aplicado solo en el alta. Requiere que la instancia de
   Clerk permita registro con invitacion (modo "Public" o "Restricted"; ambos aceptan invitaciones).
3. **Que puede hacer un `admin`.** El pedido solo dice que el super admin los crea. Default: `admin` = acceso al
   panel `/organizer`, sin gestion de usuarios. Si `admin` tambien deberia invitar organizadores o ver todos los
   eventos, decirlo ahora (cambia `USER_ADMIN_ROLES` y la logica de 027).
4. **D5 — reparto de 020:** la proteccion de rutas y `organizer-shell` pasan a 026; 020 queda reducida a 4
   consumidores; 021 sin cambios.

No bloqueantes:
5. **Permisos granulares** (tabla `permissions` / `role_permissions`): no se crean; la matriz D4 cubre el pedido.
   Si se necesitan permisos por usuario (ej. un organizador que no puede publicar), es una spec nueva.
6. **Email del super admin hardcodeado** en `user.constants.ts` (pedido explicito). Alternativa: env var
   `SUPER_ADMIN_EMAIL` si se quiere distinto por entorno (prod vs dev).
7. **Sin degradacion automatica** si el super admin cambia su email primario: conserva el rol.
8. **Usuarios existentes** quedan `customer`; se promueven en 027 (o a mano en DB mientras tanto).

## Estado
- Aprobacion humana: aprobada
- Fase: implementada (estado actualizado en P1-09, 2026-10-10)
- Log de review: Sin review formal registrado; codigo y tests presentes (comprobado en P1-09, 2026-10-10). Suite completa (552 tests), tsc, eslint y build en verde.
