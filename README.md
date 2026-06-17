## v0.24.253

Cambios v0.24.253:
- Pantalla de transición entre ítems: se agregó una capa visual de bandas animadas dentro del contenedor actual, sin tocar countdown de 3 segundos ni polígono/puntaje acumulado.
- Transición inicial: muestra banda de información del quiz por 3 segundos, luego banda ITEM 1 por 3 segundos, y ambas salen con rebote/gelatina.
- Transiciones siguientes: solo muestran banda ITEM N por 3 segundos y luego salen.
- Bandas con ancho 125vw, altura clamp(190px, 32vh, 280px), color aleatorio entre #e21b3c, #ff7a00, #EBB513, #24b49a y #54c600, rotación aleatoria y figuras geométricas lentas 0.4x.
- No se tocaron preguntas, respuestas, ranking, podio, resultados, música, datos ni lógica de puntaje.
- Version/cache busting actualizado a 0.24.253.
