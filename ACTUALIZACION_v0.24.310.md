# EncisoMath LMS v0.24.310

## Antes de subir el código

Ejecuta una sola vez en **Supabase > SQL Editor**:

`SUPABASE_MIGRATION_v0.24.310.sql`

Debe mostrar cinco columnas nuevas de la tabla `lessons`:

- `page_count`
- `source_file_name`
- `storage_pdf_path`
- `storage_thumbnail_path`
- `thumbnail_url`

## Cambios

### Actividades y quizzes

Ambas pestañas incluyen selector **Cuadrícula / Lista**. La preferencia se recuerda en el navegador.

### Clases

El botón **Añadir clase** abre un formulario con:

- nombre del tema;
- periodo, preseleccionado con el periodo global activo;
- PDF obligatorio, máximo 20 MB;
- imagen de portada opcional, máximo 5 MB;
- alcance **Solo este curso** o **Todo el grado**.

Cuando no se proporciona portada, la aplicación genera una imagen WEBP usando la primera página del PDF.

### Tarjetas

- En cuadrícula, cada clase se muestra como un cuaderno utilizando la portada o la primera página, sin mostrar el nombre.
- En lista, se muestra portada, nombre, periodo y cantidad de páginas.

### Lector

El PDF se presenta como una sola hoja de cuaderno. Se puede cambiar de página mediante:

- botones laterales;
- flechas izquierda/derecha del teclado;
- deslizamiento horizontal en pantalla táctil.

La transición simula el giro de una hoja.

## Prueba recomendada

1. Entra a una carga, por ejemplo 10-2.
2. Abre **Clases > Añadir clase**.
3. Sube un PDF sin portada y elige **Solo este curso**.
4. Verifica que la portada se genere desde la primera página.
5. Comprueba que la clase no aparezca en 10-1 ni 10-3.
6. Crea otra clase usando **Todo el grado** y verifica que aparezca en los tres cursos de grado 10.
7. Abre el PDF y cambia páginas mediante botones y deslizamiento.
