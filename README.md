# EncisoMath LMS v0.25.000 — Offline First

Esta versión convierte EncisoMath en una PWA con lectura y escritura offline. El LMS trabaja sobre una copia local en IndexedDB y sincroniza con Supabase cuando vuelve la conexión.

## Instalación obligatoria

1. Ejecuta una sola vez en Supabase SQL Editor el archivo externo:
   `SUPABASE_MIGRATION_v0.25.000_OFFLINE_FIRST.sql`
2. Después publica los archivos modificados de la v0.25.000, incluido el nuevo `offline-engine.js`.
3. Abre la aplicación con internet e inicia sesión al menos una vez.
4. Toca el indicador de conexión y usa **Descargar todo para trabajar offline**.
5. Espera la confirmación de preparación antes de probar el modo avión.

La migración SQL se entrega separada y no debe acumularse dentro del repositorio público.

## Qué funciona sin internet

Después de la primera preparación online se puede:

- abrir la PWA y entrar con la última sesión conocida;
- consultar estudiantes, asignaturas, clases, actividades, quizzes, asistencia, Rockstars y NOTAS;
- registrar o quitar asistencia;
- dar puntos Rockstar;
- crear y retirar estudiantes;
- crear, editar y eliminar actividades;
- calificar normal o con rúbrica;
- crear grupos de calificación;
- registrar seguimientos, comentarios y entregables;
- crear clases PDF con portada;
- crear y editar quizzes;
- resolver y enviar intentos de quiz;
- modificar preferencias y configuración de NOTAS;
- cambiar imágenes de asignaturas;
- consultar PDFs, imágenes, respuestas, guías y archivos previamente descargados.

Los cambios se reflejan inmediatamente en la interfaz y quedan en una cola persistente aunque se cierre la app o se reinicie el celular.

## Sincronización

La sincronización ocurre:

- al recuperar internet;
- al abrir la aplicación;
- al volver desde segundo plano;
- periódicamente mientras la app esté abierta;
- al pulsar **Sincronizar ahora**.

Cada operación tiene un identificador único. Supabase registra recibos de sincronización para que un reintento no duplique puntos, seguimientos, intentos de quiz ni otros eventos.

## Regla de conflictos

- Si el registro de Supabase no cambió desde la última sincronización, se aplica el cambio local.
- Si Supabase tiene una versión más reciente, gana Supabase.
- Cambios consecutivos hechos offline sobre el mismo registro se aplican en su orden; el último cambio local termina ganando cuando no existe una edición remota posterior.
- Eventos independientes, como puntos Rockstar y seguimientos, se agregan sin duplicarse.
- Los conflictos descartados quedan visibles en el Centro de sincronización.

La comparación usa la hora del servidor y los campos `updated_at`; no depende únicamente de la hora configurada en el celular.

## Archivos offline

La preparación offline descarga en segundo plano:

- PDFs de clases;
- portadas e imágenes;
- archivos de actividades y respuestas;
- entregables de estudiantes;
- recursos incrustados detectables;
- archivos estáticos de la PWA;
- PDF.js, música, sonidos, iconos y plantilla EducaCity;
- librerías externas necesarias, después de haberlas cargado online al menos una vez.

Los archivos creados sin conexión se conservan como blobs locales y se suben a Supabase Storage al recuperar internet. La aplicación solicita almacenamiento persistente al navegador.

## Límites reales del dispositivo

- La primera instalación, el primer inicio de sesión y la primera descarga completa requieren internet.
- Borrar los datos de la PWA o desinstalarla elimina la copia local y la cola pendiente.
- El espacio disponible depende del almacenamiento que Android/Chrome conceda al sitio.
- Supabase sigue siendo la copia oficial una vez finaliza la sincronización.
- No se debe borrar manualmente el almacenamiento de la app cuando existan cambios pendientes.

## Centro de sincronización

El indicador flotante muestra:

- En línea / Sin conexión / Sincronizando;
- cantidad de cambios pendientes;
- conflictos;
- última sincronización;
- botón para descargar todo;
- botón para sincronizar ahora.

## Archivos principales de esta versión

- `offline-engine.js`: IndexedDB, cola, sincronización, conflictos y archivos locales.
- `sw.js`: shell offline, caché de recursos y solicitud de sincronización.
- `supabase-adapter.js`: operaciones idempotentes y rutas estables para reintentos.
- `app.js`: integración de snapshots y actualización de la interfaz al sincronizar.
- `styles.css`: indicador y Centro de sincronización.
- `index.html`: carga del motor offline y versionado v0.25.000.

## Validación requerida antes de publicar

- `node --check app.js`
- `node --check supabase-adapter.js`
- `node --check offline-engine.js`
- `node --check sw.js`
- validación de JSON/manifest;
- `unzip -t` sobre el paquete final.

## Base visual y funcional conservada

Se conservan todos los cambios aprobados hasta v0.24.349: logo animado EncisoMaths, carga personalizada, clases PDF, actividades, rúbricas, grupos, seguimientos, NOTAS, exportación EducaCity, héroes, tabla de estudiantes y estilos actuales.
