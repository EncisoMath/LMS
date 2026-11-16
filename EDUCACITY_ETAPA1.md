# Educa.city ↔ EncisoLMS: lectura en vivo y sincronización

## Qué hace el botón de PLANILLA

1. Obtiene de la **PLANILLA de EncisoLMS** los tres valores por alumno y los porcentajes del período activo.
2. Contacta el **conector local v20** (se inicia con `INICIAR_PANEL.bat` y mantiene una sesión privada de Chrome con `insroque.educa.city`).
3. Consulta la **planilla actual de educa.city**: estudiantes, nombres, matrículas, matriz real, actividades existentes y porcentajes en sus formularios.
4. Busca los componentes **Académico → Académico**, **Asistencia → Actitudinal** y **Rockstars → Aptitudinal**. Si existe exactamente uno, lo reutiliza; si falta, prepara crearlo. Ante duplicados o componentes ajenos con peso, detiene la operación sin escribir.
5. Verifica por **código de matrícula y nombre** a cada estudiante. Los que no coinciden quedan omitidos y visibles en la vista previa.
6. Compara nota por nota y muestra solo las diferencias. Únicamente tras pulsar **«Crear/reutilizar y sincronizar»**, crea las actividades ausentes con el formulario actual, obtiene y comprueba el **ID devuelto por la nueva lectura de educa.city**, ajusta porcentajes y envía solo las notas diferentes.
7. Comprueba la respuesta y relee la planilla después de cada envío. Los IDs reales comprobados se guardan en Supabase **solo después de un resultado exitoso**. En usos futuros vuelve a leer la planilla actual, sin confiar en esos IDs guardados como fuente de verdad.

## Instalación

Descargar el paquete `EducaCity_Conector_LMS_v20.zip`, descomprimir y ejecutar `INICIAR_PANEL.bat` en el computador con Chrome/Python. Con el conector abierto, entrar a EncisoLMS → curso → PLANILLA → **Sincronizar con educa.city**.

## Estado de datos

- Tres tablas Supabase: `educacity_course_links`, `educacity_student_links`, `educacity_component_links` con RLS docente.
- Todos los **IDs de actividades históricos fueron borrados** como fuente operativa. Los vínculos de alumnos quedaron sin confirmar hasta hacer la comparación en vivo.
- El lector conserva el catálogo histórico de grupos **solo para navegar**; la planilla y los formularios se comprueban en educa.city al momento de cada operación.
- **No hay sincronización automática en segundo plano**. Cada envío requiere abrir PLANILLA, revisar la vista previa y pulsar el botón de confirmación.
- No borra automáticamente una calificación en educa.city si EncisoLMS la muestra vacía.
- Las escrituras de v20 aún necesitan la primera comprobación con una sesión real: pasaron tests locales de validación, identidad, CORS, peso y verificación, pero no se emitió ninguna orden de escritura durante el desarrollo.

## Seguridad

El sitio web no recibe la contraseña de educa.city; la sesión se mantiene dentro del navegador controlado por el conector local. Las llamadas desde EncisoLMS a `127.0.0.1` están limitadas al origen `https://encisomath.github.io`, necesitan el token emitido por el conector, generan respaldos locales y bloquean escrituras si la verificación remota no se cumple.
