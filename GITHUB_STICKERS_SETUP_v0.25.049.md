# Configuración de stickers en GitHub — v0.25.049

Los archivos de stickers se guardan en GitHub. Supabase solo ejecuta una Edge Function segura que recibe el archivo y lo envía a GitHub; **no se usa Supabase Storage**.

## 1. Ejecutar el SQL
Ejecuta `SUPABASE_ACTIVITY_STICKERS_v0.25.049.sql` en Supabase → SQL Editor.

## 2. Crear un token de GitHub
Crea un token de acceso de alcance fino para el repositorio público del LMS, con permiso **Contents: Read and write**. El repositorio debe ser público para que los estudiantes puedan cargar los stickers sin una credencial de GitHub. No coloques ese token en `app.js` ni en `supabase-config.js`.

## 3. Crear secretos de la Edge Function
En Supabase → Edge Functions → Secrets agrega:

- `GITHUB_TOKEN`: token de GitHub.
- `GITHUB_REPOSITORY`: `propietario/repositorio`.
- `GITHUB_BRANCH`: normalmente `main`.
- `GITHUB_STICKER_ROOT`: normalmente `assets/stickers`.

## 4. Desplegar la función
Despliega la carpeta `supabase/functions/encisomath-github-stickers`. La verificación JWT debe permanecer activa.

## 5. Subir los archivos web
Haz push de los archivos tocados, incluido `assets/stickers/catalog.json`.

Los stickers nuevos reciben nombres únicos, se añaden a `assets/stickers/custom/` en GitHub y se registran en `catalog.json`. La calificación guarda únicamente la URL del sticker seleccionado.
