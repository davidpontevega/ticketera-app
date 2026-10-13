# Ticketera

Demo de una plataforma de venta de entradas para eventos (conciertos, deportes, teatro, ferias): catalogo publico, seleccion de entradas y asientos, pago con Stripe, "Mis entradas" y un panel para organizadores y administradores. Next.js 16 (App Router) con Clerk, Stripe y Postgres, desarrollado con **Spec Driven Development (SDD)** y agentes de Claude Code.

> Es una demo: no hay envio de correos, reembolsos ni despliegue a produccion configurado (ver [Limitaciones](#limitaciones-conocidas)).

## Que incluye

- **Catalogo publico**: home con destacados, tendencias y mas vendidos, busqueda y filtros en `/events`, detalle de evento. Solo se muestran eventos **publicados** de la base de datos.
- **Compra**: seleccion de entradas y asientos con mapa del recinto, checkout con **Stripe Checkout** (pago hospedado), confirmacion y emision de entradas con codigo unico (`TK-XXXXXXXX-01`).
- **Anti-sobreventa**: la disponibilidad se calcula en el servidor (ordenes pagadas y reservas pendientes) y un lock por evento evita vender dos veces el mismo asiento.
- **Mis entradas** (`/my-tickets`): ordenes pagadas del usuario autenticado.
- **Panel del organizador** (`/organizer`): metricas de ventas e ingresos, crear y editar eventos con sus tipos de entrada, publicar, despublicar, destacar y borrar.
- **Panel de administracion** (`/admin/users`, solo super admin): listar, invitar, cambiar el rol y eliminar usuarios.

## Stack

| Area | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Lenguaje | TypeScript |
| Estilos / UI | Tailwind CSS v4 + shadcn (Base UI) |
| Autenticacion | Clerk (email/password + Google) |
| Pagos | Stripe Checkout (modo test) |
| Base de datos | Postgres (Neon) + Drizzle ORM |
| Validacion | zod |
| Estado cliente | zustand (solo seleccion de entradas) |
| Testing | Vitest + React Testing Library |

## Inicio rapido

Requisitos: Node.js 20+, npm, un Postgres (por ejemplo un proyecto gratuito en [Neon](https://neon.tech)), una aplicacion de [Clerk](https://clerk.com) y una cuenta de [Stripe](https://stripe.com) en modo test.

```bash
npm install
cp .env.example .env        # y completar las variables (ver tabla abajo)
```

**1. Base de datos.** En la base de datos (Neon u otra) ejecutar una vez, a mano, porque `drizzle-kit` no gestiona extensiones:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Luego aplicar las migraciones y, opcionalmente, comprobar la conexion y el esquema:

```bash
npm run db:migrate
npm run db:verify     # inserta y borra filas de prueba para comprobar el esquema
```

**2. Usuario y catalogo.** Iniciar sesion una vez en la app (o crear el usuario en Clerk) para que el webhook lo sincronice a la tabla `users`, y despues sembrar el catalogo de ejemplo asignandolo a ese usuario:

```bash
SEED_ORGANIZER_EMAIL=tu-correo@ejemplo.com npm run db:seed
```

> **Atencion: el seed es destructivo.** Antes de sembrar **borra todas las filas de `orders`** (y en cascada sus `order_items` y `tickets`) para que las metricas del organizador arranquen en cero. Es idempotente para los eventos (no los duplica), pero **no lo ejecutes en una base de datos con compras que quieras conservar**. Con la DB vacia el catalogo se ve vacio y los detalles dan 404.

**3. Servidor de desarrollo y webhooks.**

```bash
npm run dev           # http://localhost:3000
```

En otra terminal, reenviar los webhooks de Stripe y copiar el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET` (reiniciar `npm run dev` despues de cambiar el `.env`):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

El webhook de Clerk necesita una URL publica (ver [Autenticacion con Clerk](#autenticacion-con-clerk)).

### Variables de entorno

Ver [`.env.example`](.env.example) para los comentarios completos.

| Variable | Para que |
|----------|----------|
| `DATABASE_URL` | Conexion a Postgres |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Claves de Clerk |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Firma del webhook `/api/webhooks/clerk` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Rutas propias de acceso (`/login`, `/register`) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe (`sk_test_...`), solo servidor |
| `STRIPE_WEBHOOK_SECRET` | Firma del webhook `/api/webhooks/stripe` (`whsec_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No se usa con Checkout hospedado |
| `SEED_ORGANIZER_EMAIL` | Solo para `npm run db:seed`: correo del usuario que sera dueno de los eventos sembrados |

### Scripts

| Script | Uso |
|--------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Servir el build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (modo watch); `npx vitest run` para una sola pasada |
| `npm run db:generate` | Genera una migracion de Drizzle a partir de los cambios en el esquema |
| `npm run db:migrate` | Aplica las migraciones a la base de datos |
| `npm run db:studio` | Drizzle Studio (explorador de la base de datos) |
| `npm run db:verify` | Comprueba la conexion y el esquema (inserta y borra filas de prueba) |
| `npm run db:seed` | Siembra los eventos de ejemplo (**borra las ordenes**, ver aviso arriba) |

Agregar componentes de shadcn: `npx shadcn@latest add <component>`.

## Roles y acceso

El rol vive en `users.role` y se asigna en el webhook de Clerk al crear el usuario.

| Rol | Puede |
|-----|-------|
| `customer` (por defecto) | Comprar y ver sus entradas |
| `organizer` | Lo anterior + `/organizer`: crear y administrar **sus** eventos |
| `admin` | Lo anterior, y ademas puede administrar los eventos de cualquier organizador |
| `super_admin` | Todo lo anterior + `/admin/users`: es el unico que gestiona usuarios (invitar, cambiar rol, eliminar) |

- El **super admin** no es una variable de entorno: es la constante `SUPER_ADMIN_EMAIL` en [`src/modules/user/constants/user.constants.ts`](src/modules/user/constants/user.constants.ts), y solo aplica si el correo esta verificado en Clerk. Cambiala por tu correo para administrar tu propia instancia.
- Los demas usuarios con rol (`admin` u `organizer`) los **invita** el super admin desde `/admin/users` (la invitacion de Clerk lleva el rol).
- `proxy.ts` exige sesion en `/my-tickets`, el checkout y la confirmacion, `/organizer` y `/admin`; el rol se verifica ademas en el servidor (`requireRole`).

## Pagos con Stripe

Flujo: el checkout crea una orden `pending` y redirige a Stripe Checkout; el webhook confirma el pago, pasa la orden a `paid` y emite las entradas en la misma transaccion (idempotente ante reintentos).

- Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
- En produccion registrar el endpoint `/api/webhooks/stripe` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`.
- Una reserva `pending` bloquea los asientos durante 31 minutos; si la sesion expira o se cancela, se liberan.

## Autenticacion con Clerk

La identidad de la app es [Clerk](https://clerk.com) (email/password + Google). Configuracion manual necesaria:

1. Crear una aplicacion en el dashboard de Clerk y habilitar **Email + Password** (con "Forgot password") y **Google** (User & Authentication -> Social connections). En desarrollo Clerk provee credenciales de Google compartidas; en produccion se cargan Client ID/Secret propios de Google Cloud en el dashboard de Clerk (no en el repo).
2. Copiar las keys del dashboard al `.env` (variables `NEXT_PUBLIC_CLERK_*` y `CLERK_SECRET_KEY`).
3. En Clerk -> Webhooks, agregar el endpoint `https://<host>/api/webhooks/clerk` con los eventos `user.created`, `user.updated`, `user.deleted`, y copiar el Signing Secret a `CLERK_WEBHOOK_SIGNING_SECRET`.
4. En local, exponer `localhost:3000` con un tunel (`ngrok http 3000` o `cloudflared tunnel --url http://localhost:3000`) y usar esa URL publica en el endpoint del webhook: Clerk no puede llamar a `localhost` directo. La pestana "Testing" del endpoint permite reenviar eventos por el tunel.

> **Nota:** el auth mock anterior (spec 012/016) fue retirado (spec 037). Los navegadores que lo usaron pueden conservar las claves `ticketera-auth` y `ticketera-dev-mail` en `localStorage`; ya no se leen y se pueden borrar desde DevTools.

## Estructura

Organizacion **por modulo de dominio**. `src/app` es solo routing; la logica vive en `src/modules`.

```
src/
  app/                  # routing: paginas, layouts y route handlers (/api/...)
  proxy.ts              # proteccion de rutas por sesion (Clerk)
  modules/<domain>/     # admin, auth, catalog, event, order, organizer, ticket, user
                        #   components, hooks, services, schemas, actions, db, types, index.ts
  components/ui/        # primitivos de shadcn
  components/shared/    # componentes reutilizables sin dominio
  db/schema.ts          # reexporta las tablas de Drizzle
  lib/                  # db, stripe, utils
  hooks/                # hooks genericos
drizzle/                # migraciones SQL generadas
scripts/                # seed-events.ts, verify-db.ts
docs/
  SETUP.md              # reglas del proyecto
  SYSTEM_DESIGN.md      # indice: donde esta definida cada decision de arquitectura
  specs/                # specs SDD (NNN-<slug>.md)
.claude/agents/         # agentes SDD
```

Las reglas completas (naming, estructura, SOLID/DRY/KISS/YAGNI, reuso, testing) estan en [`docs/SETUP.md`](docs/SETUP.md), y el mapa de arquitectura (base de datos, pagos, autorizacion, autenticacion) en [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md). Lectura obligatoria antes de aportar codigo.

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

## Limitaciones conocidas

- **Sin correos**: no se envia confirmacion por email; las entradas se ven en `/events/<slug>/confirmation` y `/my-tickets`.
- **Sin reembolsos, transferencia de entradas ni validacion de QR en puerta.**
- **Pago confirmado sobre una orden ya cancelada** (por ejemplo, reemplazada por un reintento del mismo comprador): no emite tickets y requiere reconciliacion manual o reembolso desde Stripe.
- **Sin despliegue configurado**: faltan produccion de Postgres, claves live de Clerk/Stripe y los webhooks de produccion.
- **Metricas del organizador** en PEN y sin desglose por tipo de entrada ni filtro de fechas.

## Skills recomendadas para Claude Code

Estas skills/plugins complementan el flujo del proyecto. Los comandos `/plugin` se ejecutan dentro de Claude Code.

| Skill | Para que sirve | Instalacion |
|-------|----------------|-------------|
| [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Inteligencia de diseno: estilos de UI, paletas, pares tipograficos y guias de UX. | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| frontend-design (Anthropic) | Interfaces frontend con diseno cuidado y sin estetica generica. | `/plugin install frontend-design@claude-plugins-official` |
| [Vercel Labs agent-skills](https://github.com/vercel-labs/agent-skills) | Buenas practicas de React/Next.js de Vercel (performance, data fetching, bundle size). | `npx skills add vercel-labs/agent-skills` |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Fuerza la solucion mas simple que funciona: YAGNI, stdlib y features nativas antes que dependencias. Encaja con KISS/YAGNI del `SETUP.md`. | `/plugin marketplace add DietrichGebert/ponytail` y `/plugin install ponytail@ponytail` |
| [caveman](https://github.com/JuliusBrussee/caveman) | Respuestas comprimidas del agente: menos tokens, misma sustancia tecnica. Alarga las sesiones. | `/plugin marketplace add JuliusBrussee/caveman` y `/plugin install caveman@caveman` |
| [superpowers](https://github.com/obra/superpowers) | Biblioteca de skills de ingenieria: brainstorming, planes, TDD, debugging sistematico, subagentes. | `/plugin install superpowers@claude-plugins-official` |
