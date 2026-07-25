# EncisoMath LMS v0.25.052

## v0.25.052 — eliminación completa del sistema RIESGO
- Se retiró la pestaña RIESGO del modal de calificación.
- Se eliminaron los detectores de pérdida de foco, cambio de aplicación, copia, captura e inspección.
- Se eliminaron las advertencias, baneos y la autocalificación automática en 2.0.
- Se eliminaron las etiquetas de riesgo y el botón Reactivar actividad.
- Se retiraron las llamadas RPC y la cola offline relacionadas con riesgo.
- Se conservan intactos STICKER, CALIFICACIÓN, ENTREGA, GRUPO y SEGUIMIENTO.
- Se incluye un SQL idempotente para limpiar cualquier tabla, función o columna de riesgo creada en Supabase y restaurar calificaciones autogeneradas si existieran.
