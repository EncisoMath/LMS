## v0.24.295 - Tarjetas limpias fijas de quizzes

Cambio limitado a ASIGNATURA > PESTAÑA QUIZZES: se reemplazó visualmente el listado interno de quizzes por tarjetas arcade/flat limpias `em-quiz-card-clean` de tamaño fijo, con hero superior, figuras geométricas oscuras animadas, botón Iniciar negro, estado pendiente con “Disponible hasta” y estado calificado con “Calificado: X.X”.

Las tarjetas pendientes conservan alternancia de paleta EncisoMath: azul, naranja, aguamarina, verde, amarillo y rojo. Las tarjetas calificadas toman color según nota: 9.0-10.0 correcto, 7.0-8.9 verde, 6.0-6.9 amarillo, 4.0-5.9 naranja y 0.0-3.9 rojo. El espacio del botón queda reservado en estado calificado para evitar saltos de layout.

El botón Iniciar conserva el flujo real de quiz y abre el modal de inicio existente; solo se añadió rebote visual antes de abrir. No se tocaron Home, tarjetas de asignaturas, Clases, Estudiantes, Asistencia, Rockstars, navegación, ranking, podio, música, countdown, pantalla de juego, resultados, feedback, motor del quiz ni datos base.

Version/cache busting actualizado a 0.24.295.
