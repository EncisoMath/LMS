# EncisoMath LMS v0.25.094

## v0.25.094 — Progreso: viaje de la Definitiva

- Progreso ahora usa el azul principal de EncisoMath (`#1368ce`).
- El hero reutiliza exactamente la estructura visual base de los heroes de Actividades/Planilla: 4 shapes animados y el bloque decorativo principal reemplazado por notas `60`, `80` y `100` que flotan y crecen.
- Debajo del hero se añade un recorrido espacial: estrellas se desplazan de derecha a izquierda y un cohete avanza de izquierda a derecha según la **Definitiva real de la PLANILLA**.
- La estela de fuego funciona como barra de `0` a `100`; al terminar el recorrido aparece `VAS A X VECES LA VELOCIDAD DE LA LUZ`.
- Añade `supabase/migrations/SUPABASE_STUDENT_PROGRESS_v0.25.094.sql`, que actualiza la RPC existente para entregar también la configuración no sensible de ponderaciones de la PLANILLA. Ejecutarlo en Supabase SQL Editor permite que el cohete use exactamente las ponderaciones configuradas por el docente.
- Mantiene los acordeones de Actividades, Asistencia y Rockstar Points de v0.25.093.

## v0.25.093 — Progreso del estudiante

- Añade una cuarta sección **📈 Progreso** al portal estudiante, dejando Clases / Actividades / Quizzes / Progreso en una fila de cuatro tarjetas.
- Progreso presenta tres bloques verticales desplegables: **Actividades**, **Asistencia** y **Rockstar Points**.
- Cada bloque muestra un resumen `/100` con barra por desempeño: rojo 0–59, naranja 60–69, amarillo 70–79, verde 80–89 y dorado 90–100.
- Actividades lista únicamente las actividades habilitadas para la asignatura y periodo actual, con su nota o estado pendiente.
- Asistencia muestra el total de asistencias, inasistencias y excusas, además del historial por fecha.
- Rockstar Points agrupa los puntos por día y los relaciona con las mismas fechas de asistencia; una jornada sin puntos aparece como `0`. La nota Rockstar reutiliza la meta configurada en la PLANILLA (15 por defecto).
- Añade `supabase/migrations/SUPABASE_STUDENT_PROGRESS_v0.25.093.sql`. Debe ejecutarse una vez en Supabase SQL Editor para exponer al propio estudiante únicamente su asistencia, Rockstars y meta de puntos.
- Si el SQL todavía no fue ejecutado, el resto del portal sigue cargando y Progreso muestra un aviso en lugar de bloquear el acceso.
- La sincronización silenciosa de la PWA también incluye el resumen de Progreso para refrescar asistencia y Rockstars cuando cambian en Supabase.


## v0.25.092 — Rockstars: cada toque suma exactamente un punto

- Corrige el caso en que una sola pulsación de `+1` podía reflejarse temporalmente como `+2`.
- La causa era una referencia compartida entre el estado visible de Rockstars y la copia offline inmediatamente después de una carga fresca.
- El motor offline ahora reconoce por `id` o `clientMutationId` un evento que `app.js` ya añadió de forma optimista y actualiza ese mismo evento en lugar de insertarlo de nuevo.
- Al confirmarse en Supabase, el evento existente recibe el `id`/fecha del servidor y se marca como sincronizado, sin alterar nuevamente el puntaje.
- La misma protección aplica tanto a `+1` como a `-1` y también evita duplicados durante transiciones online/offline.
- No requiere SQL nuevo.

## v0.25.091 — cabecera de PLANILLA refinada

- La cabecera sticky de **Estudiante** queda siempre por encima de asistencias/notas al desplazar horizontalmente la matriz.
- El scroll vertical realizado sobre la fila de encabezados desplaza la página, no el scroll interno de la tabla.
- En **Asistencia**, tocar la fecha abre filtros/orden y desde ese mismo modal se puede eliminar la fecha completa con confirmación.
- En columnas de nota, tocar el encabezado abre **Configurar nota**; el botón superior derecho abre **Filtros de planilla**.
- El botón de filtro usa tres líneas horizontales, sin emoji.


## v0.25.090 — planilla compacta, fija y filtrable

