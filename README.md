# EncisoMath LMS v0.25.037

## v0.25.037 — margen horizontal en detalle estudiantil

- Corrige la pérdida de separación lateral ocasionada al sacar `em-student-activity-status`, `em-activity-detail-content-tabs` y `em-activity-content-stage` de `em-activity-detail-main`.
- En celulares, los tres bloques mantienen un gutter de 10 px a izquierda y derecha sin volver a anidarse.
- Se restauran bordes laterales y radio máximo de 4 px.
- El escenario conserva padding interno horizontal para que PDF, imágenes, HTML y texto enriquecido no queden pegados al borde.
- No se modifica la lógica de actividades, calificaciones, RESULTADO ni EncisoFlow.

## v0.25.036 — detalle estudiantil separado y resultado tipo hero

- En la vista estudiante, `em-student-activity-status`, `em-activity-detail-content-tabs` y cada `em-activity-content-stage` dejan de estar dentro de `em-activity-detail-main`; ahora son bloques hermanos de ancho completo para aprovechar más espacio horizontal.
- Al cambiar entre **ACTIVIDAD** y **RESULTADO**, el escenario completo ejecuta `encisoFlowOut` antes de ocultarse y `encisoFlowIn` al mostrar el nuevo contenido.
- La tarjeta de calificación se rediseña como un mini hero dinámico con colores sólidos según la nota, figuras geométricas animadas y una cabecera de estado.
- Todos los contenedores y controles de la tarjeta usan bordes de máximo 4 px; las figuras circulares conservan su forma geométrica.
- No se altera la calificación, publicación de RESULTADO, descargas offline, actividades ni datos de Supabase.

## v0.25.035 — recuadro estudiantil de calificación rediseñado

- El resumen de la actividad en la vista estudiante adopta una tarjeta más llamativa y compacta, con fondo, borde, figuras y acentos que cambian según el desempeño obtenido.
- La primera fila queda organizada como **Calificación** y **Fecha de calificación**; la observación ocupa una fila completa debajo.
- La calificación se muestra como número limpio, sin `/100`, acompañada por su nivel visual: Superior, Alto, Básico o Bajo.
- La fecha de calificación usa el formato `Julio 20 de 2026, 3:14p.m.` cuando el dato está disponible.
- Se eliminan del recuadro la fecha de asignación y la fecha de entrega para concentrarlo en la información de calificación.
- No se modifica la publicación de RESULTADO, la calificación, las entregas, el modo offline ni la descarga silenciosa.

## v0.25.034 — estado de actividades y publicación controlada de RESULTADO

- En la vista estudiante, cada actividad muestra un rectángulo compacto con calificación, observación, fecha de calificación, fecha de asignación y fecha máxima de entrega.
- El recuadro permanece gris mientras no exista calificación y adopta los colores de desempeño de la Planilla cuando la nota ya fue registrada.
- La pestaña **RESULTADO** solo queda disponible para estudiantes cuando el docente activa el nuevo switch, existe contenido de resultado y todos los estudiantes activos del curso están calificados.
- Si RESULTADO está bloqueado, su contenido y archivos no se guardan en el snapshot estudiantil ni entran en la descarga silenciosa.
- Crear una actividad ya no exige añadir contenido en RESULTADO; puede agregarse después al editar.
- Requiere ejecutar una vez `SUPABASE_STUDENT_ACTIVITY_RESULTS_v0.25.034.sql` para que el portal conozca la calificación del estudiante y si todo el curso ya fue calificado. Antes de ejecutar la migración, la aplicación sigue funcionando, pero RESULTADO permanece bloqueado en el portal estudiantil.

## v0.25.033 — detalle y edición de asistencia desde la Planilla

- Cada icono de asistencia de la Planilla ahora es interactivo.
- Al tocar ✅, ⚠️ o 🔴 se abre una ventana con el estudiante, la fecha, el estado actual y la hora del registro cuando Supabase la conserva.
- Si existe una modificación posterior, también se muestra su fecha y hora.
- Desde la misma ventana se puede cambiar entre Asistió, Excusa y No asistió.
- El cambio actualiza el registro real de asistencia, funciona con la cola offline existente y refresca la Planilla sin alterar notas, definitivas ni la exportación EducaCity.
- La consulta de la hora es puntual: solo se solicita el registro tocado, no toda la asistencia nuevamente.

## v0.25.032 — Planilla con asistencia por fecha y detalle de calificaciones

