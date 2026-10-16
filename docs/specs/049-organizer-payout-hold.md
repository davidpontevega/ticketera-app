# 049 — Retencion de payouts del organizador (7 dias tras el evento)

Estado: aprobada

## Estado
- Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo
El organizador solo puede retirar (payout a su banco) los fondos de un evento 7 dias despues de que el evento concluyo,
para que cancelaciones/reembolsos posteriores (041 `reverse_transfer`, 047 cancelacion masiva) no encuentren el saldo de
la cuenta conectada ya vaciado y la plataforma deba cubrir el hueco. Referencias: `042` (destination charges +
`application_fee_amount`, `orders.organizerNetAmount`), `048` (onboarding/sync), `041`/`047` (reembolsos con
`reverse_transfer: true` y `refund_application_fee: true`), `docs/SYSTEM_DESIGN.md` solo si el dev necesita contexto de pagos.
Next 16: el developer lee `node_modules/next/dist/docs/` (server actions, `revalidatePath`) antes de codificar.

## Hallazgos (verificado en codigo)
- El checkout usa **destination charges**: `payment_intent_data.transfer_data.destination` + `application_fee_amount`
  (`checkout.service.ts`). El dinero del organizador **cae en el balance de su cuenta Express en cuanto se cobra**; hoy
  Stripe lo paga a su banco con el calendario **automatico** por defecto (diario). Por eso hoy no hay ninguna retencion.
- Los reembolsos (`organizer-refund.service.ts`, 047) hacen `reverse_transfer` => Stripe resta del balance de la cuenta
  conectada. Si ya se pago a su banco, el balance queda negativo y (segun configuracion Connect) la plataforma lo absorbe.
- `orders.organizerNetAmount` y `platformFeeAmount` ya se guardan por orden (042); son `NULL` si la orden no uso Connect.
  `orders.status` pasa a `refunded` al reembolsar; el reembolso parcial de Stripe se ignora hoy (`charge.refunded` parcial).
- **`events` no tiene `ends_at`**, solo `starts_at`. Agregar `ends_at` toca formulario, validaciones y seeds: fuera de alcance.
- La moneda del catalogo es `EVENT_CURRENCY` (PEN). Una cuenta Express de pais US liquida en USD: el balance de la
  cuenta puede no estar en la moneda de la DB (ver "Riesgo de moneda").
- `/organizer/payments` (pagina + `ConnectStatusCard`) existe y sincroniza el estado de Connect (042/048). No hay cron
  ni scheduler en el proyecto; la demo corre local con 1-2 usuarios.
- `src/components/ui` ya tiene `card`, `table`, `badge`, `button`: no hay nada que instalar con shadcn.

## Opciones evaluadas
| Opcion | Como | Pros | Contras |
|--------|------|------|---------|
| A. **Payouts manuales por cuenta** (`settings.payouts.schedule.interval = "manual"`) y `stripe.payouts.create(..., { stripeAccount })` tras la ventana | El balance queda en la cuenta conectada; la plataforma dispara el payout evento por evento cuando vence | **No cambia checkout ni reembolsos** (041/047/042 intactos): el `reverse_transfer` sigue funcionando porque el dinero sigue en la cuenta conectada hasta el payout. Cambio chico y aislado en `payment` | Requiere calcular el monto liberable en DB; riesgo de moneda (ver abajo); cuentas ya creadas con calendario automatico hay que actualizarlas; el organizador ve saldo "pendiente" en su Express Dashboard (correcto y esperado) |
| B. `delay_days` del calendario automatico | Retraso fijo desde que el pago esta disponible | Cero codigo propio de payout | **No sirve**: cuenta desde la fecha de **cobro**, no del evento (se compra semanas antes); maximo 31 dias; no distingue eventos. Descartada |
| C. **Separate charges and transfers** | Cobrar a la plataforma y hacer `transfers.create` al organizador tras la ventana | Control total: la plataforma retiene el dinero real; reembolso antes de la ventana no requiere revertir nada | **Reescribe checkout (042), reembolsos (041/047) y sus tests**: sin `transfer_data`, `reverse_transfer` deja de aplicar; el fee pasa a calcularse en la transferencia; fondos de todos los organizadores mezclados en el balance de la plataforma (hay que garantizar disponibilidad para transferir). Demasiado para una sesion |

**Recomendacion: A.** Es la unica que logra el objetivo sin tocar el flujo de cobro/reembolso ya aprobado y probado. La
retencion real es "no hay payout automatico y la plataforma solo paga lo vencido". Techo conocido: un reembolso despues
de liberado (post +7 dias) puede dejar saldo negativo; es el mismo riesgo que hoy pero acotado a fuera de la ventana.

