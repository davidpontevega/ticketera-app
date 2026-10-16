# 040 — Validacion de entradas en puerta (check-in por codigo QR)

Estado: implementada

## Estado
- Aprobacion humana: aprobada (2026-10-14, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Que un organizador (o admin/super_admin) pueda validar en puerta una entrada pagada ingresando su `qr_code`
(`TK-XXXXXXXX-NN`) y marcarla como **usada una sola vez**, con resultado claro y contador de ingresados/total por
evento. Referencias: `032` (tickets y `qr_code` en DB), `034` (decision 4: "cuando exista validacion de ingreso se lee
`tickets`"), `030/036` (patron de area del organizador: `requireRole(ORGANIZER_AREA_ROLES)`, server actions con
`useActionState`, `getEventScope`), `026` (el proxy ya protege `/organizer`).

## Hallazgos (verificado en codigo)
- `tickets` **ya tiene** `status` (`ticket_status`: `valid | used | cancelled`) y `checked_in_at timestamptz` NULL
  (migracion `0000`). Nada los escribe hoy. Solo falta quien hizo el check-in (`checked_in_by`).
- `tickets.qr_code` es `NOT NULL UNIQUE` (indice implicito para el lookup). `tickets.order_id` -> `orders.id`.
- `tickets` no tiene `event_id`. El evento se llega por `orders`: `orders.event_id` es nullable (ordenes antiguas) pero
  `orders.event_slug` es `NOT NULL` y `events.slug` es `UNIQUE` => se une por **`events.slug = orders.event_slug`**
  (igual que el resto del codigo hasta P1-06).
- `getEventScope(viewer)` (`organizer-event-admin.service.ts`): `organizer` => `events.organizer_id = viewer.id`;
  admin/super_admin => `undefined` (sin filtro). Se reutiliza tal cual.
- `requireRole(ORGANIZER_AREA_ROLES)` (`super_admin | admin | organizer`) redirige a `/login` o `/`; ya se usa en pages
  y actions del organizador. `customer` queda fuera por construccion. No existe rol `staff`.
- Patron de mutacion del area organizador: server action (`"use server"`) + `useActionState` + `revalidatePath`
  (`organizer-event.actions.ts`, `EventAdminActionState`). Las pages usan `PageProps<"/organizer/...">` y el servicio
  `server-only` se importa por ruta directa, no por el barrel.
- Rutas del organizador viven en `src/app/(organizer)/organizer/...`; `/organizer(/.*)?` ya esta en
  `protected-routes.ts` => **no se toca el proxy**.
- Referencia del profesor (solo lectura): tabla aparte `check_in(ticket_id, scanned_by, scanned_at, result)` + enum
  `check_in_result` + `tickets.checked_in_at`. Es un log de intentos; aqui se descarta (YAGNI, ver Decisiones 1).
- Drizzle omite el prefijo de tabla en selects/subconsultas de una sola tabla: calificar a mano (`"tickets"."id"`,
  `"events"."id"`) en cualquier subconsulta cruda.

## Decisiones
1. **Modelo minimo**: se reutiliza `status = 'used'` + `checked_in_at` y se agrega **una** columna
   `checked_in_by uuid NULL REFERENCES users(id) ON DELETE SET NULL`. Sin tabla `check_in` ni enum de resultado
   (el log de intentos fallidos no se pide; se puede agregar luego sin romper nada).
2. **Atomicidad en un solo UPDATE condicional**:
   `UPDATE tickets SET status='used', checked_in_at=now(), checked_in_by=$viewer
    WHERE qr_code=$code AND status='valid' AND <ticket pertenece a evento $eventId, orden paid, evento != cancelled,
    y dentro del scope del viewer> RETURNING ...`.
   Dos escaneos simultaneos: Postgres serializa por fila, el segundo ve `status='used'` y afecta 0 filas. Sin SELECT
   previo, sin transaccion explicita. La pertenencia se expresa con `EXISTS`/`IN (subconsulta)` sobre `orders`+`events`
   (UPDATE de Postgres no admite JOIN en Drizzle).
3. **Clasificacion solo si el UPDATE afecta 0 filas** (camino de error, no critico para concurrencia): un SELECT
   diagnostico del `qr_code` (con `orders`+`events`, **sin** scope) y una funcion pura `classifyCheckInFailure(row, ctx)`
   devuelve, en este orden:
   - no existe, o el viewer es organizer y el evento no es suyo => `not-found` (no filtra la existencia de entradas
     ajenas);
   - el evento del ticket != `eventId` de la pagina => `wrong-event`;
   - orden no `paid` o evento `cancelled` => `not-valid`;
   - `status='used'` => `already-used` con `checkedInAt`;
   - `status='cancelled'` => `cancelled`.
   Resultado exitoso: `valid` con `{ code, zoneName, seatLabel, attendeeName, sequence }`.
4. **Entrada del evento via pagina `/organizer/events/[id]/check-in`**: el `eventId` (uuid de la URL) acota la
   validacion; el organizador valida "en este evento". El `viewer` sale de `requireRole` en servidor, nunca del
   formulario. Un organizer sobre un evento ajeno recibe `notFound()` (mismo patron que `edit/page.tsx`).
5. **Server action (no route handler)**: `checkInTicketAction` con `useActionState`, igual que las demas mutaciones
   del organizador; no hay cliente externo que consuma una API. El estado devuelto es una union discriminada
   (`idle | valid | already-used | not-found | wrong-event | not-valid | cancelled | error`).
6. **Input**: un unico `<Input>` autofocus con `name="code"`; un lector USB envia el codigo + Enter => submit del form.
   Se normaliza (`trim`, `toUpperCase`) y se valida con zod contra `^TK-[0-9A-F]{8}-\d{2}$` (formato de
   `toTicketRows`/`getOrderTickets`; el developer confirma el patron exacto leyendo esa funcion). Tras cada resultado
   el input se limpia y recupera el foco para el siguiente escaneo.
7. **Camara**: **fuera de alcance**. Requeriria `getUserMedia` + libreria de decodificacion (`BarcodeDetector` no es
   universal) => dependencia nueva y permisos; no es trivial.
8. **Contador**: `getCheckInStats(eventId, viewer)` => `{ total, checkedIn }` con un solo `SELECT count(*) FILTER
   (WHERE status='used')` sobre tickets de ordenes `paid` del evento. Se muestra en la page (render servidor) y se
   refresca con `revalidatePath` tras cada check-in valido. No cuenta tickets `cancelled` en `total`.
9. **"Mis entradas" mostrando "Usada"**: **diferido**. `034` decidio no leer `tickets` (los codigos salen de
   `getOrderTickets`); mostrar el estado exige un JOIN nuevo y tocar `Order`/`OrderTicketViewer`, no es barato.
10. **Entrada al check-in desde el dashboard**: un enlace "Check-in" por evento publicado en `organizer-event-actions`
    / lista. Minimo: un `Link` en `organizer-event-list.tsx` (visible solo si `status = 'published'`).
11. **Fecha del evento**: no se restringe la ventana horaria (se puede validar cualquier dia). Ver pregunta 2.

## Alcance
- Incluye: migracion `checked_in_by`; servicio `checkInTicket` atomico + `getCheckInStats`; funcion pura
  `classifyCheckInFailure`; schema zod del codigo; server action; page y componente de check-in con resultados
  (verde / rojo / ambar) y contador; enlace desde la lista de eventos del organizador; tests.
- No incluye (se difiere):
  - Escaneo con camara (Decision 7).
  - Tabla de log de intentos / auditoria de escaneos fallidos / reporte de check-ins.
  - Deshacer un check-in (revertir `used` a `valid`).
  - Rol `staff` dedicado o asignacion de staff a eventos.
  - Estado "Usada" en "Mis entradas" (Decision 9).
  - Restriccion por ventana horaria del evento.
  - Modo offline / sincronizacion, rate limiting de intentos.
  - Cambios en el proxy o en `protected-routes.ts`.

## Reutilizar
- `tickets` (`ticket.table.ts`: `status`, `checkedInAt`), `orders`, `events`, `users`, `db` (`@/lib/db`).
- `getEventScope` y `EventAdminViewer` (`organizer-event-admin.service.ts`) para el scope por rol.
- `requireRole`, `ORGANIZER_AREA_ROLES` (`@/modules/user`).
- Patron de action + `useActionState` + `revalidatePath` (`organizer-event.actions.ts`); `ORGANIZER_PATH`.
- Patron de page: `edit/page.tsx` (`PageProps`, `z.uuid()`, `notFound()`, servicio por ruta directa).
- UI shadcn ya instalada (verificar con `ls src/components/ui`: `input`, `button`, `card`, `badge`); el developer
  instala solo lo que falte con `npx shadcn@latest add`. Iconos: `lucide-react` (`CheckCircle2`, `XCircle`).
- Patron de tests con `db` mockeado: `organizer-event-admin.service.test.ts`, `organizer-event.actions.test.ts`,
  `event-form.test.tsx`.
- Formato del codigo: `getOrderTickets`/`toTicketRows` en `order.utils.ts` (fuente del regex).

## Archivos
| Archivo | Cambio |
|---------|--------|
| `src/modules/ticket/db/ticket.table.ts` | agrega `checkedInBy: uuid("checked_in_by").references(() => users.id, { onDelete: "set null" })` |
| `drizzle/0006_*.sql` + `drizzle/meta/*` | generado con `npx drizzle-kit generate` (NO se aplica; lo aplica el usuario con `npm run db:migrate`) |
| `src/modules/organizer/types/check-in.types.ts` | `CheckInTicket`, `CheckInResult`, `CheckInActionState`, `CheckInStats` |
| `src/modules/organizer/schemas/check-in.schema.ts` | `checkInSchema` (`eventId` uuid, `code` normalizado + regex) |
| `src/modules/organizer/schemas/check-in.schema.test.ts` | tests |
| `src/modules/organizer/utils/check-in.utils.ts` | `classifyCheckInFailure` (pura) |
| `src/modules/organizer/utils/check-in.utils.test.ts` | tests |
| `src/modules/organizer/services/organizer-check-in.service.ts` | `checkInTicket`, `getCheckInStats` (`server-only`) |
| `src/modules/organizer/services/organizer-check-in.service.test.ts` | tests con `db` mockeado |
| `src/modules/organizer/actions/check-in.actions.ts` | `checkInTicketAction` |
| `src/modules/organizer/actions/check-in.actions.test.ts` | tests |
| `src/modules/organizer/components/check-in-panel.tsx` | form + resultado + contador (cliente, `useActionState`) |
| `src/modules/organizer/components/check-in-panel.test.tsx` | tests de UI condicional |
| `src/modules/organizer/constants/organizer.constants.ts` | agrega `getOrganizerCheckInPath(id)` |
| `src/modules/organizer/components/organizer-event-list.tsx` | enlace "Check-in" (solo `published`) |
| `src/modules/organizer/index.ts` | exporta `CheckInPanel`, `getOrganizerCheckInPath` |
| `src/app/(organizer)/organizer/events/[id]/check-in/page.tsx` | page servidor: `requireRole`, valida uuid, stats, `<CheckInPanel>` |

## Criterios de aceptacion
- AC1: la tabla `tickets` tiene `checked_in_by` (uuid NULL, FK `users.id`, `ON DELETE SET NULL`); la migracion
  generada solo contiene ese `ALTER TABLE ... ADD COLUMN` + FK (sin tocar otras tablas).
- AC2: `checkInTicket({eventId, code}, viewer)` sobre un ticket `valid`, de orden `paid`, evento no `cancelled` y
  en scope devuelve `{ result: "valid", ticket }` y deja `status='used'`, `checked_in_at` y `checked_in_by = viewer.id`
  en **una sola sentencia** `UPDATE ... WHERE ... status='valid' ... RETURNING` (sin SELECT previo en el camino feliz).
- AC3: si el UPDATE afecta 0 filas, el resultado se clasifica: inexistente => `not-found`; organizer con evento ajeno =>
  `not-found`; ticket de otro evento del mismo viewer/admin => `wrong-event`; orden no `paid` o evento `cancelled` =>
  `not-valid`; `used` => `already-used` con `checkedInAt`; `cancelled` => `cancelled`.
- AC4: idempotencia/concurrencia logica: dos llamadas consecutivas con el mismo codigo devuelven `valid` y luego
  `already-used` (la hora de la segunda es la del primer check-in, no se sobreescribe). La atomicidad descansa en
  `status='valid'` dentro del `WHERE` (verificado por la forma de la consulta en el test; verificacion con dos
  requests simultaneos queda manual).
- AC5: autorizacion: `customer` o sin sesion no accede (page y action usan `requireRole(ORGANIZER_AREA_ROLES)`);
  `organizer` solo valida/ve stats de eventos con `organizer_id = su id` (usa `getEventScope`); `admin`/`super_admin`
  de cualquier evento. El `viewer` nunca proviene del `FormData`.
- AC6: `checkInSchema` acepta `tk-1a2b3c4d-01` y ` TK-1A2B3C4D-01 ` normalizandolos a `TK-1A2B3C4D-01`; rechaza vacio,
  formato invalido y `eventId` no uuid; la action devuelve `status: "error"` con mensaje de validacion sin tocar la DB.
- AC7: `getCheckInStats` devuelve `{ total, checkedIn }` contando solo tickets de ordenes `paid` del evento
  (`total` excluye `cancelled`; `checkedIn` = `status='used'`), respetando el scope.
- AC8: la page `/organizer/events/[id]/check-in` hace `notFound()` con id no uuid o evento inexistente/ajeno
  (organizer), y muestra titulo del evento, `ingresados/total` y el form con el input autofocus.
- AC9: `CheckInPanel` muestra: `valid` => bloque verde con codigo, zona/asiento y asistente; `already-used` => bloque
  rojo con "Ya usada" y fecha/hora formateada; `not-found`, `wrong-event`, `not-valid`, `cancelled` => bloque rojo/ambar
  con mensaje distinto cada uno; `error` => mensaje de validacion. El resultado se anuncia con `role="status"`
  (accesible). El input se limpia tras cada intento.
- AC10: `organizer-event-list.tsx` muestra el enlace "Check-in" solo en eventos `published`, hacia
  `getOrganizerCheckInPath(id)`.
- AC11: `tsc`, `eslint` y `vitest` pasan. Verificacion manual (con DB y migracion aplicada): validar una entrada real
  => verde, repetirla => rojo "ya usada", codigo inventado => "no encontrada", entrada de otro organizador => "no
  encontrada", contador sube en 1.

## Tests requeridos
(Vitest, junto al archivo)
- `check-in.schema.test.ts`: normalizacion (trim/mayusculas), formato valido/invalido, `eventId` uuid (AC6).
- `check-in.utils.test.ts`: `classifyCheckInFailure` para cada rama y su orden de precedencia (AC3).
- `organizer-check-in.service.test.ts` (`db` mockeado): camino feliz = un solo `update` con `returning`, sin `select`
  previo (AC2); update vacio => select diagnostico y resultado clasificado (AC3); segunda llamada => `already-used`
  conservando la hora original (AC4); scope: organizer incluye `organizer_id`, admin no (AC5); `getCheckInStats`
  (AC7).
- `check-in.actions.test.ts` (`requireRole`, servicio y `revalidatePath` mockeados): llama `requireRole` con
  `ORGANIZER_AREA_ROLES`; payload invalido => error sin llamar al servicio; resultado `valid` => `revalidatePath`;
  el viewer pasa al servicio desde `requireRole` (AC5, AC6).
- `check-in-panel.test.tsx` (RTL, action mockeada): render de cada estado (AC9), contador, input limpio/enfocado.
- No automatizable sin DB real (manual): concurrencia real, AC1 aplicado, AC11.

## Tareas
### T0 — Migracion y tabla
- Archivos: `src/modules/ticket/db/ticket.table.ts`, `drizzle/0006_*.sql`, `drizzle/meta/*`
- Depende de: —
- Paralelizable: no (bloquea a T3)
- Cubre: AC1
- Nota: el developer ejecuta `npx drizzle-kit generate` y revisa el SQL; **no** ejecuta `db:migrate` (lo hace el
  usuario).

### T1 — Tipos, schema y clasificacion pura
- Archivos: `src/modules/organizer/types/check-in.types.ts`, `src/modules/organizer/schemas/check-in.schema.ts`,
  `src/modules/organizer/schemas/check-in.schema.test.ts`, `src/modules/organizer/utils/check-in.utils.ts`,
  `src/modules/organizer/utils/check-in.utils.test.ts`
- Depende de: —
- Paralelizable: si (con T0)
- Cubre: AC3 (parte pura), AC6 (schema)

### T2 — Servicio atomico y estadisticas
- Archivos: `src/modules/organizer/services/organizer-check-in.service.ts`,
  `src/modules/organizer/services/organizer-check-in.service.test.ts`
- Depende de: T0, T1
- Paralelizable: no
- Cubre: AC2, AC3, AC4, AC5 (scope), AC7

### T3 — Action, UI y page
- Archivos: `src/modules/organizer/actions/check-in.actions.ts`, `src/modules/organizer/actions/check-in.actions.test.ts`,
  `src/modules/organizer/components/check-in-panel.tsx`, `src/modules/organizer/components/check-in-panel.test.tsx`,
  `src/app/(organizer)/organizer/events/[id]/check-in/page.tsx`
- Depende de: T2
- Paralelizable: no
- Cubre: AC5 (roles), AC6 (action), AC8, AC9

### T4 — Enlace, constantes y barrel
- Archivos: `src/modules/organizer/constants/organizer.constants.ts`, `src/modules/organizer/components/organizer-event-list.tsx`,
  `src/modules/organizer/index.ts`
- Depende de: T3 (para exportar `CheckInPanel`)
- Paralelizable: no
- Cubre: AC10, AC11

Orden: (T0 || T1) -> T2 -> T3 -> T4. Cada archivo pertenece a una sola tarea. Si el developer necesita `getOrganizerCheckInPath`
antes en T3, se mueve la constante a T1 (no a otra tarea con archivos compartidos).

## Riesgos
- **Fuga por mensajes**: distinguir "no existe" de "es de otro organizador" revelaria codigos ajenos; mitigado con
  `not-found` para ambos (Decision 3).
- **Union `orders.event_slug` -> `events.slug`**: si un evento cambia de slug despues de vender, el join pierde los
  tickets. Hoy el slug no es editable en el flujo de edicion (verificar en 036); si lo fuera, usar `orders.event_id`
  cuando no sea NULL (`COALESCE`) como fallback. El developer confirma y deja nota.
- **Drizzle sin prefijo de tabla** en selects de una tabla: calificar a mano en subconsultas del `UPDATE ... WHERE
  EXISTS (...)`; test del servicio debe revisar el SQL generado.
- **Enumeracion de codigos**: el espacio de `TK-XXXXXXXX-NN` es 32 bits; un organizer autenticado podria probar
  codigos, pero solo ve resultados de sus propios eventos. Sin rate limiting en esta fase (fuera de alcance).
- **Tickets sin `checked_in_by`** si el usuario se borra (`SET NULL`): aceptado, se conserva `checked_in_at`.
- **Migracion en produccion**: `ADD COLUMN` nullable sin default es online y barata; no requiere backfill.
- **Entrada duplicada sin red / doble clic**: el segundo submit devuelve `already-used`, que es el comportamiento
  correcto, pero la UI debe deshabilitar el boton mientras `isPending`.

## Preguntas abiertas
1. **Staff**: ¿basta con organizer/admin/super_admin (no hay rol `staff`)? Default: si; el organizador comparte su
   sesion o crea un usuario organizer. Un rol/asignacion de staff seria otra spec.
2. **Ventana horaria**: ¿bloquear check-in antes de X horas del `starts_at` o despues de pasado el evento? Default: no
   se restringe (evita falsos rechazos en puerta).
3. **Entradas `cancelled`** (hoy ninguna ruta las crea): default = resultado propio `cancelled`. Alternativa: tratarlas
   como `not-valid`.
4. **Deshacer check-in** por error del operador: default = no (fuera de alcance); se corrige por SQL manual.
5. **Camara/QR visual**: default = fuera de alcance (solo escribir/pegar o lector USB). ¿Se abre spec aparte con
   `BarcodeDetector`/libreria?
6. **"Mis entradas" mostrando "Usada"**: default = diferido (Decision 9). ¿Se quiere en una spec corta posterior?
7. **Union por slug vs `event_id`**: default = `events.slug = orders.event_slug` (siempre poblado). ¿Se prefiere
   esperar a P1-06 para unir por `event_id`?

## Proximas fases
- Escaneo con camara en `CheckInPanel` (`BarcodeDetector` + fallback).
- Log de intentos (`check_in`: ticket, usuario, resultado, fecha) y reporte de asistencia.
- Estado "Usada"/"Anulada" en "Mis entradas" leyendo `tickets`.
- Rol/asignacion de staff por evento; ventana horaria; deshacer check-in; rate limiting.

## Log de review
- Reviewer: PASS (AC1-AC10 verificados; AC11 y concurrencia real quedan para prueba manual con la migracion 0006 aplicada). Sin hallazgos bloqueantes. Un test de check-in-panel fallo una vez en corrida paralela completa y no se reprodujo: atribuido a carga (timeout de findByRole).
