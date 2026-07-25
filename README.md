# EncisoMath LMS v0.25.045

## v0.25.045 — tarjeta de resultado sin borde ni sombra

- Se eliminó el borde exterior de `em-student-activity-status`.
- Se eliminó la sombra desplazada exterior.
- Se conservan el color sólido, las figuras, el cristal interno, el contador y la gelatina.

## v0.25.045 — cristal también en Fecha de calificación

- `em-student-activity-status-top` continúa transparente, sin blur ni oscurecimiento.
- El efecto de cristal suave se aplica únicamente a los tres contenedores internos: `is-score`, `is-observation` e `is-graded-at`.
- Los tres usan el mismo fondo levemente oscuro, `blur(7px)` y `brightness(.94)`.
- Se conservan las cuatro figuras aleatorias, el contador y la gelatina de la calificación.
