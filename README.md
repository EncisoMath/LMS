# EncisoMath LMS v0.25.028

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


## v0.25.028 — corrección global del nombre EncisoMath

- Se corrige el nombre visible anterior de la aplicación para usar únicamente “EncisoMath” en el logo animado, la pantalla de instalación, textos de accesibilidad, mensajes e instrucciones.
- Se actualiza la referencia interna del comentario de estilos asociado al logo para mantener la nomenclatura uniforme.
- No se modifican claves de almacenamiento, nombres de caché ni lógica funcional.

## v0.25.027 — instalación vertical y botón plateado

- Los cuatro pasos ahora aparecen como tarjetas horizontales en cuatro filas: roja, azul, verde y amarilla.
- El botón principal dice únicamente “Instalar la App” y usa acabado plateado/blanco con texto gris oscuro.
- El botón incorpora resplandor exterior respirando, barrido luminoso, destellos tipo escarcha y la misma gelatina periódica de los títulos ROCKSTARS, ACTIVIDADES y QUIZZES.
- Se reutiliza exclusivamente el cohete animado del hero de Rockstars dentro del botón.
- Se eliminan de la pantalla “Instalación manual” y “Ya la instalé”.
- La composición sigue bloqueada al alto de la pantalla, sin desplazamiento vertical.

## v0.25.026 — pantalla de instalación renovada

- La instalación obligatoria reutiliza el fondo negro y el logo animado de la pantalla de carga.
- Se elimina el resplandor de las figuras geométricas; permanecen sólidas y en movimiento suave.
- Los cuatro pasos se presentan en tarjetas roja, azul, verde y amarilla.
- La llamada principal incorpora el texto “Tócame”, brillo animado y efecto gelatina cada cinco segundos.
- La composición se adapta a la altura disponible, bloquea el desplazamiento vertical y compacta contenido en pantallas pequeñas.
- Se conserva el instalador nativo de Android, el método manual, las instrucciones de iOS y el botón “Ya la instalé”.

## v0.25.025 — pantalla de actualización unificada

- La actualización obligatoria reutiliza exactamente la pantalla de carga inicial de EncisoMath.
- Se elimina el overlay blanco independiente, el icono cuadrado y los estilos inline anteriores.
- Se mantienen el fondo negro, el logo animado, la barra multicolor, la frase de estado y el número de versión.
- La lógica de actualización forzada, la protección contra bucles y la conservación de archivos offline no cambian.

## v0.25.024 — actualización obligatoria de la PWA

- El Service Worker se registra desde la URL estable `./sw.js` con `updateViaCache: none`.
- Se comprueba una versión nueva al abrir, recuperar conexión, volver a la app y cada 15 minutos.
- Un worker nuevo activa `skipWaiting`, toma las pestañas con `clients.claim` y fuerza una navegación a la versión nueva incluso si la instalación seguía ejecutando JavaScript antiguo.
- La recarga usa un marcador temporal y protección contra bucles.
- Las navegaciones solicitan el HTML con `cache: no-store` y los recursos se revalidan sin depender de una copia HTTP vieja.
- Se conservan `encisomath-media-v1`, IndexedDB, sesiones, preferencias y mutaciones offline pendientes.

## v0.25.023 — optimización de Storage

Los archivos de Supabase Storage ya no se precargan en cada inicio o sincronización. Se descargan al abrirlos y se conservan en una caché multimedia estable. La preparación offline manual se limita al curso y periodo abiertos. No requiere SQL.
