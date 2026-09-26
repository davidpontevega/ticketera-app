@AGENTS.md

## Reglas del proyecto

Lee `docs/SETUP.md` antes de escribir codigo: estructura por modulos (`src/modules/<domain>`, `src/app` solo routing), naming, SOLID/DRY/KISS/YAGNI, reuso obligatorio (revisar shadcn y el proyecto antes de crear cualquier componente, hook o funcion) y testing con Vitest + React Testing Library.

@docs/SETUP.md

## Agentes SDD (`.claude/agents/`)

- `orchestrator` — punto de entrada. Decide modo build vs SDD y coordina a los demas. Correrlo como hilo principal: `claude --agent orchestrator` (un subagente no puede lanzar otros subagentes).
- `spec` — escribe la spec en `docs/specs/NNN-<slug>.md` con alcance alcanzable en una sesion, tareas con archivos owner y criterios de aceptacion.
- `developer` — implementa solo los archivos de su tarea; varios pueden correr en paralelo si sus archivos son disjuntos.
- `reviewer` — valida contra la spec y `docs/SETUP.md`, sin editar. Loop developer → reviewer, maximo 3 iteraciones.

**Bloqueante:** ninguna spec pasa a `developer` sin aprobacion humana explicita (`Aprobacion humana: aprobada` en la seccion "Estado" de la spec).
