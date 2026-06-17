## v0.24.266

Base: v0.24.265.

Ajuste visual puntual en los heroes de ROCKSTARS y QUIZZES: se mantuvo el mismo contenedor existente y la misma escala responsiva lograda en v0.24.265, pero se separó un poco más el bloque de textos respecto al cohete/tablero izquierdo, desplazando el contenido unos pocos píxeles hacia la derecha para que no quede tan pegado a los elementos gráficos. No se tocaron tamaños/posición del contenedor padre, ni menús, listados, lógica, datos, countdown, música, ranking, podio, clases ni estudiantes.

Version/cache busting actualizado a 0.24.266.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.263

Base: v0.24.262.

Cambio visual limitado a la pestaña Quizzes: se reemplazó el contenido interno del hero de QUIZZES por un hero flat navy tipo quiz board con figuras geométricas oscuras animadas, tablero de 4 tarjetas de colores sólidos con símbolos blancos y texto ASIGNATURA • GRADOCURSO / QUIZZES / Retos rápidos para aprender jugando. Se conserva el contenedor principal `.quiz-hero` y no se modifican menú de periodo, listado de quizzes, lógica, datos, preguntas, respuestas, countdown, música, resultados, ranking, podio, clases ni estudiantes.

Version/cache busting actualizado a 0.24.263.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.262

Base: v0.24.261.

Cambio visual puntual en Rockstars:
- Se ajusto solo la escala interna del nuevo hero ROCKSTARS para que el cohete, el titulo, el eyebrow y el subtitulo sean responsivos y no se vean sobredimensionados en pantallas estrechas o heroes bajos.
- Se conserva el contenedor padre `.rockstar-hero` sin cambiar su tamano, posicion ni layout general.
- No se tocaron navegacion, logica de Rockstars, estudiantes, clases, quizzes, resultados, ranking, podio, musica, countdown, puntajes ni datos.

Version/cache busting actualizado a 0.24.262.
