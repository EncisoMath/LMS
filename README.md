# EncisoMath PWA v0.4

Base funcional de EncisoMath como PWA instalable para GitHub Pages.

## Usuario demo

```text
0720
```

## Cambios v0.4

- Fondo global de la app en `#04101c`.
- Color principal por defecto `#1b96bf`.
- Opción para cambiar color principal y elegir fondo azul oscuro o negro total desde el menú de tres puntos del perfil.
- Encabezado docente rediseñado con inspiración tipo Twitter/X: portada animada, avatar, nombre, usuario y metadatos.
- Portadas con animación matemática/geométrica más orgánica, sin brillo artificial de izquierda a derecha.
- Tarjetas de asignaturas rediseñadas y sin contador de estudiantes en la cuadrícula.
- Gestor visual retirado de las tarjetas de asignatura; ahora aparece solo dentro de la asignatura como cuadro emergente.
- Botón de cerrar sesión en la fila superior del perfil.
- Barra inferior fija; no se desplaza con el contenido.
- Ajuste para que el scroll del navegador en web no mueva el contenido al aparecer.
- Cambio de asistencia sin fade de toda la pantalla: ahora se ilumina solo la tarjeta del estudiante.
- Cambio de pestañas sin remonte visual de toda la pantalla.
- Tarjetas de estudiantes más compactas.
- Botones de asistencia con texto: Asistió, No asistió y Excusa.
- Botón para eliminar estudiante en cada tarjeta.
- Modal de eliminación con alerta roja, fondo oscuro, líneas diagonales animadas y signo de exclamación con bounce.
- Esquinas de ventanas, tarjetas, botones, cuadros y modales en `6px`.

## Publicación en GitHub Pages

1. Crear un repositorio, por ejemplo `encisomath-ava`.
2. Subir todos los archivos de esta carpeta a la raíz del repositorio.
3. Ir a `Settings > Pages`.
4. Elegir `Deploy from a branch`.
5. Rama `main`, carpeta `/root`.
6. Abrir la URL publicada desde Chrome Android y usar `Instalar app`.

## Nota sobre datos

Los JSON en `data/` funcionan como datos base. GitHub Pages no puede escribir directamente sobre esos JSON desde el navegador de forma segura. Por ahora, asistencia, estudiantes añadidos, estudiantes eliminados, sesión, apariencia e imágenes personalizadas se guardan en `localStorage` del dispositivo.
