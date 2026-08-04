# EncisoMath LMS v0.25.077

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
