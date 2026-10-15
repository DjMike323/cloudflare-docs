# Tablero de tareas y mejoras

Todos pueden agregar propuestas al final. Estados: `propuesta → aceptada → en curso → hecha / descartada`. Solo el responsable o DjMike323 marcan `hecha`, enlazando el commit/PR. Reglas en `PROTOCOLO.md`.

| # | Prioridad | Tarea / mejora | Propone | Responsable sugerido | Estado |
|---|---|---|---|---|---|
| 1 | P0 | Terminar la instancia duplicada de `HERMES_BRAIN_BRIDGE_REAL_WEB.py` y revisar por que el monitor no lo detecto | Muse | Kai | propuesta |
| 2 | P0 | Plan de actualizacion de Hermes **v0.16.0 → v0.22.x** (un gateway multiplexado; `sessions.auto_prune: false`) | Muse | Kai + Claude | propuesta |
| 3 | P1 | Unificar la memoria: que el perfil `mirofish` cree y use su `MEMORY.md`/`USER.md`/`state.db` en vez de archivos sueltos en `~/.hermes` | Muse | Kai | propuesta |
| 4 | P1 | Adoptar los **prompts canonicos v2.0** (Conductor/Writer/Analyst/Executor/router hibrido) y el par de umbrales canonico, eliminando la deriva entre las 5 copias del prompt del Conductor | Muse | Claude | propuesta |
| 5 | P1 | Completar los 3 placeholders del motor KAI del PR #3: loop del Executor, triggers de cron y borrado masivo en KV; el motor aun no hace **ninguna** llamada a modelos | Muse | Claude | propuesta |
| 6 | P1 | Fusionar o cerrar el **PR #3** (`claude/hermes-trinity-production-oe9rdg`): lleva el ecosistema nuevo y `production` sigue en el commit del 6-oct | Muse | DjMike323 decide | propuesta |
| 7 | P1 | Reactivar herramientas caidas de Kai: Home Assistant, vision, messaging (deps del sistema) | Muse | Kai | propuesta |
| 8 | P2 | Borrar los **17 alias huerfanos** de perfiles inexistentes | Muse | Kai | propuesta |
| 9 | P2 | `npm audit fix` en workspaces web y ui-tui (23 vulnerabilidades) e instalar `agent-browser` | Muse | Kai | propuesta |
| 10 | P2 | Inicializar Skills Hub y agregar `GITHUB_TOKEN` al .env del perfil (subir el limite de 60 req/h) | Muse | Kai | propuesta |
| 11 | P2 | Configurar tokens faltantes si se quieren esas funciones: Discord, xAI (x_search), OpenRouter (moa) | Muse | DjMike323 decide | propuesta |

<!-- Propuestas nuevas: agregar filas al final de la tabla. -->
