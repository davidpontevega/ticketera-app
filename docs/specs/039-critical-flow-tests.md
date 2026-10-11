# 039 — Tests de flujos criticos (route handlers, webhooks, huecos de pagos) y hallazgos menores

Estado: implementada (AC12 solo manual)

## Estado
- Aprobacion humana: aprobada (2026-10-11, 4 preguntas abiertas aceptadas con la opcion propuesta)

Tarea Trello P2-13 (solo la parte de TESTS; el review humano de specs 008-015 es tarea del usuario). Numero 039: el
ultimo existente es 038.

## Objetivo
Los 4 route handlers (`src/app/api/**/route.ts`) y el wiring de `src/proxy.ts` no tienen ningun test; la logica de
servicio de pagos si (`checkout.service.test.ts`, specs 022/026/032/033). Se agregan tests de los handlers (pagos y
webhooks primero), se cubren los huecos reales del servicio de pagos y se cierran los hallazgos menores abiertos de
reviews anteriores. **Sin cambio de comportamiento de produccion**, salvo el refactor del ciclo de modulos (D4).
Referencias: `022`/`026` (checkout, `userId` nulo permitido), `023` (webhook Clerk / user-sync), `032` (tickets por
orden), `033` (anti-sobreventa), `029`/`030`/`035`/`038` (hallazgos), `SETUP.md` §3.1 (test junto al archivo),
`SYSTEM_DESIGN.md` (fila Autorizacion / Pagos). Next 16: `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`
(los handlers `async` de App Router se prueban como funciones: Vitest no ejecuta Server Components async, pero un
`POST(request)`/`GET(request, { params })` es una funcion normal; `params` es `Promise`).

## Hallazgos (verificado en codigo)
- **Handlers sin test**: `checkout/session/route.ts`, `webhooks/stripe/route.ts`, `webhooks/clerk/route.ts`,
  `events/[slug]/availability/route.ts`. Toda la logica de negocio esta en servicios ya testeados; los handlers solo
  mapean entrada -> servicio -> status HTTP, que es justo lo que hoy no se verifica (un 400 -> 200 pasaria el CI).
- **`proxy.ts`**: son 3 lineas (`clerkMiddleware(async (auth, req) => { if (isProtectedRoute(req)) await auth.protect() })`);
  el matcher de rutas ya esta testeado en `src/lib/protected-routes.test.ts`. Ver D3.
- **Huecos en el servicio de pagos** (`checkout.service.test.ts` ya cubre: 404/400/feliz, advisory lock, 409 x3, reintento,
  fallo de Stripe create, ticket pending->paid, segundo completed, orden paid repara, failed/expired sin tickets, error
  de insert propagado). Faltan:
  - `handleStripeEvent` con evento **sin orden** (session desconocida): `applySessionStatus` devuelve `null` sin escribir.
  - `handleStripeEvent` `async_payment_failed` y `expired` sobre orden `pending`: el `update` fija `failed`/`cancelled`
    (hoy el test "failed/expired no inserta tickets" cubre tickets, verificar que tambien asegure el `status` del `set`).
  - Orden ya `cancelled`/`failed` + evento `completed` tardio: no cambia estado ni emite tickets (rama
    `!isTransition && status !== "paid"` -> `return existing`). Este es el riesgo real de carrera expiracion/pago.
  - `syncOrderWithSession` con session `open`/`unpaid` (pending): sin update ni tickets; con session desconocida: `null`.
  - "Session de otro evento": **no existe** esa validacion en codigo (`applySessionStatus` busca por
    `stripeCheckoutSessionId` unico; el evento viene de la orden, no de la session). No hay comportamiento que probar;
    se documenta y no se agrega test ni validacion (YAGNI).
