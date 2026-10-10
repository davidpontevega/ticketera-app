# 028 — UI de gestion de usuarios del super admin (`/admin/users`)

> Fase 2 de `docs/specs/027-admin-users-panel.md` (aprobada e implementada). Las decisiones de estructura ya estan
> fijadas alla y **no se reabren aca**: D1 (filtros/paginacion server-side por URL, `next/form` GET), D2 (Activos/Todos,
> eliminados sin acciones), D6 (ruta `src/app/(admin)/admin/users/page.tsx`, route group `(admin)` sin layout, modulo
> `src/modules/admin` con `AdminShell`, sin tocar `OrganizerShell`), D7 (`useActionState` sobre las 3 server actions),
> D8 (shadcn `dialog`, `table`, `pagination`; reuso de `native-select`, no se instala `select`).

## Contexto
027 dejo el servidor listo (`listUsers`, `inviteUser`, `changeUserRole`, `deleteUser`, 3 server actions protegidas con
`requireRole`). Nada lo consume todavia. Esta spec construye la UI segun el diseño aprobado (frames "Main.dc.html",
"Mobile.dc.html", "UserModal.dc.html", descritos abajo en "Diseño") para que el super admin gestione usuarios desde la
app. Resultado: en `/admin/users` el super admin lista, busca, filtra, pagina, invita, cambia roles y elimina usuarios.

### Diseño (fuente de verdad; transcrito del pedido)
**Main (escritorio):** `flex flex-wrap`: `<aside>` fijo de 272px + `<main>` que crece.
- Sidebar: logo "Ticketera" + subtitulo "Administracion". Seccion "ORGANIZADOR" (label mayuscula chica, muted): "Resumen",
  "Mis eventos", "Crear evento" (iconos `ORGANIZER_NAV`). Seccion "ADMINISTRACION": "Usuarios" (icono dos personas,
  `Users` de lucide). Tarjeta de usuario al pie: avatar con iniciales, nombre, rol (texto chico), boton logout (icono).
- Main: `<h1>Usuarios</h1>` + "Invita administradores y organizadores, y gestiona sus roles." + boton primario
  "Invitar usuario" (icono `PlusCircle`) a la derecha.
