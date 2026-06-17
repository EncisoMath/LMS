## v0.24.252

Cambios v0.24.252:
- Transicion entre items/inicio del quiz limpiada: se elimina banda/contenedor visual, info inicial, item X/Y, figuras geometricas, radiales y glow de fondo.
- Se conserva solo el poligono con puntaje acumulado cuando aplica y la barra/countdown de transicion con sus animaciones.

- Resultados: se agrega música de fondo loopeada desde `assets/music_quiz/results.mp3`, iniciando antes de las animaciones de la pantalla final.
- Resultados: la música hace fadeout al pulsar `Repetir animación`, `Continuar` o `Reiniciar animación con estos puntos`.
- Quizzes: la búsqueda de música por pregunta queda limitada solo a archivos `.mp3` en `assets/music_quiz`.
- No se tocaron preguntas, tipos de quiz, countdown, ranking/podio visual, resumen visual ni datos base.
- Version/cache busting actualizado a 0.24.252.
