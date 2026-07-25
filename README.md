# EncisoMath LMS v0.25.046

## v0.25.046 — sticker PNG 1:1 en la tarjeta estudiantil de actividades
- Se añadió un sticker en la esquina inferior derecha de `em-student-activity-status`.
- El sticker usa una imagen PNG cuadrada 1:1 y se sale del contenedor, como un sticker real.
- Se aplicó un borde/silueta blanca de 3 px siguiendo la transparencia del PNG.
- Se habilitó `overflow: visible` únicamente para esta tarjeta, para que el sticker pueda sobresalir.
- Se añadió el archivo nuevo `assets/stickers/activity-status-cat.png` y se precachea en `sw.js`.
