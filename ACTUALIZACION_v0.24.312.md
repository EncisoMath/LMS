# EncisoMath v0.24.312

## Visor PDF: nuevo pasado de hoja

La transición anterior fue reemplazada por un sistema de página 3D inspirado en el efecto clásico de `page flip`:

- La página visible se copia en la cara frontal de una hoja temporal.
- La página de destino se prepara debajo y en el reverso de esa hoja.
- La hoja gira desde el lomo correcto según se avance o retroceda.
- Durante el giro cambia levemente su ancho para simular curvatura.
- Un brillo recorre el borde doblado.
- Una sombra dinámica se proyecta sobre la página inferior.
- El comienzo incorpora un rizo diagonal de esquina.

El cambio mantiene:

- zoom con botones;
- pellizco con dos dedos;
- `Ctrl/Cmd + rueda`;
- arrastre cuando la página está ampliada;
- deslizamiento horizontal para cambiar de página;
- flechas del teclado;
- ajuste automático al dispositivo.

No requiere SQL ni cambios en Supabase.
