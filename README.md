# EncisoMath LMS v0.25.059


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
