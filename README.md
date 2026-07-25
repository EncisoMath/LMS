# EncisoMath LMS v0.25.050

## Riesgo y bloqueo de actividades
- Se reutiliza el modal visual de seguridad de quizzes para advertir al estudiante.
- Primer evento sospechoso: advertencia. Segundo evento: calificación automática **2.0**, observación automática y bloqueo de la actividad.
- Al intentar volver a abrir una actividad bloqueada, el estudiante recibe un warning y no accede al contenido.
- Nueva pestaña **RIESGO** en el modal docente de calificación, con historial, motivos, horas y botón **Reactivar actividad**.
- La reactivación restaura la calificación previa cuando existía; si la nota 2.0 fue creada desde un registro pendiente, vuelve a quedar sin calificar.
- El profesor recibe un aviso al cargar la actividad cuando aparece un bloqueo nuevo.
- Los eventos se registran con identificadores idempotentes y también quedan pendientes localmente si el estudiante pierde internet.

## Limitación técnica importante
Una PWA no puede confirmar de manera infalible una captura del sistema. EncisoMath registra señales sospechosas disponibles en el navegador: pérdida de foco, cambio de app/pestaña, menú contextual, copiar, PrintScreen/F12 y atajos de guardado o impresión.

## Instalación obligatoria
Ejecutar una sola vez `SUPABASE_ACTIVITY_RISK_v0.25.050.sql` en Supabase → SQL Editor.
