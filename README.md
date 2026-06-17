## v0.24.240

Cambios v0.24.240:
- Se excluyó la fase `results` del padding inline de `.quiz-fullscreen-content` aplicado por la calibración del quiz, para que Resultados pueda centrarse sin afectar preguntas ni transición.
- Se ajustó el orden de `encisoFlowIn/encisoFlowOut` en Resultados: hero, puntaje, ranking, resumen y botones, de arriba hacia abajo, tanto al entrar como al salir.
- Se actualizó la clave de calibración a `encisomath:finalResultsTune:v0.24.240`.
- Versión/cache busting actualizado a `0.24.240`.

Validaciones: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.