## Decisiones
1. **Evento concluido**: no hay `ends_at`, asi que `concluyo = starts_at`. **Fecha de liberacion = `starts_at` + 7 dias**
   (`PAYOUT_HOLD_DAYS`, default 7, override por env para la demo, p. ej. `0`). Conservador si el evento dura varios dias;
   cuando exista `ends_at` (proxima fase) solo cambia `getPayoutReleaseDate`.
2. **Que se libera**: por evento, la suma de `organizer_net_amount` de ordenes `paid` (excluye `refunded`/`cancelled` y
   ordenes sin Connect). Evento `cancelled` no libera nada (047 ya reembolso todo). Solo eventos del organizador y con
   fecha de liberacion vencida.
3. **Calendario manual**: `startConnectOnboarding` crea la cuenta con `settings.payouts.schedule.interval = "manual"` y,
   si la cuenta ya existe, la actualiza (`accounts.update`, idempotente) al pasar por el onboarding/refresh. Cuentas
   Express ya `complete` de pruebas previas: para la demo se recrean o se actualizan una vez a mano (nota en "Preguntas").
4. **Liberacion explicita, sin cron**: boton **"Retirar fondos disponibles"** en `/organizer/payments` (server action)
   que libera todos los eventos vencidos del organizador de la sesion. Descartadas: liberacion lazy al renderizar la
   pagina (efecto secundario en un GET/render, dificil de razonar y de testear) y cron (no hay infraestructura). Para
   produccion el mismo `releaseDuePayouts` se puede invocar desde un cron/route sin cambios (proxima fase).
5. **Idempotencia**: tabla `event_payouts` con `event_id` **unico** (un payout por evento). El payout usa
   `idempotencyKey = event-payout-<eventId>` (sin cents: una key reutilizada con otros parametros hace que Stripe falle en vez de duplicar; el insert usa `returning()` para detectar conflictos); la fila se inserta tras crear el payout con
   `onConflictDoNothing`. Doble clic o reintento no duplica. # ponytail: si entre dos intentos cambia el monto
   (un reembolso) la key cambia; aceptable, el unico `event_id` evita doble registro.
6. **Riesgo de moneda**: el payout se crea en la moneda del balance disponible de la cuenta conectada
   (`stripe.balance.retrieve({ stripeAccount })`). Monto = `min(liberable_db, disponible)`; si el balance no tiene la
   moneda `EVENT_CURRENCY` o el disponible es 0 => error legible, no se registra nada. La conversion PEN->USD exacta
   queda fuera (proxima fase); en la demo se valida con el monto disponible real.
7. **Autorizacion**: la action usa `requireRole(ORGANIZER_AREA_ROLES)` y opera siempre sobre `viewer.id`; nunca recibe
   `userId`/`eventId` del cliente. Solo con `isConnectEnabled()` y onboarding `complete`.
8. **Ubicacion**: todo en el modulo `payment` (`payout.service.ts`, `payout.actions.ts`, `payout-hold-card.tsx`,
   `event-payout.table.ts`). El servicio importa `orders`/`events` por ruta directa de `db` (patron ya usado en
   `connect.service.ts` con `users`). El barrel `index.ts` solo exporta el componente (cliente-seguro).

## Alcance
- Incluye: calendario manual de payouts en cuentas Express; calculo de fondos retenidos/liberables por evento;
  liberacion (payout) por evento vencido via action; tarjeta en `/organizer/payments` con retenido total, tabla por
  evento (evento, monto, fecha de liberacion, estado Retenido/Disponible/Liberado) y boton de retiro; tabla
  `event_payouts` + migracion; `PAYOUT_HOLD_DAYS`; tests.
- No incluye: `ends_at` del evento; cron/scheduler; liberacion lazy; conversion de moneda; payouts parciales por evento;
  reintentos automaticos; webhooks `payout.*`; Express Dashboard link; vista admin de payouts; gate que impida reembolsar
  tras la liberacion; cambios a checkout, reembolsos (041/047), webhook de pagos o proxy.

## Reutilizar
- `stripe` (`@/lib/stripe`), `db`, `users`, `orders` (`organizerNetAmount`, `status`), `events` (`startsAt`, `status`,
  `organizerId`), `isConnectEnabled`, `PAYMENTS_PATH`, `getPayoutAccount`, `requireRole`, `ORGANIZER_AREA_ROLES`.
- `EVENT_CURRENCY` y el formateador de precio que ya use el proyecto (el dev lo localiza con `grep -rn EVENT_CURRENCY src`;
  no crear otro formateador).
