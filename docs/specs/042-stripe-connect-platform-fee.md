# 042 — Stripe Connect para organizadores + comision de plataforma

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-14, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Que cada organizador conecte su cuenta Stripe (Express) y que el checkout cobre con **destination charge**: el dinero
va a la cuenta del organizador y la plataforma retiene un porcentaje (`application_fee_amount`) editable solo por
`super_admin`. Hoy todo se cobra a una unica cuenta de la plataforma (spec 022/023). Referencias:
`022/023` (checkout hosted), `032` (emision de tickets al pagar, sin cambios), `033` (lock + reserva antes de crear la
session), `036` (patron de action + `useActionState` del organizador), `024/026` (roles, `requireRole`),
`040` (formato de spec y patron de pagina del organizador). Referencia del profesor (solo lectura, no copiada): spec
`organizer-stripe-connect.md` (usa Accounts v2 + webhook thin events + gate de publicacion; aqui se simplifica, ver
Decisiones 1, 3 y 4).

**Prerequisito del usuario (no es codigo):** activar Connect en el Dashboard de Stripe **modo test** (Settings ->
Connect -> "Get started", tipo plataforma/marketplace con cuentas Express). Sin esto `stripe.accounts.create` falla.
**Ruta de degradacion:** `STRIPE_CONNECT_ENABLED` (env, default ausente = `false`). Con el flag apagado el checkout es
**identico al actual** (cobra a la cuenta de la plataforma, sin fee, sin bloqueo) y las paginas nuevas muestran
"Stripe Connect desactivado".

## Hallazgos (verificado en codigo)
- `users` (`user.table.ts`) no tiene campos de Stripe; `events.organizer_id -> users.id` (nullable, SET NULL). No existe
  tabla `organizer` aparte: el "organizador" es el usuario con ese rol => las columnas van en `users`.
- `createCheckoutSession` (`order/services/checkout.service.ts`): `getPublishedEvent` -> lineas/total -> transaccion con
  advisory lock (cancela pendientes del mismo comprador, valida cupo, inserta `orders`) -> `stripe.checkout.sessions.create`
  con `payment_intent_data: { receipt_email, metadata }`. Si Stripe falla la orden se cancela. El monto es
  `totals.amount` (PEN, `EVENT_CURRENCY`).
- Webhook `/api/webhooks/stripe` + `handleStripeEvent` solo procesan `checkout.session.*`; con destination charges esos
  eventos llegan igual a la plataforma => **no cambia**.
- `ORGANIZER_AREA_ROLES` y `USER_ADMIN_ROLES = ["super_admin"]` (`user.constants.ts`) ya existen; `/organizer` y `/admin`
  estan protegidos por el proxy (`protected-routes.ts`) => **no se toca el proxy**. El admin tiene `ADMIN_NAV_SECTIONS`
  (seccion "Administracion" con `roles: USER_ADMIN_ROLES`) y el organizador `ORGANIZER_NAV`.
- `drizzle.config.ts` toma `src/modules/*/db/*.table.ts`: una tabla nueva en `payment/db/` entra sola.
- `stripe` ya es `^23.0.0` (`src/lib/stripe.ts`, cliente unico). `docs/specs/041-*` **no existe aun** (ver Decisiones 8).
- Drizzle omite el prefijo de tabla en selects/subconsultas de una sola tabla: calificar a mano (`"users"."id"`).
- Next 16: el developer lee `node_modules/next/dist/docs/` antes de tocar pages/actions (`PageProps`, `redirect`).

## Decisiones
1. **Express + API v1 clasica** (`stripe.accounts.create({ type: "express", capabilities: { transfers: { requested: true } } })`
   + `stripe.accountLinks.create({ type: "account_onboarding" })`). El profesor usa Accounts v2; aqui no se necesita
   (YAGNI). El developer confirma los tipos exactos en `node_modules/stripe` (v23) antes de codificar.
2. **Modulo nuevo `src/modules/payment`** concentra todo lo de Connect y comision (servicios, schema, actions, UI,
   tabla `platform_settings`). `user` y `order` solo ganan columnas; `order` consume dos funciones de `payment`.
   `payment` importa `stripe` solo desde `@/lib/stripe`.
