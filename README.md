# EncisoMath LMS v0.25.007 — Clases editables y arranque estable

Parche acumulativo sobre la rama Offline First.

## Cambios

- El splash animado de EncisoMaths se monta una sola vez durante el arranque real.
- La restauración de sesión y la sincronización ya no vuelven a montar el splash.
- Una actualización del service worker deja de recargar la pantalla mientras el docente navega dentro de un curso.
- Las tarjetas de CLASES incluyen un botón de edición junto a la papelera.
- Añadir y editar clase utilizan el mismo modal.
- Se puede modificar nombre, periodo, PDF, portada y visibilidad.
- La visibilidad se configura mediante checklist por cursos del mismo grado y asignatura.
- La subida o reemplazo de PDF/portada muestra progreso real de transferencia con la barra multicolor y destello blanco del visor PDF.
- Crear y editar clases conserva el funcionamiento offline: sin conexión se guarda localmente y queda pendiente de sincronización.
- El motor offline reconoce `updatePdfLesson` y resuelve conflictos usando la versión más reciente del servidor.

## Archivos modificados

- `app.js`
- `styles.css`
- `supabase-adapter.js`
- `offline-engine.js`
- `sw.js`
- `index.html`
- `manifest.webmanifest`
- `README.md`

## Supabase

Este parche no requiere una migración nueva. Para subir PDFs debe haberse ejecutado previamente la corrección de políticas Storage `SUPABASE_FIX_v0.25.006_STORAGE_RLS.sql`.
