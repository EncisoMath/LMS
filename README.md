# EncisoMath LMS v0.25.051

## v0.25.051 — biblioteca adicional de stickers WebP
- Se importaron 33 stickers WebP únicos desde `WEBP_CONVERTIDOS.zip`.
- El ZIP original contenía 34 archivos; uno era un duplicado binario exacto y se omitió.
- 32 stickers son animados y 1 es estático.
- Los archivos no cuadrados se normalizaron a un lienzo transparente 1:1 sin recortar el contenido.
- Se conservaron la animación y la transparencia.
- `assets/stickers/catalog.json` incluye ahora el sticker original y los 33 nuevos.
- Los nuevos archivos se guardaron en `assets/stickers/library/`.
- Para proteger el egress, la biblioteca completa no está en el precache global: cada sticker se descarga y cachea únicamente cuando se muestra o cuando se asigna a un estudiante.
- No se modificaron la calificación, el sistema de riesgo ni la subida de stickers a GitHub.