- La columna `Estudiante` reduce nuevamente su ancho y conserva el nombre completo mediante tooltip/ellipsis.
- Las columnas de asistencia, notas y definitiva son más angostas para ganar espacio horizontal.
- La fila de encabezados queda fija dentro de la matriz mientras se recorre verticalmente la planilla.
- Se añade un buscador superior para mostrar rápidamente uno o varios estudiantes por nombre, apellido o código.
- El encabezado `Estudiante` permite seleccionar exactamente qué estudiantes mostrar y ordenar A→Z o Z→A.
- Cada fecha de asistencia permite filtrar por Asistió / Excusa / No asistió y ordenar por estado; la eliminación de la fecha permanece disponible mediante un botón independiente.
- Cada columna de nota permite filtrar con `>`, `>=`, `<`, `<=` o `=` y ordenar de menor a mayor o de mayor a menor. La `Definitiva` también admite estos filtros.
- Los filtros se combinan entre sí y pueden limpiarse con un solo botón.
- La configuración de código/color/ponderación de cada nota se conserva en un botón `⚙` independiente del filtro.
- Al tocar una celda Estudiante × Actividad, el modal incorpora dos pestañas superiores: `Actividad` para consultar el contenido y `Nota` para editar calificación, entrega, observaciones, seguimiento, grupo y sticker.
- No requiere SQL nuevo.



## v0.25.089 — Rockstars sin pérdida de puntos al resincronizar

- La carga docente de `rockstar_events` ahora se pagina en bloques de 500 filas, evitando que Supabase/PostgREST recorte el historial cuando supera el límite de una sola respuesta.
- Cada página se ordena de forma estable por `occurred_at` e `id`, de modo que pulsaciones consecutivas de `+1` no desaparezcan al reconstruir el puntaje desde Supabase.
- Los eventos recuperados se deduplican por `id` antes de calcular los totales, protegiendo el contador frente a solapamientos de paginación.
- El cambio corrige el caso en que un estudiante podía verse con 8 puntos inmediatamente y bajar a 7 después de una sincronización aunque los eventos se hubieran registrado.
- No requiere SQL nuevo.


## v0.25.088 — máximo 4 figuras por hero estudiantil

- El fondo animado del Home del estudiante pasa de 8 a 4 figuras geométricas.
- La cabecera de asignatura (por ejemplo, `ESTADÍSTICA · Grado 9-2 · Municipal · Vista estudiante`) pasa de 8 a 4 figuras geométricas.
- El hero de Clases pasa de 7 a 4 shapes animados.
- El hero de Actividades ya tenía 4 shapes y se conserva sin cambios.
- El hero de Quizzes pasa de 7 a 4 shapes animados.
- Se conservan los mismos tipos de figura, animaciones y colores; únicamente se reduce la cantidad visible para mantener una composición más limpia.
- No requiere SQL nuevo.

## v0.25.087 — navegación estudiantil en tarjetas

- En la vista estudiante, el selector desplegable de `Clases / Actividades / Quizzes` se sustituyó por tres tarjetas compactas en una sola fila.
- Cada tarjeta mide aproximadamente la mitad de la altura de los heroes (59 px) y usa esquinas redondeadas de 4 px.
- La tarjeta seleccionada toma el color exacto del hero correspondiente: Clases `#24b49a`, Actividades `#e21b3c` y Quizzes `#ff7a00`.
- Cada tarjeta incorpora un único shape animado del mismo sistema visual del hero: cuadrado para Clases, círculo para Actividades y X para Quizzes.
- Se eliminó el texto `SECCIÓN` y el selector desplegable únicamente para estudiantes; la navegación docente permanece intacta.
- No requiere SQL nuevo.


## v0.25.086 — Recuperación completa de fechas de asistencia en PLANILLA

- La carga docente de `attendance_records` ahora se pagina en bloques de 500 filas, evitando el límite de respuesta de Supabase/PostgREST cuando el historial supera 1000 registros.
- Cada página se ordena de forma estable por fecha, curso y estudiante antes de aplicar `range()`, evitando saltos o duplicados entre páginas.
- La PLANILLA vuelve a recibir todas las fechas disponibles del periodo; no se modifica la lógica de eliminación por fecha ni el diseño compacto introducido en v0.25.085.
- No requiere SQL nuevo.

## v0.25.085 — PLANILLA compacta, asistencia por fecha y edición completa

