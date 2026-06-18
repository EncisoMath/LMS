## v0.24.298 - Quiz Studio guarda en formato legacy real

Base: v0.24.297-quiz-studio-ajustes.

Cambio limitado al flujo de quizzes creados desde Quiz Studio y su lectura en el player:

- Las preguntas creadas desde Quiz Studio ahora se normalizan al formato legacy real del motor de quizzes, igual que las preguntas de data/quizzes.json.
- Se convierten tipos del editor a tipos del motor: multiple_choice, flip, order, true_false y open.
- Opciones, tarjetas, correctas, imágenes, textA/textB, prompt, timeLimit, respuesta corta y orden se guardan en la estructura que ya consume el player.
- Se normalizan también quizzes locales antiguos al leerse para evitar estructuras intermedias del editor.
- Se conserva academicGrade/courseGrade y se evita que el grado del curso sea interpretado como calificación.
- Se agrega marca interna source=quiz-studio/legacyFormat=true para aplicar un fallback visual seguro solo a quizzes creados desde Quiz Studio, especialmente preguntas sin imagen.
- No se toca Home, Clases, Estudiantes, Asistencia, Rockstars, ranking, podio, música, countdown ni resultados.

Validaciones:
- node --check app.js
- node --check sw.js
- JSON/manifest válidos
- CSS braces balanceado
- unzip -t sin errores

Version/cache busting actualizado a 0.24.298.