- **Hallazgos menores** (estado real verificado):
  - 029 comentario de `organizer-dashboard.tsx:22`: hoy dice "Se renderiza dentro de OrganizerShell, que ya garantiza
    sesion y rol (guard de servidor)"; `OrganizerShell` existe y el layout `(organizer)/layout.tsx` hace el guard. **Parece
    ya corregido**; T5 solo lo confirma (si el comentario sigue inexacto respecto al layout, ajustarlo; es un comentario).
  - 029 orden `requireRole` -> query: el test actual solo comprueba `toHaveBeenCalledWith` y `select` 1 vez; no el orden.
    Falta `expect(requireRole.mock.invocationCallOrder[0]).toBeLessThan(select.mock.invocationCallOrder[0])`.
  - 030 caso admin (`organizer-event-admin.service.test.ts:121`): solo `not.toContain("admin-1")`; no verifica los params
    exactos. Debe afirmar `paramsOf(...)` igual a lo que realmente emite el WHERE (solo `event-1`, sin organizerId).
  - 035 `tier-layout.utils.test.ts:45`: `expect(layout.id === "general-admission").toBe(numbered)` es una tautologia
    condicional (depende de la categoria del evento de prueba). Debe usar un evento con zona numerada garantizada y
    afirmar `id === "general-admission"` de forma incondicional.
  - 035 ciclo `ticket.utils` <-> `event-seed.utils`: `ticket.utils.ts:4` importa `SEED_GENERAL_ZONE_STOCK` de
    `event-seed.utils.ts`, que a su vez importa `getVenueLayout` de `ticket.utils`. Ver D4.
  - 038 mock con `imageUrl: null`: **ya existe** (`organizer-events.service.test.ts:77`, evento `sin-ventas`). Cerrado, nada
    que hacer.
  - 036 largo maximo de `description`/`venue`/`city` y validacion runtime de `intent`/`values`: YAGNI, **fuera**.

## Decisiones
1. **Prioridad por riesgo**: webhook Stripe y checkout (dinero) > huecos de `checkout.service` > webhook Clerk
   (identidad/rol) > availability (lectura) > proxy > hallazgos menores. Una sola fase: son archivos `*.test.ts` nuevos,
   pequenos y disjuntos, alcanzable en una sesion (5 tareas).
2. **Estilo de test de handler**: se mockea el modulo de servicio (`vi.mock`), no `db` ni Stripe real; se invoca el handler
   con `new NextRequest(url, { method: "POST", body, headers })` (checkout/webhooks) o `new Request` + `{ params:
   Promise.resolve({ slug }) }` (availability). `vi.mock("server-only", () => ({}))` donde el import arrastre
   `server-only` (patron existente). Los tests afirman **status y body** y que el servicio se llama (o no) con los
   argumentos correctos. `console.error` se silencia con `vi.spyOn(console, "error").mockImplementation(() => {})` en los
   casos 500.
3. **`proxy.ts`: se hace un test minimo de wiring**, no de Clerk. Se mockea `@clerk/nextjs/server` para que
   `clerkMiddleware(handler)` devuelva el `handler`, y `@/lib/protected-routes` (`isProtectedRoute`). Dos casos: ruta
   protegida -> `auth.protect` llamado una vez; ruta publica -> no llamado. Es ~25 lineas, protege contra quitar el `if`
   (que dejaria todo protegido/desprotegido) y no prueba el runtime de Clerk. Si en la revision se considera ruido, se
   elimina T5-b sin afectar el resto (ver Preguntas abiertas 2).
4. **Ciclo de modulos 035**: mover `SEED_GENERAL_ZONE_STOCK` (`= 500`) a `src/modules/ticket/constants/ticket.constants.ts`
   (ya existe, sin imports de servicios), y que `ticket.utils.ts` y `event-seed.utils.ts` lo importen de ahi. Es un cambio
   de 3 archivos + el test que lo importa (`event-seed.utils.test.ts:7`); **refactor sin cambio de comportamiento** (mismo
   valor, mismos consumidores). Verificacion: `grep -rn SEED_GENERAL_ZONE_STOCK src` solo apunta a `ticket.constants` como
   definicion; `event-seed.utils.ts` no re-exporta la constante: se actualiza el import del test para evitar dos fuentes (DRY). Si `event` ya importa de `@/modules/ticket` por barrel en otros lados, usar la ruta
   directa `@/modules/ticket/constants/ticket.constants` (evita un nuevo ciclo por barrel).
