## v0.24.297 - Quiz Studio ajustes finales

Base: v0.24.296-quiz-studio.

Cambios limitados a ASIGNATURA > QUIZZES / Quiz Studio y lectura visual de calificación en tarjetas de quizzes:
- Quiz Studio: barra inferior fija queda en una sola fila con Guardar / Publicar; se elimina Probar.
- Inputs/selects quedan en fuente Regular; botones en Medium/Regular.
- Títulos de tarjetas del generador quedan en Bold; textos de tarjetas de respuesta en SemiBold y blanco.
- Disponible hasta carga por defecto mañana a las 11:59 p.m. y permite abrir el selector de fecha/hora.
- Preguntas en desorden y Opciones en desorden quedan en una misma fila.
- Se quitan mayúsculas forzadas en controles del generador.
- Se agregan tiempos 90 y 120 segundos.
- La caja Sin imagen abre el selector de archivos al tocarla.
- Cambiar imagen / Quitar imagen y Duplicar / Eliminar quedan en una misma fila.
- Tipo de pregunta y Tiempo quedan debajo del selector de imagen.
- Tarjetas de opciones sin figuras internas.
- Replicar queda como pestaña real junto a Datos rápidos y Preguntas, sin regresar a Preguntas ni parpadear al seleccionar cursos.
- Se añade Mostrar respuesta correcta después del intento en Datos rápidos y se guarda en el quiz.
- Se preserva scroll al re-renderizar Quiz Studio para evitar saltos al inicio.
- Se corrige que un quiz recién publicado aparezca como calificado por leer el grado académico como nota.

No se tocaron Home, Clases, Estudiantes, Asistencia, Rockstars, navegación global, ranking, podio, música, countdown, pantalla de juego, resultados ni motor del quiz.

Validaciones realizadas:
- node --check app.js
- node --check sw.js
- JSON/manifest válidos
- CSS braces balanceado
- unzip -t sin errores

Version/cache busting actualizado a 0.24.297.
