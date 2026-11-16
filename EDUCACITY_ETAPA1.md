# EducaCity ↔ EncisoLMS — Etapa 1 (2026)

## Qué se ha implementado

- En **PLANILLA** aparece el botón **Vincular con educa.city**. Abre un panel separado para consultar/editar los vínculos; no altera las calificaciones.
- Supabase guarda tres tablas con RLS para el profesor propietario de cada curso:
  - \`educacity_course_links\`: asignación LMS ↔ grupo/asignatura/área educa.city, por año.
  - \`educacity_student_links\`: UUID LMS ↔ ID de estudiante educa.city, por curso/año, con estado de confirmación.
  - \`educacity_component_links\`: curso/año/período/componente ↔ ID de actividad educa.city y peso en EncisoLMS.
- Los identificadores de los 11 cursos provienen del catálogo comprobado con navegador de educa.city.
- Los pesos se resolvieron según \`user_preferences.gradebookConfigs\`; también se contempló el modelo histórico de pesos internos.
- No se alteraron las tablas de actividades, calificaciones, asistencias ni eventos Rockstars del LMS.

## Correspondencia oficial

| EncisoLMS | educa.city |
| --- | --- |
| Académico | Académico |
| Asistencia | Actitudinal |
| Rockstars | Aptitudinal |

**Los pesos NO son siempre 60/20/20**: se leen por curso y período de PLANILLA.
El panel permite actualizar la copia de pesos con **Actualizar pesos desde PLANILLA**.

## Estado de los datos cargados

- 11 cursos de Estadística (8-4, 9-1 a 9-4, 10-1 a 10-3 y 11-1 a 11-3), sin 8-6.
- 274 estudiantes activos con correspondencia de ID confirmada contra la captura v13 de educa.city.
- 3 estudiantes activos sin correspondencia confirmada: uno en 9-2 y dos en 9-3. No se guardaron IDs supuestos como confirmados. Requieren consulta de las fichas externas y vinculación manual en el panel.
- 132 componentes planificados para 11 cursos × 4 períodos × 3 componentes.
- 49 IDs históricos de actividades recuperados de v13, guardados como \`found_unverified\`, no \`verified\`.
- 83 componentes con ID pendiente. **No se deben crear a ciegas**: puede haber actividades existentes con nombres anteriores.
- 44/44 combinaciones curso-período tienen pesos LMS sumando exactamente 100%.

**Excepción a revisar:** 8-4 P4 tiene en la captura las actividades «COMP. HUMANO (ASISTENCIA)» y «COMP. ACTITUDINAL» y no aparece «COMP. APTITUDINAL». La relación de Actitudinal fue marcada \`needs_review\` y Aptitudinal permanece pendiente; no decidir automáticamente cuál reutilizar o retirar.

En períodos anteriores aparecen otras categorías («COMP. HUMANO», «PARTICIPACION», «SIMULACRO») con pesos distintos. Es necesario verificar esas planillas en vivo antes de reutilizar componentes o crear otros.

## Cómo utilizar la pantalla

1. Abrir EncisoLMS como docente → curso → **PLANILLA**.
2. Pulsar **Vincular con educa.city**.
3. Elegir curso y período, revisar los IDs de curso y las tres actividades.
4. Pulsar **Actualizar pesos desde PLANILLA** si has modificado la ponderación en el LMS.
5. Usar **Solo pendientes** para ver los estudiantes que requieren confirmar identidad. El botón **Editar** guarda un ID real después de tu comprobación.
6. **Guardar IDs** registra vínculos en Supabase, sin tocar educa.city.

## Seguridad y alcance

- RLS aplica permisos por docente propietario de la asignación en LMS.
- Un rol autenticado ajeno consultado durante la prueba ve 0 filas.
- No hay contraseñas de educa.city, claves secretas ni service_role en JavaScript.
- La etapa 1 **no consulta educa.city en tiempo real, no crea actividades allí, no cambia sus pesos externos ni envía calificaciones**. Esas acciones requieren abrir la sesión autenticada con el conector Python local y comparar/confirmar los datos de educa.city. La etapa 2 deberá respetar los estados \`pending\`, \`found_unverified\`, \`needs_review\` y bloquear escrituras hasta verificar los IDs.
- Una futura sincronización debe realizar relectura posterior a cada envío y detectar conflictos antes de sobrescribir.

## Archivos

- \`index.html\`: carga del módulo.
- \`educacity-stage1.js\`: interfaz, lectura y guardado de vínculos.
- \`educacity-stage1.css\`: estilos planos y responsive.

Estado: base implementada en GitHub \`main\` y tablas creadas en Supabase. Integración en vivo y alta de actividades externas todavía pendientes.
