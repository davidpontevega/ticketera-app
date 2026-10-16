# Reporte PDF descargable del dashboard global del admin

Estado: aprobada
Aprobacion humana: aprobada (2026-10-16, preguntas abiertas aceptadas con sus defaults)

## Objetivo

Agregar un boton "Exportar PDF" al dashboard global del admin (spec `045-admin-global-dashboard.md`) que descarga un reporte A4 con las mismas metricas que muestra la pantalla. Depende de 045: el tipo de metricas y la ruta del dashboard los define esa spec; aqui solo se consumen. No se agregan consultas ni calculos nuevos: el PDF se arma con el objeto de metricas que ya recibe el dashboard.

Referencia (solo lectura, no se copia codigo): la rama `profesor/main` resuelve lo mismo con `admin-report.ts` (modelo puro de KPIs), `admin-pdf-draw.ts` (jspdf, ~585 lineas, 3 paginas con graficos vectoriales) y `admin-export.ts` (fachada de descarga). Su separacion modelo puro / dibujo / descarga es buena y se adopta; su alcance (graficos, resumen ejecutivo por plantilla, Excel) no.

Seguridad: el PDF se genera en el cliente con datos que la pagina admin ya cargo bajo el guard de rol (ver `docs/system-design.md` solo si 045 cambia la autorizacion; este modulo no agrega rutas ni endpoints).

### Evaluacion de la libreria

| Opcion | Veredicto |
|---|---|
| `jspdf` (la del profesor) | Elegida. Archivo real descargable, texto vectorial, sin servidor, se carga con `import()` dinamico (no pesa en el bundle de la pagina), y el documento se puede probar en Vitest en entorno node. |
| `window.print()` (ya usado en `order-ticket-viewer.tsx`) | Descartada: abre el dialogo de impresion, no descarga un archivo y exige CSS de impresion que depende del navegador. |
| `@react-pdf/renderer` / `pdfkit` / generacion en servidor | Descartadas: mas peso o mas superficie (route handler + auth) para un reporte tabular. |

`jspdf` no esta en `package.json` del proyecto: se agrega en T0.

## Alcance

- Incluye:
  - Dependencia `jspdf`.
  - Modelo puro del reporte: de las metricas de 045 a secciones `{ title, rows: [label, value] }` (+ tablas mensuales si 045 las expone).
  - Dibujo A4 con `jspdf`: encabezado con titulo y fecha de Lima, secciones como tarjetas/tablas, pie con numeracion. Salto de pagina automatico si el contenido no cabe.
  - Boton "Exportar PDF" en el dashboard, con estado de carga y manejo de error.
  - Nombre de archivo `ticketera-dashboard-YYYY-MM-DD.pdf`.
- No incluye:
  - Graficos en el PDF (las series mensuales van como tabla). Ver Proximas fases.
  - Excel, CSV ni resumen ejecutivo/proyecciones.
  - Fuente personalizada (Helvetica base; texto fuera de Latin-1 se normaliza).
  - Endpoint de servidor, envio por correo o programacion.
  - Nuevas metricas o consultas (son de 045).

## Reutilizar

| Que | Donde | Uso |
|---|---|---|
| Tipo de metricas y datos del dashboard | spec 045 (`src/modules/admin/...`, nombre exacto lo fija 045) | Entrada del modelo del reporte |
| `formatEventPrice` | `src/modules/event` (via `@/modules/event`) | Formato de montos en soles; `Intl.NumberFormat("es-PE")` ya usado en `organizer-kpis.tsx` para conteos |
| Fecha de Lima (`toLimaDate`/equivalente) | buscar en `src/modules/event` y `src/lib`; si no existe, `Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" })` dentro del modelo | Fecha del encabezado y del nombre del archivo |
| `Button` | `src/components/ui/button.tsx` | Boton de exportar |
| Icono `Download` de lucide-react | ya usado en `order-ticket-viewer.tsx` | Icono del boton |
| Labels de estados y roles | los que use 045 para el dashboard | Mismas etiquetas en pantalla y PDF (DRY) |

