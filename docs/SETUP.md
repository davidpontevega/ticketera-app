# SETUP.md — Reglas de proyecto

Este documento define la estructura de carpetas, las buenas practicas de desarrollo y la metodologia de trabajo para este proyecto Next.js (App Router). Es de lectura obligatoria antes de aportar codigo.

---

## 1. Estructura de carpetas

### 1.1 Principio general

Todo el codigo de dominio (logica de negocio, UI especifica de un dominio, hooks, servicios, schemas, estado) se organiza **por modulo de dominio**, no por tipo de archivo. `src/app` se reserva exclusivamente para el enrutamiento de Next.js (App Router): layouts, pages, route handlers, loading/error boundaries. Un archivo dentro de `src/app` no debe contener logica de negocio: debe importar esa logica desde el modulo correspondiente en `src/modules`.

### 1.2 Reglas de naming

- **Idioma:** todos los nombres de carpetas, archivos, variables, funciones, tipos, etc. van en **ingles**.
- **Carpetas de modulo:** kebab-case, singular, nombre del dominio (`user`, `product`, `order`), no `users` ni `Products`.
- **Archivos:** kebab-case siempre. Ejemplos: `user-card.tsx`, `user.service.ts`, `use-user-query.ts`, `user.schema.ts`.
  - Esto aplica tambien a los componentes de shadcn, que ya siguen esta convencion (`button.tsx`, `dialog.tsx`).
- **Componentes React (identificador exportado):** PascalCase. Ejemplo: archivo `user-card.tsx` exporta `export function UserCard() {}`.
- **Hooks:** camelCase con prefijo `use`, tanto en archivo como en identificador. Archivo `use-auth.ts` exporta `useAuth()`.
- **Tipos e interfaces:** PascalCase. Ejemplo: `UserDto`, `ProductEntity`, `CreateOrderInput`.
- **Funciones y variables:** camelCase.
- **Constantes globales:** UPPER_SNAKE_CASE.
- **Servicios:** sufijo `.service.ts` (ej. `user.service.ts`), funciones que encapsulan llamadas HTTP (axios) o logica de acceso a datos.
- **Schemas de validacion (zod):** sufijo `.schema.ts` (ej. `user.schema.ts`).
- **Store (zustand):** sufijo `.store.ts` (ej. `user.store.ts`).

### 1.3 Estructura interna de un modulo

Cada modulo agrupa unicamente lo que le pertenece a ese dominio. No todo modulo necesita todas las subcarpetas; se crean solo las que se usan (YAGNI).

```
src/modules/<domain>/
  components/        # UI especifica del dominio
  hooks/              # hooks especificos del dominio (ej. use-user-query.ts)
  services/           # llamadas a API con axios
  schemas/            # validaciones zod
  store/              # estado zustand del dominio (si aplica)
  types/              # tipos/interfaces del dominio
  index.ts            # barrel export publico del modulo
```

### 1.4 Carpetas compartidas (fuera de `src/modules`)

```
src/app/              # SOLO routing: layout.tsx, page.tsx, route.ts, loading.tsx, error.tsx
src/components/ui/    # primitivos de shadcn (no tocar la logica, solo estilos/variants)
src/components/shared/# componentes reutilizables que NO pertenecen a un dominio especifico
src/lib/               # utils.ts, instancia de axios, query-client, etc.
src/hooks/             # hooks genericos/reutilizables (no atados a un dominio)
src/store/              # estado global zustand compartido entre modulos (usar solo si aplica a mas de un modulo)
```

### 1.5 Ejemplo completo

Dominio "user" consumido desde la ruta `/users`:

```
src/
  app/
    users/
      page.tsx                 # importa <UserList /> desde @/modules/user
  modules/
    user/
      components/
        user-card.tsx           # export function UserCard()
        user-list.tsx           # export function UserList()
      hooks/
        use-user-query.ts       # export function useUserQuery()
      services/
        user.service.ts         # export const userService = { getAll, getById, ... }
      schemas/
        user.schema.ts          # export const userSchema = z.object({...})
      store/
        user.store.ts           # export const useUserStore = create(...)
      types/
        user.types.ts           # export interface User {...}
      index.ts                  # export * from "./components/user-list"; ...
```