- UI: `Card`, `Table`, `Badge`, `Button` de `src/components/ui`; patron de `useActionState` de `ConnectStatusCard`.
- Patron de tests de `connect.service.test.ts` / `connect.actions.test.ts` (mocks de `@/lib/stripe`, `@/lib/db`).

## Archivos
| Archivo | Tarea | Cambio |
|---------|-------|--------|
| `src/modules/payment/db/event-payout.table.ts` | T0 | tabla `event_payouts` (id, `event_id` unique FK events, `organizer_id` FK users, `amount` numeric(10,2), `stripe_payout_id`, `created_at`) |
| `src/db/schema.ts` | T0 | exporta la tabla nueva |
| `drizzle/00NN_*.sql` (+ meta) | T0 | migracion generada con `npm run db:generate` |
| `src/modules/payment/constants/payment.constants.ts` | T0 | `PAYOUT_HOLD_DAYS` (lee env, default 7) |
| `src/modules/payment/utils/payment.utils.ts` (+ test) | T0 | `getPayoutReleaseDate(startsAt, holdDays)` y `isPayoutReleasable(startsAt, now, holdDays)` |
| `src/modules/payment/types/payment.types.ts` | T0 | `EventPayoutRow`, `PayoutSummary`, `PayoutActionState` |
| `.env.example` | T0 | `PAYOUT_HOLD_DAYS` documentado |
| `src/modules/payment/services/connect.service.ts` (+ test) | T1 | calendario manual al crear/actualizar la cuenta |
| `src/modules/payment/services/payout.service.ts` (+ test) | T2 | `getPayoutSummary(organizerId)`, `releaseDuePayouts(user)` |
| `src/modules/payment/actions/payout.actions.ts` (+ test) | T3 | `releasePayoutsAction` |
| `src/modules/payment/components/payout-hold-card.tsx` (+ test) | T3 | tarjeta + tabla + boton |
| `src/modules/payment/index.ts` | T3 | exporta `PayoutHoldCard` |
| `src/app/(organizer)/organizer/payments/page.tsx` | T4 | carga `getPayoutSummary` y renderiza la tarjeta |

## Criterios de aceptacion
- AC1: `getPayoutReleaseDate(startsAt, 7)` devuelve `startsAt + 7 dias`; `isPayoutReleasable` es `false` antes y `true`
  en/despues de esa fecha; `PAYOUT_HOLD_DAYS` usa 7 si la env falta o es invalida (no numerica/negativa).
- AC2: `startConnectOnboarding` crea la cuenta con `settings.payouts.schedule.interval = "manual"`; si la cuenta ya
  existe llama `accounts.update` con ese mismo ajuste; el resto del comportamiento de 042/048 (flag apagado, idempotencyKey,
  urls) no cambia y sus tests siguen pasando.
- AC3: `getPayoutSummary(organizerId)` devuelve, por evento del organizador con ordenes `paid` y `organizerNetAmount`,
  el monto, la fecha de liberacion y un estado `held` (no vencido) | `available` (vencido y sin fila en `event_payouts`) |
  `released` (con fila); excluye eventos `cancelled`, ordenes `refunded`/`cancelled`/sin Connect y eventos de otros
  organizadores; incluye el total retenido (`held` + `available`).
- AC4: `releaseDuePayouts` solo procesa eventos `available`; por cada uno crea `stripe.payouts.create` con
  `{ stripeAccount }`, moneda del balance y `idempotencyKey = event-payout-<eventId>` (sin cents: una key reutilizada con otros parametros hace que Stripe falle en vez de duplicar; el insert usa `returning()` para detectar conflictos), y luego inserta la fila
  en `event_payouts` con `onConflictDoNothing`. Sin eventos vencidos no llama a Stripe.
- AC5: si el balance disponible no tiene la moneda esperada o es menor al monto, el monto se limita a lo disponible; con
  disponible 0 devuelve error legible y no inserta fila. Un fallo de Stripe en un evento no impide procesar el resto
  y se reporta en el resultado.
- AC6: `releasePayoutsAction` exige `requireRole(ORGANIZER_AREA_ROLES)`, no acepta `userId`/`eventId` del request, con
  Connect apagado o onboarding no `complete` devuelve error y no llama a Stripe, y hace `revalidatePath(PAYMENTS_PATH)` al terminar.
- AC7: `PayoutHoldCard` muestra el total retenido, una fila por evento con fecha de liberacion y badge de estado, y
  el boton "Retirar fondos disponibles" **deshabilitado** salvo que haya al menos un evento `available`; muestra el
  error de la action; sin eventos muestra un estado vacio.