3. **Estado de onboarding por consulta, sin webhook Connect** (MVP). `syncOnboardingStatus(user)` hace
   `accounts.retrieve` y mapea: `complete` si `details_submitted && capabilities.transfers === "active"`, si no `pending`.
   Se ejecuta (a) al cargar `/organizer/payments` cuando hay cuenta y no esta `complete` (cubre el retorno del
   onboarding, `return_url`) y (b) nunca en el checkout (el checkout lee la DB). El webhook `account.updated` se difiere
   (requiere endpoint Connect + secreto propio) -> Fuera de alcance.
4. **Politica sin onboarding completo** (decision): **no se bloquea publicar** (el flag y el onboarding son opcionales
   para el flujo de contenido) y **solo se bloquea la compra**, con mensaje claro, y **solo con el flag encendido**.
   Justificacion: bloquear publicar rompe el flujo de la spec 036 y los eventos semilla (spec 025); bloquear compra
   protege el dinero (nunca se cobra a la plataforma por cuenta de un tercero sin destino). Con flag encendido y
   organizador sin cuenta `complete` (o evento sin `organizer_id`) => 409 `"El organizador aun no habilita los pagos de este evento"`
   **antes** de reservar inventario. Alternativa (cobrar a la plataforma sin fee como "modo demo") queda en pregunta 2.
5. **Comision**: tabla `platform_settings` de **una sola fila** (`id smallint PK CHECK (id = 1)`,
   `fee_percent numeric(5,2) NOT NULL`, `updated_by uuid NULL -> users(id) SET NULL`, `updated_at timestamptz`).
   Si la fila no existe se usa `DEFAULT_PLATFORM_FEE_PERCENT = 10` (sin seed). Guardar = upsert. Rango valido 0 a 50
   (`FEE_PERCENT_MAX`). Solo `super_admin` (`requireRole(USER_ADMIN_ROLES)` en page **y** action).
6. **Calculo en centavos enteros**, funcion pura `calculatePlatformFee(totalAmount, feePercent)` =>
   `{ feeCents, netCents }` con `feeCents = Math.round(totalCents * percent / 100)` y `feeCents < totalCents`
   (Stripe exige fee menor al monto). Cuando el fee calculado es 0 no se envia `application_fee_amount`.
7. **Registro en la orden** (para metricas): `orders.platform_fee_amount numeric(10,2) NULL`,
   `orders.organizer_net_amount numeric(10,2) NULL`, `orders.platform_fee_percent numeric(5,2) NULL`. Se escriben en el
   `INSERT` de la reserva (el porcentaje queda congelado en la orden; cambios posteriores de `platform_settings` no la
   alteran). `NULL` = orden sin Connect (flag apagado u ordenes previas). Un `platform_fee_amount IS NOT NULL` identifica
   una orden de destination charge.
8. **Reembolsos (spec 041 no existe aun)**: esta spec **no implementa reembolsos**. Contrato para 041: si
   `orders.platform_fee_amount IS NOT NULL`, el refund debe crearse con `reverse_transfer: true` y
   `refund_application_fee: true` (reembolso total: comprador integro, organizador devuelve su neto, plataforma devuelve
   su fee); en ordenes sin fee, refund normal. Parcial: fuera de alcance de ambas. Si 041 ya esta redactada al aprobar,
   el spec agent/humano concilia este punto.
9. **Pagina del organizador `/organizer/payments`** (tarjeta con estado: no iniciado / pendiente / listo + boton
   "Conectar con Stripe" / "Continuar onboarding"). La action crea la cuenta si falta (guarda `stripe_account_id`
   con `UPDATE ... WHERE stripe_account_id IS NULL` y `idempotencyKey` `connect-account-<userId>` para carreras),
   crea el `AccountLink` (`return_url`/`refresh_url` = `/organizer/payments?connect=return|refresh`, origen de
   `headers()`/env, no del cliente) y hace `redirect(url)` fuera de `try/catch`. Los links no se guardan.
10. **Pagina admin `/admin/settings`**: un form (`fee_percent`) con `useActionState`; muestra el valor vigente y quien/
    cuando lo cambio. Item "Comision" en la seccion "Administracion" del nav.
11. **Pais/moneda de la cuenta Express**: `STRIPE_CONNECT_ACCOUNT_COUNTRY` (default `US`). Peru no figura como pais de
    cuentas conectadas; es una demo en modo test (ver Riesgos).