- El encabezado de cada fecha de asistencia en la PLANILLA ahora es interactivo: al tocarlo se puede eliminar esa fecha y todos sus registros de asistencia únicamente para el curso actual, con confirmación previa.
- La columna `Estudiante`, las columnas de asistencia, las columnas de notas y la `Definitiva` se compactaron para mostrar más información horizontalmente sin perder los nombres completos en `title`.
- Al tocar una nota de actividad desde la PLANILLA se abre el editor completo de calificación con nota normal o rúbrica, entrega/archivos, observación, grupo, sticker y seguimiento.
- Al guardar desde ese editor, la PLANILLA se recalcula y actualiza inmediatamente.
- No requiere SQL nuevo.

## v0.25.084 — PLANILLA solo con actividades visibles del curso

- La PLANILLA ya no incluye actividades ocultas en la biblioteca docente ni actividades asignadas a otros cursos.
- La definitiva se calcula únicamente con los componentes realmente visibles/asignados al curso actual.
- Si una configuración antigua reservaba peso para una actividad que ahora está oculta, el peso de los componentes visibles se normaliza proporcionalmente a 100% sin alterar la configuración guardada.

## v0.25.083 — actualización PWA sin reinicio manual

- Se eliminó la doble navegación que podía producirse entre `client.navigate()`, `controllerchange` y `location.reload()` al activar una versión nueva.
- El Service Worker ahora solo anuncia que la nueva versión quedó activa y `app.js` realiza una única recarga controlada.
- Si el navegador pierde el evento `controllerchange`, un fallback de 9 segundos aplica la versión automáticamente en lugar de dejar la pantalla **Actualizando EncisoMath...** indefinidamente.
- El mensaje `ENCISOMATH_UPDATE_ACTIVATED` también dispara la recarga, por lo que ya no depende exclusivamente de un único evento del navegador.
- Se añadió una protección de 45 segundos contra bucles de actualización y recargas repetidas.
- La actualización usa `location.replace()` con un marcador temporal y luego limpia ese marcador al iniciar, evitando llenar el historial.
- No requiere ejecutar SQL nuevo.


## v0.25.081 — visor de imágenes sin doble desplazamiento

- Las imágenes de una actividad ya no quedan encerradas en un viewport con altura máxima.
- El visor crece hasta mostrar la imagen completa según su relación de aspecto y el desplazamiento vertical queda únicamente en la página general.
- La imagen ocupa todo el ancho útil del `em-activity-media-viewer`, sin padding interno adicional.
- El carrusel de entregas docentes y el modo pantalla completa conservan su scroll propio, zoom y pellizco.
- No requiere ejecutar SQL nuevo.

## v0.25.080 — cabecera limpia de Mi entrega

- Se eliminó el icono de flecha hacia arriba del modal estudiantil.
- El botón de cierre queda fijado y alineado en la esquina superior derecha.
- Se conserva el radio de 4 px y la animación de shapes del hero de Actividades.


## v0.25.079 — modal de entrega con shapes animados del hero

- El modal **Mi entrega** reutiliza exactamente las figuras del hero de Actividades: círculo, cuadrado, triángulo y equis.
- Las cuatro figuras se inicializan con el mismo sistema `emActInitActivitiesHero` y permanecen animadas mientras el modal está abierto.
- El modal y sus componentes mantienen esquinas de `4px`, siguiendo la regla visual de EncisoMath.
- No requiere ejecutar un SQL nuevo.

## v0.25.078 — entrega estudiantil organizada y avisos docentes

- En el hero **Mi resultado** del estudiante, la gestión de archivos se compactó en un botón **Añadir entrega**.
- El botón abre un modal visual e intuitivo con la lista completa de fotos y PDF, carga múltiple, eliminación, progreso y acceso al visor.
- La pestaña **Entrega** del modal docente muestra una insignia con el número de archivos asociados a la entrega.
- En la lista de calificaciones aparece `⚠️` cuando hay archivos enviados pendientes de calificar y `❗❗` cuando no hay archivos ni calificación. Los avisos desaparecen al calificar.
- No requiere ejecutar un SQL nuevo: reutiliza la estructura de entregas instalada en v0.25.077.

## v0.25.077 — entregas estudiantiles sin Edge Function

