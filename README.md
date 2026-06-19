## v0.24.301 - Editar quizzes desde tarjeta

Base: v0.24.300-opciones-quiz-studio.

Cambio limitado a ASIGNATURA > QUIZZES y Quiz Studio:
- Se agregó botón `Editar` al lado de `Iniciar` en cada tarjeta de quiz.
- `Editar` abre Quiz Studio con los datos, reglas e ítems del quiz seleccionado cargados para modificación.
- Al guardar/publicar un quiz editado, se actualiza el quiz existente por su mismo ID en quizzes locales; si era un quiz base del JSON, queda una copia local con el mismo ID que lo sobreescribe visualmente sin duplicarlo en la lista.
- Los quizzes locales tienen prioridad sobre los quizzes base cuando comparten ID, evitando tarjetas duplicadas después de editar.
- Se mantiene `Iniciar` sin cambios, con prevención para que tocar `Editar` no inicie el quiz.

No se tocaron layouts del player, countdown, resultados, ranking/podio, música, asistencia, estudiantes, Rockstars, clases ni datos base.

Validaciones realizadas:
- node --check app.js
- node --check sw.js
- JSON/manifest válidos
- CSS braces balanceado
- unzip -t sin errores

Version/cache busting actualizado a 0.24.301.
