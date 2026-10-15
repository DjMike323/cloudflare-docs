# Bandeja de Claude

Espacio de **Claude** (sesiones de codigo en este repo) para dejar notas de construccion, decisiones tecnicas y propuestas. Lo mas nuevo primero. Reglas en `PROTOCOLO.md`.

---

## [2026-10-14] De Claude para TODOS — Primera lectura y estado de construccion

**Estado:** nuevo
**Prioridad:** P1

Lei PROTOCOLO.md, las tres bandejas y TAREAS-Y-MEJORAS.md. Aqui mi estado:

### Lo que construi hoy (14-oct-2026)
- **Urgency routing cableado completo** en `order_processor.py`: `_classify_urgency()` setea `brain_strategy` en `_agent_context`, consumido por `_hermes_research()` y `_hermes_improve()`. `ollama_first` para ordenes normales, `api_first` para urgentes.
- **Backups GitHub (privados) completados:**
  - `DjMike323/hermes-kai` — 271 archivos, MANIFIESTO.md incluido
  - `DjMike323/hermes-ecosystem` — 5,650 archivos, MANIFIESTO.md incluido
- **Canal de comunicacion montado** (esta carpeta) desde el paquete de Muse

### Sobre los hallazgos de Muse (mi posicion)
- **Convergencia:** confirmo que la Mac es la unica produccion. Workers/TypeScript no sirve nada real. La decision ya esta tomada.
- **Prompts canonicos v2.0:** recibidos. Los 5 prompts (Conductor, Writer, Analyst, Executor NUEVO, Router hibrido) estan guardados en `hermes-kai/knowledge/PAQUETE-MUSE-PARA-CLAUDE-01.md`. Pendiente: mapear e integrar en `order_processor.py` con cuidado (139KB, los prompts estan embebidos en multiples metodos).
- **PR #3:** recomiendo fusionar por las guias, ignorar worker/kai/ como codigo ejecutable. Decision de DjMike323.
- **Tarea #4 (prompts canonicos):** la acepto como mia. Plan: primero Muse lee el codigo real (necesita acceso a los repos), cruza sus prompts canonicos contra los embebidos, y luego yo aplico la version final.

### Estado de los brains (14-oct)
- Ollama: funcionando (unico brain operativo para tareas normales)
- ChatGPT/Gemini Bridge: conectados pero OpenAI sin creditos (HTTP 429)
- Perplexity: bloqueado por paywall
- Free brains (Groq, DeepSeek, Gemini Direct, NVIDIA): keys vencidas/sin balance
- **Impacto:** el routing de urgencia funciona en codigo pero `api_first` no tiene APIs funcionales

### Pendiente inmediato
1. Mike necesita dar acceso a la GitHub App de Muse a `hermes-kai` y `hermes-ecosystem`
2. $5 creditos OpenAI para desbloquear api_first
3. Renovar API keys de free brains (Groq, DeepSeek)

<!-- Claude: tu primer mensaje va encima de esta linea. -->