No existe en el proyecto ningun helper de PDF ni de descarga de archivos: se crea el minimo (el `save` de jspdf basta, no hace falta helper propio).

## Archivos

| Archivo | Accion | Tarea |
|---|---|---|
| `package.json`, `package-lock.json` | modificado (`npm i jspdf`) | T0 |
| `src/modules/admin/utils/admin-report.utils.ts` | nuevo: `buildAdminReport(metrics, now)`, `reportFileName(now)` | T1 |
| `src/modules/admin/utils/admin-report.utils.test.ts` | nuevo | T1 |
| `src/modules/admin/utils/admin-pdf.ts` | nuevo: `buildAdminPdf(report)` (devuelve el `jsPDF` sin guardar) y `downloadAdminReport(metrics)` (fachada: `now`, build, `save`) | T2 |
| `src/modules/admin/utils/admin-pdf.test.ts` | nuevo (smoke, `// @vitest-environment node`) | T2 |
| `src/modules/admin/components/admin-export-button.tsx` | nuevo | T3 |
| `src/modules/admin/components/admin-export-button.test.tsx` | nuevo | T3 |
| `src/modules/admin/index.ts` | modificado: exporta el boton | T3 |
| Componente del dashboard de 045 | modificado: monta `<AdminExportButton />` | T3 (ver Preguntas abiertas 1) |

Estructura segun SETUP.md (`utils/` dentro del modulo, kebab-case, tests junto al archivo). Si 045 usa otra subcarpeta para helpers del admin, T1/T2 siguen la de 045.

## Criterios de aceptacion

- AC1: `jspdf` queda en `dependencies`; solo se importa con `await import("jspdf")` dentro de `buildAdminPdf`, y los demas imports de jspdf son `import type`.
- AC2: `buildAdminReport(metrics, now)` es pura (sin DOM, sin jspdf) y devuelve `{ title, generatedLabel, sections }`. Cada KPI visible en el dashboard de 045 aparece exactamente una vez, con la misma etiqueta y formato que en pantalla. Montos con `formatEventPrice`, conteos con `es-PE`.
- AC3: `generatedLabel` usa fecha y hora de Lima (`America/Lima`), no la del navegador: `2026-10-12T19:05:00Z` produce `2026-10-12` y `14:05`; `2026-11-01T03:00:00Z` produce `2026-10-31` y `22:00`.
- AC4: `reportFileName(now)` devuelve `ticketera-dashboard-YYYY-MM-DD.pdf` con la fecha de Lima.
- AC5: `buildAdminPdf` crea un `jsPDF({ unit: "mm", format: "a4" })` vertical con encabezado (`Ticketera`, titulo, fecha), una seccion por bloque del reporte, y pie `Pagina X de N` en todas las paginas. Con muchas filas agrega paginas sin cortar ni solapar texto.
- AC6: Todo texto pasa por una funcion unica que elimina caracteres fuera de Latin-1 (Helvetica base no los dibuja) y normaliza el espacio duro U+00A0 de `Intl`. Texto minimo 9 pt, texto oscuro sobre fondo claro.
- AC7: Con metricas vacias (todo en 0, series sin datos) el PDF se genera sin error, con al menos 1 pagina, mostrando ceros o "Sin datos" en tablas vacias.
- AC8: `downloadAdminReport` crea un unico `now`, arma el reporte y llama `doc.save(reportFileName(now))`.
- AC9: `AdminExportButton` muestra "Exportar PDF" con icono; al hacer clic queda `disabled` con texto "Generando..." hasta terminar; si falla, muestra un mensaje de error accesible (`role="alert"`) y se rehabilita. No hay doble descarga por doble clic.
- AC10: El boton aparece en el dashboard global del admin (045) y en ninguna otra pagina; no se agregan rutas ni endpoints.
- AC11: `npx vitest run`, `npm run lint` y `npm run build` pasan.
- AC12 (manual): en `/admin/dashboard`, "Exportar PDF" descarga el archivo y sus cifras coinciden con la pantalla. Con una base sin ordenes el PDF tambien se descarga.

