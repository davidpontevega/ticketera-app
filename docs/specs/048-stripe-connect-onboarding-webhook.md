# 048 — Webhook Connect (account.updated) y ruta de refresh del onboarding

Estado: aprobada

## Estado
- Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Cerrar dos huecos que la spec 042 dejo diferidos (Decisiones 3 y "Proximas fases"): (1) que el estado de onboarding del
organizador se actualice solo cuando Stripe emite `account.updated`, sin depender de que el organizador vuelva a
`/organizer/payments`; (2) que el `refresh_url` del AccountLink (link vencido o ya usado) emita un link nuevo y redirija,
en vez de aterrizar en la pagina. Referencias: `042` (servicio, action, pagina y tarjeta de Connect ya implementados),
`044`/`checkout.service.ts` (patron del webhook `/api/webhooks/stripe`). Referencia del profesor (solo lectura, no
copiada): spec `organizer-stripe-connect.md`, `api/webhooks/stripe-connect/route.ts` y
`organizer/settings/connect/refresh/route.ts`. Se adopta de ahi solo la forma (ruta delgada que delega al modulo
`payment`; refresh = link nuevo + redirect con fallback a la pagina). No se adopta Accounts v2 / thin events / tabla
`stripe_event`: nuestra cuenta es Express v1 (042 Decision 1) y el evento es `account.updated` clasico.

## Hallazgos (verificado en codigo)
- Ya existe y se reutiliza: `startConnectOnboarding` (crea cuenta si falta + AccountLink), `syncOnboardingStatus(user)`
  (retrieve + `mapAccountToOnboardingStatus` + UPDATE por `users.id`), `getPayoutAccount`, `startConnectOnboardingAction`,
  `ConnectStatusCard`, pagina `/organizer/payments`, `isConnectEnabled`, `PAYMENTS_PATH`.
- `startConnectOnboarding` hoy usa `refresh_url = /organizer/payments?connect=refresh`; esa query no se lee en ningun
  sitio: el organizador cae en la pagina y debe pulsar de nuevo el boton.
- `/api/webhooks/stripe/route.ts`: `request.text()` + header `stripe-signature` + `stripe.webhooks.constructEvent` con
  `STRIPE_WEBHOOK_SECRET`; 400 si firma invalida, 500 si el handler falla (Stripe reintenta). Se replica el patron
  (es una ruta de ~25 lineas; no se abstrae).
