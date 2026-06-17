## v0.24.245

Cambios v0.24.245:
- En la ventana emergente antes de iniciar el quiz se agregó la opción `Pasar a resultados`, junto al botón existente `Empezar quiz` y el selector de puntaje por tiempo.
- Esta opción muestra directamente la pantalla final de Resultados sin recorrer las preguntas y sin modificar los datos base del quiz.
- En la tuerquita de Resultados se agregó la pestaña `Puntos` para ajustar puntajes de `Correctas` y `Tiempo` en la pantalla actual.
- El botón `Reiniciar animación con estos puntos` recalcula la nota/puntaje con esos valores y reproduce de nuevo las animaciones de Resultados.
- No se tocaron preguntas, tipos de quiz, countdown, música, ranking/podio visual, resumen visual ni datos base.
- Versión/cache busting actualizado a `0.24.245`.

## v0.24.244

Cambios v0.24.244:
- Se modificó únicamente la animación del polígono y número de la nota final en Resultados.
- El polígono existente usa sus puntos como forma final, sale desde el centro en cascada vértice 1 -> 2 -> 3 -> 4, con bounce cartoon y levitación suave sin salto.
- El número existente aparece al iniciar el tercer vértice, cuenta 0 -> nota falsa -> nota real, con impactos jelly en falso y real, y queda blanco.
- No se cambiaron contenedores, tamaño, posición, layout, botones, ranking, resumen, lógica del quiz ni datos.
- Versión/cache busting actualizado a `0.24.244`.

## v0.24.244

Cambios v0.24.244:
- Solo se agrego una capa de animacion al ranking actual de Resultados.
- Se conservaron elementos, diseno, colores, tamanos, posiciones, nombres, puntajes, avatares y orden visual actuales.
- Se agregaron clases de animacion a los elementos existentes del podio: ranking-animation-root, ranking-place-1/2/3, ranking-podium-block, ranking-rank-number, ranking-avatar, ranking-name, ranking-score y ranking-sparkle.
- La animacion del ranking entra en cascada rapida 1 -> 2 -> 3 con efecto comic/cartoon en bloque, numero, avatar, nombre, puntaje y punticos blancos.
- La animacion se reproduce al abrir Resultados y al repetir la animacion existente.
- Version/cache busting actualizado a 0.24.244.

## v0.24.244

Cambios v0.24.244:
- Se excluyó la fase `results` del padding inline de `.quiz-fullscreen-content` aplicado por la calibración del quiz, para que Resultados pueda centrarse sin afectar preguntas ni transición.
- Se ajustó el orden de `encisoFlowIn/encisoFlowOut` en Resultados: hero, puntaje, ranking, resumen y botones, de arriba hacia abajo, tanto al entrar como al salir.
- Se actualizó la clave de calibración a `encisomath:finalResultsTune:v0.24.244`.
- Versión/cache busting actualizado a `0.24.244`.

Validaciones: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.
