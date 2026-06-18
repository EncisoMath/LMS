## v0.24.292 - Parche final resultados quiz responsive

Base: `v0.24.291-ajustes-resultados-quiz`.

Cambios integrados desde el parche de consola final, limitados a la pantalla final de resultados del quiz:

- Se eliminan cortes/overflow horizontal en resultados (`quiz-phase-results`, `quiz-fullscreen-content`, `enciso-final-results` y bloques internos).
- La banda superior de resultados conserva el ancho visual sin empujar la pantalla lateralmente.
- Textos superiores de la banda (`enciso-result-kicker`, `enciso-result-title`, `enciso-result-message`) quedan más grandes y proporcionados.
- `enciso-result-message` queda centrado, en una sola línea, con ancho máximo de `60vw` y separación vertical ajustada debajo del título.
- `RESUMEN POR ITEM` queda anclado debajo de `RANKING DEL QUIZ` con separación final equivalente a `__emAnchorReview(10)`.
- Las tarjetas del resumen mantienen altura responsive con `clamp(62px, 8.8svh, 78px)`, sin achatamiento y con scroll horizontal interno cuando aplique.
- Se oculta el botón `Continuar` original y se crea un botón flotante visual a 4px del borde inferior que dispara el botón real, conservando la lógica existente.
- Al salir o cambiar de fase del quiz, el botón flotante se remueve para no contaminar otras pantallas.

No se tocaron datos base, tarjetas Clases/Quizzes, motor de preguntas, countdown, música, ranking/podio lógico, navegación de asignatura, asistencia, estudiantes, Rockstars ni Home.

Version/cache busting actualizado a `0.24.292`.

Validaciones esperadas: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos, CSS brace balanceado y ZIP sin errores.