- Eventos de cuentas conectadas llegan a un endpoint **Connect** distinto (Dashboard -> Webhooks -> "Listen to events on
  Connected accounts") y con **secreto propio**: no se pueden mezclar con `/api/webhooks/stripe`.
- El proxy (`protected-routes.ts`) solo protege `/organizer(/.*)?`, `/admin`, etc.; `/api/webhooks/*` ya es publico y el
  refresh bajo `/organizer/...` ya exige sesion => **no se toca el proxy**.
- El origen del request se calcula hoy inline en `connect.actions.ts` (solo `host`, no `x-forwarded-host`, por un
  hallazgo de review de 042). La ruta de refresh lo necesita igual => se extrae a un helper (DRY), no se copia.
- La sync es idempotente por naturaleza (retrieve de Stripe + UPDATE del estado): **no hace falta tabla de eventos
  procesados**. Eventos repetidos o desordenados no dejan estado viejo porque se usa el estado recuperado, no el payload.
- Next 16: el developer lee `node_modules/next/dist/docs/` (route handlers, `redirect`, `headers`) antes de codificar.

## Decisiones
1. **Sync por retrieve, no por payload**: el webhook lee `event.data.object.id` y llama a `stripe.accounts.retrieve`
   (reusa el mapeo de 042). Una llamada extra a cambio de ser inmune a eventos desordenados.
2. **Logica en `connect.service.ts`** (mismo modulo `payment`, un solo lugar que habla con Stripe/DB de Connect):
   nuevo `handleConnectEvent(event)`. La ruta solo verifica firma y delega. Cuenta desconocida (ningun `users` con ese
   `stripe_account_id`) => no-op, 200.
3. **Secreto propio** `STRIPE_CONNECT_WEBHOOK_SECRET`. Si falta: la ruta responde 500 con log (configuracion rota, no
   "firma invalida"), asi Stripe reintenta y se nota en el Dashboard.
4. **Respuestas**: sin header `stripe-signature` o firma invalida => 400; tipo distinto de `account.updated` => 200 sin
   hacer nada; error en sync => 500 (Stripe reintenta); ok => 200. El webhook funciona aunque `STRIPE_CONNECT_ENABLED`
   este apagado (solo sincroniza estado; no cobra nada).
5. **Ruta de refresh** `GET /organizer/payments/refresh` (`route.ts` junto a la pagina): `requireRole(ORGANIZER_AREA_ROLES)`,
   `startConnectOnboarding(viewer, origin)`; con `{ url }` => `redirect(url)`; con `connect-disabled` o cualquier error =>
   `redirect(PAYMENTS_PATH)`. `redirect` fuera de `try/catch`. Opera siempre sobre el usuario de la sesion.
6. `startConnectOnboarding` pasa a usar `refresh_url = ${origin}/organizer/payments/refresh` (constante
   `PAYMENTS_REFRESH_PATH`); `return_url` no cambia (la pagina ya sincroniza al cargar).
7. **Helper `getRequestOrigin()`** (`payment/utils/request-origin.ts`, `server-only`): mueve el calculo actual de la
   action sin cambiar su comportamiento; lo usan la action y la ruta de refresh.

## Alcance
- Incluye: `handleConnectEvent` (account.updated) en `connect.service.ts`; ruta `/api/webhooks/stripe-connect`; ruta
  `/organizer/payments/refresh`; `refresh_url` del AccountLink apuntando a ella; helper de origen compartido;
  `STRIPE_CONNECT_WEBHOOK_SECRET` en `.env.example`; tests.
- No incluye: tabla de eventos procesados / idempotencia por `event.id`; Accounts v2 o thin events; otros eventos
  (`account.application.deauthorized`, `capability.updated`, `payout.*`); gate de publicacion por Connect; aviso en la
  ficha del evento; desconectar cuenta; Express Dashboard link; cambios al proxy, a `ConnectStatusCard` o a la pagina
  `/organizer/payments`.

## Reutilizar
- `stripe` (`@/lib/stripe`), `db`, `users`, `mapAccountToOnboardingStatus`, `isConnectEnabled`, `PAYMENTS_PATH`,
  `startConnectOnboarding` (sin cambios de firma), `requireRole`, `ORGANIZER_AREA_ROLES` (`@/modules/user`).
- Patron de `src/app/api/webhooks/stripe/route.ts` (firma, codigos de respuesta) y de tests de `connect.service.test.ts` /
  `connect.actions.test.ts` (mocks de `@/lib/stripe`, `@/lib/db`, `next/headers`, `next/navigation`).
- `protected-routes.test.ts` (se amplia la lista de rutas no protegidas).
- UI: no hay UI nueva (`ls src/components/ui` no aplica; nada que instalar con shadcn).

## Archivos
| Archivo | Tarea | Cambio |
|---------|-------|--------|
| `.env.example` | T1 | `STRIPE_CONNECT_WEBHOOK_SECRET` + instrucciones (`stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe-connect --events account.updated`; prod: endpoint Connect con evento `account.updated`) |
| `src/modules/payment/constants/payment.constants.ts` | T1 | `PAYMENTS_REFRESH_PATH = "/organizer/payments/refresh"` |
| `src/modules/payment/utils/request-origin.ts` (+ `.test.ts`) | T1 | `getRequestOrigin()` (extraido de la action) |
| `src/modules/payment/services/connect.service.ts` (+ `.test.ts`) | T1 | `refresh_url` nuevo; `handleConnectEvent(event)` |
| `src/modules/payment/actions/connect.actions.ts` (+ `.test.ts`) | T1 | usa `getRequestOrigin()`; sin cambio de comportamiento |
| `src/app/api/webhooks/stripe-connect/route.ts` (+ `.test.ts`) | T2 | verifica firma y delega |
| `src/app/(organizer)/organizer/payments/refresh/route.ts` (+ `.test.ts`) | T2 | link nuevo + redirect |
| `src/lib/protected-routes.test.ts` | T2 | agrega `/api/webhooks/stripe-connect` a las no protegidas |

## Criterios de aceptacion
- AC1: `startConnectOnboarding` crea el AccountLink con `refresh_url = <origin>/organizer/payments/refresh` y
  `return_url = <origin>/organizer/payments?connect=return`; el resto del comportamiento de 042 (flag apagado, crear
  cuenta solo si falta, idempotencyKey) no cambia y sus tests existentes siguen pasando.
- AC2: `handleConnectEvent` con `account.updated` y una cuenta conocida hace `accounts.retrieve(acct)` y actualiza
  `users.stripe_onboarding_status` con `mapAccountToOnboardingStatus` (`complete` solo con `details_submitted` y
  `transfers === "active"`, si no `pending`), filtrando por `stripe_account_id`; puede bajar de `complete` a `pending`.
- AC3: `handleConnectEvent` ignora (sin llamar a Stripe ni a la DB) cualquier tipo distinto de `account.updated`; con
  una cuenta que no pertenece a ningun usuario no falla (no-op).
- AC4: `POST /api/webhooks/stripe-connect`: sin `stripe-signature` => 400; firma invalida => 400 sin llamar al handler;
  sin `STRIPE_CONNECT_WEBHOOK_SECRET` => 500; handler que lanza => 500; ok o tipo no manejado => 200. La firma se
  verifica con `STRIPE_CONNECT_WEBHOOK_SECRET` (no con `STRIPE_WEBHOOK_SECRET`) sobre el cuerpo crudo (`request.text()`).
- AC5: `GET /organizer/payments/refresh` exige `requireRole(ORGANIZER_AREA_ROLES)`; con exito redirige a la URL del
  nuevo AccountLink; con `connect-disabled` o si el servicio lanza redirige a `/organizer/payments`; nunca recibe un
  `userId` del request.
- AC6: `getRequestOrigin()` devuelve `http://localhost...` o `https://<host>` usando solo el header `host` (nunca
  `x-forwarded-host`); `startConnectOnboardingAction` lo usa y sus tests existentes siguen pasando.
- AC7: `.env.example` documenta `STRIPE_CONNECT_WEBHOOK_SECRET`; `/api/webhooks/stripe-connect` no esta protegido por el
  proxy; `/api/webhooks/stripe` y `checkout.service.ts` no se modifican.
- AC8: `grep -rn "from \"stripe\"" src/modules/payment` no encuentra imports directos del SDK fuera de tipos;
  `npm run lint`, `npm run test` y `npm run build` pasan.

## Tests requeridos
(Vitest, junto al archivo)
- `connect.service.test.ts` (ampliar): AC1 (urls del link), AC2 (complete / pending / baja de complete), AC3 (tipo
  ignorado, cuenta desconocida).
- `request-origin.test.ts` (`next/headers` mockeado): localhost => http, otro host => https, ignora `x-forwarded-host`.
- `connect.actions.test.ts`: regresion tras usar el helper.
- `stripe-connect/route.test.ts` (`@/lib/stripe` y servicio mockeados): AC4 (los cinco codigos).
- `payments/refresh/route.test.ts` (servicio, `requireRole` y `redirect` mockeados): AC5.
- `protected-routes.test.ts`: AC7.
- Manual (queda para el usuario): crear el endpoint Connect o `stripe listen --forward-connect-to ...`, completar el
  onboarding de una cuenta de prueba y ver `complete` en la DB sin visitar `/organizer/payments`; dejar vencer un
  link y comprobar que el refresh emite uno nuevo.

## Tareas
### T1 — Servicio, helper de origen, constantes y env
- Archivos: `.env.example`, `payment/constants/payment.constants.ts`, `payment/utils/request-origin.ts` + test,
  `payment/services/connect.service.ts` + test, `payment/actions/connect.actions.ts` + test.
- Depende de: —
- Paralelizable: no (T2 consume `handleConnectEvent`, `getRequestOrigin` y `PAYMENTS_REFRESH_PATH`)
- Cubre: AC1, AC2, AC3, AC6, AC7 (env), AC8

### T2 — Rutas (webhook y refresh)
- Archivos: `src/app/api/webhooks/stripe-connect/route.ts` + test, `src/app/(organizer)/organizer/payments/refresh/route.ts`
  + test, `src/lib/protected-routes.test.ts`.
- Depende de: T1
- Paralelizable: no (depende de T1); internamente sus dos rutas son independientes
- Cubre: AC4, AC5, AC7 (proxy), AC8

## Riesgos
- **Dos endpoints, dos secretos**: si el usuario registra `account.updated` en el endpoint normal (no Connect) o usa el
  secreto equivocado, el webhook responde 400 y el estado sigue dependiendo de la visita a la pagina (degradacion
  segura: 042 sigue funcionando). Documentado en `.env.example`.
- **Sin idempotencia por `event.id`**: un evento repetido hace un retrieve y un UPDATE redundantes; inocuo. Si mas
  adelante se procesan eventos con efectos (emails, etc.) habra que agregar la tabla.
- **Carrera webhook vs. visita a la pagina**: ambos escriben el estado recuperado de Stripe; el ultimo gana y ambos
  convergen al mismo valor.

## Preguntas abiertas
1. **Retrieve vs. payload** (default: retrieve, Decision 1). Alternativa: mapear `event.data.object` directo y ahorrar la
   llamada, a costa de orden de eventos.
2. **Secreto ausente** (default: 500 con log). Alternativa: tratarlo como 400 de firma invalida.
3. **Webhook con el flag apagado** (default: procesa igual). Alternativa: 200 sin hacer nada si
   `STRIPE_CONNECT_ENABLED` no es `true`.
4. **Ruta de refresh** (default: `/organizer/payments/refresh`, bajo la pagina de pagos). El profesor la pone bajo
   `settings/connect/refresh`; aqui no existe `settings` del organizador.
5. **Numeracion**: se usa 048 por indicacion (045-047 no existen en `docs/specs`).

## Próximas fases
- Gate de publicacion y aviso en la ficha del evento segun estado de Connect.
- Eventos adicionales (`account.application.deauthorized`) y tabla de eventos procesados si aparecen efectos laterales.
- Express Dashboard link y desconexion de cuenta.
