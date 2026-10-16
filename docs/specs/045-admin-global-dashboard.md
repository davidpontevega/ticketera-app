# 045 — Dashboard global del admin (/admin)

Estado: aprobada

## Estado
- Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo
Pagina `/admin` con metricas **globales** de la plataforma: entradas vendidas, ingresos, comision de plataforma,
eventos y usuarios, cada una con su tendencia (ultimos 6 meses y variacion vs mes anterior). Toda la agregacion se hace
en Postgres (mismo criterio que la spec 038); el servidor solo rellena meses vacios y calcula variaciones.
Referencias: `038` (SQL con `orders` + `jsonb_array_elements(lines)`, fuente de `sold`/`revenue`, bug de prefijo de
Drizzle -> nombres calificados a mano), `042` (`orders.platform_fee_amount`, NULL = sin Connect), `041` (estado
`refunded`), `024`/`026`/`027` (roles, `requireRole`, `/admin(/.*)?` ya protegido en el proxy), `008` (esquema),
`SYSTEM_DESIGN.md` (fila Autorizacion / Base de datos).
Referencia solo lectura (no copiar codigo, esquema distinto): `git show profesor/main:src/modules/admin/services/admin-metrics-service.ts`
(rama feat/admin-dashboard-metrics). Se toma solo la idea: un servicio que corta por rol y consultas por metrica en paralelo.

## Hallazgos (verificado en codigo)
- **No existe**: no hay `src/app/(admin)/admin/page.tsx` (solo `users` y `settings`); `src/modules/admin` solo tiene
  `AdminShell` + `ADMIN_NAV_SECTIONS` (sin servicios ni metricas). `grep -ri "dashboard" src/modules/admin` vacio.
  El dashboard de `/organizer` es por dueno y no sirve como global (aunque `admin`/`super_admin` ven todos los eventos alli).
- `/admin(/.*)?` ya esta en `isProtectedRoute`; el rol se valida en servidor con `requireRole`. `USER_ADMIN_ROLES = ["super_admin"]`
  es lo que usan `users` y `settings`.
- Fuentes de datos: `orders` (`status`, `total_amount`, `lines` jsonb, `platform_fee_amount` numeric nullable,
  `created_at` sin zona), `events` (`status` draft|published|cancelled, `created_at`), `users` (`role`, `created_at`,
  `deleted_at` null = activo). Todo en PEN (sin columna de moneda).
- `order_items` sigue sin escribirse (038): no se usa.
- No hay libreria de graficos instalada (`package.json`) ni componente shadcn `chart`.
- Comision: `platform_fee_amount` solo se llena en compras con Connect (042); las demas quedan NULL y suman 0.

## Decisiones
1. **Definiciones** (todas sobre ordenes `status = 'paid'`, igual que 038):
   - Entradas vendidas = `sum(line.quantity)` via `jsonb_array_elements(lines)`; Ingresos = `sum(total_amount)`;
     Comision = `sum(coalesce(platform_fee_amount, 0))`. Las `refunded` quedan fuera de las tres (ya no son `paid`).
   - Eventos = conteo por `status` (total + publicados) y nuevos por mes (`created_at`).
   - Usuarios = activos (`deleted_at is null`) total, desglose por `role`, y altas por mes.
2. **Tendencia**: serie de 6 meses calendario (incluye el mes actual, parcial) agrupada con
   `date_trunc('month', created_at at time zone 'America/Lima')`. `created_at` es `timestamp` sin zona (UTC, default `now()`):
   se interpreta `created_at at time zone 'UTC' at time zone 'America/Lima'`. Variacion = (mes actual - mes anterior) /
   mes anterior; si el anterior es 0 -> `null` (UI muestra "—", no infinito). Mes actual parcial se rotula "mes en curso".
3. **Una query por grupo, no por metrica** (4 en paralelo con `Promise.all`): (a) ordenes por mes: ingresos + comision
   (`sum` sobre `orders`, sin lateral para no duplicar `total_amount`, como 038); (b) entradas por mes (lateral sobre
   `lines`, query aparte por la misma razon); (c) eventos: conteo por `status` + altas por mes; (d) usuarios: activos por
   `role` + altas por mes. Los meses sin datos se rellenan en TS (`fillMonths`), no con `generate_series`, para mantener
   el SQL simple y testeable.
4. **Precision**: sumas `numeric` en Postgres devueltas como `text` (`::text`) y `Number()` una vez por mes; totales con
   redondeo a centimos (`Math.round(x * 100) / 100`), igual que 038.
5. **Autorizacion**: `getAdminMetrics()` empieza con `requireRole(USER_ADMIN_ROLES)` (falla cerrado antes de cualquier
   query) y la pagina tambien (patron de `users`/`settings`). Se reutiliza `USER_ADMIN_ROLES`; no se crea constante nueva
   (ver pregunta 1).
6. **Graficos sin dependencia nueva**: barras CSS (`div` con altura proporcional + `aria-label`/tabla accesible por
   `sr-only`). Se reutiliza `Card`, `Badge`, `formatEventPrice` y el patron `dl` de `organizer-kpis.tsx`. No se agrega
   `recharts`/shadcn `chart` (YAGNI; ver pregunta 2).
