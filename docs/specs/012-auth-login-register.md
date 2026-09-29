# 012 — Login y registro (mock)

## Contexto
Feature "7 · Login y registro" del diseño de Claude Design (`https://claude.ai/artifact/NmeqG8Dta7F7zcSPmbQC8y`,
boards `Auth.dc.html` y `AuthMobile.dc.html`). Hoy "Iniciar sesion" del header apunta a `#`.

Resultado esperado: `/login` y `/register` con el layout del board (panel de marca con foto + formulario, pestañas
"Iniciar sesion" / "Crear cuenta"), validacion en español y una **sesion simulada** en el navegador: al ingresar, el
header muestra al usuario con un menu (Mis entradas, Cerrar sesion). Es la base de "Mis entradas" (spec 013).
**Solo UI: no hay backend, no se verifican credenciales ni se guardan contraseñas.**

## Alcance
- Incluye:
  - shadcn `dropdown-menu` (menu del usuario en el header).
  - Modulo nuevo `src/modules/auth`: tipos, schemas zod de login/registro (+ test), store de sesion mock persistido
    en `localStorage` (+ test), util de redireccion segura (+ test) y componentes.
  - Componentes compartidos de formulario: `TextField` (label + input + error) y `PasswordField` (con boton mostrar/
    ocultar); `CheckoutTextField` (spec 010) pasa a usar `TextField` (DRY).
  - Rutas en un grupo nuevo `(auth)` sin header/footer del sitio: `/login` y `/register`. Las pestañas son links
    entre ambas rutas. Soportan `?redirect=/ruta` para volver a donde estaba el usuario (default `/`).
  - Header: "Iniciar sesion" → `/login`; con sesion, boton con iniciales + nombre y `DropdownMenu` con
    "Mis entradas" (`/my-tickets`) y "Cerrar sesion". En el `Sheet` mobile, lo mismo como links.
- Excluye:
  - Recuperar contraseña ("¿Olvidaste tu contraseña?" queda como link a `#`), login social, verificacion de correo.
  - Proteger rutas (redirigir a `/login` si no hay sesion): se hace en la spec 013 para `/my-tickets`.
  - Prellenar el checkout con los datos del usuario (backlog).
- Backlog: 013 mis entradas, 014 organizador.

## Decisiones
- **Sesion mock:** `useAuthStore` con `user: { fullName, email } | null`, `login(email)`, `register(fullName,
  email)`, `logout()`. `persist` en `localStorage` (la sesion sobrevive a cerrar la pestaña, como un login real con
  "recordarme"). **La contraseña nunca se guarda**: solo se valida su formato. `login` con cualquier correo valido
  ingresa; el nombre se deriva del correo si no hubo registro previo en ese navegador ("maria.perez@..." →
  "Maria Perez"). Se simula una espera de ~600 ms con estado "Ingresando..." / "Creando cuenta..." en el boton.
- **Validaciones:** login: correo valido y contraseña requerida. Registro: nombre >= 3 letras, correo valido,
  contraseña >= 8 caracteres con al menos una letra y un numero, terminos aceptados. Mensajes en español bajo cada
  campo; foco al primer error; errores en vivo despues del primer intento (mismo patron que el checkout).