## Alcance
- Incluye: columnas en `users` y `orders`; tabla `platform_settings`; migracion; flag y variables de entorno;
  servicio de onboarding (crear cuenta, AccountLink, sync de estado); servicio y action de comision (solo
  super_admin); pagina `/organizer/payments` y `/admin/settings`; items de nav; checkout con `transfer_data.destination`
  + `application_fee_amount`; bloqueo de compra con flag encendido y organizador no `complete`; registro de fee/neto
  en la orden; tests.
- No incluye (se difiere): webhook `account.updated` / endpoint Connect; gate de publicacion por Connect; reembolsos
  (spec 041; solo se fija el contrato en Decisiones 8); fee fijo por ticket o por evento; comisiones distintas por
  organizador; payouts, balance o dashboard de Stripe del organizador (Express Dashboard link); `on_behalf_of`;
  desconectar cuenta; KYC/RUC propio; mostrar fee/neto en el dashboard del organizador (los datos quedan en la orden);
  aviso en la ficha del evento cuando el organizador no puede cobrar; cambios al proxy.

## Reutilizar
- `stripe` (`@/lib/stripe`), `db` (`@/lib/db`), `requireRole`, `ORGANIZER_AREA_ROLES`, `USER_ADMIN_ROLES`
  (`@/modules/user`), `EVENT_CURRENCY`.
- `createCheckoutSession` y su transaccion (solo se anaden campos); `getPublishedEvent` (`event.service.ts`; el
  developer verifica que exponga `organizerId`, si no, lo consulta con una query puntual `events.organizer_id`).
- Patron de action + `useActionState` + `revalidatePath` (`organizer-event.actions.ts`, `check-in.actions.ts`),
  `OrganizerShell`/`AdminShell`, `ORGANIZER_NAV`, `ADMIN_NAV_SECTIONS`.
- UI ya instalada: `card`, `button`, `badge`, `input`, `field`, `label` (verificar con `ls src/components/ui`; el
  developer instala solo lo que falte con `npx shadcn@latest add` en T0). Iconos `lucide-react` (`CreditCard`,
  `Percent`/`Settings`).
- Patron de tests: `checkout.service.test.ts` (mock de `stripe` y `db`), `check-in.actions.test.ts`,
  `check-in-panel.test.tsx`.

