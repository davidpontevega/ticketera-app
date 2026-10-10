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

### Catalogo de eventos (requiere seed)

El catalogo publico (home, `/events`, detalle y compra) lee los eventos **publicados de la base de datos**. El seed no corre solo: con la DB vacia el catalogo se ve vacio y los detalles dan 404. Para cargar los eventos de ejemplo:

```bash
SEED_ORGANIZER_EMAIL=organizador@ejemplo.com npm run db:seed
```

| Script | Uso |
|--------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Servir el build |
| `npm run lint` | ESLint |

Agregar componentes de shadcn: `npx shadcn@latest add <component>`.

## Autenticacion con Clerk

La identidad de la app es [Clerk](https://clerk.com) (email/password + Google). Esta seccion documenta la
configuracion manual necesaria.

Pasos:

1. Crear una aplicacion en el dashboard de Clerk y habilitar **Email + Password** y **Google** (User & Authentication
   -> Social connections). En desarrollo Clerk provee credenciales de Google compartidas; en produccion se cargan
   Client ID/Secret propios de Google Cloud en el dashboard de Clerk (no en el repo).
2. Copiar las keys del dashboard a `.env.local` (ver variables `NEXT_PUBLIC_CLERK_*` y `CLERK_SECRET_KEY` en
   `.env.example`).
3. En Clerk -> Webhooks, agregar el endpoint `https://<host>/api/webhooks/clerk` con los eventos `user.created`,
   `user.updated`, `user.deleted`, y copiar el Signing Secret a `CLERK_WEBHOOK_SIGNING_SECRET`.
4. En local, exponer `localhost:3000` con un tunel (`ngrok http 3000` o `cloudflared tunnel --url
   http://localhost:3000`) y usar esa URL publica en el endpoint del webhook: Clerk no puede llamar a `localhost`
   directo. La pestaña "Testing" del endpoint permite reenviar eventos por el tunel.
5. Correr `npm run db:migrate` para aplicar la migracion que agrega `deleted_at` a `users`.

> **Nota:** el auth mock (spec 012/016) fue retirado (spec 037). Los navegadores que lo usaron pueden conservar las
> claves `ticketera-auth` y `ticketera-dev-mail` en `localStorage`; ya no se leen y se pueden borrar desde DevTools.

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