- **Redireccion segura:** `?redirect=` solo acepta rutas internas (empieza con `/` y no con `//` ni `/\`); cualquier
  otro valor cae a `/`. Tras ingresar se usa `router.replace`.
- **Ya logueado:** si hay sesion al entrar a `/login` o `/register`, se muestra "Ya iniciaste sesion como X" con
  "Continuar" (al redirect) y "Cerrar sesion".
- **Hidratacion:** la sesion vive en `localStorage`; header y paginas de auth usan `useIsClient()` (spec 010) y
  muestran el estado "sin sesion" hasta hidratar.
- **Layout:** desktop grid 2 columnas (panel de marca `bg-indigo-950` con imagen, logo, "Tus entradas, siempre a
  mano." | formulario centrado max-w-md). Mobile: franja de marca arriba (imagen corta + logo + frase) y formulario
  abajo. Tokens de MASTER.md (CTA indigo).

## Reuso detectado
- `src/components/ui`: `button`, `input`, `checkbox`, `field` (Field/FieldLabel/FieldError), `sheet`, `separator`.
- `src/components/shared/brand-logo.tsx`, `site-header.tsx`; `src/hooks/use-is-client.ts`.
- Patron de formulario controlado + zod + foco al primer error de `src/modules/order` (spec 010):
  `checkout-text-field.tsx` se generaliza a `src/components/shared/text-field.tsx`.
- Patron de store persistido de `order.store.ts`.
- `lucide-react`: `Eye`, `EyeOff`, `LogOut`, `Ticket`, `User`, `Loader2`.
- Instalar via fuente oficial de GitHub (mismo metodo que 009-011): `dropdown-menu`.
- Imagen del panel: una de las fotos de Unsplash ya usadas en el mock (festival), via `next/image`.

## Contratos

### Tipos (`src/modules/auth/types/auth.types.ts`)
```ts
export interface AuthUser { fullName: string; email: string }
export interface LoginFormValues { email: string; password: string }
export interface RegisterFormValues { fullName: string; email: string; password: string; acceptedTerms: boolean }
export type FormErrors<T> = Partial<Record<keyof T, string>>;
```

### Schemas (`src/modules/auth/schemas/auth.schema.ts`)
```ts
export const loginSchema: z.ZodType<LoginFormValues>;
export const registerSchema: z.ZodType<RegisterFormValues>;
export function validateLogin(values: LoginFormValues): FormErrors<LoginFormValues>;       // {} si es valido
export function validateRegister(values: RegisterFormValues): FormErrors<RegisterFormValues>;
export const LOGIN_FORM_DEFAULT: LoginFormValues;
export const REGISTER_FORM_DEFAULT: RegisterFormValues;
```

### Store (`src/modules/auth/store/auth.store.ts`)
```ts
export interface AuthState {
  user: AuthUser | null;
  knownUsers: AuthUser[];                       // registros previos en este navegador (para el nombre al hacer login)
  login: (email: string) => AuthUser;
  register: (user: AuthUser) => AuthUser;
  logout: () => void;
}
// persist en localStorage, name "ticketera-auth"
```

### Utils (`src/modules/auth/utils/auth.utils.ts`)
```ts
export function getSafeRedirect(value: string | null | undefined, fallback?: string): string; // default "/"
export function getNameFromEmail(email: string): string;   // "maria.perez@x.com" -> "Maria Perez"
export function getInitials(fullName: string): string;     // "Maria Perez" -> "MP"
export function getAuthHref(path: "/login" | "/register", redirect?: string): string; // conserva ?redirect=
```

### Compartidos (`src/components/shared`)
```ts
// text-field.tsx — Field + FieldLabel + Input + FieldError (aria-invalid, aria-describedby).
export interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> { id: string; label: string; error?: string }
// password-field.tsx — "use client". TextField-like con boton "Mostrar/Ocultar contraseña" (aria-pressed) y slot
//   opcional junto al label (link "¿Olvidaste tu contraseña?").
export interface PasswordFieldProps extends Omit<TextFieldProps, "type"> { labelAction?: ReactNode }
```

### Componentes (`src/modules/auth/components`)
```ts
// auth-layout.tsx — server. Panel de marca + contenedor del formulario. Props: children.
// auth-tabs.tsx — "use client". Nav con 2 links (aria-current) a /login y /register conservando ?redirect=.
// login-form.tsx — "use client". Formulario de login + estado "ya logueado".
// register-form.tsx — "use client". Formulario de registro + estado "ya logueado".
// user-menu.tsx — "use client". Sin sesion: link "Iniciar sesion". Con sesion: DropdownMenu (iniciales + nombre;
//   items "Mis entradas" y "Cerrar sesion"). Variante `layout="sheet"` para el menu mobile (links apilados).
export interface UserMenuProps { layout?: "inline" | "sheet" }
```

### Rutas (`src/app/(auth)`)
```
layout.tsx          # <AuthLayout>{children}</AuthLayout> (sin SiteHeader/SiteFooter)
login/page.tsx      # metadata "Iniciar sesion | Ticketera"; <Suspense><LoginForm/></Suspense> (lee ?redirect=)
register/page.tsx   # metadata "Crear cuenta | Ticketera"; <Suspense><RegisterForm/></Suspense>
```

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | shadcn `dropdown-menu` | src/components/ui/dropdown-menu.tsx | - | S |
| T2 | `TextField` y `PasswordField` (+ test) compartidos; `CheckoutTextField` usa `TextField` | src/components/shared/text-field.tsx, src/components/shared/password-field.tsx, src/components/shared/password-field.test.tsx, src/modules/order/components/checkout-text-field.tsx | - | S |
| T3 | Modulo auth: tipos, schemas (+ test), store (+ test), utils (+ test) | src/modules/auth/types/auth.types.ts, src/modules/auth/schemas/auth.schema.ts, src/modules/auth/schemas/auth.schema.test.ts, src/modules/auth/store/auth.store.ts, src/modules/auth/store/auth.store.test.ts, src/modules/auth/utils/auth.utils.ts, src/modules/auth/utils/auth.utils.test.ts | - | S |
| T4 | Layout, pestañas y formularios de login/registro | src/modules/auth/components/auth-layout.tsx, src/modules/auth/components/auth-tabs.tsx, src/modules/auth/components/login-form.tsx, src/modules/auth/components/register-form.tsx | T2, T3 | P1 |
| T5 | Menu de usuario + integracion en el header | src/modules/auth/components/user-menu.tsx, src/components/shared/site-header.tsx | T1, T3 | P1 |
| T6 | Barrel y rutas | src/modules/auth/index.ts, src/app/(auth)/layout.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/register/page.tsx | T4, T5 | S |

Orden: T1 → T2 → T3 → [T4 ‖ T5] → T6. ~22 archivos.

## Criterios de aceptacion
- [ ] AC1: "Iniciar sesion" del header lleva a `/login`: panel de marca con foto + formulario "Hola de nuevo", pestañas
  con "Iniciar sesion" activa. La pestaña "Crear cuenta" lleva a `/register` ("Crea tu cuenta"). Sin header/footer
  del sitio; el logo vuelve a `/`.
- [ ] AC2: Enviar vacio muestra los errores en español bajo cada campo, con `aria-invalid` y foco en el primero.
  Registro exige contraseña de 8+ caracteres con letra y numero y aceptar terminos.
- [ ] AC3: "Mostrar contraseña" alterna el tipo del input y su `aria-pressed`/`aria-label`.
- [ ] AC4: Con datos validos el boton muestra "Ingresando..."/"Creando cuenta...", y luego navega (replace) al
  `?redirect=` si es interno o a `/`. `?redirect=https://evil.com` o `//evil.com` terminan en `/`.
- [ ] AC5: Con sesion, el header (desktop) muestra iniciales + nombre; el menu tiene "Mis entradas" y "Cerrar sesion".
  En mobile el `Sheet` muestra lo mismo. Cerrar sesion vuelve al estado "Iniciar sesion".
- [ ] AC6: La sesion sobrevive a recargar y a cerrar la pestaña (`localStorage`), sin hydration warnings; nunca se
  guarda la contraseña.
- [ ] AC7: Entrar a `/login` o `/register` con sesion muestra "Ya iniciaste sesion como X" con "Continuar" y
  "Cerrar sesion".
- [ ] AC8: Registrarse y luego (tras cerrar sesion) ingresar con el mismo correo muestra el nombre registrado; un
  correo nuevo usa el nombre derivado del correo.
- [ ] AC9: Mobile y desktop sin scroll horizontal (375/768/1024/1440); foco visible, labels asociados, CTA indigo.
- [ ] AC10: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `auth.schema.test.ts`: login valido/invalido; registro: nombre, correo, contraseña (corta, sin numero, sin letra),
  terminos; formularios vacios devuelven todos los campos.
- `auth.store.test.ts`: `register` inicia sesion y recuerda al usuario; `login` usa el nombre registrado o el derivado
  del correo; `logout`; lo persistido en `localStorage` no contiene contraseña.
- `auth.utils.test.ts`: `getSafeRedirect` (interna, externa, `//`, `/\`, vacio), `getNameFromEmail`, `getInitials`,
  `getAuthHref`.
- `password-field.test.tsx`: el boton alterna `type` password/text y `aria-pressed`.
- Siguen pasando los tests del checkout con `CheckoutTextField` refactorizado.
- Sin test: layout, tabs, formularios y menu (composicion sobre schemas/store/utils testeados).

## Preguntas abiertas
Ninguna bloquea. Defaults tomados, ajustables al aprobar:
- Sesion en `localStorage` (persiste entre pestañas y cierres), no en `sessionStorage`.
- Cualquier correo valido puede ingresar (no hay "credenciales incorrectas" en el mock).
- Rutas separadas `/login` y `/register` en vez de una sola pagina con pestañas internas.

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementado (pendiente de review humano)
- Desviaciones menores durante el desarrollo:
  - Hook `src/modules/auth/hooks/use-auth-form.ts` (estado, errores en vivo, foco al primer error, envio simulado)
    compartido por login y registro.
  - `auth-signed-in.tsx` (estado "Ya iniciaste sesion") compartido por ambos formularios.
  - `src/lib/focus-form-field.ts`: enfoca el control visible de checkbox/radio de base-ui; lo usan auth y el checkout
    (reemplaza la logica equivalente que tenia `checkout-form.tsx`).
  - `TextField` acepta `labelAction` y `trailing`; `PasswordField` se arma sobre `TextField`. Se exporta
    `FORM_INPUT_CLASS_NAME` (lo usa tambien el input de documento del checkout).
  - "Iniciar sesion" del header arma el `?redirect=` con pathname + query string al hacer click (con `usePathname`
    solo se perdian, por ejemplo, los filtros de `/events`; leer `useSearchParams` en el header obligaria a envolver
    cada pagina en Suspense).
  - `MY_TICKETS_PATH` exportado desde `user-menu.tsx` para la spec 013.
- Verificacion: 139 tests, `tsc`, `lint` y `build` OK (`/login` y `/register` estaticas). En Chromium: header ->
  login con redirect (incluye query), errores y foco, pestañas conservan redirect, mostrar contraseña, errores en vivo,
  "Creando cuenta...", redirect al volver, sesion en localStorage sin contraseña, reload conserva sesion, menu con
  "Mis entradas"/"Cerrar sesion", "Ya iniciaste sesion", login con nombre registrado y con nombre derivado,
  `?redirect=https://evil.com` termina en `/`, sheet mobile con usuario; sin scroll horizontal ni errores de consola.
- Log de review: -
