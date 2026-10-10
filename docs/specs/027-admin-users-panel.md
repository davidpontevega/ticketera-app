# 027 — Gestion de usuarios del super admin (servidor): listar, invitar, cambiar rol, eliminar

> Fase 3 del plan de `docs/specs/024-user-roles-authorization.md` (seccion "Fases"). Los contratos de referencia de
> la 024 ("Contratos de fases siguientes", 027) se amplian aca: el pedido actual es CRUD completo + filtros +
> paginacion, no solo invitar + cambiar rol.
> **Dos specs secuenciales** (mismo patron que 022/023):
> - **027 (esta):** todo el lado servidor — servicio, schemas, server actions, tests. Sin UI.
> - **028 (backlog, se escribe al aprobar esta):** UI — pagina `/admin/users`, shell del area admin, tabla, filtros,
>   paginacion y dialogo segun el diseño aprobado. Sus decisiones de estructura quedan fijadas aca (D6-D8) para que
>   la aprobacion de esta spec las cubra; los contratos de 028 estan en "Contratos de la fase 2".

## Contexto
Pedido del usuario: "implementa el diseño y el CRUD de usuarios". El super admin (`pontevegadavid@gmail.com`) debe
poder, desde la app: ver los usuarios con su rol (busqueda, filtro por rol y estado, paginacion), invitar
administradores y organizadores, cambiar el rol de un usuario existente y eliminar usuarios.

Estado actual (024 implementada): `users.role` tiene fuente de verdad y se escribe en el webhook (super admin por
email verificado, rol de invitacion por `public_metadata.role` solo en el alta). `requireRole()` existe. No hay ninguna
server action en el proyecto (esta spec define el patron). Nada lista, invita, cambia roles ni elimina desde la app.

El alcance completo (servidor + UI responsive con shell, tabla, filtros, paginacion y dialogo de 3 estados) son ~22
archivos: excede una fase (~8 archivos). Se divide en 027 (servidor, 8 archivos) y 028 (UI, ~12 archivos). No se
recorta alcance.

### Fases
| Fase | Spec | Entrega | Estado de la app al terminar |
|------|------|---------|------------------------------|
| 1 | **027 (esta)** | `listUsers` (filtros + paginacion server-side), `inviteUser`, `changeUserRole`, `deleteUser`; schemas zod; server actions protegidas con `requireRole` | Sin cambios visibles. Las actions existen y estan testeadas. |
| 2 | 028 (backlog) | `/admin/users` con shell admin (sidebar + drawer), filtros, tabla con badges, paginacion, dialogo invitar/editar rol/eliminar | El super admin gestiona usuarios desde la app. |

027 no depende de 026 (proteccion de rutas): cada action y la page de 028 llaman a `requireRole` (D1 de la 024).

## Decisiones (bloquean la aprobacion; cada una tiene default propuesto)

### D1 — Paginacion y busqueda: server-side (SQL), por URL
- `listUsers(params)` hace `WHERE` (rol, estado, `ILIKE` sobre `full_name` o `email`) + `ORDER BY created_at DESC, id
  DESC` + `LIMIT/OFFSET`, y un `count` con el mismo `WHERE`. Los parametros vienen de `searchParams` de la page
  (`?q=&role=&status=&page=`), parseados con un schema zod que nunca falla (valores invalidos -> default).
- **Por que server-side y no client-side:** el costo es el mismo (dos queries con el mismo `where` vs. filtrar un array
  en el componente), pero client-side obliga a mandar toda la tabla `users` al navegador (emails de todos) y crece sin
  limite. Por URL: el estado de filtros es compartible, sobrevive al refresh y no necesita store. En 028 el formulario
  de filtros es un `next/form` GET (navegacion cliente sin codigo de estado propio).
- Tamaño de pagina fijo `USERS_PAGE_SIZE = 10` (sin selector: YAGNI). Si `page` excede el total, se devuelve la ultima
  pagina (caso tipico: eliminar el unico usuario de la ultima pagina).
