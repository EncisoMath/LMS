## v0.24.299 - Quiz question content centrado

Base: v0.24.298-quiz-studio-legacy-player.

Cambio limitado a la pantalla de juego del quiz:
- Se agregó centrado horizontal estable para `.quiz-question-content` contra el viewport real.
- El ajuste mantiene el contenedor al ancho horizontal de pantalla sin desbalancear los bordes izquierdo/derecho.
- No modifica alturas, grid de respuestas, imagen, textos, countdown, resultados, ranking/podio, datos ni Quiz Studio.

Validaciones realizadas:
- node --check app.js
- node --check sw.js
- JSON/manifest válidos
- CSS braces balanceado
- unzip -t sin errores

Version/cache busting actualizado a 0.24.299.