`app/users/page.tsx`:

```tsx
import { UserList } from "@/modules/user";

export default function UsersPage() {
  return <UserList />;
}
```

---

## 2. Buenas practicas

Se aplican **siempre**, sin excepcion, al crear componentes (shadcn o propios), funciones, hooks, servicios, schemas o store:

- **SOLID** — cada pieza (componente, hook, servicio) tiene una sola responsabilidad; se depende de abstracciones (tipos/interfaces), no de implementaciones concretas.
- **DRY** — no se duplica logica. Si una misma necesidad aparece dos veces, se extrae a una funcion, hook o componente compartido.
- **KISS** — la solucion mas simple que resuelve el problema. Nada de abstracciones o capas que no se necesitan hoy.
- **YAGNI** — no se construye para un caso hipotetico futuro. Se construye lo que el requerimiento actual pide.

### 2.1 Antes de crear un componente

1. **Verificar si el componente existe en shadcn.** Si existe, se instala con `npx shadcn@latest add <component>` y se usa/extiende, nunca se reescribe desde cero.
2. Si **no existe en shadcn**, se crea a mano pensando en que sea **reutilizable**: sin logica de negocio embebida, props claras, ubicado en `src/components/shared` si no pertenece a un solo dominio, o en `modules/<domain>/components` si es especifico de ese dominio.

### 2.2 Antes de crear cualquier pieza de codigo

Antes de escribir un componente, funcion, hook o servicio nuevo, se debe **verificar que no exista ya** uno equivalente en el proyecto (buscar en `src/components/ui`, `src/components/shared`, `src/hooks`, `src/lib` y en el modulo correspondiente). Si existe algo parecido, se reutiliza o se extiende; no se duplica.

---

## 3. Metodologia de trabajo: SDD (Spec Driven Development)

El desarrollo de cada feature/tarea sigue un flujo dirigido por especificacion, no por codigo directo. Se definen 4 roles/agentes dentro de este flujo:

1. **Orquestador** — recibe el requerimiento, decide el orden de trabajo, coordina el paso entre los demas agentes y gestiona las iteraciones (si el reviewer rechaza, reenvia al developer; si la spec queda ambigua, reenvia al spec agent).
2. **Spec** — traduce el requerimiento en una especificacion tecnica clara y verificable *antes* de escribir codigo: alcance, estructura de carpetas/modulo afectado, contratos (tipos, schemas zod, endpoints), criterios de aceptacion.
3. **Developer** — implementa exactamente lo definido en la spec, siguiendo las reglas de estructura de carpetas y buenas practicas de la seccion 1 y 2.
4. **Reviewer** — valida la implementacion contra la spec: correctitud, adherencia a SOLID/DRY/KISS/YAGNI, naming, reutilizacion de componentes/hooks existentes, y cobertura de tests donde corresponda. Aprueba o devuelve al developer con hallazgos puntuales.

Flujo: `Orquestador → Spec → Aprobacion humana → Developer → Reviewer → (aprueba | vuelve a Developer)`.

La aprobacion humana de la spec es **bloqueante**: ningun developer empieza sin ella. Los agentes viven en `.claude/agents/` (`orchestrator`, `spec`, `developer`, `reviewer`) y las specs en `docs/specs/`.

### 3.1 Unit testing

- Framework: **Vitest + React Testing Library**.
- Se agregan tests unitarios en las secciones que lo requieren segun criterio de la spec/reviewer: logica de negocio (services, schemas, stores, hooks con logica) y componentes con comportamiento condicional relevante. No se exige test para componentes puramente presentacionales sin logica.
- Archivo de test junto al archivo que prueba, sufijo `.test.ts` / `.test.tsx` (ej. `user.service.test.ts`).