## Archivos
| Archivo | Tarea | Cambio |
|---------|-------|--------|
| `src/modules/user/db/user.table.ts` | T0 | `stripeAccountId text UNIQUE NULL`, enum `stripe_onboarding_status` (`not_started \| pending \| complete`) en `stripeOnboardingStatus NOT NULL DEFAULT 'not_started'` |
| `src/modules/order/db/order.table.ts` | T0 | `platformFeeAmount`, `organizerNetAmount` (numeric 10,2 NULL), `platformFeePercent` (numeric 5,2 NULL) |
| `src/modules/payment/db/platform-settings.table.ts` | T0 | tabla `platform_settings` (Decisiones 5) |
| `drizzle/0007_*.sql` + `drizzle/meta/*` | T0 | `npx drizzle-kit generate` (NO se aplica). El numero real lo fija el developer al generar (proxima libre; si 041 uso 0007, sera 0008) |
| `.env.example` | T0 | `STRIPE_CONNECT_ENABLED`, `STRIPE_CONNECT_ACCOUNT_COUNTRY`, prerequisito documentado |
| `src/modules/payment/constants/payment.constants.ts` | T0 | `DEFAULT_PLATFORM_FEE_PERCENT`, `FEE_PERCENT_MAX`, `PAYMENTS_PATH`, `ADMIN_SETTINGS_PATH`, `isConnectEnabled()` |
| `src/modules/payment/utils/payment.utils.ts` (+ `.test.ts`) | T0 | `calculatePlatformFee`, `mapAccountToOnboardingStatus` (puras) |
| `src/modules/payment/types/payment.types.ts` | T0 | `OnboardingStatus`, `ConnectActionState`, `FeeActionState`, `PlatformSettings` |
| `src/modules/organizer/constants/organizer.constants.ts` | T0 | item "Pagos" en `ORGANIZER_NAV` (`/organizer/payments`) |
| `src/modules/admin/constants/admin.constants.ts` | T0 | item "Comision" (`/admin/settings`) en la seccion "Administracion" |
| `src/modules/payment/services/connect.service.ts` (+ `.test.ts`) | T1 | `startConnectOnboarding(user, origin)`, `syncOnboardingStatus(user)`, `getPayoutAccount(organizerId)` => `{ accountId } \| null` solo si `complete` (`server-only`) |
| `src/modules/payment/services/platform-settings.service.ts` (+ `.test.ts`) | T1 | `getPlatformFeePercent()`, `getPlatformSettings()`, `setPlatformFeePercent(percent, viewerId)` upsert |
| `src/modules/payment/schemas/platform-settings.schema.ts` (+ `.test.ts`) | T1 | `feePercentSchema` (`coerce.number`, 0 a `FEE_PERCENT_MAX`, max 2 decimales) |
| `src/modules/payment/actions/connect.actions.ts` (+ `.test.ts`) | T1 | `startConnectOnboardingAction` (`requireRole(ORGANIZER_AREA_ROLES)`, `redirect`) |
| `src/modules/payment/actions/platform-settings.actions.ts` (+ `.test.ts`) | T1 | `updatePlatformFeeAction` (`requireRole(USER_ADMIN_ROLES)`, `revalidatePath`) |
| `src/modules/payment/components/connect-status-card.tsx` (+ `.test.tsx`) | T2 | estado + boton (form con `useActionState`) |
| `src/modules/payment/components/platform-fee-form.tsx` (+ `.test.tsx`) | T2 | input % + guardar + "ultimo cambio" |
| `src/modules/payment/index.ts` | T2 | barrel: componentes y paths (los servicios `server-only` se importan por ruta directa) |
| `src/app/(organizer)/organizer/payments/page.tsx` | T2 | `requireRole`, sync si aplica, `<ConnectStatusCard>` |
| `src/app/(admin)/admin/settings/page.tsx` | T2 | `requireRole(USER_ADMIN_ROLES)`, `<PlatformFeeForm>` dentro de `AdminShell` |
| `src/modules/order/services/checkout.service.ts` (+ `.test.ts`) | T3 | destination charge, bloqueo 409, columnas de fee en el insert |

## Criterios de aceptacion
- AC1: `users` tiene `stripe_account_id` (text NULL UNIQUE) y `stripe_onboarding_status` (enum, NOT NULL, default
  `not_started`); `orders` tiene `platform_fee_amount`, `organizer_net_amount`, `platform_fee_percent` (NULL); existe
  `platform_settings` con `CHECK (id = 1)`. La migracion generada solo contiene esos cambios (sin tocar otras tablas)
  y **no se aplica** (la aplica el usuario con `npm run db:migrate`).
- AC2: `calculatePlatformFee(100, 10)` => `{ feeCents: 1000, netCents: 9000 }`; redondea en centavos enteros
  (`33.33` al 10% => `333`); `percent = 0` => `feeCents = 0`; nunca `feeCents >= totalCents`.
- AC3: `mapAccountToOnboardingStatus` devuelve `complete` solo con `details_submitted` y `capabilities.transfers ===
  "active"`; en cualquier otro caso `pending`.
- AC4: `startConnectOnboarding` crea la cuenta Express solo si el usuario no tiene `stripe_account_id` (lo guarda con
  estado `pending` en un `UPDATE ... WHERE stripe_account_id IS NULL`), y siempre devuelve un `AccountLink`
  `account_onboarding` nuevo; con el flag apagado devuelve error `connect-disabled` sin llamar a Stripe.
- AC5: `/organizer/payments` exige `requireRole(ORGANIZER_AREA_ROLES)`; opera siempre sobre el usuario de la sesion
  (nunca un `userId` del `FormData`); con cuenta no `complete` llama a `syncOnboardingStatus` al cargar y muestra
  el estado resultante (no iniciado / pendiente / listo) y el boton correspondiente.
- AC6: `updatePlatformFeeAction` rechaza (redirect) a cualquier rol distinto de `super_admin`, valida con
  `feePercentSchema` (rechaza `-1`, `51`, texto, mas de 2 decimales) sin tocar la DB, y al exito hace upsert de la
  fila unica con `updated_by = viewer.id` y `revalidatePath`. `getPlatformFeePercent()` devuelve el default (10) si
  la fila no existe.