## Tests requeridos

Vitest, junto al archivo. Los montos esperados se construyen con `formatEventPrice`, nunca con espacio ASCII fijo (ICU usa U+00A0).

- `admin-report.utils.test.ts` (T1): estructura y orden de secciones; cada KPI una sola vez; formato de montos y conteos; fecha de Lima con los dos instantes de AC3 (incluido el cruce de dia); `reportFileName`; metricas vacias.
- `admin-pdf.test.ts` (T2): primera linea `// @vitest-environment node`; sin mocks de jsPDF. Con reporte tipico: `getNumberOfPages() >= 1`, `output()` contiene el titulo y `Pagina 1 de`. Con un reporte de 200 filas: mas de 1 pagina y el pie dice `de {N}` con N real. Con texto con `…` y emoji: no lanza y la funcion de limpieza devuelve solo Latin-1. Vacio: no lanza. (`output()` contiene texto en claro solo si no se activa `compress`; no activarlo.)
- `admin-export-button.test.tsx` (T3): mock de `downloadAdminReport`. Clic llama una vez y deshabilita durante la espera; error muestra `role="alert"` y rehabilita; exito rehabilita sin alerta.

## Tareas

### T0 — Dependencia
- Archivos: `package.json`, `package-lock.json`
- Depende de: — (y de que 045 este implementada para T3)
- Paralelizable: no (base)
- Cubre: AC1 (parcial)

### T1 — Modelo puro del reporte
- Archivos: `src/modules/admin/utils/admin-report.utils.ts`, `src/modules/admin/utils/admin-report.utils.test.ts`
- Depende de: T0 (por orden de instalacion, no usa jspdf), 045 (tipo de metricas)
- Paralelizable: si (con T2 si se acuerda primero el tipo `AdminReport`, definido en T1; si no, T2 espera)
- Cubre: AC2, AC3, AC4, AC7

### T2 — Dibujo y descarga del PDF
- Archivos: `src/modules/admin/utils/admin-pdf.ts`, `src/modules/admin/utils/admin-pdf.test.ts`
- Depende de: T0, T1 (tipo `AdminReport` y `reportFileName`)
- Paralelizable: no (consume el tipo de T1)
- Cubre: AC1, AC5, AC6, AC7, AC8

### T3 — Boton e integracion en el dashboard
- Archivos: `src/modules/admin/components/admin-export-button.tsx`, `src/modules/admin/components/admin-export-button.test.tsx`, `src/modules/admin/index.ts`, y el componente del dashboard de 045
- Depende de: T2, 045
- Paralelizable: no
- Cubre: AC9, AC10, AC11, AC12

Orden efectivo: T0, T1, T2, T3 (cadena corta; solo hay paralelismo marginal entre T1 y el inicio de T2). 4 tareas.

## Preguntas abiertas

1. Tipo y ubicacion de las metricas, y archivo del dashboard: dependen de 045, que se escribe en paralelo. Default: T1 recibe el tipo exportado por 045 y T3 edita el componente que 045 declare como dashboard. Si 045 cambia de nombre o ubicacion, se ajustan las rutas de esta spec antes de aprobar.
2. Series mensuales (si 045 las incluye): default, tabla "Mes / valor" sin grafico ni proyeccion. Alternativa: grafico vectorial como hace el profesor (+1 archivo de geometria y ~1 tarea mas).
3. Fecha: default ISO (`2026-10-12`) en encabezado y archivo. Alternativa `12 oct 2026`.
4. Fuente: default Helvetica (sin tildes problematicas, Latin-1 cubre es-PE). Incrustar fuente de marca queda fuera.
5. Mes en curso parcial en tendencias: default, se muestra tal cual con la nota "mes en curso, parcial" solo si 045 expone esa serie.

## Proximas fases

- Graficos vectoriales (linea/barras) en el PDF.
- Exportar a Excel/CSV.
- Resumen ejecutivo por plantilla y proyeccion del trimestre.
- Fuente de marca incrustada.
