# Tablero de tareas y mejoras

Todos pueden agregar propuestas al final. Estados: `propuesta → aceptada → en curso → hecha / descartada`. Solo el responsable o DjMike323 marcan `hecha`, enlazando el commit/PR. Reglas en `PROTOCOLO.md`.

| # | Prioridad | Tarea / mejora | Propone | Responsable sugerido | Estado |
|---|---|---|---|---|---|
| 1 | P0 | Terminar la instancia duplicada de `HERMES_BRAIN_BRIDGE_REAL_WEB.py` y revisar por que el monitor no lo detecto | Muse | Claude | hecha — PID 4899 matado, `kill_duplicate_bridges()` agregado al monitor, monitor reiniciado (PID 27746) |
| 2 | P0 | Plan de actualizacion de Hermes **v0.16.0 → v0.22.x** (un gateway multiplexado; `sessions.auto_prune: false`) | Muse | Claude | en curso — plan escrito en `kai/knowledge/PLAN-UPGRADE-v0.16-a-v0.22.md`, 5 pasos + rollback. Espera aprobacion de DjMike323 para ejecutar |
| 3 | P1 | Unificar la memoria: que el perfil `mirofish` cree y use su `MEMORY.md`/`USER.md`/`state.db` en vez de archivos sueltos en `~/.hermes` | Muse | Claude | hecha — USER.md, MEMORY.md creados; state.db y decisions_executed.jsonl movidos a `profiles/mirofish/memories/`; symlinks para compatibilidad |
| 4 | P1 | Adoptar los **prompts canonicos v2.0** (Conductor/Writer/Analyst/Executor/router hibrido) y el par de umbrales canonico, eliminando la deriva entre las 5 copias del prompt del Conductor | Muse | Claude | en curso — constantes CANONICAL_PROMPTS y umbrales (0.80/0.65) agregados a order_processor.py. Falta: integrar en métodos existentes (espera acceso de Muse para cruzar contra código real) |
| 5 | P1 | Completar los 3 placeholders del motor KAI del PR #3: loop del Executor, triggers de cron y borrado masivo en KV; el motor aun no hace **ninguna** llamada a modelos | Muse | Claude | propuesta |
| 6 | P1 | Fusionar o cerrar el **PR #3** (`claude/hermes-trinity-production-oe9rdg`): lleva el ecosistema nuevo y `production` sigue en el commit del 6-oct | Muse | DjMike323 decide | propuesta |
| 7 | P1 | Reactivar herramientas caidas de Kai: Home Assistant, vision, messaging (deps del sistema) | Muse | Kai | bloqueada — HA necesita HASS_TOKEN (Mike), vision necesita OpenAI credits ($0), messaging necesita gateway activo |
| 8 | P2 | Borrar los **17 alias huerfanos** de perfiles inexistentes | Muse | Claude | hecha — 17 wrappers eliminados de `~/.local/bin/` (architect, debugger, sql-expert, etc.) |
| 9 | P2 | `npm audit fix` en workspaces web y ui-tui (23 vulnerabilidades) e instalar `agent-browser` | Muse | Claude | hecha — de 48 a 22 vulns (0 critical, 3 high en electron-builder — necesitan major upgrade manual) |
| 10 | P2 | Inicializar Skills Hub y agregar `GITHUB_TOKEN` al .env del perfil (subir el limite de 60 req/h) | Muse | Claude | hecha — GITHUB_TOKEN activado en .env, rate limit 60→5000 req/hr |
| 11 | P2 | Configurar tokens faltantes si se quieren esas funciones: Discord, xAI (x_search), OpenRouter (moa) | Muse | DjMike323 decide | propuesta |

<!-- Propuestas nuevas: agregar filas al final de la tabla. -->
