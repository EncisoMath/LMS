## v0.24.300 - Opciones activas del Quiz Studio

Base: v0.24.299-quiz-question-content-centrado.

Cambios limitados a la lógica del player de Quizzes:
- Se conectó `showCorrectAfterAttempt` para que, cuando esté activo, al fallar se revele también la respuesta correcta; si está apagado, solo se marca la respuesta seleccionada incorrecta.
- Se conectó `shuffleQuestions` para crear un orden aleatorio fijo por intento al iniciar el quiz.
- Se conectó `shuffleOptions` para crear un orden aleatorio fijo por intento en opciones, verdadero/falso, flip y tarjetas de ordenar.
- El orden se guarda en la sesión del intento para evitar que cambie en cada render.
- Se conserva el centrado de `.quiz-question-content` de v0.24.299.

No se tocaron layouts visuales, alturas, tarjetas de estudiantes/Rockstars/Clases, Home, ranking/podio, música, countdown ni datos base.

Validaciones realizadas:
- node --check app.js
- node --check sw.js
- JSON/manifest válidos
- CSS braces balanceado
- unzip -t sin errores

Version/cache busting actualizado a 0.24.300.