- AC8: `/organizer/payments` renderiza `ConnectStatusCard` y, solo si Connect esta habilitado y el estado es
  `complete`, la `PayoutHoldCard`; el estado de Connect se sigue sincronizando como en 042/048.
- AC9: checkout, `organizer-refund.service.ts`, `organizer-event-cancel.service.ts` y los webhooks no se modifican;
  `grep -rn "from \"stripe\"" src/modules/payment` solo importa tipos; `npm run lint`, `npm run test` y `npm run build` pasan.

## Tests requeridos
(Vitest, junto al archivo)
- `payment.utils.test.ts` (ampliar): AC1 (fechas limite exactas, hold 0, env invalida).
- `connect.service.test.ts` (ampliar): AC2.
- `payout.service.test.ts` (`@/lib/stripe` y `@/lib/db` mockeados): AC3 (held/available/released, exclusiones), AC4, AC5.
- `payout.actions.test.ts`: AC6 (rol, Connect apagado, no complete, revalidate).
- `payout-hold-card.test.tsx` (React Testing Library): AC7.
- Manual (para el usuario, demo local): con `STRIPE_CONNECT_ENABLED=true`, crear una cuenta Express nueva y completar el
  onboarding; comprar un ticket de un evento con tarjeta de saldo disponible inmediato (`4000 0000 0000 0077`); ver el
  monto "Retenido" con fecha `starts_at + 7d`; poner `PAYOUT_HOLD_DAYS=0` (o mover `starts_at` al pasado en la DB),
  pulsar "Retirar fondos disponibles" y ver el payout en el Dashboard de Stripe (test) y el evento como "Liberado".

## Tareas
### T0 — Base: tabla, migracion, constantes, utils y tipos
- Archivos: `src/modules/payment/db/event-payout.table.ts`, `src/db/schema.ts`, `drizzle/00NN_*` (generada),
  `payment.constants.ts`, `payment.utils.ts` + test, `payment.types.ts`, `.env.example`.
- Depende de: —
- Paralelizable: no (base compartida)
- Cubre: AC1

### T1 — Calendario manual en la cuenta Express
- Archivos: `src/modules/payment/services/connect.service.ts` + test.
- Depende de: T0
- Paralelizable: si (con T2; archivos disjuntos)
- Cubre: AC2

### T2 — Servicio de resumen y liberacion
- Archivos: `src/modules/payment/services/payout.service.ts` + test.
- Depende de: T0
- Paralelizable: si (con T1)
- Cubre: AC3, AC4, AC5

### T3 — Action y tarjeta de UI
- Archivos: `src/modules/payment/actions/payout.actions.ts` + test, `src/modules/payment/components/payout-hold-card.tsx` +
  test, `src/modules/payment/index.ts`.
- Depende de: T2
- Paralelizable: no
- Cubre: AC6, AC7

### T4 — Integracion en `/organizer/payments`
- Archivos: `src/app/(organizer)/organizer/payments/page.tsx`.
- Depende de: T3
- Paralelizable: no
- Cubre: AC8, AC9 (verificacion final: lint, test, build)

## Preguntas abiertas
1. **Fin del evento**: se usa `starts_at` (Decision 1) porque no existe `ends_at`. Default: aceptado; `ends_at` en una spec aparte.
2. **Cuentas Express ya creadas** con payout automatico: default = no se migran en masivo; se actualizan al pasar por
   onboarding (T1) y para la demo se recrea la cuenta de prueba. Saldo ya pagado antes de esta spec no se retiene.
3. **Moneda**: PEN en DB vs balance de la cuenta Express (pais `STRIPE_CONNECT_ACCOUNT_COUNTRY`, default US => USD).
   Default: el payout se limita al balance disponible (Decision 6). El dev debe verificar con `stripe` CLI en test si
   Stripe permite payouts manuales en Express para el pais elegido y reportar el resultado; si no, se escala a spec nueva.
4. **Quien retira**: default = boton del organizador (Decision 4). Alternativa: tambien un boton admin; no incluido.
5. **Reembolsos tras la liberacion**: default = sin bloqueo ni reserva; saldo negativo posible (techo documentado).
6. **`PAYOUT_HOLD_DAYS` configurable** por env (no por `platform_settings`/UI admin). Default aceptado.

## Proximas fases
- `ends_at` en eventos y usarlo en `getPayoutReleaseDate`.
- Cron/route protegida (Vercel Cron) que invoque `releaseDuePayouts` por todos los organizadores.
- Conversion de moneda exacta (monto del `balance_transaction` del transfer) y payouts parciales.
- Webhooks `payout.paid`/`payout.failed` para estado real del retiro.
- Vista admin de payouts y bloqueo/reserva de reembolsos posteriores a la liberacion.