- Busqueda: `%q%` con `\`, `%` y `_` escapados (el usuario no inyecta comodines). `q` se recorta y se limita a 100
  caracteres; vacio = sin filtro.

### D2 — Estado (Activos / Todos)
- `status=active` (default): `deleted_at IS NULL`. `status=all`: incluye eliminados (soft-deleted), que en 028 se ven
  con badge "Eliminado" y **sin acciones** (no hay "restaurar": ver D4).
- Se mantiene porque esta en el diseño aprobado y cuesta una condicion en el `WHERE`.

### D3 — Invitar: solo `admin` y `organizer`; Clerk invitations
- Roles invitables: `INVITABLE_ROLES = ["admin", "organizer"]` (el diseño: el select de invitar solo ofrece esos dos;
  invitar a un `customer` no tiene sentido, se registra solo).
- `inviteUser`: si ya hay una fila **activa** en `users` con ese email -> `already-registered` (se le cambia el rol desde
  la lista, D3 de la 024). Si no: `(await clerkClient()).invitations.createInvitation({ emailAddress, publicMetadata:
  { role }, redirectUrl: \`${origin}/register\` })` (firma confirmada en `@clerk/backend` 3.21.1
  `InvitationApi.d.ts`, `clerkClient` de `@clerk/nextjs/server` 7.9.9 es `() => Promise<ClerkClient>`). Sin
  `ignoreExisting` (default `false`): Clerk rechaza duplicados.
- Errores de Clerk (`isClerkAPIResponseError` de `@clerk/nextjs/errors`): codigo `duplicate_record` -> `already-invited`;
  `form_identifier_exists` -> `already-registered` (existe en Clerk pero no activo en nuestra DB, ej. webhook atrasado);
  cualquier otro error -> `invitation-failed` (se loguea con `console.error`). Los codigos se validan en AC5 manual.
- `origin`: la action lo lee de `(await headers()).get("origin")` (toda server action lo trae: Next lo usa para su
  chequeo CSRF). Sin `origin` -> `invitation-failed`.
- El lado receptor (webhook aplica `public_metadata.role` en el alta) ya existe (024). No se toca `user-sync.service.ts`.

### D4 — Eliminar = borrar en Clerk + soft-delete local
- `deleteUser`: busca la fila activa por `id`; si no existe o es `super_admin` -> `not-found`. Llama
  `(await clerkClient()).users.deleteUser(clerkId)` (revoca sesiones y la cuenta) y luego reusa
  `softDeleteUserByClerkId(clerkId)` de `user-sync.service.ts` (sin modificarlo) para que la UI refleje el cambio sin
  esperar al webhook. El webhook `user.deleted` llega despues y repite el soft-delete (idempotente).
- Clerk responde 404 (ya borrado alla) -> se continua con el soft-delete local (deja la DB consistente). Otro error de
  Clerk -> `delete-failed` y **no** se toca la DB.
- La fila no se borra fisicamente: `orders.user_id` es `RESTRICT` (spec 008) y el historial de compras se conserva.
- **Tradeoffs / alternativas descartadas:**
  - *Solo soft-delete local:* el usuario sigue logueado en Clerk y cualquier `user.updated` posterior lo "resucita"
    (`upsertUserFromClerk` hace `deletedAt: null` en el conflicto).
  - *`banUser` en Clerk + soft-delete local:* reversible (`unbanUser`), pero el ban dispara `user.updated` y el webhook
    vuelve a poner `deletedAt: null` -> habria que tocar `user-sync.service.ts` para respetar `banned`. Mas piezas
    para un "restaurar" que nadie pidio.
  - *Costo de la opcion elegida:* irreversible. Si la persona vuelve, se registra de nuevo (o se la invita) y queda como
    fila nueva (`email` no es unique en `users`); sus ordenes viejas quedan en la fila eliminada.

### D5 — Cambiar rol
- Roles asignables: `ASSIGNABLE_ROLES` (`admin | organizer | customer`). `super_admin` nunca se asigna ni se quita:
  el `UPDATE` filtra `role <> 'super_admin' AND deleted_at IS NULL`. Como el unico que puede llamar la action es el
  super admin, esa misma condicion impide que se auto-degrade (no hace falta comparar con el id del actor).
- Cambiar al mismo rol que ya tiene = OK (no-op, devuelve `true`).
- El cambio no se espeja en Clerk `publicMetadata` (D1 de la 024: la DB manda; el metadata solo se lee en el alta).

### D6 — Ruta y shell (fase 028, se fija aca)
- Ruta `src/app/(admin)/admin/users/page.tsx`, route group `(admin)` propio **sin `layout.tsx`**: la page hace
  `const viewer = await requireRole(USER_ADMIN_ROLES)` y renderiza `<AdminShell viewer={...}>`. Asi el shell recibe
  nombre/email/rol de la misma query del guard (una sola query, sin chequeo en layout, D1 de la 024). Si aparecen
  mas paginas admin, se mueve a un layout.
- Shell nuevo en modulo nuevo `src/modules/admin` (`AdminShell`), **sin tocar** `organizer-shell.tsx` ni `/organizer`
  (siguen con el store mock hasta 026). Mismo patron visual que `OrganizerShell` (sidebar `lg`, `Sheet` izquierdo con
  hamburger en mobile). Nav combinado del diseño: seccion "Organizador" (reusa `ORGANIZER_NAV` del barrel de
  `organizer`) visible para `ORGANIZER_AREA_ROLES` + seccion "Administracion" (Usuarios) visible para
  `USER_ADMIN_ROLES`. Cerrar sesion con `<SignOutButton>` de `@clerk/nextjs` (no requiere tocar el barrel de `auth`).
- Duplicacion temporal aceptada: `AdminShell` y `OrganizerShell` comparten markup. **026 debe** usar `AdminShell` en
  `(organizer)` y borrar `OrganizerShell` (anotado en backlog). Hasta entonces, los links "Organizador" del shell
  admin llevan al area `/organizer` con su guard mock (estado conocido desde 019).

### D7 — Formularios con server actions (patron nuevo en el proyecto)
- Guia: `node_modules/next/dist/docs/01-app/02-guides/forms.md` ("useActionState") y `server-actions.md`.
- Firma de cada action: `(prevState: UserAdminActionState, formData: FormData) => Promise<UserAdminActionState>`,
  consumida con `useActionState` en 028. Cada action: `await requireRole(USER_ADMIN_ROLES)` (primera linea) ->
  `safeParse(Object.fromEntries(formData))` -> servicio -> `revalidatePath(ADMIN_USERS_PATH)` si hubo cambio.
  `revalidatePath` re-renderiza la page en el mismo roundtrip (`server-actions.md`), sin refetch manual.

### D8 — Componentes UI (fase 028, se fija aca)
- shadcn a instalar en 028 (confirmado que no estan en `src/components/ui/` y que existen en el registro
  `base-nova`): `dialog`, `table`, `pagination`.
- Se reusa `native-select` (ya instalado) para los selects de rol/estado: no se instala `select`.
- No se usa `@tanstack/react-table` (instalado): la tabla no ordena ni filtra en cliente (D1); `Table` de shadcn basta.

## Alcance
- Incluye (027):
  - Tipos y constantes del CRUD en el modulo `user`.
  - Schemas zod: parametros de lista, invitar, cambiar rol, eliminar (+ test).
  - Servicio server `user-admin.service.ts`: `listUsers`, `inviteUser`, `changeUserRole`, `deleteUser` (+ test).
  - Server actions `user-admin.actions.ts`: `inviteUserAction`, `changeUserRoleAction`, `deleteUserAction` (+ test).
- Excluye:
  - Toda la UI, la page y el barrel (028).
  - `user-sync.service.ts`, `user-access.service.ts`, `src/proxy.ts`, `organizer-shell.tsx`: sin cambios.
  - Migraciones: no hay cambios de schema (`deleted_at` ya existe).
  - Espejar el rol en Clerk `publicMetadata`.
- Backlog:
  - **028** UI (ver "Contratos de la fase 2").
  - 026: usar `AdminShell` en `(organizer)` y borrar `OrganizerShell` (D6).
  - Listar / revocar invitaciones pendientes (`invitations.getInvitationList` / `revokeInvitation`).
  - Restaurar usuarios eliminados (requeriria `banUser` en vez de `deleteUser`, D4).
  - Permitir que `admin` invite organizadores (pregunta 3 de la 024: hoy `admin` no gestiona usuarios).

## Reuso detectado
- `src/modules/user/services/user-access.service.ts`: `requireRole` — guard de cada action (y de la page en 028).
- `src/modules/user/services/user-sync.service.ts`: `softDeleteUserByClerkId` — se reusa en `deleteUser` sin cambios.
- `src/modules/user/db/user.table.ts`: `users`, `userRoleEnum.enumValues` (lista de los 4 roles para el filtro de rol,
  sin duplicar el enum).
- `src/modules/user/constants/user.constants.ts`: `ASSIGNABLE_ROLES`, `USER_ADMIN_ROLES` — se agregan constantes.
- `src/modules/user/types/user.types.ts`: `UserEntity`, `UserRole`, `AssignableRole` — se agregan tipos.
- `src/lib/db.ts`: cliente drizzle. `drizzle-orm`: `and`, `or`, `eq`, `ne`, `ilike`, `isNull`, `desc`, `db.$count`.
- `@clerk/nextjs/server`: `clerkClient()` (`invitations.createInvitation`, `users.deleteUser`). `@clerk/nextjs/errors`:
  `isClerkAPIResponseError`.
- `next/cache` `revalidatePath`, `next/headers` `headers()`.
- Patron de mocks de `user-access.service.test.ts` (`vi.mock("@/lib/db")` con cadena de `select`, `vi.mock` de Clerk).
- Para 028: `Sheet`, `Button`, `Badge`, `Input`, `Field`/`Label`, `NativeSelect`, `EmptyState`
  (`src/components/shared/empty-state.tsx`), `getInitials` (barrel `auth`), `ORGANIZER_NAV` (barrel `organizer`),
  `next/form`. No hay tabla reutilizable en `src/components/shared`.

## Contratos

### `src/modules/user/types/user.types.ts` (se agrega)
```ts
export type InvitableRole = Extract<AssignableRole, "admin" | "organizer">;
export type UserStatusFilter = "active" | "all";

export interface UserListParams {
  q?: string; // ya recortado; undefined = sin busqueda
  role?: UserRole; // undefined = todos los roles
  status: UserStatusFilter;
  page: number; // 1-based
}

// Solo columnas que necesita la UI (no se manda clerkId/phone al cliente)
export type UserListItem = Pick<UserEntity, "id" | "email" | "fullName" | "role" | "createdAt" | "deletedAt">;

export interface UserListResult {
  users: UserListItem[];
  total: number; // filas que cumplen el filtro
  page: number; // pagina efectiva (clamp a la ultima si excede)
  pageSize: number;
}

export type InviteUserResult =
  | { ok: true }
  | { ok: false; error: "already-registered" | "already-invited" | "invitation-failed" };
export type DeleteUserResult = { ok: true } | { ok: false; error: "not-found" | "delete-failed" };

export type UserAdminActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"email" | "role" | "userId", string>> };
```

### `src/modules/user/constants/user.constants.ts` (se agrega)
```ts
export const INVITABLE_ROLES = ["admin", "organizer"] as const satisfies readonly InvitableRole[];
export const USER_STATUS_FILTERS = ["active", "all"] as const satisfies readonly UserStatusFilter[];
export const USERS_PAGE_SIZE = 10;
export const USER_SEARCH_MAX_LENGTH = 100;
export const ADMIN_USERS_PATH = "/admin/users";
```
El archivo sigue importando solo tipos: es seguro importarlo desde componentes cliente por ruta directa
(`@/modules/user/constants/user.constants`), porque el barrel de `user` es solo de servidor (024).

### `src/modules/user/schemas/user-admin.schema.ts` (nuevo)
```ts
// Nunca falla: cada campo usa .catch(default). Entrada: el objeto awaited de searchParams
// (string | string[] | undefined por clave; un array cae al default).
// q: trim, "" -> undefined, > USER_SEARCH_MAX_LENGTH -> se corta (o undefined, a criterio del dev, documentado en test)
// role: z.enum(userRoleEnum.enumValues) | undefined ; status: z.enum(USER_STATUS_FILTERS) default "active"
// page: z.coerce.number().int().min(1) default 1
export const userListParamsSchema: z.ZodType<UserListParams>;

export const inviteUserSchema;     // { email: string (trim + lowercase + formato email), role: z.enum(INVITABLE_ROLES) }
export const changeUserRoleSchema; // { userId: z.uuid(), role: z.enum(ASSIGNABLE_ROLES) }
export const deleteUserSchema;     // { userId: z.uuid() }
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
```
Mensajes de error de validacion en español (se muestran en el formulario de 028).

### `src/modules/user/services/user-admin.service.ts` (nuevo, server)
```ts
// WHERE: status "active" -> deleted_at IS NULL; role -> role = $role;
//        q -> (full_name ILIKE %q% OR email ILIKE %q%) con \ % _ escapados.
// total = db.$count(users, where); page efectiva = min(page, max(1, ceil(total / USERS_PAGE_SIZE)))
// SELECT columnas de UserListItem ... ORDER BY created_at DESC, id DESC LIMIT USERS_PAGE_SIZE OFFSET (page-1)*size
export async function listUsers(params: UserListParams): Promise<UserListResult>;

// D3. Fila activa con ese email -> already-registered (sin llamar a Clerk).
// createInvitation({ emailAddress, publicMetadata: { role }, redirectUrl: `${context.origin}/register` })
// Errores Clerk: duplicate_record -> already-invited; form_identifier_exists -> already-registered; otro -> invitation-failed
export async function inviteUser(input: InviteUserInput, context: { origin: string }): Promise<InviteUserResult>;

// D5. UPDATE users SET role, updated_at WHERE id = $1 AND role <> 'super_admin' AND deleted_at IS NULL RETURNING id
// -> false si 0 filas
export async function changeUserRole(input: ChangeUserRoleInput): Promise<boolean>;

// D4. Fila activa no super_admin por id (si no -> not-found) -> clerk users.deleteUser(clerkId)
// (404 de Clerk se ignora; otro error -> delete-failed, sin tocar DB) -> softDeleteUserByClerkId(clerkId)
export async function deleteUser(input: DeleteUserInput): Promise<DeleteUserResult>;
```

### `src/modules/user/actions/user-admin.actions.ts` (nuevo, `"use server"`)
```ts
// Las tres: 1) await requireRole(USER_ADMIN_ROLES)  2) safeParse(Object.fromEntries(formData))
// invalido -> { status: "error", message: "Revisa los datos", fieldErrors } sin llamar al servicio
// 3) servicio  4) exito -> revalidatePath(ADMIN_USERS_PATH) y { status: "success", message }
export async function inviteUserAction(prev: UserAdminActionState, formData: FormData): Promise<UserAdminActionState>;
//   origin = (await headers()).get("origin"); null -> error "No se pudo enviar la invitacion"
//   already-registered -> "Ese email ya tiene cuenta: cambia su rol desde la lista"
//   already-invited -> "Ese email ya tiene una invitacion pendiente"; invitation-failed -> "No se pudo enviar la invitacion"
//   ok -> "Invitacion enviada a <email>"
export async function changeUserRoleAction(prev: UserAdminActionState, formData: FormData): Promise<UserAdminActionState>;
//   false -> "No se puede cambiar el rol de este usuario"; true -> "Rol actualizado"
export async function deleteUserAction(prev: UserAdminActionState, formData: FormData): Promise<UserAdminActionState>;
//   not-found -> "No se puede eliminar este usuario"; delete-failed -> "No se pudo eliminar el usuario. Intenta de nuevo"
//   ok -> "Usuario eliminado"
```
Los textos exactos pueden ajustarse; lo vinculante es: un mensaje por cada resultado, en español, sin filtrar
detalles internos de Clerk.

### Contratos de la fase 2 (028, solo referencia; se especifican en su spec)
Fuente visual obligatoria: el Artifact aprobado (frames "Main.dc.html", "Mobile.dc.html", "UserModal.dc.html").
```ts
// src/app/(admin)/admin/users/page.tsx (server, sin layout en (admin)):
//   const viewer = await requireRole(USER_ADMIN_ROLES);
//   const params = userListParamsSchema.parse(await props.searchParams);
//   const result = await listUsers(params);
//   return <AdminShell viewer={{ fullName, email, role }}><UserAdminPanel result={result} params={params} /></AdminShell>
// src/modules/admin/: constants/admin.constants.ts (secciones de nav con roles), components/admin-shell.tsx ("use client",
//   sidebar lg + Sheet mobile, filtra secciones por viewer.role, SignOutButton), index.ts
// src/modules/user/components/ (todos "use client" salvo pagination):
//   user-admin-panel.tsx  — header "Usuarios" + boton "Invitar usuario", filtros, tabla, paginacion; estado del dialogo
//                           { mode: "invite" } | { mode: "edit-role"; user } | { mode: "delete"; user } | null
//   user-filters.tsx      — next/form GET: q (Input), role (NativeSelect "Todos" + 4 roles), status (Activos/Todos);
//                           los selects hacen form.requestSubmit() onChange; sin input page (resetea a 1)
//   user-table.tsx        — shadcn Table: Nombre / Email / Rol (Badge con color por rol; "Eliminado" si deletedAt) /
//                           Acciones ("Editar rol", "Eliminar"); sin acciones si role === "super_admin" o eliminado
//   user-pagination.tsx   — "Mostrando a-b de total" + shadcn Pagination con hrefs que conservan q/role/status
//   user-dialog.tsx       — shadcn Dialog, 3 formularios con useActionState (invite / edit-role / delete),
//                           cierra al recibir status "success"; errores por campo y mensaje general
// constants: USER_ROLE_LABELS (Record<UserRole, string>, español) y clases de badge por rol
// src/modules/user/index.ts: exporta componentes, listUsers, userListParamsSchema
// shadcn: npx shadcn@latest add dialog table pagination
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Tipos y constantes del CRUD de usuarios | src/modules/user/types/user.types.ts, src/modules/user/constants/user.constants.ts | - | S |
| T2 | Schemas zod (lista, invitar, cambiar rol, eliminar) + test | src/modules/user/schemas/user-admin.schema.ts, src/modules/user/schemas/user-admin.schema.test.ts | T1 | P1 |
| T3 | Servicio `listUsers`/`inviteUser`/`changeUserRole`/`deleteUser` + test | src/modules/user/services/user-admin.service.ts, src/modules/user/services/user-admin.service.test.ts | T1 | P1 |
| T4 | Server actions con `requireRole` + test | src/modules/user/actions/user-admin.actions.ts, src/modules/user/actions/user-admin.actions.test.ts | T2, T3 | S |

Orden: T1 -> (T2 ‖ T3) -> T4. 4 tareas, 8 archivos, sin migraciones ni instalaciones. T3 importa los tipos
`*Input` de T2: el contrato de esos tipos esta fijado arriba, asi que T3 puede escribirse en paralelo y compila al
juntarse (si el orquestador prefiere cero riesgo, correr T2 antes que T3). El barrel `user/index.ts` no se toca en
027 (nada fuera del modulo consume esto todavia); lo actualiza 028.

## Criterios de aceptacion
- [ ] AC1: `userListParamsSchema` nunca lanza: `{}` -> `{ status: "active", page: 1 }`; valores invalidos
  (`role=foo`, `status=x`, `page=-3`, `page=abc`, arrays) caen al default; `q` se recorta y `""` queda `undefined`.
- [ ] AC2: `listUsers` aplica rol, estado y busqueda en el `WHERE` (comodines escapados), ordena por `created_at desc`,
  pagina con `USERS_PAGE_SIZE` y hace clamp de `page` a la ultima pagina (cubierto por tests).
- [ ] AC3: `changeUserRole` nunca modifica una fila `super_admin` ni eliminada; `deleteUser` devuelve `not-found` para
  `super_admin` o inexistente sin llamar a Clerk; con error de Clerk distinto de 404 no toca la DB (tests).
- [ ] AC4: Cada action llama `requireRole(USER_ADMIN_ROLES)` antes que nada (si lanza/redirige, no se llama al
  servicio); input invalido devuelve `fieldErrors` sin llamar al servicio; exito llama
  `revalidatePath("/admin/users")` (tests).
- [ ] AC5 (manual con Clerk real; se verifica al cerrar 028, que es la primera UI que llama las actions): invitar un email nuevo como `organizer` envia el email de Clerk; al
  registrarse por el link queda `role = 'organizer'`; reinvitar el mismo email devuelve `already-invited`; invitar un
  email ya registrado devuelve `already-registered`. Confirmar que los codigos de Clerk de D3 son los reales; si no,
  ajustar el mapeo y el test.
- [ ] AC6 (manual): `deleteUser` de un usuario de prueba lo borra en el dashboard de Clerk, su sesion se cierra, la fila
  queda con `deleted_at` y sus `orders` siguen existiendo.
- [ ] AC7: `user-sync.service.ts`, `user-access.service.ts`, `src/proxy.ts`, paginas y componentes sin cambios; no hay
  cambios visibles.
- [ ] AC8: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
Vitest, junto a cada archivo.
- `user-admin.schema.test.ts`: AC1; `inviteUserSchema` normaliza email (trim + minusculas), rechaza email invalido y
  roles `customer`/`super_admin`; `changeUserRoleSchema` acepta los 3 asignables, rechaza `super_admin` y `userId`
  no uuid; `deleteUserSchema` rechaza `userId` no uuid.
- `user-admin.service.test.ts` (`vi.mock("@/lib/db")`, `vi.mock("@clerk/nextjs/server")` con `clerkClient`,
  `vi.mock("@clerk/nextjs/errors")`, `vi.mock("./user-sync.service")`):
  - `listUsers`: `where` con/sin cada filtro (comparar con `and(...)`/`ilike(...)` como hace `user-access.service.test`);
    `q` con `%`/`_` escapado; `offset` segun pagina; clamp cuando `page` > total de paginas; `total = 0` -> pagina 1.
  - `inviteUser`: email activo existente -> `already-registered` sin llamar a Clerk; exito llama `createInvitation`
    con `publicMetadata.role` y `redirectUrl` `${origin}/register`; mapeo de `duplicate_record`,
    `form_identifier_exists` y error generico.
  - `changeUserRole`: `true` con 1 fila, `false` con 0; el `where` incluye `role <> super_admin` y `deleted_at IS NULL`.
  - `deleteUser`: `not-found` (sin fila / super_admin) sin llamar a Clerk; exito llama `deleteUser(clerkId)` y
    `softDeleteUserByClerkId(clerkId)`; 404 de Clerk -> soft-delete igual y `ok`; otro error -> `delete-failed` sin
    soft-delete.
- `user-admin.actions.test.ts` (`vi.mock` de `../services/user-access.service`, `../services/user-admin.service`,
  `next/cache`, `next/headers`): AC4 para las tres actions; mapeo de cada resultado del servicio a su mensaje;
  `inviteUserAction` sin header `origin` -> error sin llamar al servicio.

## Preguntas abiertas
Bloqueantes (aprobar la spec = aceptar los defaults):
1. **Diseño no leido por el agente spec.** Este agente no tiene herramienta para leer el Artifact
   (https://claude.ai/artifact/ABhskE9h4QqMTFNXH5kDsL). Contratos y D6/D8 se basan en la descripcion de los 3 frames
   del pedido. 027 no tiene UI, asi que el riesgo es bajo, pero **antes de aprobar** confirmar que el diseño no pide
   algo que cambie el servidor (ej. columnas extra como fecha de alta o telefono, otro tamaño de pagina, filtro
   distinto). La spec 028 debe escribirse con acceso al Artifact.
2. **D4 — Eliminar borra la cuenta en Clerk** (irreversible) + soft-delete local. Alternativa: `banUser` reversible,
   con cambio en el webhook (mas trabajo, habilita "restaurar").
3. **D1 — paginacion y busqueda server-side por URL**, 10 por pagina.
4. **D3 — solo se invitan `admin`/`organizer`**; `customer` solo por registro propio o cambio de rol.
5. **D6 — shell propio en `src/modules/admin`** con duplicacion temporal de `OrganizerShell` hasta 026; route group
   `(admin)` sin layout.

No bloqueantes:
6. Codigos de error de Clerk (`duplicate_record`, `form_identifier_exists`) segun documentacion; se confirman en AC5.
7. Filtro "Todos" muestra eliminados sin acciones (no hay restaurar).
8. Invitaciones pendientes no se listan ni se revocan desde la app (backlog).

## Estado
- Aprobacion humana: aprobada
- Fase: implementada (estado actualizado en P1-09, 2026-10-10)
- Log de review: Sin review formal registrado; codigo y tests presentes (comprobado en P1-09, 2026-10-10). Suite completa (552 tests), tsc, eslint y build en verde.
