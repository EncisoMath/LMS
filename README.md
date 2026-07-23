# EncisoMath LMS v0.25.020

PWA estática para gestión de clases, actividades, asistencia, notas, Rockstars, quizzes y portal estudiantil, con Supabase como backend y funcionamiento offline-first.

## Novedad v0.25.020: Conexiones

El inicio del docente incorpora una sección **Conexiones** para consultar:

- Quién ingresó a EncisoMath.
- Hora de conexión y última actividad.
- Estado en línea o desconectado.
- Duración aproximada de la sesión.
- Celular, tablet o computador.
- Sistema operativo y navegador.
- Si se abrió como PWA instalada.
- Última sección visitada dentro del LMS.

La presencia se actualiza mediante latidos periódicos. Se considera en línea a una persona cuya última señal haya ocurrido durante los últimos 90 segundos. La duración es aproximada si el dispositivo pierde internet o la app se cierra de forma abrupta.

No se registra ubicación ni dirección IP.

## Instalación obligatoria de Supabase

Antes de usar Conexiones, ejecutar completo en **Supabase → SQL Editor**:

`SUPABASE_CONNECTIONS_v0.25.020.sql`

La migración crea:

- Tabla `connection_sessions`.
- RPC de inicio, latido y cierre de sesión.
- RPC docente para consultar el historial.
- Índices y restricciones de seguridad.

La tabla no concede lectura o escritura directa a `anon` ni `authenticated`. El acceso se realiza mediante funciones `SECURITY DEFINER`, y cada docente solo recibe estudiantes matriculados en alguno de sus grupos activos, además de sus propias sesiones.

## Archivos principales

- `app.js`: interfaz, navegación y lógica de negocio.
- `styles.css`: diseño completo del LMS.
- `supabase-adapter.js`: Auth, RPC, CRUD y Storage.
- `offline-engine.js`: IndexedDB, cola offline y sincronización.
- `sw.js`: caché y Service Worker.
- `SUPABASE_CONNECTIONS_v0.25.020.sql`: migración del panel Conexiones.
- `INSTALACION_CONEXIONES_v0.25.020.txt`: pasos rápidos de instalación.
