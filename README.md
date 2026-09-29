# next-js-template

Template base para proyectos Next.js listo para desarrollar con Claude Code usando **Spec Driven Development (SDD)**. No esta atado a ningun sector de negocio: trae el stack, las reglas de arquitectura y los agentes para empezar a construir cualquier producto.

## Stack

| Area | Libreria |
|------|----------|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Lenguaje | TypeScript |
| Estilos / UI | Tailwind CSS v4 + shadcn |
| Data fetching | axios + TanStack Query |
| Tablas | TanStack Table |
| Validacion | zod |
| Estado | zustand |
| Testing | Vitest + React Testing Library (convencion definida, pendiente de instalar) |

## Inicio rapido

Requisitos: Node.js 20+ y npm.

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

| Script | Uso |
|--------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Servir el build |
| `npm run lint` | ESLint |

Agregar componentes de shadcn: `npx shadcn@latest add <component>`.

### Datos de prueba

La app es solo UI/UX, sin backend. Cuentas (contraseñas hasheadas con SHA-256), sesion, pedidos, eventos del
organizador, seleccion de entradas y correos simulados se guardan en `localStorage` con el prefijo `ticketera-`.

- Cuenta demo: `demo@ticketera.pe` / `Demo1234`.
- `/dev/inbox`: bandeja de correos simulados (por ejemplo, el enlace de "Olvidaste tu contraseña").
- `/dev/storage`: ver y borrar los datos guardados, o reiniciar la app (link "Datos de prueba" en el footer).

### Iniciar sesion con Google (opcional)

Sin configuracion, "Continuar con Google" abre un selector de cuentas simulado. Para usar Google real
(Google Identity Services):

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crear un proyecto y configurar la
   pantalla de consentimiento OAuth (tipo "Externo", modo de prueba, agregando tu correo como usuario de prueba).
2. Crear credenciales → **ID de cliente de OAuth** → tipo **Aplicacion web**.
3. En **Origenes de JavaScript autorizados** agregar `http://localhost:3000` (y el dominio donde se despliegue).
   No hace falta URI de redireccion: se usa el popup de Google.
4. Crear `.env.local` en la raiz y reiniciar `npm run dev`:

   ```bash
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   ```

Limitacion: sin backend, la credencial (JWT) de Google se decodifica en el navegador **sin verificar su firma**.
Sirve para probar el flujo, no para produccion.

## Estructura

Organizacion **por modulo de dominio**. `src/app` es solo routing; la logica vive en `src/modules`.

```
src/
  app/                  # routing (layout, page, route, loading, error)
  modules/<domain>/     # components, hooks, services, schemas, store, types, index.ts
  components/ui/        # primitivos de shadcn
  components/shared/    # componentes reutilizables sin dominio
  lib/                  # utils, cliente axios, query client
  hooks/                # hooks genericos
  store/                # estado global compartido
docs/
  SETUP.md              # reglas del proyecto
  specs/                # specs SDD (NNN-<slug>.md)
.claude/agents/         # agentes SDD
```

Las reglas completas (naming, estructura, SOLID/DRY/KISS/YAGNI, reuso, testing) estan en [`docs/SETUP.md`](docs/SETUP.md). Lectura obligatoria antes de aportar codigo.

## Flujo de trabajo: SDD con agentes

El proyecto incluye 4 agentes en `.claude/agents/`:

| Agente | Rol |
|--------|-----|
| `orchestrator` | Punto de entrada. Decide si la tarea va en modo build (cambio chico y claro) o en SDD, y coordina a los demas agentes. |
| `spec` | Escribe la spec en `docs/specs/` con alcance alcanzable en una sesion, reuso detectado, tareas y criterios de aceptacion. |
| `developer` | Implementa solo los archivos de su tarea. Varios developers pueden correr en paralelo si sus archivos no se pisan. |
| `reviewer` | Valida contra la spec y `docs/SETUP.md` (sin editar). Si encuentra problemas, vuelve al developer; maximo 3 iteraciones. |

```
orchestrator → spec → APROBACION HUMANA → developer(s) → reviewer → aprobado | vuelve a developer
```

La aprobacion humana de la spec es **bloqueante**: ningun developer arranca sin ella.

Para usar el orquestador como sesion principal (necesario para que pueda lanzar a los otros agentes):

```bash
claude --agent orchestrator
```

## Skills recomendadas para Claude Code

Estas skills/plugins complementan el flujo del template. Los comandos `/plugin` se ejecutan dentro de Claude Code.

| Skill | Para que sirve | Instalacion |
|-------|----------------|-------------|
| [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Inteligencia de diseno: estilos de UI, paletas, pares tipograficos y guias de UX. | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| frontend-design (Anthropic) | Interfaces frontend con diseno cuidado y sin estetica generica. | `/plugin install frontend-design@claude-plugins-official` |
| [Vercel Labs agent-skills](https://github.com/vercel-labs/agent-skills) | Buenas practicas de React/Next.js de Vercel (performance, data fetching, bundle size). | `npx skills add vercel-labs/agent-skills` |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Fuerza la solucion mas simple que funciona: YAGNI, stdlib y features nativas antes que dependencias. Encaja con KISS/YAGNI del `SETUP.md`. | `/plugin marketplace add DietrichGebert/ponytail` y `/plugin install ponytail@ponytail` |
| [caveman](https://github.com/JuliusBrussee/caveman) | Respuestas comprimidas del agente: menos tokens, misma sustancia tecnica. Alarga las sesiones. | `/plugin marketplace add JuliusBrussee/caveman` y `/plugin install caveman@caveman` |
| [superpowers](https://github.com/obra/superpowers) | Biblioteca de skills de ingenieria: brainstorming, planes, TDD, debugging sistematico, subagentes. | `/plugin install superpowers@claude-plugins-official` |
