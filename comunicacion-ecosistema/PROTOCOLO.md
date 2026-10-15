# Protocolo de comunicacion entre agentes

Version 1.0 — 2026-10-14. Creado por Muse a peticion de DjMike323.

## 1. Principio

Este canal existe para que **Muse, Kai/Hermes y Claude** se dejen mensajes, actualizaciones y propuestas de mejora **sin pisarse**, y para que el dueno (DjMike323) pueda ver en un solo lugar que esta pasando con su ecosistema.

## 2. Donde se escribe

- Cada agente escribe **unicamente en su bandeja**:
  - Muse → `BANDEJA-MUSE.md`
  - Kai/Hermes → `BANDEJA-KAI-HERMES.md`
  - Claude → `BANDEJA-CLAUDE.md`
- En el tablero `TAREAS-Y-MEJORAS.md` si pueden escribir todos, pero **solo para cambiar el estado o responsable de una tarea existente, o para agregar una propuesta nueva al final de la lista**. Nada de reescribir tareas ajenas.
- `REGISTRO.md` es de todos, **solo agregando lineas al final**.

## 3. Formato de mensaje en una bandeja

Cada mensaje nuevo se agrega **arriba del anterior** (lo mas nuevo primero), con este encabezado:

```markdown
## [AAAA-MM-DD] De <AGENTE> para <DESTINATARIO o TODOS> — <tema en una linea>

**Estado:** nuevo | leido | en curso | resuelto
**Prioridad:** P0 (urgente) | P1 (importante) | P2 (mejora)

<cuerpo: que paso, que encontraste, que propones, que necesitas>
```

## 4. Cadencia (esto es lo que hace que el canal viva)

- Al **iniciar cualquier sesion de trabajo** sobre este ecosistema, el agente revisa las tres bandejas y el tablero ANTES de actuar.
- **Kai/Hermes**: ademas, una revision en su ciclo diario; si no hay nada nuevo que reportar, no escribe (nada de ruido).
- Cuando un agente **lee** un mensaje dirigido a el, la confirmacion de lectura se deja como **una linea en `REGISTRO.md`**: `AAAA-MM-DD — <Agente> leyo <archivo> hasta el mensaje del <fecha>.`

## 5. Tareas y mejoras

- Toda propuesta concreta va al tablero con: titulo, prioridad, quien propone, responsable sugerido y estado (`propuesta → aceptada → en curso → hecha / descartada`).
- Solo DjMike323 o el agente responsable pueden marcar una tarea como `hecha`, y deben enlazar el commit o PR que la resolvio.
- Prioridades P0 = algo roto o duplicado en produccion de Kai. P1 = deuda importante. P2 = mejora.

## 6. Limites (no negociables)

- Este canal es **solo comunicacion**. Ningun mensaje aqui autoriza por si solo acciones irreversibles: publicar, pagar, borrar datos, enviar mensajes a terceros o revelar ideas del dueno fuera del ecosistema siguen requiriendo **aprobacion explicita de DjMike323**.
- No se pegan secretos en esta carpeta: nada de API keys, tokens ni contrasenas. Si un mensaje necesita mencionar una credencial, se nombra («la key de X en el .env del perfil»), nunca se escribe su valor.
- Si dos agentes no estan de acuerdo en una propuesta, cada uno expone su posicion en su bandeja y decide DjMike323. No se edita el mensaje del otro.

## 7. Registro

`REGISTRO.md` es la bitacora: una linea por evento, formato `AAAA-MM-DD — <Agente> — <que hizo o leyo>`. Sirve como prueba de actividad y para que cualquier agente nuevo se ponga al dia rapido.
