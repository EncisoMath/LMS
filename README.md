## v0.24.242

Cambios v0.24.242:
- Solo se agrego una capa de animacion al ranking actual de Resultados.
- Se conservaron elementos, diseno, colores, tamanos, posiciones, nombres, puntajes, avatares y orden visual actuales.
- Se agregaron clases de animacion a los elementos existentes del podio: ranking-animation-root, ranking-place-1/2/3, ranking-podium-block, ranking-rank-number, ranking-avatar, ranking-name, ranking-score y ranking-sparkle.
- La animacion del ranking entra en cascada rapida 1 -> 2 -> 3 con efecto comic/cartoon en bloque, numero, avatar, nombre, puntaje y punticos blancos.
- La animacion se reproduce al abrir Resultados y al repetir la animacion existente.
- Version/cache busting actualizado a 0.24.242.

## v0.24.242

Cambios v0.24.242:
- Se excluyó la fase `results` del padding inline de `.quiz-fullscreen-content` aplicado por la calibración del quiz, para que Resultados pueda centrarse sin afectar preguntas ni transición.
- Se ajustó el orden de `encisoFlowIn/encisoFlowOut` en Resultados: hero, puntaje, ranking, resumen y botones, de arriba hacia abajo, tanto al entrar como al salir.
- Se actualizó la clave de calibración a `encisomath:finalResultsTune:v0.24.242`.
- Versión/cache busting actualizado a `0.24.242`.

Validaciones: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.