- La sección docente **Notas** pasa a llamarse **Planilla** en el selector, encabezado y contexto de navegación.
- Inmediatamente después de la columna **Estudiante** se muestran columnas verticales por cada fecha de asistencia del periodo.
- Cada cruce estudiante/fecha muestra el estado real: `✅` asistió, `⚠️` excusa y `🔴` no asistió.
- Estas columnas son solo visuales dentro de EncisoMath y **no se agregan al Excel de EducaCity**.
- Las notas de actividades con registro guardado ahora son botones accesibles. Al tocarlas se consulta únicamente esa actividad y se muestra: calificación, fecha de asignación/publicación, fecha de calificación, historial de seguimientos/intentos con observaciones y comentario general.
- No se modificó la ponderación, la definitiva, los quizzes, Rockstars, la asistencia consolidada ni la estructura del Excel exportado.

## v0.25.031 — descarga silenciosa e incremental de clases y actividades

- En Android/Chromium instalado como PWA se registra `Periodic Background Sync` con un intervalo mínimo solicitado de una hora. El navegador decide el momento real según uso, batería, red y políticas del dispositivo.
- En iPhone/Safari y navegadores sin esa API, el mismo proceso se ejecuta al abrir la aplicación y cuando la copia de datos se actualiza en primer plano.
- La primera apertura crea una línea base de lo que el estudiante ya tenía y **no descarga de nuevo el contenido anterior**.
- Cada ejecución compara un manifiesto local por contenido y solo procesa clases o actividades nuevas/cambiadas. Antes de solicitar cada PDF, portada, imagen o adjunto consulta `encisomath-media-v1`; si el URL ya está cacheado no vuelve a descargarlo.
- Los metadatos recibidos en segundo plano se guardan para que el contenido nuevo aparezca incluso si la siguiente apertura ocurre sin conexión.
- No usa notificaciones push ni muestra avisos al estudiante. Respeta ahorro de datos, conexiones extremadamente lentas y espacio local insuficiente, dejando el intento para otra oportunidad.
- No incluye quizzes ni entregas estudiantiles en la precarga automática.

PWA estática para clases, actividades, asistencia, planilla, Rockstars, quizzes y portal estudiantil, con Supabase y funcionamiento offline-first.

## Conexiones

La opción **Conexiones** está dentro de la tuerca del perfil docente, junto a **Calendario académico**. El panel muestra quién ingresó, hora de entrada, última actividad, duración aproximada, dispositivo, sistema, navegador, uso como PWA y última vista.

Todos los controles y paneles nuevos usan el lenguaje visual existente de EncisoMath y bordes de 4 px.

## Instalación obligatoria de Supabase

Ejecuta completo en **Supabase → SQL Editor**:

`SUPABASE_CONNECTIONS_v0.25.022.sql`

La migración crea o corrige:

- Tabla `connection_sessions`.
- Token privado por sesión.
- RPC de inicio, latido y cierre.
- RPC docente de consulta.
- Índices y permisos.
- Recarga inmediata del esquema de PostgREST.

La URL correcta en `supabase-config.js` es la URL base del proyecto:

`https://jjllrciujqauqpjffsud.supabase.co`

No se debe añadir `/rest/v1/`; `supabase-js` lo agrega automáticamente.

No se registra ubicación ni dirección IP. La duración es aproximada porque depende de señales periódicas mientras la aplicación está abierta.

## Archivos principales

- `app.js`: interfaz y lógica.
- `styles.css`: diseño del LMS.
- `supabase-adapter.js`: Auth, RPC, CRUD y Storage.
- `offline-engine.js`: IndexedDB y sincronización offline.
- `background-content-sync.js`: manifiesto incremental compartido entre la app y el Service Worker.
- `sw.js`: Service Worker y caché.
- `SUPABASE_STUDENT_ACTIVITY_RESULTS_v0.25.034.sql`: RPC de estado de calificaciones para el portal estudiantil.
- `SUPABASE_CONNECTIONS_v0.25.022.sql`: migración necesaria.
- `INSTALACION_CONEXIONES_v0.25.022.txt`: pasos rápidos.



## v0.25.030 — clases aisladas correctamente por grado y curso

- Las clases PDF dejan de aparecer como `Sin asignar` dentro de otros grados que comparten la misma asignatura o área.
- El filtro recupera vínculos de curso conservados en `assignmentId`, `assignmentIds`, `targetAssignmentIds` y `sortOrderByAssignment`, incluyendo snapshots offline de versiones anteriores.
- Una clase guardada sin seleccionar cursos queda asociada a la biblioteca del grado/asignatura desde donde se creó, mediante un vínculo invisible en `assignment_lessons`; no requiere una migración SQL nueva.
- Los vínculos invisibles solo se cargan en el panel docente. El portal estudiantil continúa recibiendo exclusivamente clases visibles mediante sus RPC.
- Al editar una clase, marcar cursos la publica en ellos; dejar todos desmarcados la devuelve únicamente a la biblioteca del grado actual.