- Filtros: input con lupa, placeholder "Buscar por nombre o email" (crece); select de rol ("Todos los roles" / "Super
  admin" / "Administrador" / "Organizador" / "Cliente"); select de estado ("Activos" / "Todos").
- Tabla en tarjeta con borde redondeado: Nombre / Email / Rol (badge: super_admin indigo claro, admin gris, organizer
  verde claro, customer gris) / Acciones. Fila super_admin: "—". Resto: boton icono "Editar rol" (lapiz, borde gris) y
  "Eliminar" (tacho, borde/fondo rojo claro, icono rojo).
- Pie: "Mostrando 1–4 de 23 usuarios" (chico, muted) + paginacion a la derecha (flecha izquierda deshabilitada en la
  primera pagina, numeros con la actual en indigo, "…" para paginas ocultas, flecha derecha).

**Mobile (390px):** header fijo con logo + hamburguesa a la derecha; drawer izquierdo de 280px con el mismo nav combinado
y la tarjeta de usuario al pie, boton "X" arriba, scrim sobre el resto (patron `Sheet side="left"` de `OrganizerShell`).

**UserModal (480px):** dialogo centrado, borde redondeado grande, sombra. Header: titulo + "X" a la derecha.
- `invite` — "Invitar usuario"; texto "Se enviara una invitacion por correo con el rol elegido preasignado."; Email
  (input); Rol (select "Administrador"/"Organizador" = `INVITABLE_ROLES`); footer "Cancelar" + "Enviar invitacion".
- `edit-role` — "Cambiar rol"; "El nuevo rol se aplica de inmediato."; avatar + nombre + email (solo lectura); Rol
  (select "Administrador"/"Organizador"/"Cliente" = `ASSIGNABLE_ROLES`); footer "Cancelar" + "Guardar".
- `delete` — "Eliminar usuario"; "Esta accion no se puede deshacer. El usuario pierde acceso de inmediato."; caja de
  alerta roja con nombre + email; footer "Cancelar" + "Eliminar" (destructivo).

Colores solo via tokens/clases existentes (`primary`, `muted`, `muted-foreground`, `border`, `destructive`, `success`
en `globals.css`); **sin hex en componentes**.

## Alcance
- Incluye:
  - Instalar shadcn `dialog`, `table`, `pagination` (D8) y `avatar` (ver Reuso: reemplaza el avatar a mano repetido).
  - Etiquetas de rol en español (`USER_ROLE_LABELS`) en `user.constants.ts`; exportar `ORGANIZER_NAV` del barrel de
    `organizer`.
  - Modulo `src/modules/admin`: `AdminShell` (sidebar desktop + drawer mobile, nav filtrado por rol del viewer, logout).
  - Componentes en `src/modules/user/components/`: panel, filtros, tabla, paginacion, dialogo de 3 modos.
  - Hook `useUserAdminAction` (`useActionState` + cierre al exito) y utils de paginacion/URL, con tests.
  - Page `src/app/(admin)/admin/users/page.tsx` protegida con `requireRole(USER_ADMIN_ROLES)`.
  - Barrel `src/modules/user/index.ts` ampliado.
- Excluye:
  - Cambios en servidor de 027 (servicios, schemas, actions, tipos existentes): no se tocan.
  - `organizer-shell.tsx`, `(organizer)/layout.tsx`, `src/proxy.ts`: sin cambios.
  - Toasts (no hay `sonner` instalado): el exito se informa con un aviso inline en el panel (ver Contratos).
  - Ordenar columnas, selector de tamaño de pagina, columnas extra (fecha de alta, telefono).
- Backlog:
  - 026: usar `AdminShell` en `(organizer)` y borrar `OrganizerShell` (D6 de 027).
  - Mover `(admin)` a un `layout.tsx` cuando haya una segunda pagina admin.
  - Listar/revocar invitaciones pendientes; restaurar eliminados (027 backlog).

## Reuso detectado
- `src/components/ui/native-select.tsx` — `NativeSelect` + `NativeSelectOption` para rol/estado (filtros y dialogo).
- `src/components/ui/input.tsx`, `field.tsx` (`Field`, `FieldLabel`, `FieldError`, `FieldDescription`) — campos del
  dialogo y busqueda.
- `src/components/ui/button.tsx` (`Button`, `buttonVariants`) — acciones, links de paginacion (`render={<Link/>}` +
  `nativeButton={false}`, mismo patron que `SheetTrigger render` en `OrganizerShell`).
- `src/components/ui/badge.tsx` — badge de rol. Variantes: `destructive` para "Eliminado"; para los colores por rol se
  usan clases con tokens via `className` (`bg-primary/10 text-primary`, `bg-success/10 text-success`,
  `bg-muted text-muted-foreground`). **No se agrega variante `success`** a `badge.tsx`: un solo consumidor, y SETUP
  pide no tocar logica de primitivos.
- `src/components/ui/sheet.tsx` — drawer mobile (`Sheet`, `SheetTrigger`, `SheetContent side="left"`, `SheetHeader`,
  `SheetTitle`), igual que `OrganizerShell`.
- `src/components/shared/empty-state.tsx` — `EmptyState titleAs="h2"` cuando el filtro no devuelve usuarios.
- `src/lib/utils.ts` — `cn`.
- `src/modules/auth` (barrel) — `getInitials` para el avatar.
- `src/modules/organizer` (barrel) — `ORGANIZER_NAV` (se exporta en esta spec; hoy no esta en el barrel).
- `src/modules/organizer/components/organizer-shell.tsx` — **patron de referencia** (logo, nav con `aria-current`,
  tarjeta de usuario, Sheet). No se importa ni modifica; la duplicacion temporal esta aceptada en D6 de 027.
- `src/modules/user` (027): `requireRole`, `listUsers`, `userListParamsSchema`, las 3 actions, `UserListItem`,
  `UserListResult`, `UserListParams`, `UserAdminActionState`, `UserRole`, constantes `INVITABLE_ROLES`,
  `ASSIGNABLE_ROLES`, `USER_ADMIN_ROLES`, `ORGANIZER_AREA_ROLES`, `USERS_PAGE_SIZE`, `ADMIN_USERS_PATH`,
  `USER_STATUS_FILTERS`. Los componentes cliente importan constantes por ruta directa
  (`../constants/user.constants` dentro del modulo, `@/modules/user/constants/user.constants` desde `admin`), porque el
  barrel de `user` es solo de servidor (exporta `db`, servicios) — permitido explicitamente por 027.
- `@clerk/nextjs` `SignOutButton` — logout del shell (D6 de 027).
- `next/form` — formulario de filtros GET (primer uso en el proyecto; guia
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md`: `action` string -> GET + navegacion
  cliente, `""`/path propio actualiza los search params).
- `react` `useActionState` — guia `node_modules/next/dist/docs/01-app/02-guides/forms.md` ("useActionState": devuelve
  `[state, formAction, pending]`; `pending` deshabilita el submit).
- `next/link` `Link` — paginacion con navegacion cliente (el `PaginationLink` de shadcn renderiza `<a>` plano: se usan
  `Pagination`/`PaginationContent`/`PaginationItem`/`PaginationEllipsis` para la estructura y `Button render={<Link/>}`
  para los links).
- Instalar (verificado que no existen en `src/components/ui/` y si en el registro `base-nova`):
  `npx shadcn@latest add dialog table pagination avatar`. `avatar` no estaba en D8 de 027: se agrega porque el avatar
  de iniciales aparece en 2 lugares nuevos (shell y dialogo) y ya esta repetido a mano en `OrganizerShell`/`UserMenu`
  (DRY); estos dos ultimos no se migran aca.
- No se usa: `@tanstack/react-table` (D8), `select` de shadcn (D8), zustand (estado de URL + estado local).

## Contratos

### `src/modules/user/constants/user.constants.ts` (se agrega; T2)
```ts
// Orden de insercion = orden de las opciones del filtro de rol (super_admin, admin, organizer, customer)
export const USER_ROLE_LABELS: Record<UserRole, string>;
//   { super_admin: "Super admin", admin: "Administrador", organizer: "Organizador", customer: "Cliente" }
export const USER_STATUS_LABELS: Record<UserStatusFilter, string>; // { active: "Activos", all: "Todos" }
```
El archivo sigue importando solo tipos (seguro en cliente).

### `src/modules/organizer/index.ts` (se agrega; T2)
```ts
export { ORGANIZER_NAV } from "./constants/organizer.constants";
export type { OrganizerNavItem } from "./constants/organizer.constants";
```

### `src/modules/admin/constants/admin.constants.ts` (nuevo; T3)
```ts
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/modules/user/types/user.types";

export interface AdminNavItem { href: string; label: string; icon: LucideIcon }
export interface AdminNavSection { label: string; roles: readonly UserRole[]; items: readonly AdminNavItem[] }

// [{ label: "Organizador", roles: ORGANIZER_AREA_ROLES, items: ORGANIZER_NAV },
//  { label: "Administracion", roles: USER_ADMIN_ROLES, items: [{ href: ADMIN_USERS_PATH, label: "Usuarios", icon: Users }] }]
export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[];
```

### `src/modules/admin/components/admin-shell.tsx` (nuevo, `"use client"`; T3)
```ts
export interface AdminViewer { fullName: string; email: string; role: UserRole } // datos planos desde la page
export interface AdminShellProps { viewer: AdminViewer; children: ReactNode }
export function AdminShell(props: AdminShellProps): JSX.Element;
```
- Secciones visibles = `ADMIN_NAV_SECTIONS.filter((s) => s.roles.includes(viewer.role))`.
- Desktop (`lg`): `<aside>` sticky `h-dvh w-68` (272px) con logo (subtitulo "Administracion"), secciones (label
  `text-xs uppercase text-muted-foreground`), tarjeta de usuario al pie (`Avatar` con `getInitials(fullName)`, nombre,
  `USER_ROLE_LABELS[role]`, `SignOutButton redirectUrl="/"` envolviendo `Button variant="ghost" size="icon"
  aria-label="Cerrar sesion"`).
- Mobile (`< lg`): header sticky con logo + `SheetTrigger` hamburguesa (`aria-label="Abrir menu"`); `SheetContent
  side="left"` de 280px (`w-70`) con el mismo nav + tarjeta; cerrar al navegar (`onNavigate`).
- Link activo: `aria-current="page"` si `href === usePathname()` (mismas clases que `OrganizerShell`).
- Sin guard propio (lo hace la page) y sin skeleton (el viewer llega del servidor).

### `src/modules/admin/index.ts` (nuevo; T3)
```ts
export { AdminShell } from "./components/admin-shell";
export type { AdminShellProps, AdminViewer } from "./components/admin-shell";
```

### `src/modules/user/utils/user-admin.utils.ts` (nuevo; T5)
```ts
// ADMIN_USERS_PATH + query con q/role/status/page; omite q/role undefined, status "active" y page 1.
// getUsersPageHref({ status: "active", page: 1 }, 1) === "/admin/users"
// getUsersPageHref({ q: "ana", role: "admin", status: "all", page: 1 }, 3) === "/admin/users?q=ana&role=admin&status=all&page=3"
export function getUsersPageHref(params: UserListParams, page: number): string;

export type PaginationItem = number | "ellipsis";
// totalPages <= 7 -> [1..totalPages]. Si no: 1, totalPages, current-1..current+1 (acotados), y "ellipsis" en cada hueco.
// getPaginationItems(1, 10) -> [1, 2, "ellipsis", 10]; getPaginationItems(5, 10) -> [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
export function getPaginationItems(current: number, totalPages: number): PaginationItem[];
```

### `src/modules/user/hooks/use-user-admin-action.ts` (nuevo, `"use client"`; T6)
```ts
type UserAdminAction = (prev: UserAdminActionState, formData: FormData) => Promise<UserAdminActionState>;
// useActionState(action, { status: "idle" }); useEffect: state.status === "success" -> onSuccess(state.message)
export function useUserAdminAction(
  action: UserAdminAction,
  onSuccess: (message: string) => void,
): [state: UserAdminActionState, formAction: (formData: FormData) => void, pending: boolean];
```

### `src/modules/user/components/user-dialog.tsx` (nuevo, `"use client"`; T6)
```ts
export type UserDialogState =
  | { mode: "invite" }
  | { mode: "edit-role"; user: UserListItem }
  | { mode: "delete"; user: UserListItem };

export interface UserDialogProps {
  state: UserDialogState | null; // null = cerrado
  onClose: () => void;
  onSuccess: (message: string) => void; // el panel cierra el dialogo y muestra el aviso
}
export function UserDialog(props: UserDialogProps): JSX.Element;
```
- `Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}`; `DialogContent` `sm:max-w-[480px]`
  `rounded-2xl`, `showCloseButton={false}` + `DialogClose` propio en el header con `aria-label="Cerrar"` (el de shadcn
  trae texto sr-only en ingles).
- Durante la animacion de cierre el contenido se renderiza con el ultimo `state` no nulo (para que no quede vacio).
- Un formulario por modo (subcomponentes privados del archivo), cada uno con `useUserAdminAction(<action>, onSuccess)`:
  - `invite` -> `inviteUserAction`: `Input name="email" type="email"`, `NativeSelect name="role"` con `INVITABLE_ROLES`.
  - `edit-role` -> `changeUserRoleAction`: `input hidden name="userId"`, avatar+nombre+email, `NativeSelect name="role"`
    con `ASSIGNABLE_ROLES`, `defaultValue={user.role}`.
  - `delete` -> `deleteUserAction`: `input hidden name="userId"`, caja `bg-destructive/10 text-destructive` con
    nombre+email, submit `variant="destructive"`.
- `state.status === "error"`: `fieldErrors.email|role` en `FieldError` del campo (`aria-invalid` en el control) y
  `message` en un `<p role="alert">` sobre el footer. Submit `disabled={pending}`.
- Footer: "Cancelar" (`DialogClose render={<Button variant="outline" />}`) + submit con el texto del diseño.

### `src/modules/user/components/user-table.tsx` (nuevo, `"use client"`; T4)
```ts
export interface UserTableProps {
  users: UserListItem[];
  onEditRole: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
}
export function UserTable(props: UserTableProps): JSX.Element;
```
- shadcn `Table`: Nombre / Email / Rol / Acciones (encabezado "Acciones" alineado a la derecha).
- Rol: `Badge` con `USER_ROLE_LABELS[role]` y clase por rol (mapa local del archivo); si `deletedAt` -> `Badge
  variant="destructive"` "Eliminado".
- Acciones solo si `role !== "super_admin" && deletedAt === null`; si no, `<span aria-label="Sin acciones">—</span>`.
  Botones `size="icon-sm"`: "Editar rol" (`Pencil`, `variant="outline"`, `aria-label="Editar rol de <nombre>"`) y
  "Eliminar" (`Trash2`, clases `border-destructive/20 bg-destructive/10 text-destructive`,
  `aria-label="Eliminar a <nombre>"`).

### `src/modules/user/components/user-filters.tsx` (nuevo, `"use client"`; T5)
```ts
export interface UserFiltersProps { params: UserListParams }
export function UserFilters(props: UserFiltersProps): JSX.Element;
```
- `<Form action={ADMIN_USERS_PATH} key={<q|role|status>}>` (el `key` remonta los `defaultValue` al navegar con
  paginacion/atras). Sin input `page` (cada busqueda vuelve a la pagina 1).
- `Input name="q" type="search" placeholder="Buscar por nombre o email" maxLength={USER_SEARCH_MAX_LENGTH}` con icono
  `Search`, `aria-label="Buscar usuarios"`; submit con Enter.
- `NativeSelect name="role"`: `""` "Todos los roles" + `USER_ROLE_LABELS`; `NativeSelect name="status"`:
  `USER_STATUS_LABELS`. Ambos con `aria-label` y `onChange={(e) => e.currentTarget.form?.requestSubmit()}`.
- Valores vacios en la URL (`?q=&role=`) son validos: `userListParamsSchema` los normaliza a `undefined`.

### `src/modules/user/components/user-pagination.tsx` (nuevo; T5)
```ts
export interface UserPaginationProps { result: UserListResult; params: UserListParams }
export function UserPagination(props: UserPaginationProps): JSX.Element | null;
```
- `null` si `result.total === 0`. Texto `Mostrando {from}–{to} de {total} usuarios` (`from = (page-1)*pageSize+1`,
  `to = from + users.length - 1`).
- Controles solo si `totalPages > 1`: anterior (`ChevronLeft`, `aria-label="Pagina anterior"`, deshabilitado en la
  pagina 1: `<span aria-disabled>` sin href), `getPaginationItems` (numero -> link; actual con
  `aria-current="page"` y `bg-primary text-primary-foreground`; `"ellipsis"` -> `PaginationEllipsis`), siguiente
  (deshabilitado en la ultima). Hrefs con `getUsersPageHref(params, n)` (conserva filtros).

### `src/modules/user/components/user-admin-panel.tsx` (nuevo, `"use client"`; T7)
```ts
export interface UserAdminPanelProps { result: UserListResult; params: UserListParams }
export function UserAdminPanel(props: UserAdminPanelProps): JSX.Element;
```
- Estado local: `dialog: UserDialogState | null`, `notice: string | null`.
- Header (h1 "Usuarios" + descripcion + boton "Invitar usuario" -> `{ mode: "invite" }`), `UserFilters`, aviso
  `notice` en `<p role="status">` (se reemplaza en cada exito), tarjeta (`rounded-2xl border bg-background`) con
  `UserTable` o `EmptyState` (`Users`, "No hay usuarios", "Prueba con otra busqueda o filtro.", `titleAs="h2"`) y
  `UserPagination` al pie, `UserDialog`.
- `onSuccess(message)`: `setDialog(null)` + `setNotice(message)`. Los datos se refrescan solos por `revalidatePath` en
  la action (D7 de 027).

### `src/modules/user/index.ts` (se agrega; T7)
```ts
export { UserAdminPanel } from "./components/user-admin-panel";
export { listUsers } from "./services/user-admin.service";
export { userListParamsSchema } from "./schemas/user-admin.schema";
export type { UserListItem, UserListParams, UserListResult } from "./types/user.types";
```
(El resto de componentes son internos del modulo; los consume solo `UserAdminPanel`.)

### `src/app/(admin)/admin/users/page.tsx` (nuevo, server; T7)
```ts
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  // const viewer = await requireRole(USER_ADMIN_ROLES);         // primera linea
  // const params = userListParamsSchema.parse(await searchParams);
  // const result = await listUsers(params);
  // return <AdminShell viewer={{ fullName, email, role }}><UserAdminPanel result={result} params={params} /></AdminShell>;
}
```
Sin `layout.tsx` en `(admin)` (D6). Solo routing: imports de los barrels `@/modules/user` y `@/modules/admin`.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Instalar shadcn `npx shadcn@latest add dialog table pagination avatar` (verificar que no sobreescribe `button.tsx`; si pregunta, responder no) | src/components/ui/dialog.tsx, src/components/ui/table.tsx, src/components/ui/pagination.tsx, src/components/ui/avatar.tsx, package.json, package-lock.json (solo si cambian) | - | S |
| T2 | Etiquetas de rol/estado + exportar `ORGANIZER_NAV` del barrel de organizer | src/modules/user/constants/user.constants.ts, src/modules/organizer/index.ts | - | S |
| T3 | Modulo admin: nav por secciones + `AdminShell` + barrel | src/modules/admin/constants/admin.constants.ts, src/modules/admin/components/admin-shell.tsx, src/modules/admin/index.ts | T1, T2 | P1 |
| T4 | Tabla de usuarios con acciones condicionales + test | src/modules/user/components/user-table.tsx, src/modules/user/components/user-table.test.tsx | T1, T2 | P1 |
| T5 | Utils de URL/paginacion + test, filtros (`next/form`), paginacion | src/modules/user/utils/user-admin.utils.ts, src/modules/user/utils/user-admin.utils.test.ts, src/modules/user/components/user-filters.tsx, src/modules/user/components/user-pagination.tsx | T1, T2 | P1 |
| T6 | Hook `useUserAdminAction` + test, dialogo de 3 modos | src/modules/user/hooks/use-user-admin-action.ts, src/modules/user/hooks/use-user-admin-action.test.ts, src/modules/user/components/user-dialog.tsx | T1, T2 | P1 |
| T7 | Panel, barrel de user y page `/admin/users` | src/modules/user/components/user-admin-panel.tsx, src/modules/user/index.ts, src/app/(admin)/admin/users/page.tsx | T3, T4, T5, T6 | S |

Orden: T1 -> T2 -> (T3 ‖ T4 ‖ T5 ‖ T6) -> T7. 7 tareas, 18 archivos de los cuales 4 los genera shadcn y 3 son tests:
**11 archivos escritos a mano**. Supera el tope de ~8 por fase porque el pedido es la UI completa sin recorte (027 ya
anticipo ~12 archivos para 028). Punto de corte natural si el orquestador prefiere dos sesiones: sesion A = T1-T5 + T7
sin dialogo (panel con `UserDialog` pendiente), sesion B = T6 + conectar el dialogo en el panel (pregunta 3).

## Criterios de aceptacion
- [ ] AC1: Sin sesion, `/admin/users` redirige a `/login`; con rol distinto de `super_admin` redirige a `/`; con
  `super_admin` renderiza la pagina (guard en la page, sin `layout.tsx` en `(admin)`).
- [ ] AC2 (visual, desktop >= 1024px, contra el frame Main): sidebar de 272px con logo + "Administracion", seccion
  "ORGANIZADOR" (Resumen, Mis eventos, Crear evento con sus iconos), seccion "ADMINISTRACION" (Usuarios, activo), y
  tarjeta al pie con iniciales, nombre, "Super admin" y boton de cerrar sesion que deslogea y lleva a `/`. Main con h1
  "Usuarios", la descripcion y el boton "Invitar usuario" a la derecha; barra de filtros (busqueda que crece + select de
  rol + select de estado); tabla con columnas Nombre / Email / Rol / Acciones; pie "Mostrando a–b de N usuarios" +
  paginacion a la derecha.
- [ ] AC3 (visual, mobile 390px, contra el frame Mobile): header con logo y hamburguesa; al tocarla se abre un drawer
  izquierdo de 280px con las mismas dos secciones y la tarjeta de usuario, boton X, fondo oscurecido; tocar un link lo
  cierra.
- [ ] AC4: Badges de rol: Super admin indigo claro, Administrador gris, Organizador verde claro, Cliente gris; usuarios
  eliminados (filtro "Todos") muestran badge rojo "Eliminado". Ningun componente contiene colores hex.
- [ ] AC5: Filas `super_admin` y eliminadas muestran "—" sin botones; las demas muestran "Editar rol" y "Eliminar"
  (cubierto por `user-table.test.tsx`).
- [ ] AC6: Buscar (Enter), cambiar rol o estado actualiza la URL (`?q=&role=&status=`), vuelve a la pagina 1 y la tabla
  refleja el filtro; recargar la URL conserva filtros y valores de los controles.
- [ ] AC7: Paginacion: con >10 usuarios aparecen los numeros con la actual resaltada en indigo, "…" cuando hay paginas
  ocultas, flecha anterior deshabilitada en la pagina 1 y siguiente en la ultima; los links conservan q/role/status y
  navegan sin recarga completa.
- [ ] AC8 (visual, contra el frame UserModal): "Invitar usuario" abre el dialogo modo invite (titulo, texto, Email, Rol
  con solo Administrador/Organizador, Cancelar + Enviar invitacion); "Editar rol" abre modo edit-role (avatar + nombre +
  email, Rol con Administrador/Organizador/Cliente preseleccionado en el rol actual, Cancelar + Guardar); "Eliminar"
  abre modo delete (advertencia, caja roja con nombre + email, Cancelar + Eliminar rojo). X, Cancelar, Escape y click en
  el scrim cierran.
- [ ] AC9: Enviar un formulario deshabilita el submit mientras corre; error de validacion muestra el mensaje bajo el
  campo; error de negocio (ej. "Ese email ya tiene una invitacion pendiente") se muestra en el dialogo sin cerrarlo;
  exito cierra el dialogo, muestra el mensaje en el aviso del panel y la tabla se actualiza sin recargar.
- [ ] AC10: Se completan los AC5 y AC6 manuales de 027 desde esta UI (invitacion real de Clerk, codigos de error,
  borrado en Clerk + soft-delete).
- [ ] AC11: `organizer-shell.tsx`, `(organizer)/layout.tsx`, `src/proxy.ts` y los archivos de servidor de 027 sin cambios.
- [ ] AC12: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
Vitest + React Testing Library, junto a cada archivo.
- `user-admin.utils.test.ts`: `getUsersPageHref` omite defaults (`status=active`, `page=1`, q/role vacios), incluye
  filtros y codifica `q` con espacios/`&`; `getPaginationItems` con `totalPages` 1, 7 (todas), 10 en pagina 1, 5 y 10
  (ellipsis a uno o ambos lados, sin duplicados ni numeros fuera de rango).
- `use-user-admin-action.test.ts` (`renderHook`; la action es un `vi.fn` async; despachar `formAction` dentro de
  `act` + `startTransition`): estado inicial `idle`; resultado `error` no llama `onSuccess`; resultado `success` llama
  `onSuccess` una vez con el mensaje.
- `user-table.test.tsx`: AC5 (super_admin -> sin botones; eliminado -> badge "Eliminado" y sin botones; organizer ->
  ambos botones) y que cada boton llama `onEditRole`/`onDelete` con el usuario de su fila.
- Opcionales (no exigidos): `AdminShell` (filtrado de secciones por rol), `UserDialog` (titulo por modo).

## Preguntas abiertas
Bloqueantes (aprobar la spec = aceptar los defaults):
1. **Instalar shadcn `avatar`** (no estaba en D8 de 027). Default: si, para no repetir por tercera y cuarta vez el
   avatar a mano. Alternativa: copiar el `<span>` de `OrganizerShell` (0 instalaciones, mas duplicacion).
2. **Feedback de exito con aviso inline** (`role="status"` sobre la tabla) en vez de toast. Default: inline (no hay
   libreria de toasts; instalar `sonner` seria otra dependencia para un solo uso).
3. **Tamaño: 11 archivos a mano en una spec** (tope ~8). Default: una sola sesion con P1 de 4 tareas en paralelo.
   Alternativa: dos sesiones con el corte indicado debajo de "Tareas".

No bloqueantes:
4. Diseño transcrito del pedido (el Artifact no es legible por este agente); los textos y colores de arriba son los
   aprobados. Diferencias de pixel se resuelven en review visual (AC2, AC3, AC8).
5. Usuarios eliminados en "Todos": badge "Eliminado" en lugar del badge de rol (D2 de 027). Default: reemplaza al rol.
6. Los links "Organizador" llevan a `/organizer`, que sigue con el guard mock de localStorage hasta 026 (estado conocido,
   D6 de 027).
7. El "…" de `PaginationEllipsis` trae texto sr-only en ingles ("More pages"); no se modifica el primitivo.

## Estado
- Aprobacion humana: aprobada
- Fase: implementada (estado actualizado en P1-09, 2026-10-10)
- Log de review: Sin review formal registrado; codigo y tests presentes (comprobado en P1-09, 2026-10-10). Suite completa (552 tests), tsc, eslint y build en verde.
