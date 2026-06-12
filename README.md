# EncisoMath PWA v0.3

Base inicial de AVA/LMS para GitHub Pages, construida con HTML5, CSS3, JavaScript puro y JSON.

## Usuario demo

```text
0720
```

## Cambios de la v0.3

- Login en modo oscuro con fondo negro.
- Figuras geométricas animadas con aparición, desaparición, desplazamiento, rotación y zoom.
- Transiciones entre pantallas más visibles: fade, blur y desplazamiento.
- Rediseño de tarjetas de asignaturas con apariencia más moderna y compacta.
- Portada docente más baja y rectangular.
- Bienvenida debajo de la portada.
- Foto de perfil más moderada, borde delgado y radio de 6px.
- Vista de asignatura rediseñada con tarjeta informativa más limpia.
- Tarjetas de estudiantes más compactas.
- Botones de asistencia con texto: Asistió, No asistió y Excusa.
- Regla visual general: ventanas, tarjetas, botones, campos, cuadros y modales con border-radius de 6px.
- Cache busting actualizado a v0.3.0 y service worker configurado para no cachear.

## Publicación en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio.
2. Entra a Settings > Pages.
3. Selecciona Deploy from a branch.
4. Usa la rama main y carpeta /root.
5. Abre la URL publicada en Chrome Android.
6. Instala la PWA desde el navegador.

## Datos

Los datos base están en:

```text
data/users.json
data/assignments.json
data/students.json
data/classes.json
```

GitHub Pages no puede escribir esos JSON desde la app de forma segura. Por ahora, los cambios de asistencia, sesión, estudiantes añadidos, portadas e iconos personalizados se guardan en localStorage del dispositivo.