## v0.25.029 — compatibilidad del visor PDF con iPhone, Safari y WebView antiguos

- Se carga una capa de compatibilidad antes de PDF.js 6.1.200 en la página y en su Web Worker.
- Se corrigen las APIs modernas ausentes que producían errores como `Map.getOrInsertComputed is not a function` y `undefined is not a function`.
- El visor conserva su interfaz normal cuando PDF.js puede renderizar el documento.
- Si el motor PDF todavía falla en un dispositivo antiguo, la clase cambia automáticamente al visor PDF nativo del teléfono sin mostrar el error técnico al estudiante.
- Se añadió un último botón `Abrir PDF` solo si fallan tanto PDF.js como el visor embebido.
- Se mantienen la caché multimedia estable, el funcionamiento offline y la actualización forzada de la PWA.

## v0.25.028 — corrección global del nombre EncisoMath

- Se corrige el nombre visible anterior de la aplicación para usar únicamente “EncisoMath” en el logo animado, la pantalla de instalación, textos de accesibilidad, mensajes e instrucciones.
- Se actualiza la referencia interna del comentario de estilos asociado al logo para mantener la nomenclatura uniforme.
- No se modifican claves de almacenamiento, nombres de caché ni lógica funcional.

## v0.25.027 — instalación vertical y botón plateado

- Los cuatro pasos ahora aparecen como tarjetas horizontales en cuatro filas: roja, azul, verde y amarilla.
- El botón principal dice únicamente “Instalar la App” y usa acabado plateado/blanco con texto gris oscuro.
- El botón incorpora resplandor exterior respirando, barrido luminoso, destellos tipo escarcha y la misma gelatina periódica de los títulos ROCKSTARS, ACTIVIDADES y QUIZZES.
- Se reutiliza exclusivamente el cohete animado del hero de Rockstars dentro del botón.
- Se eliminan de la pantalla “Instalación manual” y “Ya la instalé”.
- La composición sigue bloqueada al alto de la pantalla, sin desplazamiento vertical.

## v0.25.026 — pantalla de instalación renovada

- La instalación obligatoria reutiliza el fondo negro y el logo animado de la pantalla de carga.
- Se elimina el resplandor de las figuras geométricas; permanecen sólidas y en movimiento suave.
- Los cuatro pasos se presentan en tarjetas roja, azul, verde y amarilla.
- La llamada principal incorpora el texto “Tócame”, brillo animado y efecto gelatina cada cinco segundos.
- La composición se adapta a la altura disponible, bloquea el desplazamiento vertical y compacta contenido en pantallas pequeñas.
- Se conserva el instalador nativo de Android, el método manual, las instrucciones de iOS y el botón “Ya la instalé”.

## v0.25.025 — pantalla de actualización unificada

- La actualización obligatoria reutiliza exactamente la pantalla de carga inicial de EncisoMath.
- Se elimina el overlay blanco independiente, el icono cuadrado y los estilos inline anteriores.
- Se mantienen el fondo negro, el logo animado, la barra multicolor, la frase de estado y el número de versión.
- La lógica de actualización forzada, la protección contra bucles y la conservación de archivos offline no cambian.

## v0.25.024 — actualización obligatoria de la PWA

- El Service Worker se registra desde la URL estable `./sw.js` con `updateViaCache: none`.
- Se comprueba una versión nueva al abrir, recuperar conexión, volver a la app y cada 15 minutos.
- Un worker nuevo activa `skipWaiting`, toma las pestañas con `clients.claim` y fuerza una navegación a la versión nueva incluso si la instalación seguía ejecutando JavaScript antiguo.
- La recarga usa un marcador temporal y protección contra bucles.
- Las navegaciones solicitan el HTML con `cache: no-store` y los recursos se revalidan sin depender de una copia HTTP vieja.
- Se conservan `encisomath-media-v1`, IndexedDB, sesiones, preferencias y mutaciones offline pendientes.

## v0.25.023 — optimización de Storage

Los archivos de Supabase Storage ya no se precargan en cada inicio o sincronización. Se descargan al abrirlos y se conservan en una caché multimedia estable. La preparación offline manual se limita al curso y periodo abiertos. No requiere SQL.
