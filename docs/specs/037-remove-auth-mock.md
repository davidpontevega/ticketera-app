# 037 — Borrar el auth mock (Fase 4 de 018, "021") y el modulo `dev`

Estado: implementada (pendiente AC8 manual con Clerk)

## Estado
- Aprobacion humana: aprobada (2026-10-09, 4 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P1-08. Numero 037: 020 y 021 quedaron reservados por 018/024 y nunca se usaron; esta spec cumple la "Fase 4
(021)" de `018-clerk-google-auth.md` mas lo que quedo pendiente de 020 (`checkout-form.tsx`, ver 034 "fuera de alcance").

## Objetivo
Clerk es la unica fuente de identidad (019, 024, 026). Lo que queda del mock de las specs 012/016 esta huerfano salvo
un consumidor vivo: `checkout-form.tsx` lee `useAuthStore` (cuentas en `localStorage`), que con Clerk siempre esta
vacio, asi que hoy el checkout nunca autocompleta y siempre muestra "Inicia sesion para autocompletar" aun logueado
(bug). Se migra ese consumidor a `useCurrentUser()` y se borra todo el codigo mock: store con SHA-256, forms de
forgot/reset, boton Google GIS, `AuthSignedIn`, modulo `src/modules/dev` (bandeja y panel de storage), sus rutas, el
link "Datos de prueba" y el texto del README sobre el mock.
Referencias: `018` (Fase 4 y "Reuso detectado" de lo que se conserva), `019` (login/register con `<SignIn>`/`<SignUp>`;
"olvide mi contraseña" lo da el propio componente Clerk), `034` (prefill solo nombre/correo), `026` (proxy),
`SYSTEM_DESIGN.md` (fila "Autenticacion").

## Hallazgos (verificado con grep en `src`, `docs`, `README.md`, `next.config.ts`, `src/proxy.ts`, `.env.example`)
- `useAuthStore` / `auth.store`: consumidores fuera de su propio archivo y test: `auth-signed-in.tsx`,
  `forgot-password-form.tsx`, `reset-password-form.tsx` (todos borrables) y **`order/components/checkout-form.tsx`**
  (lineas 14, 46, 51). `order-confirmation.tsx` ya no lo usa (solo importa `MY_TICKETS_PATH`, que se conserva).
- `login-form.tsx` / `register-form.tsx` **estan vivos**: ya son wrappers de `<SignIn>`/`<SignUp>` (019) y las pages
  catch-all los usan. No son huerfanos; no se tocan.
- Huerfanos tras 019/026: `auth.store.ts` (+test), `auth-signed-in.tsx`, `auth-divider.tsx`, `google-sign-in-button.tsx`
  (GIS; `NEXT_PUBLIC_GOOGLE_CLIENT_ID` no esta en `.env.example` ni se usa fuera de este archivo), `forgot-password-form.tsx`,
  `reset-password-form.tsx`, `use-auth-form.ts` (solo lo usan forgot/reset), `auth.schema.ts` (+test; solo sus
  validadores de login/register/forgot/reset), y de `auth.utils.ts`: `DEMO_ACCOUNT*`, `normalizeEmail`, `hashPassword`,
  `decodeGoogleCredential`. Del barrel `index.ts` salen tambien `AuthAccount`, `AuthProvider`, `AuthResult`, `*FormValues`,
  `FormErrors`, `useAuthStore`, `AuthState`.
- Se **conservan con razon** (consumidores vivos): `auth-layout.tsx` (layout `(auth)`), `auth-tabs.tsx`, `user-menu.tsx`
  (+ `MY_TICKETS_PATH`: `order-confirmation.tsx`), `use-current-user.ts` (+test), `getSafeRedirect` y `getAuthHref`
  (login/register/user-menu/checkout), `getInitials` (`admin-shell`, `organizer-shell`, `user-dialog`), `getNameFromEmail`
  (`use-current-user`, `user-sync.service` + su test) y el tipo `AuthUser` (`order.utils.ts`, hook). `AuthPath` pasa a
  `"/login" | "/register"`. No hay constantes de redirect compartidas con `src/proxy.ts`/`protected-routes.ts` (el proxy
  usa `auth.protect()` de Clerk): nada que preservar ahi.
- Modulo `dev` (`mock-inbox`, `storage-panel`, `dev-mail.store`, `storage.utils`, `dev.types`): consumidores solo las
  pages `(main)/dev/inbox` y `(main)/dev/storage`, `forgot-password-form`/`reset-password-form` (`useDevMailStore`) y el
  link del footer. `storage.utils` tambien gestiona `ticketera-ticket-selection` (unica clave viva del prefijo
  `ticketera-`), pero es utilidad de depuracion; se borra con el modulo (ver pregunta 2).
- Rutas `(auth)/forgot-password` y `(auth)/reset-password`: sus unicos enlaces entrantes son codigo que se borra
  (`mock-inbox` -> `/forgot-password`, `reset-password-form` -> `/forgot-password`, el email falso -> `/reset-password`,
  `AuthPath`). No existen enlaces externos reales (los correos eran simulados).
- Clerk: `<SignIn path="/login">` muestra "¿Olvidaste tu contraseña?" y resuelve el reset en subrutas del catch-all
  (`/login/reset-password`, ...). Eso es independiente de la ruta propia `/reset-password`. Depende de que Email+Password
  este habilitado en el dashboard (018 lo exige); no verificable por grep -> AC manual.
- Docs: `README.md` seccion "Datos de prueba" (lineas ~46-53: cuenta demo, `/dev/inbox`, `/dev/storage`, "sin backend")
  y "Iniciar sesion con Google (opcional, obsoleto)" (~75-96), que 018 ya marco para borrarse en esta fase. Resto del
  README (P3-14) no se toca. `SYSTEM_DESIGN.md` no menciona el mock ni `dev`; solo se agrega esta spec a la fila
  "Autenticacion". Ningun test fuera de `auth.store.test`, `auth.schema.test`, `auth.utils.test`, `dev-mail.store.test`,
  `storage.utils.test` toca lo borrado.
- `ticket-selection.store.ts:27` tiene un comentario "Se ve y se borra en /dev/storage" que queda falso.

## Decisiones
1. **Rutas borradas = 404** (sin redirect). Nadie enlaza ya a ellas; un redirect a `/login` mantendria rutas muertas.
   `/dev/*` tambien 404 (eran solo para el mock).
2. **Prefill del checkout con `useCurrentUser()`**: `user` de Clerk carga async, asi que el inicializador de `useState`
   no sirve como hoy. `CheckoutForm` pasa a ser un envoltorio que muestra el skeleton existente (`h-96 animate-pulse`)
   hasta `isClient && isLoaded` y renderiza un componente interno (`CheckoutFormBody`, mismo archivo) que recibe
   `user: AuthUser | null` y calcula `getCheckoutPrefill(user)` en su inicializador. Se mantiene `getCheckoutPrefill`
   (`order.utils.ts` y su test no cambian). Sin pagina servidor nueva ni props nuevas en `EventCheckoutView`.
3. **localStorage residual** (`ticketera-auth`, `ticketera-dev-mail` en navegadores ya usados): no se limpia (YAGNI;
   inocuo, sin lectura). Se anota en el README.
4. **Orden**: T3 (checkout) antes que T1 (borra el store) y T1 antes que T2 (el modulo `dev` lo importan los forms que
   T1 borra); T4 (docs) es independiente. Cada archivo pertenece a una sola tarea.

## Alcance
- Incluye: lo descrito en Objetivo y Decisiones; limpiar barrel, tipos y utils del modulo `auth`; limpiar README/SYSTEM_DESIGN
  solo en lo del mock.
- No incluye: cambios a `login-form`/`register-form`/`user-menu`/proxy; theming Clerk; reescribir el README completo
  (P3-14); borrar `ticket-selection.store` ni su persistencia; limpieza activa de `localStorage` de usuarios.

## Reutilizar
`useCurrentUser` (barrel `@/modules/auth`, ya exportado), `getCheckoutPrefill`, `getAuthHref`, skeleton existente del
checkout, `useIsClient`. Nada nuevo.

## Archivos

| Archivo | Accion | Tarea |
|---|---|---|
| `src/modules/order/components/checkout-form.tsx` | Editar (ver Decision 2) | T3 |
| `src/modules/auth/store/auth.store.ts`, `auth.store.test.ts` | Borrar | T1 |
| `src/modules/auth/components/auth-signed-in.tsx`, `auth-divider.tsx`, `google-sign-in-button.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` | Borrar | T1 |
| `src/modules/auth/hooks/use-auth-form.ts` | Borrar | T1 |
| `src/modules/auth/schemas/auth.schema.ts`, `auth.schema.test.ts` | Borrar | T1 |
| `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx` | Borrar | T1 |
| `src/modules/auth/utils/auth.utils.ts`, `auth.utils.test.ts` | Editar: quedan `getSafeRedirect`, `getAuthHref`, `getInitials`, `getNameFromEmail`, `AuthPath` (`/login`\|`/register`) y sus tests | T1 |
| `src/modules/auth/types/auth.types.ts` | Editar: queda solo `AuthUser` | T1 |
| `src/modules/auth/index.ts` | Editar: quitar exports borrados | T1 |
| `src/modules/dev/**` (components, store, utils, types, index + tests) | Borrar | T2 |
| `src/app/(main)/dev/inbox/page.tsx`, `src/app/(main)/dev/storage/page.tsx` | Borrar | T2 |
| `src/components/shared/site-footer.tsx` | Editar: quitar link "Datos de prueba" (y `Link`/imports si quedan sin uso) | T2 |
| `src/modules/ticket/store/ticket-selection.store.ts` | Editar solo el comentario de la linea ~27 | T2 |
| `README.md` | Editar: borrar "Datos de prueba" y "Iniciar sesion con Google (obsoleto)"; nota breve de claves `ticketera-auth`/`ticketera-dev-mail` residuales | T4 |
| `docs/SYSTEM_DESIGN.md` | Editar: agregar 037 a la fila "Autenticacion" (mock retirado) | T4 |

## Criterios de aceptacion
- AC1: `grep -rnE "useAuthStore|auth\.store|useDevMailStore|dev-mail|@/modules/dev|modules/dev" src` sin resultados.
- AC2: `grep -rnE "forgot-password|reset-password|ForgotPassword|ResetPassword|/dev/(inbox|storage)|DEMO_ACCOUNT|hashPassword|decodeGoogleCredential|GOOGLE_CLIENT_ID|google-sign-in|AuthSignedIn|useAuthForm|auth\.schema" src` sin resultados (el `reset-password` de Clerk vive en su SDK, no en `src`).
- AC3: `src/modules/dev`, `src/app/(main)/dev`, `src/app/(auth)/forgot-password` y `src/app/(auth)/reset-password` no existen.
- AC4: `src/modules/auth` contiene solo `auth-layout`, `auth-tabs`, `login-form`, `register-form`, `user-menu`, `use-current-user` (+test), `auth.utils` (+test), `auth.types`, `index.ts`; el barrel exporta `AuthLayout`, `LoginForm`, `RegisterForm`, `UserMenu`, `MY_TICKETS_PATH`, `useCurrentUser`, `CurrentUser`, `getAuthHref`, `getInitials`, `getNameFromEmail`, `getSafeRedirect`, `AuthUser`.
- AC5: `checkout-form.tsx` no importa `useAuthStore`; con usuario Clerk el formulario abre con nombre y correo rellenos y el aviso "Completamos tus datos con tu cuenta"; sin sesion (no alcanzable por el proxy, pero soportado) muestra el link `getAuthHref("/login", ...)`; mientras Clerk carga se muestra el skeleton, sin hydration mismatch.
- AC6: `README.md` no contiene "demo@ticketera.pe", "/dev/inbox", "/dev/storage" ni "NEXT_PUBLIC_GOOGLE_CLIENT_ID".
- AC7: `npx tsc --noEmit`, `npm run lint`, `npm run test -- --run` y `npm run build` pasan; la lista de rutas del build ya no incluye `/forgot-password`, `/reset-password`, `/dev/*` y sigue incluyendo `/login`, `/register`.
- AC8 (manual, con Clerk): `/forgot-password`, `/reset-password`, `/dev/inbox`, `/dev/storage` responden 404; en `/login` el componente muestra "¿Olvidaste tu contraseña?" y completa el reset; el footer ya no tiene "Datos de prueba"; el header y `/my-tickets` siguen funcionando logueado.

## Tests requeridos
- `auth.utils.test.ts`: se eliminan los casos de `hashPassword`, `decodeGoogleCredential`, `DEMO_ACCOUNT`, `normalizeEmail`; se conservan (o se agregan, si faltan) los de `getSafeRedirect`, `getAuthHref` (sin `/forgot-password`), `getInitials`, `getNameFromEmail`.
- Se borran `auth.store.test`, `auth.schema.test`, `dev-mail.store.test`, `storage.utils.test` junto con su codigo.
- `checkout-form.tsx`: sin test hoy; la logica de prefill ya esta cubierta por `getCheckoutPrefill` en `order.utils.test.ts` (sin cambios). No se agrega test de componente (YAGNI).
- `use-current-user.test.ts` y `my-tickets.test.tsx` sin cambios; deben seguir en verde.

## Tareas

### T3 — Migrar `checkout-form` a `useCurrentUser`
- Archivos: `src/modules/order/components/checkout-form.tsx`
- Depende de: —
- Paralelizable: si (con T4)
- Cubre: AC5, AC7

### T1 — Borrar el mock del modulo `auth` y sus rutas
- Archivos: los marcados T1 en la tabla (borrados + `auth.utils(.test)`, `auth.types`, `index.ts`)
- Depende de: T3 (el store deja de tener consumidores)
- Paralelizable: no (T2 depende de el)
- Cubre: AC1, AC2, AC3, AC4, AC7

### T2 — Borrar el modulo `dev`, sus rutas y el link del footer
- Archivos: los marcados T2 en la tabla
- Depende de: T1 (los forms que importaban `useDevMailStore` ya no existen)
- Paralelizable: no
- Cubre: AC1, AC2, AC3, AC7, AC8

### T4 — Docs
- Archivos: `README.md`, `docs/SYSTEM_DESIGN.md`
- Depende de: —
- Paralelizable: si (con T3)
- Cubre: AC6

## Preguntas abiertas
1. **404 vs redirect** para `/forgot-password` y `/reset-password`: se propone 404 (Decision 1). Alternativa: redirect a `/login` en `next.config.ts` si se teme a marcadores viejos; no se propone porque los correos eran simulados.
2. **`/dev/storage` (reiniciar datos de prueba)** desaparece junto con el modulo, y era la unica UI para borrar `ticketera-ticket-selection`. Se propone aceptarlo (el usuario puede limpiar desde DevTools). Alternativa: conservar solo `storage-panel` sin mail/auth; no se propone por ser herramienta de la era "sin backend".
3. **Reset de contraseña de Clerk**: confirmar en el dashboard que Email+Password con "Forgot password" esta habilitado (AC8); no verificable por codigo.
4. **Limpieza de `localStorage` residual** (`ticketera-auth` contiene hashes de cuentas demo): se propone solo anotarlo en el README. Si se quiere limpiar, una linea de `localStorage.removeItem` en el layout `(auth)`, fuera de esta spec.

## Proximas fases
- README completo (P3-14).
- Rol en la sesion / theming de Clerk (backlog de 018).

## Log de review
- Iteracion 1 — PASS. tsc, eslint, vitest completo (47 archivos, 552 tests) y npm run build OK. Pendiente manual AC8 (Clerk): /forgot-password, /reset-password, /dev/inbox y /dev/storage dan 404; /login muestra "Olvidaste tu contrasena?" y completa el reset (requiere Email+Password habilitado en el dashboard de Clerk); footer sin "Datos de prueba"; header y /my-tickets con sesion; checkout autocompleta nombre y correo con sesion iniciada. Nota: se borro .next/dev/types (artefacto de build) para regenerar tipos tras borrar rutas.
