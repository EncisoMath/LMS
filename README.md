# EncisoMath LMS v0.25.022

PWA estática para clases, actividades, asistencia, notas, Rockstars, quizzes y portal estudiantil, con Supabase y funcionamiento offline-first.

## Conexiones

La opción **Conexiones** está dentro de la tuerca del perfil docente, junto a **Calendario académico**. El panel muestra quién ingresó, hora de entrada, última actividad, duración aproximada, dispositivo, sistema, navegador, uso como PWA y última vista.

Todos los controles y paneles nuevos usan el lenguaje visual existente de EncisoMath y bordes de 4 px.

## Instalación obligatoria de Supabase

Ejecuta completo en **Supabase → SQL Editor**:

`SUPABASE_CONNECTIONS_v0.25.022.sql`

La migración crea o corrige:

- Tabla `connection_sessions`.
- Token privado por sesión.
- RPC de inicio, latido y cierre.
- RPC docente de consulta.
- Índices y permisos.
- Recarga inmediata del esquema de PostgREST.

La URL correcta en `supabase-config.js` es la URL base del proyecto:

`https://jjllrciujqauqpjffsud.supabase.co`

No se debe añadir `/rest/v1/`; `supabase-js` lo agrega automáticamente.

No se registra ubicación ni dirección IP. La duración es aproximada porque depende de señales periódicas mientras la aplicación está abierta.

## Archivos principales

- `app.js`: interfaz y lógica.
- `styles.css`: diseño del LMS.
- `supabase-adapter.js`: Auth, RPC, CRUD y Storage.
- `offline-engine.js`: IndexedDB y sincronización offline.
- `sw.js`: Service Worker y caché.
- `SUPABASE_CONNECTIONS_v0.25.022.sql`: migración necesaria.
- `INSTALACION_CONEXIONES_v0.25.022.txt`: pasos rápidos.
