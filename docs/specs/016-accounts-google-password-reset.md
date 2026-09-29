# 016 — Cuentas en localStorage, Google y recuperar contraseña

## Contexto
Pedidos del usuario (puntos 2, 3 y 4) sobre la auth mock de la spec 012:
- Login y registro tambien con **Google**.
- **"Olvide mi contraseña"** que envie un correo para restablecerla.
- **Guardar los datos en `localStorage` para probar**.

Decisiones del usuario:
- **Google real con Google Identity Services (GIS)**, solo en el navegador. Si no hay Client ID configurado, se usa un
  selector de cuentas simulado.
- **Correo simulado con bandeja de prueba.** No hay backend: el "correo" se guarda en `localStorage` y se lee en
  `/dev/inbox`.
- **`localStorage`:** cuentas con contraseña hasheada, seleccion de entradas en `localStorage` y un panel
  `/dev/storage` para ver y borrar los datos de prueba.

Hoy la auth mock deja entrar con cualquier correo, no guarda contraseñas y la seleccion de entradas vive en
`sessionStorage`.

## Alcance
- Incluye:
  - **Cuentas reales en el navegador:**
    - `useAuthStore` guarda `accounts` (nombre, correo, `passwordHash` o `null`, proveedor `password`/`google`) y la
      sesion (`user`).
    - El registro falla si el correo ya existe ("Ya existe una cuenta con ese correo").
    - El login valida: "No encontramos una cuenta con ese correo", "La contraseña es incorrecta" y, para cuentas solo
      de Google, "Esta cuenta usa Google. Continua con Google.".
    - Cuenta de prueba precargada: `demo@ticketera.pe` / `Demo1234`, indicada en `/login`.
  - **Contraseñas hasheadas:** SHA-256 de `email:contraseña` con Web Crypto (`crypto.subtle`). Nunca se guarda el
    texto plano.
  - **Google:**
    - Boton "Continuar con Google" en `/login` y `/register`.
    - Con `NEXT_PUBLIC_GOOGLE_CLIENT_ID` definido: se carga el script oficial de GIS, se dibuja el boton oficial y el
      `credential` (JWT) se decodifica en el cliente para obtener nombre y correo.
    - Sin Client ID: boton con el mismo estilo que abre un selector de cuentas simulado (2 cuentas de ejemplo + "Usar
      otra cuenta" con un correo).
    - En ambos casos se crea o actualiza la cuenta (`provider: "google"`), se inicia sesion y se respeta
      `?redirect=`.
  - **Olvide mi contraseña:**
    - Link en `/login` a `/forgot-password`.
    - Al pedirlo, si la cuenta existe se crea un token (32 bytes aleatorios, expira en 30 min, un solo uso) y se
      "envia" un correo a la bandeja de prueba con el link `/reset-password?token=...`.
    - Siempre se muestra el mismo mensaje ("Si existe una cuenta con ese correo, te enviamos un enlace"), para no
      revelar que correos estan registrados, mas un acceso a la bandeja.
    - `/reset-password`: si el token es invalido, usado o expirado muestra "El enlace no es valido o expiro" +
      "Solicitar otro". Si es valido pide nueva contraseña + confirmacion (mismas reglas del registro), la guarda
      hasheada y marca el token como usado. Luego muestra "Contraseña actualizada" + "Iniciar sesion".
  - **Bandeja de prueba `/dev/inbox`:** lista de correos (para, asunto, fecha, no leido) y detalle con el cuerpo y el
    boton del link.
  - **Panel `/dev/storage`:** tabla de las claves `ticketera-*` de `localStorage` (y `sessionStorage` si queda
    alguna) con tamaño y vista del JSON, "Borrar" por clave y "Reiniciar datos de prueba" (borra todo `ticketera-*` y
    recarga).
  - Seleccion de entradas (`ticketera-ticket-selection`) pasa de `sessionStorage` a `localStorage`.
  - Footer: link discreto "Datos de prueba" a `/dev/storage`. `/login` suma el link "Abrir bandeja de prueba".
  - README: como crear el OAuth Client ID de Google y configurar `.env.local`.
- Excluye:
  - Verificar la firma del JWT de Google (requiere backend). El payload se decodifica sin verificar: sirve para
    probar, no para produccion (queda documentado).
  - Envio de correo real, verificacion de correo al registrarse, rate limiting, 2FA.
  - Vincular Google a una cuenta con contraseña del mismo correo: si ya existe con contraseña, Google inicia sesion en
    esa cuenta y la marca como vinculada (`providers: ["password", "google"]`).

## Decisiones
- **Hash:** `sha256Hex(`${email}:${password}`)` con el correo normalizado (en minusculas y sin espacios). No es un
  KDF de produccion (seria bcrypt/argon2 en backend), pero evita guardar la contraseña en texto plano en
  `localStorage`.
- **Migracion del store:** `persist` pasa a `version: 1`. Los `knownUsers` de la spec 012 no tienen contraseña y se
  descartan. Si habia sesion, se conserva.
- **Tokens y correos** viven en el modulo nuevo `src/modules/dev` (store `ticketera-dev-mail`). Auth usa
  `sendMockEmail()` y `consumeResetToken()` a traves de su barrel. `dev` no depende de `auth`.
- **Google GIS:** el script se carga con `next/script` (`afterInteractive`) solo en paginas de auth. El Client ID es
  publico. Si Google responde con error o el script no carga, se muestra un mensaje y se puede usar el correo.
- **UI:** separador "o" entre Google y el formulario. Boton de Google con el estilo de marca de Google (blanco,
  borde, logo "G" en SVG). Es la unica excepcion de color, porque las guias de marca de Google lo exigen.

## Reuso detectado
- `src/modules/auth`: formularios, `useAuthForm` (se amplia para `onValid` async que puede devolver errores),
  `AuthLayout`, `AuthTabs`, `AuthSignedIn`, `getSafeRedirect`, `getNameFromEmail`.
- `src/components/shared`: `TextField`, `PasswordField`, `EmptyState`; `src/lib/focus-form-field.ts`;
  `src/hooks/use-is-client.ts`.
- `src/components/ui`: `button`, `badge`, `sheet`. El selector simulado de Google usa `Sheet` (`side="bottom"`
  en mobile, `side="right"` en desktop); no se instala `dialog`.
- Patron de stores persistidos (`order.store`, `organizer.store`).
- `lucide-react`: `Mail`, `Inbox`, `KeyRound`, `ShieldCheck`, `Database`, `Trash2`, `RotateCcw`, `ExternalLink`.

## Contratos

### Auth (`src/modules/auth`)
```ts
// types
export type AuthProvider = "password" | "google";
export interface AuthAccount { fullName: string; email: string; passwordHash: string | null; providers: AuthProvider[]; createdAt: string }
export interface ForgotPasswordValues { email: string }
export interface ResetPasswordValues { password: string; confirmPassword: string }

// store (version 1)
export interface AuthState {
  user: AuthUser | null;
  accounts: AuthAccount[];
  register: (input: { fullName: string; email: string; password: string }) => Promise<AuthResult>;
  login: (input: { email: string; password: string }) => Promise<AuthResult>;
  loginWithGoogle: (profile: { fullName: string; email: string }) => AuthUser;
  updatePassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; field: "email" | "password"; message: string };
// Semilla: cuenta demo@ticketera.pe / Demo1234 (hash precalculado)

// utils
export async function hashPassword(email: string, password: string): Promise<string>; // hex sha-256
export function decodeGoogleCredential(credential: string): { fullName: string; email: string } | null;
export const DEMO_ACCOUNT: { email: string; password: string };

// schemas
export function validateForgotPassword(values): FormErrors<ForgotPasswordValues>;
export function validateResetPassword(values): FormErrors<ResetPasswordValues>; // reglas de registro + coinciden
```

### Dev (`src/modules/dev`)
```ts
export interface MockEmail { id: string; to: string; subject: string; body: string; actionLabel: string; actionHref: string; createdAt: string; read: boolean }
export interface ResetToken { token: string; email: string; expiresAt: string; usedAt: string | null }
export interface DevMailState {
  emails: MockEmail[]; resetTokens: ResetToken[];
  sendMockEmail: (email: Omit<MockEmail, "id" | "createdAt" | "read">) => MockEmail;
  createResetToken: (email: string, now?: Date) => ResetToken;
  getResetTokenStatus: (token: string, now?: Date) => { status: "valid"; email: string } | { status: "invalid" | "expired" | "used" };
  consumeResetToken: (token: string, now?: Date) => string | null; // email o null
  markRead: (id: string) => void;
}
export function listStorageEntries(): { key: string; area: "local" | "session"; bytes: number; value: string }[];
export function clearStorageEntry(key: string, area: "local" | "session"): void;
export function resetDemoData(): void; // borra ticketera-* en ambos storages
```

### Componentes y rutas
```
src/modules/auth/components/google-sign-in-button.tsx   // "use client": GIS real o selector simulado; onSuccess(profile)
src/modules/auth/components/auth-divider.tsx            // separador "o"
src/modules/auth/components/forgot-password-form.tsx    // "use client"
src/modules/auth/components/reset-password-form.tsx     // "use client" (lee ?token=)
src/modules/dev/components/mock-inbox.tsx                // "use client": lista + detalle (?id=)
src/modules/dev/components/storage-panel.tsx             // "use client"
src/app/(auth)/forgot-password/page.tsx
src/app/(auth)/reset-password/page.tsx                  // Suspense (useSearchParams)
src/app/(main)/dev/inbox/page.tsx                        // Suspense
src/app/(main)/dev/storage/page.tsx
```
`login-form.tsx` y `register-form.tsx` suman Google, separador y errores de credenciales; `login-form` suma
"¿Olvidaste tu contraseña?" → `/forgot-password` y el aviso de la cuenta de prueba.

## Tareas
| ID | Descripcion | Archivos (owner) | Depende de | Grupo |
|----|-------------|------------------|------------|-------|
| T1 | Modulo dev: tipos, store de correos/tokens + test, utils de storage + test, barrel | src/modules/dev/types/dev.types.ts, src/modules/dev/store/dev-mail.store.ts, src/modules/dev/store/dev-mail.store.test.ts, src/modules/dev/utils/storage.utils.ts, src/modules/dev/utils/storage.utils.test.ts, src/modules/dev/index.ts | - | S |
| T2 | Auth datos: tipos, store v1 con cuentas + test, utils (hash, Google) + test, schemas forgot/reset + test, `useAuthForm` async | src/modules/auth/types/auth.types.ts, src/modules/auth/store/auth.store.ts, src/modules/auth/store/auth.store.test.ts, src/modules/auth/utils/auth.utils.ts, src/modules/auth/utils/auth.utils.test.ts, src/modules/auth/schemas/auth.schema.ts, src/modules/auth/schemas/auth.schema.test.ts, src/modules/auth/hooks/use-auth-form.ts | T1 | S |
| T3 | Google + formularios de login/registro | src/modules/auth/components/google-sign-in-button.tsx, src/modules/auth/components/auth-divider.tsx, src/modules/auth/components/login-form.tsx, src/modules/auth/components/register-form.tsx | T2 | P1 |
| T4 | Olvide / restablecer contraseña | src/modules/auth/components/forgot-password-form.tsx, src/modules/auth/components/reset-password-form.tsx, src/app/(auth)/forgot-password/page.tsx, src/app/(auth)/reset-password/page.tsx | T2 | P1 |
| T5 | Bandeja y panel de datos | src/modules/dev/components/mock-inbox.tsx, src/modules/dev/components/storage-panel.tsx, src/app/(main)/dev/inbox/page.tsx, src/app/(main)/dev/storage/page.tsx | T1 | P1 |
| T6 | Integracion: barrel auth, seleccion a localStorage, footer, README | src/modules/auth/index.ts, src/modules/ticket/store/ticket-selection.store.ts, src/components/shared/site-footer.tsx, README.md | T3, T4, T5 | S |

Orden: T1 → T2 → [T3 ‖ T4 ‖ T5] → T6. ~28 archivos.

## Criterios de aceptacion
- [x] AC1: Registrarse con un correo nuevo crea la cuenta e inicia sesion. Registrarse de nuevo con el mismo correo
  muestra "Ya existe una cuenta con ese correo". `localStorage` guarda el hash, nunca la contraseña.
- [x] AC2: Login con correo desconocido / contraseña incorrecta / cuenta solo Google muestra el error correcto bajo
  el campo que corresponde. `demo@ticketera.pe` / `Demo1234` entra.
- [x] AC3: Sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: "Continuar con Google" abre el selector simulado. Elegir una cuenta
  inicia sesion (crea la cuenta Google si no existia) y respeta `?redirect=`.
- [ ] AC4: Con `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: se muestra el boton oficial de Google y un login exitoso inicia sesion
  con el nombre y correo de la cuenta de Google. Verificable por el usuario con su Client ID; no se puede probar en
  este entorno.
- [x] AC5: `/forgot-password` con cualquier correo muestra el mismo mensaje. Con un correo registrado aparece un
  correo en `/dev/inbox` con el link de reseteo.
- [x] AC6: El link lleva a `/reset-password?token=...`. La nueva contraseña (validada y confirmada) reemplaza la
  anterior: la vieja deja de funcionar y la nueva entra. Reusar el link muestra "El enlace no es valido o expiro".
  Un token expirado (> 30 min) tambien.
- [x] AC7: `/dev/storage` lista las claves `ticketera-*` con tamaño y JSON. "Borrar" elimina una clave y
  "Reiniciar datos de prueba" deja la app como nueva (sin sesion, pedidos ni eventos creados).
- [x] AC8: La seleccion de entradas sobrevive a cerrar el navegador (`localStorage`).
- [x] AC9: Sin scroll horizontal en 375/1440; labels asociados, foco visible; sin hydration warnings.
- [x] AC10: `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.

## Tests requeridos
- `dev-mail.store.test.ts`: enviar correo; token valido/expirado/usado; `consumeResetToken` de un solo uso.
- `storage.utils.test.ts`: lista solo `ticketera-*`, tamaños; borrar por clave; `resetDemoData`.
- `auth.store.test.ts`: registro (hash, duplicado), login (ok, correo desconocido, contraseña incorrecta, cuenta
  Google), Google crea/vincula, `updatePassword` cambia el hash, cuenta demo sembrada, migracion v0 → v1.
- `auth.utils.test.ts`: `hashPassword` deterministico y distinto por correo; `decodeGoogleCredential` (JWT de
  ejemplo, invalido → null).
- `auth.schema.test.ts`: forgot (correo), reset (reglas + coincidencia).

## Preguntas abiertas
- Ninguna bloquea. Para probar Google real el usuario debe crear un OAuth 2.0 Client ID (tipo "Aplicacion web") en
  Google Cloud Console, con origen autorizado `http://localhost:3000`, y ponerlo en `.env.local` como
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Estado
- Aprobacion humana: aprobada (2026-09-29)
- Fase: implementada
- Log de review: verificacion propia (tests, tsc, lint, build y Playwright a 375/1440). Sin hallazgos abiertos.
- Desviaciones:
  - `DEV_INBOX_PATH` vive en el modulo `dev` (dueño de la bandeja) y `auth` lo importa, en vez de definirlo en
    `auth.utils`.
  - "Reiniciar datos de prueba" hace una recarga completa (`window.location.assign("/")`) a proposito, para que los
    stores de zustand en memoria tambien vuelvan a su estado inicial.
- Verificacion:
  - 196 tests (26 archivos) en verde; `tsc`, `lint` y `build` sin errores.
  - E2E a 375 y 1440: errores de login (correo desconocido, contraseña incorrecta, cuenta solo Google), registro
    (hash en `localStorage`, sin la contraseña en texto plano) y duplicado, "olvide mi contraseña" → bandeja →
    reset (confirmacion que no coincide, exito, reuso rechazado, la contraseña vieja falla y la nueva entra), Google
    simulado con `?redirect=`, panel de datos (borrar una clave, reiniciar deja `localStorage` vacio). Sin scroll
    horizontal ni hydration warnings.
  - AC4 (Google real) queda para que el usuario lo pruebe con su Client ID: en este entorno no hay uno.
