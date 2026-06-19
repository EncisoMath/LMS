## v0.24.302 - Ajuste ABCD y Verdadero/Falso en player

Base: v0.24.301-editar-quizzes.

Cambios limitados a la pantalla de juego del quiz:
- Se integra el ajuste que evita que las opciones ABCD se corten abajo.
- Verdadero/Falso vuelve a flujo normal, sin `position: fixed`, para que no se salga hacia la izquierda.
- Verdadero/Falso usa ancho completo de respuestas, dos columnas y altura calculada con colchón inferior.
- El texto de la pregunta en Verdadero/Falso queda centrado verticalmente dentro de su zona, pero alineado a la izquierda.
- Se conserva el centrado estable de `quiz-question-content` de v0.24.299 y las opciones lógicas de v0.24.300.

No se tocaron datos base, Quiz Studio visual, tarjetas, navegación, resultados, ranking/podio, música ni countdown.

Validación:
- `node --check app.js`
- `node --check sw.js`
- JSON/manifest válidos
- CSS braces balanceado
- `unzip -t` sin errores

Versión/cache busting actualizado a 0.24.302.