7. **Sin cache ni rango de fechas configurable**: se lee en cada request (`dynamic` por `requireRole`/cookies). Ver
   Proximas fases.
8. Volumen: agregados por mes con filtro `created_at >= inicio de ventana`; las ordenes ya tienen
   `orders_event_slug_status_idx` pero ese no cubre filtro global por fecha. Aceptado a escala actual; comentario
   `ponytail:` (techo: cientos de miles de ordenes; salida: indice `(status, created_at)` o tabla/vista materializada).
   No se agrega indice ahora.

## Alcance
- Incluye: servicio SQL de metricas globales; utilidades puras (meses, variacion, rellenado, mapper); pagina `/admin`
  con KPIs + 3 tendencias (ingresos/comision, entradas, usuarios+eventos nuevos) + desglose de eventos por estado y
  usuarios por rol; item "Resumen" en el nav de `AdminShell`; tests; nota en `SYSTEM_DESIGN.md`.
- No incluye: export PDF/CSV, filtros por rango o por organizador, top eventos/organizadores, comparativa anual,
  graficos con libreria, cache/materializacion, cambios de esquema o de checkout, cambios en `/organizer`.

## Reutilizar
- `AdminShell`, `ADMIN_NAV_SECTIONS` (`src/modules/admin`), `requireRole`, `USER_ADMIN_ROLES`, `USER_ROLE_LABELS`
  (`@/modules/user`), `formatEventPrice` (`@/modules/event`), `Card`/`Badge` (`src/components/ui`), `EmptyState`
  (`src/components/shared`), patron `dl` de `organizer-kpis.tsx`, patron de subconsultas calificadas a mano de
  `organizer-events.service.ts`, tablas `orders`/`events`/`users`.
- UI: `ls src/components/ui` no tiene `chart`; `npx shadcn@latest search @shadcn -q chart` queda como verificacion del
  developer solo si se cambia la decision 6.

## Archivos
Todos nuevos salvo indicacion.
- `src/modules/admin/types/admin-metrics.types.ts` — `MonthPoint`, `MetricSeries` (`total`, `current`, `previous`,
  `changePct: number | null`, `points: {month: string; value: number}[]`), `AdminMetrics`.
- `src/modules/admin/utils/admin-metrics.utils.ts` (+ `.test.ts`) — `recentMonths(now, n)` (claves `YYYY-MM` en Lima),
  `fillMonths`, `changePct`, `toAdminMetrics(rows)`.
- `src/modules/admin/services/admin-metrics.service.ts` (+ `.test.ts`) — `getAdminMetrics(now = new Date())`, `server-only`.
- `src/modules/admin/components/admin-kpis.tsx`, `admin-trend-chart.tsx`, `admin-dashboard.tsx` (+ `admin-trend-chart.test.tsx`).
- `src/app/(admin)/admin/page.tsx` — routing: `requireRole` + `getAdminMetrics` + `<AdminShell><AdminDashboard/></AdminShell>`.
- Modificados: `src/modules/admin/constants/admin.constants.ts` (nav "Resumen" -> `/admin`, primero de "Administracion"),
  `src/modules/admin/index.ts` (exporta `AdminDashboard`, tipos; el servicio NO va al barrel, es server-only),
  `docs/SYSTEM_DESIGN.md` (nota de metricas globales y definiciones).

## Criterios de aceptacion
- AC1: `/admin` renderiza para `super_admin` dentro de `AdminShell`; sin sesion redirige al login (proxy ya cubre) y un
  rol distinto de `USER_ADMIN_ROLES` es rechazado por `requireRole` (mismo comportamiento que `/admin/users`).
- AC2: `getAdminMetrics` falla antes de ejecutar cualquier query si el viewer no esta en `USER_ADMIN_ROLES`.
- AC3: entradas vendidas, ingresos y comision cuentan solo ordenes `paid`; una orden `refunded`, `pending`, `failed` o
  `cancelled` no suma en ninguna; comision NULL cuenta como 0.
- AC4: ningun calculo de suma se hace en JS sobre filas de ordenes/usuarios/eventos: el servicio recibe agregados por mes
  (maximo 6 filas por serie) y no hay `select` sin `group by` sobre `orders`.
- AC5: cada serie devuelve exactamente 6 puntos (meses sin datos = 0), ordenados ascendente, con el mes actual al final,
  usando meses calendario de `America/Lima`.
- AC6: `changePct` = (actual - anterior) / anterior * 100 redondeado a 1 decimal; si anterior = 0 devuelve `null` y la UI
  muestra "—" (nunca `Infinity` ni `NaN`).
- AC7: ingresos y comision se muestran con `formatEventPrice` y sin ruido de flotantes (`0.1 + 0.2` -> `0.30`).
- AC8: usuarios cuentan solo `deleted_at is null`; el desglose por rol suma el total de activos.
- AC9: eventos muestran total, publicados, borrador y cancelados; los nuevos por mes salen de `events.created_at`.
- AC10: con base vacia la pagina renderiza ceros y graficos vacios sin error (sin division por cero).
- AC11: cada grafico expone sus valores por mes a lectores de pantalla (`sr-only` o `aria-label`); los KPIs usan `dl`.
- AC12: "Resumen" aparece en el nav de administracion y queda activo solo en `/admin` exacto (no en `/admin/users`).
- AC13: sin dependencias nuevas en `package.json`; sin cambios de esquema ni de `/organizer`.