5. **Mutacion manual como criterio** (AC): para cada archivo de test, el developer demuestra que el test rompe al quitar
   la validacion correspondiente (p. ej. quitar el `if (!signature)` del webhook -> falla el 400; cambiar 409 por 400 en
   checkout -> falla). Se deja registrado en el log de review, no se automatiza (sin Stryker; YAGNI).

## Alcance
- Incluye: tests de los 4 route handlers; test de wiring de `proxy.ts`; tests de huecos en `checkout.service`; cierre de
  hallazgos menores de 029/030/035; refactor del ciclo de modulos (D4).
- No incluye: tests e2e/Playwright; test del runtime de Clerk/Stripe; validacion "session de otro evento" (no existe, no se
  agrega); limites de longitud y validacion de `intent`/`values` de 036 (YAGNI); cambios de comportamiento en handlers o
  servicios; revision humana de specs 008-015.

## Reutilizar
- Patron de mocks de `db` encadenados de `checkout.service.test.ts` (`select/update/updateSet/updateWhere/updateReturning`)
  y de `organizer-event-admin.service.test.ts` (`paramsOf` con `PgDialect`).
- `createCheckoutSessionSchema` real (sin mockear) en el test del handler de checkout para que "body invalido -> 400"
  pruebe el schema de verdad; fixtures validos de `checkout.schema.test.ts`.
- `handleClerkWebhookEvent` ya tiene `user-sync.service.test.ts` (created/updated/deleted): el test del handler Clerk
  **no** repite esos casos, solo el wiring (firma -> 400, evento -> servicio, error -> 500).
- `src/lib/protected-routes.test.ts` queda como esta.
- Nada nuevo en `src/lib` ni `src/components`; no hay componentes.

## Archivos

| Archivo | Accion | Tarea |
|---|---|---|
| `src/app/api/webhooks/stripe/route.test.ts` | Nuevo | T1 |
| `src/app/api/checkout/session/route.test.ts` | Nuevo | T1 |
| `src/modules/order/services/checkout.service.test.ts` | Editar (casos nuevos al final de `handleStripeEvent`/`syncOrderWithSession`/`emision de tickets`) | T2 |
| `src/app/api/webhooks/clerk/route.test.ts` | Nuevo | T3 |
| `src/app/api/events/[slug]/availability/route.test.ts` | Nuevo | T3 |
| `src/proxy.test.ts` | Nuevo | T3 |
| `src/modules/organizer/services/organizer-events.service.test.ts` | Editar (orden requireRole -> select) | T4 |
| `src/modules/organizer/services/organizer-event-admin.service.test.ts` | Editar (params exactos del caso admin) | T4 |
| `src/modules/organizer/components/organizer-dashboard.tsx` | Editar solo el comentario de la linea 22 (si sigue inexacto) | T4 |
| `src/modules/ticket/constants/ticket.constants.ts` | Editar: agregar `SEED_GENERAL_ZONE_STOCK` | T5 |
| `src/modules/ticket/utils/ticket.utils.ts` | Editar: import desde `../constants/ticket.constants` | T5 |
| `src/modules/event/utils/event-seed.utils.ts` | Editar: quitar la definicion, importar desde `@/modules/ticket/constants/ticket.constants` | T5 |
| `src/modules/event/utils/event-seed.utils.test.ts` | Editar: import de la constante | T5 |
| `src/modules/ticket/utils/tier-layout.utils.test.ts` | Editar: test 035 deterministico | T5 |

## Criterios de aceptacion
- AC1 (webhook Stripe): sin cabecera `stripe-signature` -> 400 y `constructEvent`/`handleStripeEvent` no se llaman; firma
  invalida (`constructEvent` lanza) -> 400 y `handleStripeEvent` no se llama; evento valido -> `handleStripeEvent` llamado
  con el evento devuelto por `constructEvent` y respuesta 200 `OK`; `handleStripeEvent` lanza -> 500 (Stripe reintenta).
  `constructEvent` se invoca con el body **crudo** (`request.text()`), la firma y `STRIPE_WEBHOOK_SECRET`.