- Se eliminó la dependencia de `encisomath-student-submissions`; ya no hay que desplegar funciones, usar terminal, crear tokens de GitHub ni configurar GitHub Actions.
- La instalación requiere únicamente subir los archivos del parche al repositorio y ejecutar `supabase/migrations/SUPABASE_STUDENT_SUBMISSIONS_SQL_ONLY_v0.25.077.sql` en Supabase SQL Editor.
- Las fotografías continúan convirtiéndose a WebP y los PDF continúan almacenándose en el bucket privado `student-submissions`.
- La autorización se realiza mediante RPC y políticas RLS creadas por el SQL. Cada archivo recibe una ruta aleatoria privada vinculada al estudiante, actividad y curso.
- Se mantienen la carga múltiple sin límite fijo de imágenes, el carrusel docente, el visor de PDF, el zoom y la eliminación individual de archivos.
- Esta versión reemplaza el mecanismo de despliegue descrito en v0.25.076; no se necesita la Edge Function anterior.

## v0.25.076 — entregas estudiantiles con fotos y PDF

- El estudiante puede adjuntar múltiples fotografías y archivos PDF desde el bloque **Mi entrega** ubicado dentro del hero **Mi resultado** de cada actividad.
- No existe un límite fijo de cantidad de imágenes; cada selección puede contener todos los archivos que el estudiante necesite.
- Las fotografías se redimensionan en el navegador hasta 1920 px y se convierten a WebP antes de subirlas para reducir el consumo de Storage.
- Los PDF se conservan sin conversión y cada archivo puede pesar máximo 20 MB.
- La pestaña **Entrega** del modal docente muestra todos los archivos en un carrusel: navegación por flechas, deslizamiento lateral, pantalla completa, doble toque, rueda con Ctrl y pellizco para ampliar.
- El visor respeta la relación de aspecto completa de cada imagen y renderiza los PDF con PDF.js.
- El docente puede añadir un archivo complementario sin borrar los archivos enviados por el estudiante.
- Al calificar en grupo se conservan las entregas propias de cada integrante; no se reemplazan accidentalmente por la del estudiante principal.


## v0.25.059 — tarjetas estudiantiles más compactas

- Se eliminó el espacio inferior adicional que quedaba debajo de la barra de calificación en las tarjetas de actividades del estudiante.
- La barra conserva el mismo diseño, pero ahora termina con un margen inferior equilibrado respecto al padding general de la tarjeta.
- El ajuste se limita a la vista estudiantil y no modifica las tarjetas ni la barra de progreso del docente.


## v0.25.058 — calificación visible en las tarjetas del estudiante

- Las tarjetas de actividades del portal estudiantil reutilizan la misma barra de progreso de la vista docente.
- La barra representa la calificación individual obtenida sobre 100.
- El encabezado muestra `Calificación` y el valor `nota/100`; mientras no exista una calificación, muestra `—/100` con la barra vacía.

## v0.25.057 — sticker compartido en calificaciones grupales

- Al guardar una calificación grupal, el sticker seleccionado se asigna a todos los integrantes marcados del grupo.
- El estudiante principal se incluye siempre en el guardado, incluso si su selector está deshabilitado en la interfaz.
- El mensaje de confirmación indica cuándo la calificación y el sticker se aplicaron al grupo completo.

## v0.25.056 — esquinas redondeadas para stickers WebP

- Los stickers `.webp` se muestran sin contorno blanco y con `border-radius: 4px` en la tarjeta de calificación del estudiante.
- Los PNG conservan su contorno blanco y los demás formatos mantienen su visualización anterior.
- La detección admite URLs con parámetros de consulta o fragmentos.

## v0.25.055 — contorno blanco exclusivo para stickers PNG
- Los stickers PNG conservan el contorno blanco que sigue la silueta de la imagen.
- Los stickers WebP, GIF y JPG se muestran sin generar la copia blanca de contorno.
- La detección acepta extensiones PNG aunque la URL incluya parámetros o fragmentos.
- Se actualizó la versión de la aplicación y del service worker para renovar la caché instalada.

## v0.25.054 — sticker sin contenedor visible
- El bloque 1:1 del sticker conserva su espacio dentro de la cuadrícula.
- Se eliminaron fondo, borde, blur, sombra y padding del contenedor del sticker.
- Visualmente solo aparece la imagen PNG, GIF o WebP asignada.
- No se modificaron Calificación, Observación, Fecha de calificación ni la lógica de stickers.