## Tests requeridos
(Vitest, junto al archivo)
- `admin-metrics.utils.test.ts`: `recentMonths` (cruce de ano, limite UTC/Lima: 2026-11-01T03:00Z cae en noviembre Lima,
  2026-11-01T04:59Z tambien, 2026-11-01T05:00Z sigue noviembre; 2026-10-31T23:00Z Lima = 01-nov 04:00Z -> octubre),
  `fillMonths` (huecos a 0), `changePct` (anterior 0 -> null, caida negativa, redondeo), redondeo de centimos, `toAdminMetrics`
  (desglose de roles suma el total, estados de eventos).  Cubre AC5-AC9, AC10.
- `admin-metrics.service.test.ts` (mock `@/lib/db` y `requireRole`): rechaza rol no admin sin tocar `db`; arma
  `AdminMetrics` desde filas agregadas mockeadas; base vacia -> ceros.  Cubre AC2, AC4, AC10.
- `admin-trend-chart.test.tsx` (RTL): renderiza un item accesible por mes, altura relativa al maximo, serie toda en 0 sin
  `NaN`.  Cubre AC10, AC11.
- Sin test para `admin-kpis.tsx`/`admin-dashboard.tsx` (presentacionales). El filtrado `paid` (AC3) se valida leyendo el
  SQL en revision y, si el repo ya tiene harness de DB de integracion, con un caso real; si no, queda como revision
  manual (ver pregunta 4).

## Tareas
### T1 — Tipos y utilidades puras
- Archivos: `src/modules/admin/types/admin-metrics.types.ts`, `src/modules/admin/utils/admin-metrics.utils.ts`,
  `src/modules/admin/utils/admin-metrics.utils.test.ts`
- Depende de: —
- Paralelizable: si
- Cubre: AC5, AC6, AC7, AC8, AC9, AC10

### T2 — Servicio SQL de metricas
- Archivos: `src/modules/admin/services/admin-metrics.service.ts`, `src/modules/admin/services/admin-metrics.service.test.ts`
- Depende de: T1 (tipos y `toAdminMetrics`)
- Paralelizable: no (necesita el contrato de T1; puede arrancar contra los tipos si T1 ya publico `types`)
- Cubre: AC2, AC3, AC4, AC8, AC9, AC10

### T3 — Componentes de UI
- Archivos: `src/modules/admin/components/admin-kpis.tsx`, `src/modules/admin/components/admin-trend-chart.tsx`,
  `src/modules/admin/components/admin-trend-chart.test.tsx`, `src/modules/admin/components/admin-dashboard.tsx`
- Depende de: T1 (solo tipos)
- Paralelizable: si (con T2, una vez T1 deje los tipos)
- Cubre: AC6, AC7, AC10, AC11

### T4 — Pagina, nav, barrel y docs
- Archivos: `src/app/(admin)/admin/page.tsx`, `src/modules/admin/constants/admin.constants.ts`,
  `src/modules/admin/index.ts`, `docs/SYSTEM_DESIGN.md`
- Depende de: T2, T3
- Paralelizable: no
- Cubre: AC1, AC12, AC13

(Sin T0: no hay `npm install`, `shadcn add`, ni cambios en `layout.tsx`/`globals.css`.)

## Preguntas abiertas
1. **Quien ve `/admin`?** Default: solo `super_admin` (`USER_ADMIN_ROLES`, igual que `users` y `settings`). El rol `admin`
   hoy solo entra al area organizer. Si se quiere que `admin` vea metricas globales, se crea `ADMIN_DASHBOARD_ROLES`
   y se ajusta el nav (el nav ya filtra por rol por seccion; habria que partir "Administracion" en dos).
2. **Libreria de graficos?** Default: barras CSS sin dependencia. Si se prefieren lineas/areas, agregar `recharts` via
   `shadcn add chart` en una tarea T0 (toca `package.json`).
3. **Ventana de tendencia?** Default: 6 meses calendario, zona `America/Lima`, mes en curso parcial. Alternativa: 12 meses
   o ultimos 30 dias vs 30 anteriores (cambia `recentMonths`).
4. **Hay base de datos de integracion para tests?** Default: no, tests con `db` mockeado y revision manual del SQL
   contra datos del seed.
5. **Cuentan las ordenes `refunded` como ingreso?** Default: no (solo `paid`, coherente con 038/041). Si se quiere mostrar
   "reembolsado" como metrica aparte, va a Proximas fases.

## Proximas fases
- Rango de fechas y filtro por organizador/evento (`and created_at >= ...` en las queries).
- Top eventos y top organizadores por ingresos.
- Export CSV/PDF del resumen.
- Indice `(status, created_at)` en `orders` o vista materializada si el volumen lo exige.
- Metrica de reembolsos y comision devuelta.