- AC2 (checkout): JSON malformado -> 400; body que no cumple `createCheckoutSessionSchema` -> 400 con el mensaje del primer
  issue y el servicio no se llama; con sesion -> `createCheckoutSession` recibe `clerkUserId` del `auth()` y `origin` de la
  URL; **sin sesion (`userId: null`) sigue permitido** (200, `clerkUserId: null`, 022/026); resultado `ok` -> 200
  `{ url }`; `{ ok:false, status:404 }` -> 404 y `{ ok:false, status:409 }` -> 409 con su `message`; el servicio lanza
  (Stripe 500) -> 500 `No pudimos iniciar el pago` sin filtrar el mensaje del error.
- AC3 (huecos de pagos): tests nuevos en `checkout.service.test.ts` para: evento con session sin orden (sin update ni
  insert de tickets); `async_payment_failed` y `expired` sobre `pending` fijan `status` `failed`/`cancelled` en el `set`;
  orden ya `cancelled`/`failed` + `completed` tardio no hace `update` ni inserta tickets; `syncOrderWithSession` con
  session pending no escribe y con session desconocida devuelve `null`.
- AC4 (webhook Clerk): `verifyWebhook` lanza -> 400 y `handleClerkWebhookEvent` no se llama; evento valido -> servicio
  llamado con el evento y 200; servicio lanza -> 500. Los casos created/updated/deleted ya estan en
  `user-sync.service.test.ts` (no se duplican).
- AC5 (availability): snapshot -> 200 con el body; `null` -> 404 `Evento no encontrado`; servicio lanza -> 500; el `slug`
  se resuelve de `params` (Promise) y se pasa tal cual al servicio.
- AC6 (proxy): con `isProtectedRoute` -> true se llama `auth.protect` una vez; con false no se llama.
- AC7 (029): el test afirma que `requireRole` se invoca **antes** de `select` (`invocationCallOrder`).
- AC8 (030): el caso admin afirma `paramsOf` exactos de los WHERE de select y update (solo `event-1`), no solo ausencia del
  id del viewer.
- AC9 (035 test): "numbered stock does not match" usa un evento con zona numerada y afirma incondicionalmente
  `layout.id === "general-admission"`; no hay `toBe(numbered)`.
- AC10 (035 ciclo): `SEED_GENERAL_ZONE_STOCK` se define solo en `ticket.constants.ts`; `ticket.utils.ts` ya no importa de
  `@/modules/event`; `grep -n "event-seed" src/modules/ticket -r` sin resultados; mismos valores y tests existentes en verde.
- AC11 (comentario 029): el comentario de `organizer-dashboard.tsx` describe fielmente quien hace el guard (layout
  `(organizer)/layout.tsx` + `OrganizerShell`); sin cambio de codigo ejecutable.
- AC12 (mutacion manual): para T1, T3 y T4 el developer registra en el log que quitar una validacion rompe el test
  (ejemplos minimos: quitar `if (!signature)`; cambiar `status: 400` a 200 en checkout body invalido; quitar el `try/catch`
  de availability; quitar el `if (isProtectedRoute(req))`). Tras cada prueba se revierte.
- AC13: `npx tsc --noEmit`, `npm run lint` y `npm run test -- --run` pasan (los tests nuevos corren en el entorno jsdom
  por defecto; ningun test toca red ni DB reales). Ningun archivo de produccion cambia salvo los listados (refactor T5 +
  comentario T4).

## Tests requeridos
Esta spec es de tests; los AC1-AC9 son los casos. Cada archivo `route.test.ts` queda junto a su `route.ts`
(convencion SETUP.md §3.1). Mocks: `@/lib/stripe` (`stripe.webhooks.constructEvent`),
`@/modules/order/services/checkout.service`, `@clerk/nextjs/server` (`auth`), `@clerk/nextjs/webhooks`
(`verifyWebhook`), `@/modules/user`, `@/modules/order/services/availability.service`. Para `STRIPE_WEBHOOK_SECRET` usar
`vi.stubEnv`.

## Tareas

