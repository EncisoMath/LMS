# EncisoMath LMS v0.25.049

## Stickers opcionales por calificación
- Nueva pestaña **STICKER** en el modal con CALIFICACIÓN, ENTREGA, GRUPO y SEGUIMIENTO.
- Grid de stickers con opción **Sin sticker**.
- El sticker seleccionado se guarda por estudiante junto a la calificación y aparece en su mini-hero.
- Los PNG, WebP, GIF y JPG deben ser cuadrados 1:1 y pesar máximo 6 MB.
- Botón **Añadir Stickers**: envía los archivos a GitHub mediante la Edge Function `encisomath-github-stickers`; no usa Supabase Storage.
- La URL del sticker se conserva en `activity_student_records.sticker_url`.
- La descarga silenciosa incremental incluye únicamente el sticker nuevo seleccionado y no vuelve a descargar los anteriores.
- Los GIF permanecen animados y la silueta blanca se genera duplicando el PNG/GIF detrás, por lo que también funciona con animación.

## Instalación requerida
1. Ejecutar `SUPABASE_ACTIVITY_STICKERS_v0.25.049.sql`.
2. Configurar y desplegar la Edge Function siguiendo `GITHUB_STICKERS_SETUP_v0.25.049.md`.
