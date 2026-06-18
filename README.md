## v0.24.274

Base: v0.24.273.

Cambios:
- Limpieza de interfaz de calibración/debug de Quizzes: se quitaron las tuerquitas y paneles temporales del quiz en vivo, feedback, transición, ranking/podio y resultados finales.
- ROCKSTARS ahora usa directamente el contenedor padre `.rockstar-hero.em-rs-hero-host` como host visual, igual que QUIZZES y CLASES; se eliminó el wrapper interno `.em-rs-heroSkin` del render.
- Se mantuvieron los elementos visuales de ROCKSTARS: fondo navy, cohete CSS, fuego animado, estrellas/circulitos en movimiento, textos y responsive.
- Se retiraron funciones JS de paneles/tune/debug que ya no se renderizaban y se neutralizó la lectura de ajustes viejos de localStorage para que no sigan afectando el quiz.
- Se agregó override final de CSS para normalizar ROCKSTARS con la misma base de layout de QUIZZES/CLASES.

No se tocaron preguntas, datos base, tipos de pregunta, validación, countdown, música, puntajes, ranking/podio visual final ni listas de Rockstars/Clases/Estudiantes.

Version/cache busting actualizado a 0.24.274.

## v0.24.273

Base: v0.24.272.

Corrección puntual del hero de QUIZZES: se arregló el override posterior que mantenía el fondo navy con `background: #10264d !important`; el hero de QUIZZES ahora queda realmente en naranja `#ff7a00`. No se tocaron CLASES, ROCKSTARS, listados, navegación, lógica, datos, preguntas, countdown, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.273.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.272

Base: v0.24.271.

Cambio visual puntual: se actualizó únicamente el fondo del hero de QUIZZES a naranja `#ff7a00`. No se tocaron CLASES, ROCKSTARS, listados, navegación, lógica, datos, preguntas, countdown, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.272.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.271

Base: v0.24.270.

Corrección puntual solo en CLASES: se corrigió la regla responsive efectiva de `.em-cl-lessonsBoard` dentro de `@media (max-width: 560px)` para que reserve `90px × 90px` en lugar de `132px × 104px`. Se agregó un override final limitado a CLASES para evitar que una regla duplicada posterior vuelva a empujar el alto del hero. No se tocaron ROCKSTARS, QUIZZES, listados, navegación, lógica, datos, quizzes, countdown, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.271.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.270

Base: v0.24.269.

Corrección puntual solo en el hero de CLASES: se aplicó en el breakpoint `max-width: 560px` el footprint que funcionó en Chrome para `.em-cl-lessonsBoard`, dejando `width: 90px`, `height: 90px` y `transform: rotate(-2deg) scale(0.72)`, para que el board no empuje el alto del hero en responsive. No se tocaron ROCKSTARS, QUIZZES, listados, navegación, lógica, datos, quizzes, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.270.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.269

Base: v0.24.268.

Corrección limitada solo al hero de CLASES: se redujo el footprint real de `.em-cl-lessonsBoard` de 132x104px a 91x91px para que no empuje el alto del contenedor; se compactaron las tarjetas internas, líneas e íconos de CLASES y se ajustaron sus posiciones para caber dentro de ese footprint. No se tocaron ROCKSTARS, QUIZZES, listados, navegación, lógica, datos, quizzes, countdown, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.269.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.268

Base: v0.24.267.

Corrección visual limitada al hero de CLASES: se igualaron sus dimensiones y alineación base con los heroes de ROCKSTARS y QUIZZES, manteniendo el contenedor existente y sin tocar el listado de clases, contenidos, navegación, lógica, datos, quizzes, countdown, música, ranking, podio ni estudiantes.

Version/cache busting actualizado a 0.24.268.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.267

Base: v0.24.266.

Cambio visual limitado a la pestaña Clases: se agregó un hero flat aguamarina para CLASES con figuras geométricas oscuras lentas, pila de tarjetas de temas/contenidos con colores EncisoMath, etiquetas TEMA 1-4, líneas simuladas e íconos de libro, x², gráfica y lista. Se conserva el contenido/listado de clases y no se modifica lógica, datos, quizzes, countdown, música, ranking, podio, estudiantes ni navegación.

Version/cache busting actualizado a 0.24.267.

Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

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
