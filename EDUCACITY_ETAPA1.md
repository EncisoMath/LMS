# EncisoLMS ↔ educa.city — sincronización sin aplicaciones locales

## Lo implementado

- **Interfaz**: `educacity-stage1.js`, disponible desde la pestaña PLANILLA de EncisoLMS.
- **Backend remoto**: Supabase Edge Function `educacity-bridge` del proyecto LMS.
- **Código fuente del backend**: `supabase/functions/educacity-bridge/index.ts`.
- El botón utiliza HTTPS a Supabase, **sin abrir CMD, instalar Python ni descargar ZIP**.
- Primero obtiene las tres calificaciones usando las funciones originales de PLANILLA, luego inicia sesión desde el servidor y consulta los datos vivos de educa.city.
- Busca o crea **Académico**, **Actitudinal = Asistencia** y **Aptitudinal = Rockstars**, comprueba nombres y matrículas, aplica porcentajes de cada curso/período y envía solo notas nuevas o cambiadas.
- Se requieren el usuario y la contraseña de educa.city dentro de PLANILLA. Se transmiten por HTTPS y **no se guardan en GitHub, localStorage ni Supabase**. El ID institucional se busca automáticamente.
- El servidor verifica el JWT docente de Supabase antes de consultar datos de cursos y escribir.
- Las actividades y sus IDs se comprueban **en vivo**; los IDs recuperados de capturas anteriores no se utilizan para decidir escrituras.

## Cómo se usa

1. Abrir EncisoLMS en su web → curso → PLANILLA.
2. Pulsar **Sincronizar con educa.city**.
3. Introducir las credenciales institucionales en el modal (sin instalar nada en el PC).
4. Pulsar **Leer y comparar**; revisar la identidad, los pesos y las diferencias.
5. Pulsar **Crear/reutilizar y enviar notas**. El sistema procesa Académico, Actitudinal y Aptitudinal por separado, con verificación entre envíos.
6. Si una etapa falla, detenerse y releer: puede haber cambios parciales ya guardados.

## Límites y verificación requerida

**Se desplegó el backend y su frontend, pero aún NO se ha probado una lectura y escritura autenticada desde el servidor remoto de Supabase contra una planilla real de educa.city.** La versión anterior con Playwright funcionaba en una máquina local; en cambio este backend usa peticiones HTTPS a PHP y un parser HTML. Si el servidor de educa.city entrega la planilla únicamente mediante JavaScript en un navegador, o bloquea solicitudes desde centros de datos, el nuevo backend *debe detenerse antes de escribir* y mostrar el error. En ese caso se necesita su API de integración oficial. La existencia de una API pública se anuncia en su sitio, pero los endpoints y permisos exactos de notas no están publicados en la información consultada.

Nunca se considera que el POST HTTP confirme por sí solo una modificación: se relee la planilla y se comprueban los valores. No se borra una nota vacía automáticamente. No se almacenan contraseñas en la base de datos. Las tres tablas de vinculación tienen RLS por docente.

## Estado de datos

- 11 cursos y 132 configuraciones por curso, período y componente.
- IDs históricos de actividades limpiados; referencias antiguas no se usan para escritura.
- IDs de alumnos sugeridos no se consideran confirmados sin lectura en vivo.