### T1 — Tests de pagos: webhook Stripe y checkout (riesgo alto)
- Archivos: `src/app/api/webhooks/stripe/route.test.ts`, `src/app/api/checkout/session/route.test.ts`
- Depende de: —
- Paralelizable: si
- Cubre: AC1, AC2, AC12, AC13

### T2 — Huecos de `checkout.service` (idempotencia / carrera)
- Archivos: `src/modules/order/services/checkout.service.test.ts`
- Depende de: —
- Paralelizable: si
- Cubre: AC3, AC13

### T3 — Tests de webhook Clerk, availability y wiring de proxy
- Archivos: `src/app/api/webhooks/clerk/route.test.ts`, `src/app/api/events/[slug]/availability/route.test.ts`, `src/proxy.test.ts`
- Depende de: —
- Paralelizable: si
- Cubre: AC4, AC5, AC6, AC12, AC13

### T4 — Hallazgos menores de organizer (029/030) y comentario
- Archivos: `src/modules/organizer/services/organizer-events.service.test.ts`, `src/modules/organizer/services/organizer-event-admin.service.test.ts`, `src/modules/organizer/components/organizer-dashboard.tsx`
- Depende de: —
- Paralelizable: si
- Cubre: AC7, AC8, AC11, AC12, AC13

### T5 — Hallazgos de catalogo (035): test deterministico y ciclo de modulos
- Archivos: `src/modules/ticket/constants/ticket.constants.ts`, `src/modules/ticket/utils/ticket.utils.ts`, `src/modules/event/utils/event-seed.utils.ts`, `src/modules/event/utils/event-seed.utils.test.ts`, `src/modules/ticket/utils/tier-layout.utils.test.ts`
- Depende de: —
- Paralelizable: si
- Cubre: AC9, AC10, AC13

Todos los archivos son disjuntos entre tareas; las 5 tareas pueden correr en paralelo. T2 es el unico editor de
`checkout.service.test.ts` (T1 no lo toca).

## Preguntas abiertas
1. **Ciclo 035 (D4)**: se propone incluirlo (cambio chico y seguro, 3 archivos de codigo). Alternativa: dejarlo fuera y
   solo anotarlo. Confirmar.
2. **Test de `proxy.ts` (D3)**: se propone el test minimo de wiring con Clerk mockeado. Si se prefiere no probar un
   middleware de 3 lineas (el matcher ya esta cubierto), se elimina `src/proxy.test.ts` y AC6.
3. **"Session de otro evento"** (pedido en el requerimiento): no existe tal validacion en `applySessionStatus`; la orden se
   localiza por `stripeCheckoutSessionId`. Se propone no agregar test ni validacion. Si se quiere defensa en profundidad
   (comparar `session.metadata.orderId` con la orden), seria un cambio de comportamiento y una spec aparte.
4. **Comentario 029 (T4)**: parece ya corregido; si el developer lo confirma exacto, T4 no toca `organizer-dashboard.tsx`.

## Proximas fases
- Defensa en profundidad: validar `metadata.orderId` contra la orden en webhook/sync (spec aparte, cambia comportamiento).
- Tests de integracion con Postgres real (concurrencia del advisory lock) si el equipo configura una DB de test.
- Cobertura de otros handlers/server actions que aparezcan sin test.

## Log de review
- Iteracion 1 — FAIL (1 hallazgo menor): el test del completed tardio sobre orden cancelled/failed no documentaba el riesgo aceptado (pago confirmado sin tickets). Corregido con un comentario explicito sobre el it.each.
- Verificacion final: lint, vitest completo (52 archivos, 580 tests), tsc y npm run build OK; git diff de produccion limpio de restos de mutaciones (solo el refactor de SEED_GENERAL_ZONE_STOCK a ticket.constants y un comentario en organizer-dashboard.tsx). El reviewer confirmo calidad de los tests, aislamiento y fin del ciclo ticket<->event. Notas opcionales no hechas: asertar el mensaje de JSON invalido en checkout/session; asertar que el 500 de Clerk no filtre el error; asertar que isProtectedRoute reciba req en proxy.test.ts. AC12 (mutaciones manuales) lo hizo cada developer y se reviso.