- AC7: con `STRIPE_CONNECT_ENABLED` apagado, `createCheckoutSession` crea la session **exactamente como hoy** (sin
  `transfer_data` ni `application_fee_amount`) y las columnas de fee de la orden quedan `NULL` (los tests existentes
  de checkout siguen pasando sin cambios).
- AC8: con el flag encendido y el organizador del evento con cuenta `complete`, la session se crea con
  `payment_intent_data.transfer_data.destination = <acct>` y `application_fee_amount = feeCents` (calculado con
  `getPlatformFeePercent()`), conservando `receipt_email` y `metadata.orderId`; el `INSERT` de la orden guarda
  `platform_fee_amount`, `organizer_net_amount` (suman `totalAmount`) y `platform_fee_percent`.
- AC9: con el flag encendido y organizador sin cuenta `complete` o evento sin `organizer_id`, el checkout responde
  409 con el mensaje de la Decision 4, **no** reserva inventario (no hay `INSERT` en `orders`) y no llama a Stripe.
- AC10: `/admin/settings` exige `super_admin`; `admin`/`organizer`/`customer` son redirigidos; el form muestra el
  porcentaje vigente y errores de validacion.
- AC11: `ORGANIZER_NAV` incluye "Pagos" y la seccion "Administracion" incluye "Comision" (solo visible para
  `super_admin` por su `roles`).
- AC12: `.env.example` documenta `STRIPE_CONNECT_ENABLED` y `STRIPE_CONNECT_ACCOUNT_COUNTRY` y el prerequisito de
  activar Connect en modo test; `grep -rn "from \"stripe\"" src/modules/payment` no encuentra imports directos del SDK
  fuera de tipos (solo `@/lib/stripe`).
- AC13: `npm run lint`, `npm run test` y `npm run build` pasan.

## Tests requeridos
(Vitest, junto al archivo)
- `payment.utils.test.ts`: AC2 (casos 0%, 10%, redondeo, fee < total) y AC3 (tabla de cuentas).
- `platform-settings.schema.test.ts`: rangos, decimales, coercion de string.
- `platform-settings.service.test.ts` (db mockeado): default sin fila, upsert con `updated_by`.
- `connect.service.test.ts` (db y `@/lib/stripe` mockeados): crea cuenta solo si falta, `AccountLink` siempre, flag
  apagado sin llamadas, `getPayoutAccount` devuelve `null` si no `complete`, sync actualiza el estado.
- `connect.actions.test.ts` / `platform-settings.actions.test.ts`: rol, validacion previa a la DB, viewer desde la
  sesion, `revalidatePath`/`redirect`.
- `connect-status-card.test.tsx` y `platform-fee-form.test.tsx`: render por estado y mensaje de error.
- `checkout.service.test.ts` (ampliar): AC7, AC8, AC9 (con el flag via `vi.stubEnv`).
- Manual (queda para el usuario): onboarding real en Stripe test con datos de prueba y una compra con tarjeta
  `4242 4242 4242 4242` verificando en el Dashboard el pago, el fee y la transferencia.

## Tareas
### T0 — Base: schema, migracion, env, constantes, utils y nav
- Archivos: `user.table.ts`, `order.table.ts`, `payment/db/platform-settings.table.ts`, `drizzle/*` (generate),
  `.env.example`, `payment/constants/payment.constants.ts`, `payment/utils/payment.utils.ts` + test,
  `payment/types/payment.types.ts`, `organizer.constants.ts`, `admin.constants.ts`; `npx shadcn add` de lo que falte.
- Depende de: —
- Paralelizable: no (bloquea al resto)
- Cubre: AC1, AC2, AC3, AC11 (parcial: constantes), AC12 (parcial: env)

### T1 — Servicios, schema y actions de Connect y comision
- Archivos: `payment/services/connect.service.ts`, `payment/services/platform-settings.service.ts`,
  `payment/schemas/platform-settings.schema.ts`, `payment/actions/connect.actions.ts`,
  `payment/actions/platform-settings.actions.ts` y sus `.test.ts`.
- Depende de: T0
- Paralelizable: no (T2 y T3 consumen sus exports)
- Cubre: AC4, AC6, AC12

