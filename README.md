## v0.24.281 - Fondo flat reutilizable

- Se agregó el fondo reutilizable `em-flat-background` con color sólido flat y figuras geométricas oscuras animadas.
- Se aplicó a la portada superior del HOME, al banner de asignatura, al modal de inicio de quiz, al aviso de seguridad del quiz y al hero de clase (`lesson-head`).
- Se conectó el color activo de asignatura mediante `--em-current-subject-color`, sincronizado con el color de la tarjeta del HOME.
- No se modificaron contenedores externos, navegación, datos base, quizzes, rockstars, estudiantes, asistencia, ranking, podio, música ni countdown.
- Version/cache busting actualizado a 0.24.281.

## v0.24.281 - Compactacion HOME asignaturas

Base: v0.24.279.

Cambio limitado al grid interno de asignaturas del HOME: se aplico la compactacion calibrada por consola en las tarjetas `em-sub-`, reduciendo altura de card y portada, eliminando el colchon vertical del bloque de texto con `min-height: 0` y `align-content: start`, manteniendo tipografias legibles y textos mas juntos verticalmente. No se tocaron contenedores externos del HOME, navegacion, datos base, clases, quizzes, rockstars, estudiantes, asistencia, ranking, podio, musica ni countdown.

Version/cache busting actualizado a 0.24.281.

Validacion: `node --check app.js`, `node --check sw.js`, JSON/manifest validos y `unzip -t` sin errores.

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

## v0.24.275 - Tarjetas definitivas de estudiantes y Rockstars

- Reemplazo visual de las tarjetas/list items internos de ESTUDIANTES y ROCKSTARS con el nuevo estilo oscuro `em-rs-`.
- Conexión de asistencia con Rockstars: estudiantes sin asistencia presente quedan bloqueados, grises, con 😴 y sin botones de puntos.
- Orden de Rockstars: primero asistentes por apellido/nombre y luego no asistentes/excusa/sin marcar por apellido/nombre, sin separadores visuales.
- Animaciones resistentes a clics repetidos para cambios de asistencia, puntos y cambio de rango; confeti geométrico solo en ROCKSTARS al cruzar de rango.
- No se modificaron contenedores principales, heroes, navegación, datos base, quizzes, clases, ranking, podio, música ni countdown.



## v0.24.279 - Compactacion tarjetas Rockstars

Base: v0.24.275.

Cambio visual limitado a las tarjetas internas de ROCKSTARS: se compactaron las tarjetas de puntos sin modificar el contenedor principal, layout externo, heroes, navegacion, datos ni logica. El numero de puntos se movio 15px a la izquierda mediante `--em-rs-rockstar-points-x` y se aumento 2px mediante `--em-rs-rockstar-points-size`.

Version/cache busting actualizado a 0.24.279.

Validacion: `node --check app.js`, `node --check sw.js`, JSON/manifest validos y `unzip -t` sin errores.


## v0.24.279 - Compactacion final tarjetas asistencia y Rockstars
- Se compactaron solo las tarjetas internas `em-rs-att-card` de ESTUDIANTES/asistencia y `em-rs-card` de ROCKSTARS.
- Se redujeron separaciones verticales internas entre nombre, codigo/usuario, chip de asistencia y botones.
- La canastica de asistencia queda posicionada arriba a la derecha dentro de la tarjeta con 3px desde arriba y 3px desde la derecha.
- Se mantienen las variables de puntos de Rockstars: `--em-rs-rockstar-points-x: -15px` y `--em-rs-rockstar-points-size: 42px`.
- No se tocaron contenedores principales, heroes, logica, datos, navegacion, quizzes, ranking, podio, musica ni countdown.
- Version/cache busting actualizado a 0.24.279.
