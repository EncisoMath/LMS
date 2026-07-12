## v0.24.302 - Ajuste ABCD y Verdadero/Falso en player

Base: v0.24.301-editar-quizzes.

Cambios limitados a la pantalla de juego del quiz:
- Se integra el ajuste que evita que las opciones ABCD se corten abajo.
- Verdadero/Falso vuelve a flujo normal, sin `position: fixed`, para que no se salga hacia la izquierda.
- Verdadero/Falso usa ancho completo de respuestas, dos columnas y altura calculada con colchón inferior.
- El texto de la pregunta en Verdadero/Falso queda centrado verticalmente dentro de su zona, pero alineado a la izquierda.
- Se conserva el centrado estable de `quiz-question-content` de v0.24.299 y las opciones lógicas de v0.24.300.

No se tocaron datos base, Quiz Studio visual, tarjetas, navegación, resultados, ranking/podio, música ni countdown.

Validación:
- `node --check app.js`
- `node --check sw.js`
- JSON/manifest válidos
- CSS braces balanceado
- `unzip -t` sin errores

Versión/cache busting actualizado a 0.24.302.

---

## v0.24.303 - Integración inicial con Supabase

Base: v0.24.302.

Cambios:
- Login real por correo y contraseña con Supabase Auth.
- Carga de perfiles, asignaturas, 285 estudiantes, matrículas, clases y quizzes desde PostgreSQL.
- Asistencia y Rockstars guardados en Supabase.
- Quiz Studio guarda y replica quizzes en Supabase.
- Intentos, respuestas, resultados y eventos de seguridad se registran en la nube.
- Portadas e iconos se almacenan en el bucket `lms-public`.
- Preferencias principales y aperturas de clases se sincronizan.
- Se conserva `localStorage` únicamente para interfaz, caché y ajustes visuales no académicos.

Nuevos archivos:
- `supabase-config.js`
- `supabase-adapter.js`
- `SUPABASE_INTEGRACION.md`
- `supabase/ENCISOMATH_SUPABASE_SETUP_v1.sql`

Validación:
- `node --check app.js`
- `node --check supabase-config.js`
- `node --check supabase-adapter.js`
- prueba automatizada del adaptador con respuestas simuladas de Supabase
- JSON y manifiesto válidos
- rutas locales verificadas
- ZIP probado con `unzip -t`
### Privacidad v0.24.303

- Los archivos locales `data/students.json` y `data/users.json` ya no contienen registros reales.
- El instalador SQL con nombres y códigos se conserva fuera del repositorio público.
- Los datos académicos se cargan únicamente desde Supabase tras autenticar al usuario.