### T2 — UI y paginas (organizador y admin)
- Archivos: `payment/components/connect-status-card.tsx`, `payment/components/platform-fee-form.tsx` (+ tests),
  `payment/index.ts`, `src/app/(organizer)/organizer/payments/page.tsx`, `src/app/(admin)/admin/settings/page.tsx`.
- Depende de: T1
- Paralelizable: si, con T3 (archivos disjuntos)
- Cubre: AC5, AC10, AC11

### T3 — Checkout con destination charge y registro de fee
- Archivos: `src/modules/order/services/checkout.service.ts` y `checkout.service.test.ts`.
- Depende de: T1
- Paralelizable: si, con T2
- Cubre: AC7, AC8, AC9, AC13

## Riesgos
- **Pais/moneda**: Connect no soporta Peru como pais de la plataforma ni de cuentas conectadas, y el catalogo cobra en
  PEN. En modo test puede fallar el `transfer` o la cuenta Express por moneda/pais distintos al de la plataforma.
  Mitigacion: `STRIPE_CONNECT_ACCOUNT_COUNTRY` configurable y flag apagado como salida; el developer prueba en test
  antes de dar por buena la AC8. No se cambia `EVENT_CURRENCY`.
- **Eventos semilla / sin organizador** quedan no comprables con el flag encendido (por diseno, Decision 4); asignarles
  organizador conectado o apagar el flag.
- **Estado stale** si el organizador termina el onboarding y no vuelve a `/organizer/payments`: el checkout seguira
  bloqueado hasta la siguiente visita (se resuelve con el webhook `account.updated`, diferido).
- **Concurrencia en alta de cuenta** (doble click): mitigada con `UPDATE ... WHERE stripe_account_id IS NULL` e
  `idempotencyKey`; en el peor caso queda una cuenta huerfana en Stripe test.
- **Cambio del `%`** no afecta ordenes ni sessions ya creadas: el fee se fija al crear la session y se congela en la orden.
- **Reembolsos**: hasta que 041 aplique `reverse_transfer`/`refund_application_fee`, un refund manual desde el
  Dashboard dejaria al organizador con el dinero. Documentado en Decisiones 8.

## Notas de review
- 2026-10-14: ajuste cruzado con 041: `organizer-refund.service.ts` lee `platformFeeAmount` y, si no es null, crea el reembolso con `reverse_transfer: true` y `refund_application_fee: true` (Decision 8); sin fee queda igual. Tests agregados.

## Preguntas abiertas
1. **Comision por defecto y tope** (default propuesto: 10 %, rango 0-50 %). Se aplica sobre el total de la orden.
2. **Organizador no conectado con flag encendido**: bloquear compra (default) vs. cobrar a la plataforma sin fee
   ("modo demo"). Default: bloquear compra, no publicar.
3. **Eventos semilla sin organizador**: dejar no comprables con el flag encendido (default) o asignarlos al
   `super_admin` con cuenta propia.
4. **Pais de las cuentas Express** de prueba (default `US`) y si la plataforma de Stripe test esta en un pais que
   permita PEN; el usuario lo confirma al activar Connect.
5. **Reembolso total**: devolver tambien el fee de la plataforma (default, `refund_application_fee: true`) o
   retenerlo. Se resuelve en la spec 041.
6. **Numero de migracion**: se propone 0007; si 041 ya la usa, el developer toma la siguiente libre.
7. **Webhook `account.updated`** en una fase posterior (default: diferido).

## Próximas fases
- Webhook Connect (`account.updated`) con secreto propio e idempotencia.
- Gate de publicacion y aviso en la ficha del evento segun estado de Connect.
- Fee/neto en el dashboard del organizador (reutiliza las columnas de la orden) y reporte para super_admin.
- Reembolsos con `reverse_transfer` (spec 041), Express Dashboard link, comisiones por organizador.

## Log de review
- Reviewer: PASS (AC1-AC12; AC13 build verificado aparte). Hallazgo medio corregido: el origen del AccountLink ya no usa x-forwarded-host (solo `host`). Nota aplicada: /organizer/payments muestra el ultimo estado guardado si Stripe falla al sincronizar. Pendiente manual: activar Connect en Stripe test, aplicar migraciones, probar con STRIPE_CONNECT_ENABLED=true.
