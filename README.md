## v0.24.216

- Ajuste puntual en Quizzes: se agrega una barra horizontal de countdown dentro del hero superior de la pantalla de pregunta.
- La barra mide `8px` de alto, usa la misma alineación/padding horizontal del hero y se actualiza según el tiempo configurado del ítem.
- El hero superior sacrifica altura interna para alojar la barra, con `3px` de separación sobre la barra y `3px` debajo.
- No se tocó el contenedor de elementos del quiz (`.quiz-fullscreen-content`, `.quiz-stage-fullscreen`, `.quiz-question-content`, `.quiz-answer-zone`) ni layout de respuestas.
- Versión/cache busting actualizado a `0.24.216`.

## v0.24.216

- Corrección puntual de Flip: se eliminaron las reglas de `overflow: hidden`, `contain: paint` y `clip-path` agregadas en versiones anteriores sobre `.quiz-flip-card` / `.quiz-flip-inner`, porque aplanaban el 3D y dejaban visibles los signos `?` invertidos.
- Se restauró el Flip 3D real de dos caras manteniendo `perspective`, `transform-style: preserve-3d`, `backface-visibility: hidden` en las caras y los `rotateY` originales.
- Se mantiene la eliminación de sombra/resplandor exterior en Flip usando solo `box-shadow` interno y `filter: none`, sin recortar ni aplanar la tarjeta.
- No se tocaron jello de botones, Organizar, hero, countdown, puntos, música, ranking/podio, padding ni datos base.
- Versión/cache busting actualizado a `0.24.216`.

## v0.24.216
- Corrección puntual en Quizzes/Flip: el botón `Enviar respuesta` del tipo Flip ahora ejecuta `jello-horizontal` al pulsarlo, reutilizando la clase existente sin tocar la animación de las tarjetas.
- Corrección puntual en Quizzes/Organizar: al pulsar `Enviar respuesta`, las tarjetas vuelven a pasar por estado gris intermedio mientras se valida; al revelar, se limpian estilos inline para conservar verde/rojo sólidos sin degradado.
- No se tocaron hero, countdown, puntos, música, ranking/podio, padding ni datos base.
- Versión/cache busting actualizado a `0.24.216`.

## v0.24.211
- Correccion puntual de Flip sobre v0.24.210: se restaura el comportamiento 3D real de dos caras, quitando el recorte/clip que dejaba visibles solo las espaldas.
- Se mantienen las sombras exteriores eliminadas en Flip mediante bordes internos y `filter: none`, sin usar `clip-path` ni `contain: paint` sobre la tarjeta.
- No se tocaron jello de botones, hero, countdown, puntos, musica, ranking/podio, padding ni datos base.
- Version/cache busting actualizado a `0.24.211`.

## v0.24.211
- Cambio puntual en Quizzes: se eliminó el color azul/cian que aparecía al pulsar o deshabilitar los botones `Enviar respuesta` del flujo de quiz, sin tocar su animación `jello`.
- En Quiz Flip se eliminaron sombras/resplandores exteriores durante la animación de giro (`is-flip-animating`, `is-flipping-open`, `is-flipping-close`), conservando solo bordes internos.
- En Organizar, los estados de validación verde/rojo ahora usan colores sólidos sin degradados.
- No se tocaron jello de botones, hero, countdown, puntos, música, ranking/podio, datos base, Rockstars, Clases ni Estudiantes.
- Versión/cache busting actualizado a `0.24.211`.

## v0.24.211

- Ajuste visual puntual en Quizzes: se prueba separación lateral del hero superior en `8px` por lado, manteniendo `quiz-fullscreen-layer` sin padding horizontal (`0px`) y el contenido del quiz con `4px`, para conservar la corrección del recorte de animaciones sin dejar el hero pegado al borde.
- No se tocaron preguntas, countdown, puntos, música, ranking/podio, Rockstars, Clases, Estudiantes ni datos base.
- Versión/cache busting actualizado a `0.24.211`.

## v0.24.211
- Corrección puntual del hero superior en pantalla de pregunta: se mantiene `quiz-fullscreen-layer` sin padding lateral para que las animaciones de opciones no se recorten, pero el hero ahora recibe margen externo real de `4px` a izquierda y derecha mediante selector directo sobre `.quiz-fullscreen-top.quiz-fullscreen-top-countdown`.
- Se conserva `quiz-fullscreen-content` con padding lateral `4px`, countdown normal activo y sin paneles debug visibles.
- No se tocaron preguntas, tipos de quiz, countdown, puntos de transición, música, ranking/podio, Rockstars, Clases ni Estudiantes.
- Versión/cache busting actualizado a `0.24.211`.

## v0.24.211

- Se fijaron los valores encontrados en el debug de paddings: pantalla completa X en `0px` y contenido del quiz X en `4px`.
- Se retiró el panel temporal `Debug paddings` de la tuerquita y se reactivó el countdown normal.
- Para que el hero superior no quede de extremo a extremo con la pantalla completa en `0px`, se le aplicó separación lateral de `4px` a cada lado.
- No se tocaron preguntas, tipos de quiz, puntos de transición, música random, ranking/podio, Rockstars, Clases, Estudiantes ni datos base.
- Versión/cache busting actualizado a `0.24.211`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.211

- Corrección puntual en Quizzes sobre v0.24.200.
- Se reparó el recorte real de las animaciones `jello-horizontal` y `wobble-hor-bottom` en correcto/incorrecto, especialmente visible en el tipo `order`/Organizar cuando las tarjetas rotan o se desplazan durante la validación.
- Se agregó una clase temporal global `quiz-reveal-overflow-active` durante el reveal para abrir el overflow de `quiz-fullscreen-content`, `quiz-stage-fullscreen`, `quiz-question-content`, `quiz-answer-zone` y contenedores específicos de ABCD, Verdadero/Falso, Abierta, Organizar y Flip.
- En Organizar se añadió un colchón lateral temporal solo durante la animación para que las tarjetas de ancho completo no se corten al inclinarse.
- No se tocaron el fondo negro, hero flat con malla, countdown, música random, puntos de transición, ranking/podio, Rockstars, Clases, Estudiantes ni datos base.
- Versión/cache busting actualizado a `0.24.211`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.200

- Ajustes finos en Quizzes sobre v0.24.199.
- Se quitó la sombra/resplandor del número del countdown; conserva el color del tema (`--maincolor`) sin `text-shadow`.
- En el tipo Flip se quitó la sombra inferior/drop-shadow de las tarjetas al tocar y girar; se mantienen solo los bordes internos/inset necesarios.
- Se restauró la malla animada del hero superior manteniendo el estilo flat y el color sólido basado en el tema.
- Se corrigieron recortes visuales de las animaciones de correcto/incorrecto (`jello`/`wobble`) en los tipos de quiz, dejando visibles los desbordes necesarios durante la revelación.
- No se tocaron puntos de transición, música random, ranking/podio, datos base, Rockstars, Clases ni Estudiantes.
- Versión/cache busting actualizado a `0.24.200`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.198

- Ajuste visual en Quizzes: el hero superior de pregunta ahora es mas flat, con color solido basado en `--maincolor` pero oscurecido, conservando la malla animada.
- El numero del countdown dentro del poligono usa ahora el color del tema (`--maincolor`).
- Las tarjetas del tipo de pregunta Organizar/Ordenar dejan de usar degradado y quedan con color solido por tarjeta.
- Version/cache busting actualizado a `0.24.198`.
- Validacion: `node --check app.js`, `node --check sw.js`, JSON/manifest validos y `unzip -t` sin errores.

## v0.24.197

- Se restauró en la banda global de feedback del quiz (`Correcto`, `Incorrecto`, `Enviado` y `Tiempo!`) el efecto de entrada/salida tipo slide lateral con estiramiento, blur y degradado de opacidad.
- La corrección elimina el bloqueo visual introducido por reglas `opacity: 1 !important` y `filter: none !important`, que impedían que la animación `encisoFeedbackSlideBlurFull150` mostrara el estiramiento/blur.
- Se mantiene la banda flat de v0.24.195/v0.24.196: colores sólidos 100% opacos y malla animada visible encima del color.
- No se tocaron countdown, puntos de transición, música random, ranking/podio, preguntas, Rockstars, Clases, Estudiantes ni datos base.
- Versión/cache busting actualizado a `0.24.197`.

## v0.24.196

- Se restaura la malla visible en la banda global de feedback del quiz (`Correcto`, `Incorrecto`, `Enviado` y `Tiempo`).
- La banda conserva el ajuste de v0.24.195: color sólido/flat y 100% opaco, pero vuelve a mostrar la malla animada encima del color.
- Para `Tiempo`, la malla queda en líneas oscuras sobre fondo blanco; para correcto/incorrecto/enviado, la malla queda en líneas claras sobre el color sólido.
- No se tocaron countdown, puntos de transición, música random, ranking/podio, preguntas, Rockstars, Clases, Estudiantes ni datos base.
- Version/cache busting actualizado a `0.24.196`.

## v0.24.195

- Se ajusta la pantalla de preguntas del quiz: `.quiz-stage.quiz-stage-fullscreen` queda sin fondo y sin borde, y el fondo general de `.quiz-fullscreen-layer` queda negro puro.
- Se elimina el recuadro superior `Ítem X/Y` del hero del quiz y se compacta el hero desde abajo para ganar espacio; el countdown queda centrado verticalmente.
- La transición vuelve a avanzar automáticamente sin botón `Seguir`; el contador acumulado de puntos conserva la lógica de puntos por ítem + tiempo, pero el tiempo visible del contador se reduce 0.2 s.
- La banda global de `Correcto`, `Incorrecto`, `Enviado` y `Tiempo` queda con color sólido 100% opaco, estilo flat, sin degradados ni malla visible.
- El ítem ABCD/multiple choice del quiz demo queda con `timeLimit: 30` segundos.
- Version/cache busting actualizado a `0.24.195`.

## v0.24.194

- Se fija el acumulador/contador de puntos de transición con posición Y inicial `300px` y zoom `55%`, usando clave nueva `encisomath:quizTransitionScoreTune:v0.24.194` para no arrastrar calibraciones anteriores.
- Se eliminaron de la interfaz los paneles temporales/debug de puntaje: ya no aparecen el panel de fórmula, sliders, botón de repetir animación ni engranajes de ajuste en la transición.
- También se ocultó el panel temporal de calibración del podio/ranking para dejar la experiencia limpia.
- Se reemplazó el panel de transición por un flujo limpio con botón `Seguir`, manteniendo el contador acumulado funcionando y sin mostrar menús de calibración.
- Se mantiene la lógica ya corregida de puntos acumulados: ítem + tiempo en un solo contador, máximo 20.000.
- Versión/cache busting actualizado a `0.24.194`.

## v0.24.193

- Corrección en Quizzes/puntos de transición: se arregló la captura del tiempo demorado por el estudiante. El bug venía de leer `respondedElapsedSeconds` con `Number(null)`, que devolvía `0` y hacía que el debug mostrara `0s de 20s`, impidiendo sumar puntos por tiempo.
- `getQuizAnswerTimingSnapshot()` ahora solo usa `respondedElapsedSeconds` si realmente existe; si está `null`/`undefined`, calcula el tiempo con `performance.now() - startedAt` o con los segundos restantes.
- El debug temporal de transición se mantiene para verificar `tiempoDemorado`, `r`, curva, puntos por ítem, puntos por tiempo y acumulado.
- Se conserva el contador de transición con Y inicial `220px`, zoom `55%`, y clave nueva `encisomath:quizTransitionScoreTune:v0.24.193` para evitar valores viejos.
- Versión/cache busting actualizado a `0.24.193`.

## v0.24.192

- Corrección enfocada en Quizzes/puntaje de transición: se reforzó la captura del tiempo real de respuesta en el momento exacto en que el estudiante responde/valida/envía, pasándolo explícitamente a `recordQuizAnswer()` para que no dependa de lecturas posteriores del countdown.
- El contador acumulado de transición sigue siendo único, pero ahora el cálculo vuelve a sumar explícitamente `puntos por ítem + puntos por tiempo` en un mismo total.
- Se agregó un debug visible temporal en la transición con: estado del ítem, puntaje por ítem, puntaje por tiempo, tiempo que demoró el estudiante, tiempo límite, tiempo restante, ratio `r`, valor de curva, fórmula usada y acumulado anterior → nuevo.
- La fórmula visible es: `r = tiempoDemorado / tiempoLimite`; si `r <= 0.18`, tiempo suma 0; si `0.18 < r <= 0.75`, `curva = ((r - 0.18)/(0.75 - 0.18))^0.72`; si `r > 0.75`, `curva = max(0.08, 1 - ((r - 0.75)/(1 - 0.75))^1.45 * 0.92)`; `puntosTiempo = redondear(maxTiempo * curva)`.
- Se mantiene la posición inicial del contador en Y `220px` y zoom `55%`, con clave nueva `encisomath:quizTransitionScoreTune:v0.24.192` para no arrastrar calibraciones viejas.
- No se tocaron ranking/podio, countdown visual, música random por pregunta, tipos de pregunta, Rockstars, Clases, Estudiantes ni datos base.
- Versión/cache busting actualizado a `0.24.192`.

Validación:

```bash
node --check app.js
node --check sw.js
JSON/manifest válidos
unzip -t sin errores
```

## v0.24.191

- Se parte de `v0.24.190`.
- Corrección del contador de puntos en la pantalla de transición: ahora el acumulado suma correctamente en un solo contador los puntos por ítem y los puntos por tiempo.
- Los puntos por tiempo ya no dependen de que la respuesta sea correcta: se calculan cuando el estudiante hace un intento real y no por timeout; si responde demasiado inmediato, la curva puede dar 0.
- Los puntos por ítem se mantienen solo para respuestas correctas, sumando hasta 10.000 si todo queda correcto.
- Los puntos por tiempo suman hasta otros 10.000 con curva de lectura/respuesta, para un máximo total de 20.000.
- Se aplicaron valores iniciales de calibración del contador de transición: posición Y `220px` y zoom `55%`.
- Clave nueva de calibración: `encisomath:quizTransitionScoreTune:v0.24.191`, para no arrastrar valores viejos.
- Se mantienen countdown por ítem, música random por pregunta, ranking/podio, pantalla del quiz limpia y tipos de pregunta actuales.
- Versión/cache busting actualizado a `0.24.191`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.189

- Se parte de `v0.24.188`.
- Se eliminó por completo el sistema de puntos por ítem y por tiempo de Quizzes.
- Se retiraron cálculos `score`/`points`, overlays flotantes de puntaje, animación en cascada de puntos y panel temporal `⚙️ Puntajes`.
- El flujo del quiz vuelve a continuar normalmente después de la banda de feedback; ya no queda pausado por puntajes ni requiere el botón `Seguir` asociado a esa calibración.
- Se mantienen countdown por ítem, música random por pregunta, ranking/podio de resultados y la lógica de respuestas actual.
- No se tocaron Rockstars, Clases, Estudiantes, datos base ni tipos de pregunta.
- Version/cache busting actualizado a `0.24.189`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.


## v0.24.187

- Se parte de `v0.24.186`.
- Version temporal de calibracion para los puntajes flotantes del quiz.
- Se agrego panel `⚙️ Puntajes` con sliders de posicion X, posicion Y y zoom para el puntaje por pregunta y el puntaje por tiempo.
- Se agrego boton `Repetir animacion` para reproducir de nuevo los puntajes en cascada con los valores actuales.
- El flujo del quiz queda pausado despues de la animacion de puntajes y solo continua al pulsar `Seguir`.
- Se conserva el layout de contenedores de opciones/respuesta de v0.24.186; los puntajes siguen como overlays flotantes sin fondo, con texto blanco y resplandor oscuro.
- Version/cache busting actualizado a `0.24.187`.


## v0.24.60

- Se parte de `v0.24.59`.
- En el modal de la tuerca de Quizzes se agrego una opcion para mostrar/ocultar la imagen como vista previa, sin borrar la imagen del item.
- Texto A ahora se alinea a la izquierda y se pega a la parte inferior de su contenedor.
- Texto B ahora se alinea a la izquierda y se pega a la parte superior de su contenedor.
- Se mantiene el tamano base unificado de Texto A/B y la reduccion automatica segun la longitud del texto.
- Version/cache busting actualizados a `0.24.60`.

## v0.24.59

- Se parte de `v0.24.58`.
- Se corrigió la inconsistencia entre `Texto A` y `Texto B`: ahora ambos usan el mismo tamaño base por defecto (`20px`) y el mismo estilo visual.
- En la tuerca, el control de fuente queda unificado como `Texto A/B fuente base`, evitando que Texto A y Texto B tengan tamaños distintos por defecto.
- Se mantiene la reducción automática de fuente según longitud para ambos textos con los mismos porcentajes.
- Versiones/cache busting actualizados a `0.24.59`.

# EncisoMath PWA - AVA/LMS en GitHub Pages

Versión inicial: `0.1.0`

Este proyecto es una base funcional para migrar el AVA hecho en Glide hacia una PWA móvil instalable publicada con GitHub Pages.

## Qué incluye

- PWA instalable para Android y escritorio.
- Service Worker configurado para **no cachear** y pedir siempre la versión publicada más reciente.
- Login por ID con último usuario y opción de mantener sesión iniciada.
- Vista docente inicial.
- Portada tipo red social, foto de perfil y tarjetas de asignaturas.
- Filtros por grado, área y curso.
- Vista de asignatura con portada personalizable localmente.
- Pestaña de estudiantes con asistencia diaria: asistió, no asistió y excusa.
- Nuevo estudiante agregado desde la asignatura actual.
- Pestaña ROCKSTARS con puntos de participación por periodo, emojis por rango y registro de eventos +1/-1.
- Pestaña de clases por periodos, vista cuadrícula/lista.
- Clase interactiva de ejemplo: gráficos de barras con calculadora visual en Canvas.
- Datos semilla en archivos JSON.

## Usuario demo

- Docente: `0720`

Los usuarios se editan en:

```text
data/users.json
```

## Estructura

```text
encisomath-pwa/
├── index.html
├── styles.css
├── app.js
├── sw.js
├── manifest.webmanifest
├── data/
│   ├── users.json
│   ├── assignments.json
│   ├── students.json
│   ├── classes.json
│   └── rockstars.json
├── classes/
│   └── graficos-de-barras.html
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    ├── default-avatar.svg
    ├── default-profile.svg
    └── subject-statistics.svg
```

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `encisomath-ava`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En GitHub entra a **Settings > Pages**.
4. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda y espera el enlace de GitHub Pages.
6. Abre el enlace en Android con Chrome y usa **Agregar a pantalla principal** o **Instalar app**.

## Sobre los JSON en GitHub

GitHub Pages permite leer archivos JSON, pero no permite escribirlos desde la app de forma segura. Esta versión usa:

- JSON del repositorio como datos base.
- `localStorage` del dispositivo para sesión, asistencia, estudiantes añadidos y portada personalizada.

Para guardar asistencia y cambios en la nube sin riesgo, hace falta una segunda fase con una de estas opciones:

- Google Sheets + Apps Script.
- Supabase/Firebase.
- Backend pequeño con autenticación.
- GitHub API, pero nunca exponiendo un token privado en el navegador.

## Sobre notificaciones

Esta base incluye prueba de notificación local usando la API de notificaciones del navegador. Las notificaciones push reales cuando la app está cerrada requieren un servidor o servicio externo que envíe los mensajes push.

## Cómo crear una nueva clase interactiva

1. Crea un archivo HTML dentro de `classes/`, por ejemplo:

```text
classes/medidas-de-tendencia-central.html
```

2. Incluye HTML, CSS y JavaScript dentro de ese archivo. Puede tener gráficos, calculadoras, simuladores, preguntas, canvas, etc.
3. Registra la clase en `data/classes.json`:

```json
{
  "id": "central-tendency",
  "period": 2,
  "area": "Matemáticas",
  "subject": "Estadística",
  "title": "Media, mediana y moda",
  "emoji": "🎯",
  "type": "Clase interactiva",
  "estimatedTime": "50 min",
  "contentUrl": "./classes/medidas-de-tendencia-central.html"
}
```

## Próximas fases recomendadas

1. Completar vista estudiante.
2. Añadir exportación/importación de asistencia.
3. Crear panel de administración de JSON.
4. Conectar persistencia real en la nube.
5. Diseñar una plantilla estándar para clases generadas con ChatGPT.


## v0.10

- Los botones activos de asistencia ahora usan color fijo por estado: verde para Asistió, rojo para No asistió y amarillo para Excusa, independientemente del color del tema.


## v0.24

- Ajuste del modal de eliminación: signos de exclamación más juntos y fondo rojo con patrón de alerta más marcado.


## v0.24
- Login optimizado: se quitaron las figuras geométricas animadas.
- Se conservaron y reforzaron los glows/destellos de esquina con animación más liviana.
- No se tocaron clases, home, asistencia ni warning.


## v0.24

- Paleta de tema actualizada con 16 colores solicitados y nombres en español.
- Color por defecto ajustado a Azul Enciso `#1976D2`.


## v0.24.2

- Se eliminaron glows residuales que aparecían entre transiciones de pantalla.
- El fondo global de `body`, `#app`, `.app-shell`, `.screen` y `.loading-screen` queda en negro plano durante cambios de vista.
- Se desactivó el `filter: blur(...)` de la transición general para evitar que los elementos de la pantalla anterior se conviertan en manchas de color.
- Se conserva el efecto neón únicamente en las figuras geométricas del login.


## v0.24.3

- Se restauró la animación tipo bounce/squash-stretch en los signos de exclamación del modal de eliminación.
- Se eliminó el patrón de signos de exclamación del fondo del warning.
- Se reemplazó por una malla roja diagonal inspirada en la malla de los banners de clases/asignaturas.

## v0.24.4

- Se corrigió la animación visible del warning de eliminación: los signos de exclamación ahora se animan mediante contenedores `span` independientes, con bounce y squash/stretch más marcado.
- La malla roja del encabezado del warning dejó de depender del pseudo-elemento y ahora usa un elemento real `.danger-red-mesh`, con animación de desplazamiento y pulso.
- Se agregó cache busting a `styles.css`, `app.js` y `sw.js` para forzar que el navegador cargue la versión actualizada.
- Versión actualizada a `0.24.4`.


## v0.24.5

- Se comparó la versión `encisomath-pwa-v0.20(1).zip` para recuperar la animación original del warning de eliminación.
- Se restauró el HTML del warning con imágenes directas `warning-mark-a` y `warning-mark-b`, sin contenedores intermedios, para que los keyframes actúen sobre los signos de exclamación como en la versión antigua.
- Se recuperaron los keyframes `warningJumpCloseA` y `warningJumpCloseB`, con rebote, squash/stretch y desfase entre signos.
- Se reemplazó la malla previa del warning por una malla basada en la cabecera de clases `.lesson-head::before`, usando el mismo desplazamiento suave `lessonGridDrift`, pero con tonos rojos.
- Se mantuvo la capa real `.danger-red-mesh` dentro del encabezado del modal para evitar conflictos con pseudo-elementos antiguos.
- Se actualizó cache busting a `styles.css?v=0.24.5`, `app.js?v=0.24.5`, `sw.js?v=0.24.5` y manifest `index.html?v=0.24.5`.


## v0.24.7

- Se corrigio definitivamente la animacion del warning de eliminacion. La causa era que reglas heredadas con `transform: ... !important` y `background-position: ... !important` bloqueaban los keyframes, por eso los signos y la malla quedaban estaticos.
- Los signos de exclamacion ahora se animan mediante contenedores `warning-bounce` con keyframes propios, evitando que los `transform !important` heredados congelen la animacion.
- Se agrego un fallback para que, si el navegador conserva temporalmente el HTML anterior, los signos directos tambien puedan animarse mediante `translate`, `scale` y `rotate`.
- La malla roja del warning conserva la estructura visual de la cabecera de clases y ahora desplaza `background-position` sin declararlo como `!important`, de modo que el movimiento suave si se ejecuta.
- Se actualizo cache busting a `0.24.7`.

- Se agrego un refuerzo por JavaScript con Web Animations API al abrir el modal para arrancar la malla y los signos aunque alguna regla CSS cacheada o heredada intente dejarlos quietos.


### v0.24.7
- Ajuste visual del warning de eliminación: los signos de exclamación quedaron más pegados entre sí.
- Se reemplazó el rebote/squash por una animación de zoom in / zoom out más limpia.
- Se mantuvo la malla roja animada del encabezado del warning.

## v0.24.8

- Se agrego un control temporal debajo de los signos de exclamacion del warning de eliminacion para calibrar visualmente la separacion entre ambos signos.
- El slider ajusta la variable `--warning-gap` en tiempo real y guarda el valor en `localStorage` con la clave `encisomath:warningBangGap`.
- Rango de prueba: -8 px a 24 px. Valor inicial: 8 px.
- Se mantiene la animacion zoom in / zoom out de los signos y la malla roja animada del encabezado.
- Se actualizo cache busting a `0.24.8`.

## v0.24.9

- Se agrego un panel temporal de calibracion dentro del warning de eliminacion de estudiante.
- El panel permite ajustar separacion de los signos, movimiento horizontal/vertical de los signos, tamano base, zoom minimo, zoom maximo y movimiento horizontal/vertical del texto.
- Los valores se guardan en `localStorage` con la clave `encisomath:warningTune` para que el usuario pueda probar y reportar los valores finales.
- Se mantuvo la malla roja animada del warning y se actualizo cache busting a `0.24.9`.

## v0.24.10

- Se fijaron los valores reportados por el usuario para el warning de eliminacion: separacion `0px`, mover signos horizontal `-14px`, mover signos vertical `-22px`, tamano `78px`, zoom minimo `100%`, zoom maximo `155%`, mover texto horizontal `14px` y mover texto vertical `0px`.
- Se retiro el panel temporal de calibracion del modal para dejar el warning limpio.
- El warning ahora ignora valores anteriores guardados en `localStorage` para que el diseno fijo se mantenga igual en todos los navegadores.
- Se mantuvo la malla roja animada y se actualizo cache busting a `0.24.10`.


## v0.24.11 - ROCKSTARS

- Se agregó una tercera pestaña dentro de cada asignatura: **ROCKSTARS**.
- La pestaña muestra los estudiantes del curso/asignatura con buscador, sin botón de agregar estudiante.
- Cada estudiante tiene puntos por periodo y botones `-1` / `+1` para restar o sumar participación.
- La tarjeta conserva referencia visual de asistencia del día mediante un degradado lateral derecho.
- La foto se reemplazó por un emoji según puntos acumulados del periodo:
  - `15+`: 💎 diamante.
  - `10+`: 🔥 fuego.
  - `5+`: 😎 gafas de sol.
  - `1 a 4`: 🚀 cohete.
  - `0`: 🙂 carita feliz.
  - `-1 a -5`: 😡 enojo.
  - `menos de -5`: 💀 calavera.
- El encabezado ROCKSTARS incluye cohete animado, fuego, chispas y texto neón cambiante.
- Se creó `data/rockstars.json` como base de eventos con el ID del estudiante como llave; cada evento usa `assignmentId`, `period`, `date` y `delta`.
- Los nuevos eventos creados desde la PWA se almacenan localmente en `localStorage` con clave `encisomath:rockstars:<assignmentId>`.

## v0.24.12

Mejoras visuales de la pestaña Rockstars:

- La pestaña se muestra como `Rockstars`, no en mayúsculas sostenidas.
- El banner usa el texto `ROCKSTAR` con borde, gradiente neón animado y mayor intensidad visual.
- Se mejoró el fuego del cohete con plume central, capas de llama, humo y chispas.
- Se eliminó el degradado lateral por asistencia en las tarjetas Rockstar.
- Las tarjetas Rockstar ahora tienen borde y glow neón según el color/rango del puntaje.
- El número de puntos aparece más grande, sin recuadro, con `pts` proporcional.
- Estudiantes con asistencia `No asistió` o `Excusa` aparecen desactivados, en gris, con emoji 😴 y sin botones `-1`/`+1`.

## v0.24.14

- Se quita el toast automático al sumar/restar puntos Rockstar; ahora el cambio se confirma visualmente en el botón y la tarjeta.
- Se reduce el glow de la palabra ROCKSTAR del banner para mejorar legibilidad sin perder el efecto neón.
- Los botones +1 y -1 quedan forzados a verde/rojo al tocarse, sin depender del color del tema.
- El total de puntos se agranda y se aumenta el resplandor exterior de las tarjetas Rockstar para acercarlas más al estilo de Estudiantes.

## v0.24.13

Ajustes visuales en Rockstars:

- Los botones `+1` y `-1` adoptan la misma linea visual de los botones activos de asistencia: verde para `+1` y rojo para `-1`, con borde, outline y resplandor.
- Las tarjetas Rockstar mantienen el estilo de las tarjetas de Estudiantes: fondo oscuro, borde coloreado y resplandor exterior segun el rango de puntaje.
- Se elimina el exceso de capas neon internas para que el efecto quede mas parecido al estado visual de asistencia.
- El texto `Asistencia hoy` cambia a `Asistencia`.
- Se mantiene la proteccion para estudiantes con No asistio o Excusa: quedan bloqueados, grises y sin botones de puntos.

## v0.24.15

Ajustes visuales adicionales en Rockstars:

- El texto principal del banner cambia a `ROCKSTARS`.
- Se recupera un glow más fuerte en el título y se agrega animación de levitación suave.
- Se agrega una bola de disco giratoria con destellos en el banner de Rockstars.
- Se elimina la línea inferior de rango/periodo dentro de cada tarjeta Rockstar para compactar la lista.
- Los botones `+1` y `-1` refuerzan su estado verde/rojo con estilos de alta prioridad y confirmación visual directa desde JavaScript, evitando que tomen el color del tema.
- El total de puntos se agranda un poco más.
- Se incrementa el resplandor exterior de las tarjetas para acercarlas al estilo de la pestaña Estudiantes.

## v0.24.16

- Se retiró la bola de disco del banner Rockstars.
- Se agregaron luces tipo reflectores animados al banner.
- El título `ROCKSTARS` conserva el movimiento leve de levitación.
- Se agregó un panel temporal de calibración para la cantidad total de puntos con sliders de posición X, posición Y y zoom. Los valores se guardan en `localStorage` como `encisomath:rockstarScoreTune`.
- Se actualizó cache busting a `0.24.16`.

## v0.24.17

- Se agregó un panel temporal para calibrar la información del banner de asignatura con sliders de posición X y zoom. Los valores se guardan en `localStorage` como `encisomath:subjectInfoTune`.
- Se hizo más inmediata la respuesta visual de los botones `+1` y `-1` en Rockstars: el flash verde/rojo ahora inicia en `pointerdown` y dura menos, evitando sensación de botón pegado.
- Se actualizó cache busting a `0.24.17`.

## v0.24.18

- Se fijaron los valores finales de la calibración de puntos Rockstar: X `-2px`, Y `6px`, zoom `79%`, y se retiró el panel temporal de puntos.
- Se fijaron los valores finales de la información del banner de asignatura: X `10px`, zoom `137%`, y se retiró el panel temporal del banner.
- El zoom de la información del banner ya no se aplica con `transform: scale()`, sino mediante tamaños de fuente calculados para evitar que el texto se vea borroso.
- Se añadió más separación interna en los buscadores para que el texto `Buscar estudiante` no quede pegado al borde izquierdo.
- Se actualizó cache busting a `0.24.18`.

## v0.24.19

- Se agregó la pestaña **Quizzes** dentro de cada asignatura, junto a Estudiantes, Clases y Rockstars.
- Se creó la base `data/quizzes.json` con un quiz demo de Estadística para periodo 1.
- La pestaña Quizzes tiene banner propio, selector de periodos y tarjetas de quizzes disponibles.
- El quiz demo incluye estructura visual tipo concurso con opciones 2x2 en rojo, azul, amarillo y verde.
- Se agregaron tipos de pregunta preparados: opción múltiple con única respuesta, verdadero/falso, pregunta abierta con botón de enviar y arrastrar para unir con tarjetas azules y rojas.
- Las preguntas admiten texto principal, imagen ampliable al tocar y texto de apoyo debajo de la imagen.
- Se añadió el recurso `assets/quiz-demo-statistics.svg` como imagen de demostración.
- Se actualizó cache busting y versiones a `0.24.19`.

## v0.24.20

- Mejorado el efecto al pulsar respuestas de opción múltiple y verdadero/falso: ya no aparece glow blanco fuerte ni se opaca la opción; se mantiene el color Kahoot y se marca correcto/incorrecto con borde y glow controlado.
- Rehecho el tipo de pregunta `match` / arrastrar para unir: las opciones azules se mueven realmente hacia los espacios rojos, desaparecen de la columna de opciones al soltarlas, permiten reemplazo, reinicio y validación con botón. También se agregó selección por toque como apoyo en móviles.
- Los quizzes ahora se abren en una capa de pantalla completa dentro de la app, sin botón de salida ni regreso visible; se bloquea el back del navegador mientras el quiz está activo.
- Actualizado cache busting a `0.24.20`.

## v0.24.21

- Se agregó pantalla previa antes de iniciar un quiz, avisando que solo se podrá salir al finalizar.
- Al pulsar `Empezar quiz`, se muestra brevemente el título y descripción del quiz durante 2 segundos.
- Antes de cada pregunta aparece una transición tipo concurso con etiqueta `Ítem N`, barrido lateral y barra de progreso de 1.5 segundos.
- Las preguntas de opción múltiple y verdadero/falso ahora siguen una dinámica más cercana a Kahoot: al responder, las demás opciones se opacan, luego se revela la correcta en verde y la incorrecta seleccionada en rojo con íconos `✓` y `×`.
- Se agregó feedback animado de correcto/incorrecto con frases de gamificación y permanencia de 4 segundos antes de pasar al siguiente ítem.
- Al finalizar el último ítem se muestra una pantalla de resultados con acciones para volver a Quizzes, ir a Clases, ver Rockstars o repetir el quiz.
- El bloqueo del botón atrás se mantiene durante la ejecución del quiz y se libera al llegar a resultados.
- Se ajustó también la validación del tipo `match` para que al validar se registre el resultado, muestre feedback y avance automáticamente.
- Actualizado cache busting a `0.24.21`.

## v0.24.22

Ajustes en Quizzes:
- Al tocar una tarjeta de quiz ya no se abre inmediatamente la experiencia en pantalla completa; primero aparece un cuadro emergente de inicio con la línea visual de los modales y un banner con malla animada.
- Al pulsar **Empezar quiz**, inicia una escena negra de presentación con el título y descripción del quiz, sin iconos, con figuras tipo Kahoot que salen desde el centro con glow y desplazamiento.
- La transición entre ítems se rehízo para alinearse con el lenguaje visual de la app: fondo negro, figuras explosivas, etiqueta `Ítem N` en barrido lateral y barra de progreso de 100% a 0%.
- Las preguntas usan una cabecera más flexible: el texto se adapta por longitud y aprovecha mejor el ancho del contenedor.
- El tipo `match` / arrastrar para unir ahora usa opciones con paleta rojo, azul, amarillo y verde; las zonas receptoras empiezan grises y toman un tono oscuro del color de la opción colocada.
- Al validar uniones, las tarjetas se opacan y se revelan una por una cada 0.333 segundos, con sacudida y marcado verde/rojo.
- El modal de imagen del quiz ahora permite zoom con botones, doble toque/clic, rueda, arrastre y gesto de pellizco compatible con Pointer Events.
- Versión/cache busting actualizados a `0.24.22`.

## v0.24.23

Ajustes en Quizzes:
- En la transición entre ítems se eliminó la tarjeta horizontal `Ítem N`; ahora queda limpio el contador grande `Ítem` + `N/total`.
- En la cabecera superior del quiz se agregó la palabra `Ítem` encima del contador `N/total`.
- El banner superior de la ejecución del quiz ahora usa la malla animada suave de la línea visual del AVA.
- La pantalla de transición entre la presentación del quiz y el Ítem 1 ahora hace salida suave con fade out antes de mostrar el primer ítem.
- Las transiciones entre ítems usan los mismos glows y fondo negro/neón de la pantalla de título para evitar saltos visuales.
- En drag and drop, la revelación correcto/incorrecto es más fuerte: cada tarjeta se revela una por una, se sacude y cambia completamente a verde o rojo, incluida la opción colocada, sin mezcla con el color original.
- Versión/cache busting actualizados a `0.24.23`.

## v0.24.24

Ajustes menores de Quizzes sobre `v0.24.23`.

- En preguntas ABCD y Verdadero/Falso, el reveal de correcto/incorrecto ahora usa una animación más marcada tipo la de drag and drop: pop para correcta y sacudida para incorrecta.
- Las opciones no usadas en ABCD y Verdadero/Falso quedan grises durante el reveal, en lugar de mantener su color Kahoot original.
- Los íconos `✓` y `×` de las opciones se sacaron visualmente fuera de la tarjeta para que el círculo no se corte.
- El feedback inferior `¡Correcto!` / `¡Incorrecto!` ahora se muestra como una banda inferior tipo Kahoot, fija al borde inferior de la pantalla, de extremo a extremo, con curva superior y color completo verde/rojo según resultado.
- Versión/cache busting actualizados a `0.24.24`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.25

Ajustes de pulido en Quizzes:

- En preguntas ABCD y Verdadero/Falso, el reveal correcto/incorrecto usa una animación equivalente a la validación del drag and drop: pop para correcta y sacudida para incorrecta.
- Las opciones no usadas quedan en gris durante el reveal.
- Se reforzó el z-index de las tarjetas y badges para que los círculos `✓` y `×` no se corten ni queden tapados por tarjetas vecinas.
- La banda inferior de feedback `¡Correcto!` / `¡Incorrecto!` se rehízo con una curva superior amplia tipo Kahoot, ocupando todo el ancho inferior.
- Se eliminó el rebote hacia arriba de la banda para evitar que aparezca fondo negro debajo durante la animación.
- Al aparecer la banda inferior, el contenido del quiz se desplaza ligeramente hacia arriba para no quedar tapado.
- Versión/cache busting actualizados a `0.24.25`.


## v0.24.26

- Se agregó un panel temporal en Quizzes para ajustar la banda inferior de feedback: curva superior, ancho de curva, alto, desplazamiento del contenido y rebote.
- Se cambiaron los emojis de feedback según acumulado de respuestas correctas/equivocaciones; en Verdadero/Falso, la equivocación usa 😒.
- Se reforzó el reveal de ABCD y Verdadero/Falso con la misma lógica visual de drag and drop: pop para correcta y sacudida para incorrecta.
- Se corrigió el corte de los badges circulares ✓/× en las esquinas de opciones.
- La banda inferior recuperó rebote configurable y ahora desplaza también la pregunta abierta.
- En Verdadero/Falso los botones son más altos y quedan más abajo.
- Se quitaron las figuras geométricas de opciones ABCD y Verdadero/Falso.

## v0.24.27

Ajustes finales de la banda inferior de feedback de Quizzes sobre `v0.24.26`.

- Se fijaron los valores enviados por el usuario para la banda: curva superior `12px`, ancho de curva `18vw`, alto `170px`, subir contenido `19px` y rebote `20px`.
- Se retiró/ocultó el panel temporal de calibración de la banda para dejar la interfaz limpia.
- La banda inferior ahora se extiende más hacia abajo y se posiciona con offset inferior para que, durante el rebote, no se vea un hueco blanco/negro debajo.
- El texto secundario/frase cómica de la banda quedó sin negrita fuerte, con peso normal.
- Se ignoran valores anteriores guardados en `localStorage` para mantener el diseño fijo en cualquier navegador.
- Versión/cache busting actualizados a `0.24.27`.


## v0.24.28

- Se compactó la banda inferior de feedback en Quizzes para que no quede tan alta cuando muestra poco texto.
- Se mantuvo la curva superior y el rebote, pero se redujo la altura, el desplazamiento del contenido y el tamaño visual del icono/texto para mejorar proporción.
- Se conserva la extensión inferior suficiente para que durante el rebote no aparezca hueco bajo la banda.
- Versiones y cache busting actualizados a `0.24.28`.

## v0.24.29

- Versión temporal de calibración para la banda inferior de feedback en Quizzes.
- Se desactivó temporalmente el avance automático después de responder para que la banda permanezca visible.
- Cuando aparece la banda de correcto/incorrecto, se muestra un panel de sliders en vivo para ajustar:
  - Banda: curva superior, ancho de curva, alto, desplazamiento del contenido, rebote, posición X/Y y zoom.
  - Emoji: posición X/Y y zoom.
  - Título: posición X/Y y zoom.
  - Frase: posición X/Y y zoom.
- Los valores se guardan en `localStorage` bajo `encisomath:quizFeedbackTune` mientras se prueban.
- Se añadió botón `Continuar` / `Ver resultados` en el panel porque el avance automático queda desactivado temporalmente.
- Versión/cache busting actualizados a `0.24.29`.

### v0.24.32
- Se fijaron los valores finales de calibración de la banda inferior de feedback de Quizzes: curva 12px, ancho 18vw, alto 122px, subir contenido 30px, rebote 22px, banda X 0px, banda Y 13px, zoom banda 110%, emoji X 25px, emoji Y -11px, zoom emoji 132%, título X 30px, título Y 0px, zoom título 138%, frase X 30px, frase Y -18px y zoom frase 83%.
- Se retiró la calibración temporal y se reactivó el avance automático después del feedback.
- Se mejoró la entrada de la banda con rebote más natural y zoom inicial, evitando que se quede pegada arriba.
- Se extendió la banda hacia abajo para que durante el rebote no se vea hueco inferior.
- La frase secundaria quedó con peso normal, sin negrita.

### v0.24.34

Ajuste del tipo de pregunta `slider` en Quizzes sobre `v0.24.32`.

- Se retiró la estética de teléfono/celular completo; ahora se conserva únicamente el componente visual interno solicitado: globo grande con número, colita tipo bocadillo y barritas verticales inferiores.
- El slider vuelve a estar en un solo componente: al validar ya no aparece un segundo slider de respuesta correcta.
- Si la respuesta es incorrecta, la barrita seleccionada cambia a rojo y la posición correcta aparece en ese mismo slider como una marca/barrita verde.
- Si la respuesta es correcta, el mismo componente cambia a verde y mantiene el feedback inferior estable de Quizzes.
- Se conservaron interacción táctil móvil, validación numérica, tolerancia, unidad y avance automático.
- Versión/cache busting actualizados a `0.24.34`.

## v0.24.34

Ajustes al tipo de pregunta `slider` en Quizzes:

- El globo azul muestra únicamente el número seleccionado, sin palabras ni unidad dentro.
- La cantidad de barras/bullets se calcula según las unidades entre `min` y `max` usando `step` como referencia. Por ejemplo, de 0 a 20 con paso 1 se muestran 20 barras.
- El globo de respuesta se desplaza horizontalmente y queda sobre el valor que el usuario está seleccionando.
- Si la respuesta es incorrecta, no aparece otro slider: en el mismo componente se marca la selección del estudiante en rojo y se muestra la respuesta correcta en verde debajo, con una pestaña apuntando hacia arriba.
- Si la respuesta es correcta, el mismo slider cambia a verde.
- Versión/cache busting actualizados a `0.24.34`.

### v0.24.35

- Ajuste del quiz tipo `slider`: el globo numérico se compactó para que no quede sobredimensionado.
- El globo azul ahora se alinea visualmente con la barrita/bullet activo y se desplaza junto al valor seleccionado.
- El área táctil invisible del slider se amplió verticalmente para permitir arrastrar desde el globo con el dedo.
- Las barritas/bullets se redujeron de tamaño para mejorar proporción en móvil.
- La marca de respuesta correcta en verde se alinea con el mismo sistema visual de bullets y se mantiene debajo del slider cuando hay error.
- Versión/cache busting actualizados a `0.24.35`.

### v0.24.37

- Ajustes al tipo de pregunta `slider` en Quizzes:
  - El rango visual se limita a un máximo de 10 pasos/unidades por intento.
  - El mínimo y máximo del slider se aleatorizan alrededor de la respuesta correcta, respetando los límites definidos cuando existen.
  - El globo azul y las barritas se compactaron para mejorar la proporción en móvil.
  - El valor del slider queda forzado a valores válidos según `step`; no permite quedarse en intermedios como 8.5 cuando el paso es 1, ni en 0.15 cuando el paso es 0.1.
  - La respuesta correcta ya no usa un marcador superpuesto; se colorea en verde la barrita real correspondiente y aparece la paleta correcta debajo.
  - Se agregó un panel temporal de calibración para ajustar posición vertical y zoom de la paleta azul y de la paleta correcta.
- Corrección visual en drag and drop y completar texto:
  - Los badges circulares `✓` y `×` ya no deberían cortarse por las tarjetas ni por el contenedor del quiz.
- Versión/cache busting actualizados a `0.24.37`.

### v0.24.39

- Corrección en Quizzes tipo `slider`: cada bullet ahora corresponde a un único valor exacto. El rango visual se calcula como cantidad de valores válidos, no como intervalos, para evitar que un mismo bullet pueda mostrar dos números distintos.
- El rango aleatorio alrededor de la respuesta correcta conserva máximo 10 valores/bullets visibles.
- La selección por dedo/mouse se calcula desde el centro real del primer y último bullet, y se redondea al índice del bullet más cercano. Así la paleta azul se mueve de bullet en bullet, sin posiciones intermedias ni desfases.
- La respuesta correcta verde también usa el mismo índice/bullet real que el slider del estudiante.
- Versión/cache busting actualizados a `0.24.39`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

### v0.24.39
- Se compacto verticalmente el componente de quiz tipo slider para evitar que el contenedor se vea demasiado alto respecto al tamano real del control.
- Se redujo el espacio interno, la altura del escenario visual, la separacion entre barritas, etiquetas y boton, manteniendo el area tactil invisible para arrastrar la paleta.
- Cuando la respuesta es incorrecta, el bloque conserva un poco mas de altura solo para que la paleta correcta verde no se monte sobre las etiquetas.
- Version/cache busting actualizados a `0.24.39`.

### v0.24.40
- Corrección en Quizzes tipo `slider`: después de validar y mostrar la banda inferior de feedback, el quiz vuelve a avanzar automáticamente.
- Si la pregunta tipo slider es la última, ahora pasa correctamente a la pantalla de resultados.
- La causa era que el flujo del slider había quedado sin llamar a `scheduleQuizAdvance()` después de retirar los paneles temporales de calibración.
- Versión/cache busting actualizados a `0.24.40`.


## v0.24.41

- Corrección puntual en Quizzes tipo `slider`: se ajustó verticalmente la paleta superior del usuario después de la compactación del componente, evitando que quede demasiado arriba cuando se valida una respuesta incorrecta.
- La paleta azul/roja conserva el zoom final `61%`, pero su Y interno pasa a `34px` para alinearse mejor con la barrita activa compactada.
- Cache busting actualizado a `0.24.41`.


## v0.24.42

- Versión temporal para calibrar el slider numérico.
- Se reactivó un panel de ajuste dentro del tipo `slider` para modificar en vivo únicamente la posición vertical Y de la paleta azul del usuario.
- El valor se guarda en `localStorage` como `encisomath:quizSliderTune` y puede pasarse luego para fijarlo en una versión estable.
- Cache busting actualizado a `0.24.42`.


## v0.24.43

- Se fijó el valor final de calibración vertical de la paleta azul del quiz tipo `slider`: Y `-15px`.
- Se retiró el panel temporal de calibración del slider.
- El valor final se aplica desde el código e ignora valores anteriores guardados en `localStorage` para evitar desfaces por calibraciones previas.
- Cache busting actualizado a `0.24.43`.

## v0.24.44

- Se implementó un modo seguro para Quizzes sobre la versión estable `v0.24.43`.
- Durante la ejecución del quiz se bloquean acciones de riesgo como botón atrás, cambio de pestaña/app, pérdida de foco de ventana, menú contextual, copiar, cortar, pegar y atajos como imprimir/guardar/inspeccionar.
- En la primera acción sospechosa se muestra una advertencia con la misma línea visual del warning rojo: malla animada, modal de peligro, emoji 😡 y mensaje `Hey, pilas con lo que haces. Vuelves a hacerlo y te anulo el quiz.` Incluye botón `Continuar quiz`.
- En la segunda acción sospechosa el quiz se da por terminado y se muestra pantalla de resultados/anulación por seguridad.
- Se agregó marca de agua discreta durante el quiz con datos del usuario, asignatura y hora.
- Se registra localmente un historial de eventos sospechosos en `localStorage` bajo la clave `encisomath:quizSecurityLog:<quizId>`.
- Se intenta activar pantalla completa nativa cuando el navegador lo permite, manteniendo el bloqueo interno de navegación.
- Versión/cache busting actualizados a `0.24.44`.

## v0.24.45

- Optimización visual de Quizzes para reducir carga en celulares.
- Durante preguntas, resultados e intro del quiz se eliminaron glows, resplandores, sombras pesadas, filtros y degradados de elementos internos.
- Las tarjetas, opciones, drag and drop, completar texto, slider, banda inferior y elementos internos quedan con colores planos.
- Se conserva intacto el banner superior con información del quiz.
- Los efectos fuertes se mantienen únicamente en las transiciones entre ítems.
- Versión/cache busting actualizados a `0.24.45`.

## v0.24.46

- Corrección puntual posterior a la optimización visual de Quizzes.
- Se restauró el color del tema en botones internos del quiz: Enviar respuesta, Reiniciar, Validar uniones, Validar texto y Validar número, manteniéndolos planos sin glow ni degradado.
- En drag and drop y completar texto se eliminó el borde/fondo oscuro que aparecía encima de la opción colocada dentro del espacio receptor.
- En la validación de drag and drop y completar texto, las tarjetas colocadas vuelven a cambiar completamente a verde o rojo según correcto/incorrecto, sin conservar el color original de la opción.
- Se mantiene intacto el banner superior del quiz y los efectos fuertes siguen reservados para las transiciones entre ítems.
- Versión/cache busting actualizados a `0.24.46`.

## v0.24.47

- Corrección puntual posterior a la optimización visual de Quizzes.
- En drag and drop y completar texto, al validar las respuestas las tarjetas y opciones ahora cambian completamente a verde o rojo, sin mezclarse con el color original.
- En completar texto se eliminó el reborde/fondo oscuro que aparecía sobre la opción colocada dentro del espacio.
- El bloque del slider ya no se desplaza hacia arriba cuando aparece la banda inferior de feedback, evitando que la paleta toque el borde del contenedor.
- Versión/cache busting actualizados a `0.24.47`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.49

- Versión temporal para pruebas: se desactivó la protección de Quizzes añadida en v0.24.44.
- Ya no se muestran advertencias por acciones sospechosas, no se anula el quiz por cambio de pestaña/app, pérdida de foco, back, copiar/pegar, menú contextual o atajos.
- Se desactivó la marca de agua de seguridad y el intento de pantalla completa nativa.
- Se mantiene el fullscreen interno del quiz, las transiciones, resultados, Quizzes, Rockstars y demás mejoras de v0.24.47.
- Se actualizó el mensaje del modal de inicio a modo seguro temporalmente desactivado para pruebas.
- Versión/cache busting actualizados a `0.24.49`.

## v0.24.49

Correcciones visuales puntuales en Quizzes sobre v0.24.48:

- Se alargaron verticalmente los botones de Verdadero/Falso.
- Se retiraron las ayudas internas tipo “Marca verdadero o falso”, “arrastra”, “mueve el slider” y textos de apoyo dentro de recuadros oscuros.
- En ABCD se quitó el texto/etiqueta “Tocar para ampliar” sobre la imagen, manteniendo la imagen ampliable.
- Se eliminaron visualmente los badges circulares de check/X en todas las preguntas.
- La pregunta abierta recibió una interfaz más trabajada, plana y liviana, sin degradados, blur ni glow.
- En drag and drop y completar texto, los resultados validados vuelven a quedar totalmente verdes o rojos, con texto blanco y sin mezcla con el color original.
- En completar texto, los espacios vacíos usan relleno gris claro con borde punteado fino y texto “Arrastra aquí”. Se eliminó el reborde oscuro cuando se coloca una opción.
- Se ocultaron los mensajes locales tipo “1/3 correctas” o “2/2 espacios correctos” en drag and drop/completar texto, dejando solo la banda inferior general.
- Se mantuvo la protección de Quizzes desactivada temporalmente como en v0.24.48.

## v0.24.51

- Corrección visual en Quizzes tipo drag and drop: se quitó el fondo azul oscuro que aparecía debajo de las zonas `Opciones` y `Une aquí`.
- Se dejaron transparentes los contenedores internos del tablero de drag and drop sin afectar los colores de las tarjetas ni la validación correcto/incorrecto.
- Versión/cache busting actualizados a `0.24.51`.

## v0.24.50

Correcciones visuales y de composición en Quizzes sobre v0.24.49:

- En ABCD, Verdadero/Falso y Pregunta abierta, el contenido principal se centra verticalmente mejor dentro de la pantalla del quiz para evitar que la pregunta quede pegada arriba.
- En Pregunta abierta se simplificó la interfaz: se retiró el bloque de ayuda con emoji y se dejó solo el campo corto con placeholder `Escribe tu respuesta aquí` y el botón `Enviar respuesta` debajo.
- Se añadió scroll automático al enfocar el campo de respuesta abierta para mejorar el comportamiento cuando aparece el teclado en Android.
- En completar texto, las opciones se limitan visualmente a 6, el contenedor de opciones conserva una altura estable aunque se arrastren tarjetas y se eliminó el fondo azul oscuro.
- En completar texto, los espacios vacíos conservan relleno gris claro y borde punteado fino, sin rebordes oscuros al colocar opciones.
- En drag and drop, cuando aparece la banda inferior de correcto/incorrecto, el tablero ya no se desplaza hacia arriba hasta montarse sobre el texto de la pregunta.
- Se mantiene la protección de Quizzes desactivada temporalmente como en v0.24.48/v0.24.49.
- Versión/cache busting actualizados a `0.24.50`.
- Validación: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.52

- Se corrigió en Quizzes tipo `fill_text` el fondo azul oscuro detrás del contenedor de opciones, dejándolo transparente como en drag and drop.
- En todos los ítems, la cabecera `Pregunta X de Y` y el rectángulo `Item X` vuelven a quedar arriba, separados del contenido central de la pregunta.
- Se agregó navegación rápida por ítems durante la ejecución del quiz con botones numerados, permitiendo saltar a cualquier pregunta aunque no esté resuelta.
- Se recrearon las preguntas demo con estructura de texto A + imagen opcional + texto B + respuesta, para simular preguntas más reales.
- En ABCD, Verdadero/Falso y Pregunta abierta se agregó modo temporal de calibración con bordes verdes de referencia y sliders para ajustar posición X/Y, ancho y alto de Texto A, imagen, Texto B y opciones/respuesta.
- En ABCD y Verdadero/Falso se ajustó el ancho de los contenedores de opciones para aprovechar mejor el espacio horizontal.
- Se mantiene la protección de Quizzes desactivada temporalmente como en v0.24.48-v0.24.51.
- Versión/cache busting actualizados a `0.24.52`.

Validación realizada:

```bash
node --check app.js
node --check sw.js
python3 -m json.tool manifest.webmanifest
python3 -m json.tool data/*.json
unzip -t encisomath-pwa-v0.24.52.zip
```

## v0.24.56

- Se parte de `v0.24.55`.
- En el modal de la tuerca de Quizzes se agregaron los tamaños de fuente base de `Texto A` y `Texto B`:
  - `Texto A fuente base`: 20px por defecto.
  - `Texto B fuente base`: 17px por defecto.
- La fuente sigue reduciéndose automáticamente según la longitud del texto: textos medianos, largos y muy largos aplican factores de reducción sobre ese tamaño base.
- La navegación rápida de preguntas se movió dentro del cuadro emergente de la tuerca: botones `Anterior`, `Siguiente` y botones numerados para saltar a cualquier ítem aunque no esté resuelto.
- Se retiró la navegación rápida externa para no ocupar espacio del layout del ítem.
- Versiones/cache busting actualizados a `0.24.56`.

## v0.24.55

- Se parte de `v0.24.54`.
- En Quizzes, **todos los ítems de demostración ahora incluyen imagen**.
- Se reforzó la base de datos demo (`data/quizzes.json`) para que todas las preguntas tengan `image` e `imageAlt`, manteniendo compatibilidad con **todos los tipos** de quiz actuales: opción múltiple, verdadero/falso, abierta, drag and drop, completar texto y slider.
- Se actualizó la descripción/versionado de `quizzes.json` para dejar explícito que todos los ítems demo soportan e incluyen imagen.
- Versiones/cache busting actualizados a `0.24.55`.

## v0.24.53

- Se amplió el modo temporal de calibración de Quizzes a todos los tipos de pregunta: opción múltiple, verdadero/falso, pregunta abierta, arrastrar para unir, completar texto y slider numérico.
- Ahora `Drag and drop`, `Completar texto`, `Escribir respuesta` y `Slider` también muestran bordes verdes de referencia y sliders para ajustar posición X/Y, ancho y alto de Texto A, imagen, Texto B y zona de respuesta.
- Se mantiene la protección de Quizzes desactivada temporalmente como en las versiones v0.24.48-v0.24.52.

## v0.24.58

- Se parte de `v0.24.57`.
- Se unificó el estilo visual de los contenedores **Texto A** y **Texto B** en todos los tipos de quiz: opción múltiple, verdadero/falso, pregunta abierta, drag and drop, completar texto y slider.
- Texto A mantiene el mismo tamaño base, peso, alineación, color, line-height y letter-spacing en todos los tipos.
- Texto B mantiene el mismo tamaño base, peso, alineación, color, line-height y letter-spacing en todos los tipos.
- Se conserva la reducción automática de fuente según longitud del texto (`md`, `sm`, `xs`) usando los tamaños base configurables desde la tuerca.
- Versiones/cache busting actualizados a `0.24.58`.

## v0.24.57

- Se parte de `v0.24.56`.
- Se compactó verticalmente el layout de Quizzes tipo `drag and drop` para que el contenido quepa mejor en la pantalla fullscreen sin activar scroll general.
- En `drag and drop` se redujeron tamaños de Texto A, Texto B, imagen, tarjetas, receptores, espacios internos, separaciones y botones de acción, especialmente en móvil.
- Cuando aparece la banda inferior de correcto/incorrecto, el tablero se mantiene compacto y no debe salirse ni montarse sobre otros elementos.
- Versiones/cache busting actualizados a `0.24.57`.




## v0.24.64

- Se parte de `v0.24.63`.
- En Quizzes tipo `fill_text` / Completar texto drag and drop se corrigió la tipografía de la zona de respuesta.
- El texto del enunciado a completar, los espacios `Arrastra aquí`, las opciones disponibles y las opciones colocadas ahora usan la misma variable de fuente que Texto A/B (`--quiz-text-font` / `--quiz-fill-font`).
- El ajuste `Texto A/B fuente base` de la tuerca también controla estos textos de Completar texto, evitando que se vean más grandes que Texto A y Texto B.
- Se mantuvieron las alturas alineadas con Drag and drop para espacios y opciones.
- Versión/cache busting actualizados a `0.24.64`.

## v0.24.63

- Se parte de `v0.24.62`.
- En Quizzes tipo `fill_text` / Completar texto drag and drop, el texto del bloque de completar, las opciones y las etiquetas colocadas ahora usan el mismo control de fuente base de Texto A/B (`--quiz-text-font`), para que al mover el tamaño default también cambien estos elementos.
- Se igualó la altura vertical de los espacios de rellenar y de las opciones con la referencia de Drag and drop, evitando que una opción colocada aumente la altura del espacio.
- Se mantuvo el layout plano sin glow, blur ni degradados internos.
- Versiones/cache busting actualizados a `0.24.63`.

## v0.24.62

- Se parte de `v0.24.61`.
- En Quizzes tipo **Drag and drop**, la imagen ahora ocupa el alto configurado del contenedor y se muestra completa con `object-fit: contain`, evitando que solo se vea una franja de la imagen.
- Las tarjetas de la columna **Opciones** y el espacio interno de **Suelta o toca una opción** quedan con la misma altura vertical, para que al colocar una opción no crezca ni cambie el alto del receptor.
- En Drag and drop, **Texto A** y **Texto B** vuelven a usar el mismo tamaño/fuente/estilo base y la misma reducción automática por longitud de texto.
- Versiones/cache busting actualizados a `0.24.62`.

## v0.24.61

- Se parte de `v0.24.60`.
- En Quizzes, se eliminó el efecto `lift`: cuando aparece la banda inferior de **Correcto/Incorrecto**, el contenido del ítem ya no se mueve hacia arriba y permanece en su posición.
- La banda inferior de feedback ahora aparece con retraso de `0.3s` después de que las opciones/tarjetas/slider ya se marcaron en verde o rojo.
- Se fijó `--quiz-feedback-lift: 0px` y se agregaron overrides para neutralizar desplazamientos en ABCD, Verdadero/Falso, Pregunta abierta, Drag and drop, Completar texto y Slider.
- Se mantiene la protección de Quizzes desactivada temporalmente.
- Versiones/cache busting actualizados a `0.24.61`.


## v0.24.65

- Se parte de `v0.24.64`.
- Corrección en Quizzes tipo `drag and drop`: Texto A y Texto B ahora comparten el mismo modificador de longitud, calculado con el texto más largo de los dos.
- Esto evita que Texto A y Texto B queden con tamaños distintos cuando uno es más largo que el otro.
- Se mantiene la reducción automática de fuente cuando el texto es largo, pero aplicada de forma pareja a ambos contenedores.
- Versiones/cache busting actualizados a `0.24.65`.


## v0.24.67

- Se parte de `v0.24.66`.
- Se fijaron como valores iniciales del layout los ajustes enviados por el usuario para los tipos de pregunta: opción múltiple, verdadero/falso y pregunta abierta.
- Valores principales aplicados:
  - Opción múltiple: Texto A Y `30px`, imagen Y `30px`, imagen alto `200px`, Texto B Y `30px`, opciones X `-11px`, opciones Y `30px`, opciones ancho `106%`, fuente base `18px`.
  - Verdadero/Falso: Texto A Y `0px`, Texto A alto `85px`, imagen Y `0px`, imagen alto `200px`, Texto B Y `1px`, Texto B alto `85px`, opciones X `-11px`, opciones Y `0px`, opciones ancho `106%`, fuente base `18px`.
  - Pregunta abierta: Texto A Y `30px`, imagen Y `30px`, imagen alto `200px`, Texto B Y `30px`, opciones Y `30px`, fuente base `18px`.
- En esos tres tipos se ocultaron los contornos verdes de calibración, pero se mantiene la tuerca para seguir ajustando y navegar entre ítems.
- Versiones/cache busting actualizadas a `0.24.67`.

## v0.24.68

- Se parte de `v0.24.67`.
- Se fijaron los valores de calibración enviados para `Drag and drop`, `Completar texto` y `Slider`:
  - Drag and drop: Texto A X `0px`, Y `0px`, ancho `100%`, alto `80px`, fuente `18px`; imagen X `0px`, Y `10px`, ancho `100%`, alto `200px`; Texto B X `0px`, Y `20px`, ancho `100%`, alto `80px`; opciones X `0px`, Y `30px`, ancho `100%`.
  - Completar texto: Texto A X `0px`, Y `0px`, ancho `100%`, alto `80px`, fuente `16px`; imagen X `0px`, Y `0px`, ancho `100%`, alto `180px`; Texto B X `0px`, Y `0px`, ancho `100%`, alto `80px`; opciones X `0px`, Y `0px`, ancho `100%`.
  - Slider: Texto A X `0px`, Y `0px`, ancho `100%`, alto `100px`, fuente `18px`; imagen X `0px`, Y `0px`, ancho `100%`, alto `200px`; Texto B X `0px`, Y `0px`, ancho `100%`, alto `100px`; opciones X `0px`, Y `0px`, ancho `100%`.
- Se cambió la llave de `localStorage` del panel de layout a `encisomath:quizLayoutTune:v0.24.68:<tipo>` para que los nuevos defaults no queden pisados por calibraciones temporales anteriores.
- Se ocultaron los contornos verdes de calibración en Drag and drop, Completar texto y Slider, manteniendo la tuerca activa.
- Se añadieron reglas responsive para pantallas más cortas, compactando imagen, textos, tarjetas y espacios sin mover la estructura base del ítem.
- Versiones/cache busting actualizados a `0.24.68`.


## v0.24.69

- Se parte de `v0.24.68`.
- En Quizzes tipo `drag and drop` y `completar texto drag and drop`, Texto A y Texto B quedan con peso normal (`font-weight: 400`), sin negrita.
- También se normalizó el peso de textos internos de esos dos tipos: tarjetas, espacios receptores, texto a completar y opciones, para evitar que sigan viéndose en bold.
- Se mantiene la tuerca activa, la calibración actual y la protección de Quizzes desactivada temporalmente.
- Versiones/cache busting actualizados a `0.24.69`.



## v0.24.71

- Se fijó la fuente base de Texto A/B en 20px para ABCD, Verdadero/Falso, Pregunta abierta, Drag and drop, Completar texto y Slider.
- La fuente de opciones y zonas de respuesta ahora hereda la misma base visual de 20px en esos tipos de quiz.
- Se actualizó la llave de calibración de layout a `v0.24.71` para evitar que valores antiguos de `localStorage` mantengan 18px o 16px.
- Versiones/cache busting actualizados a `0.24.71`.

## v0.24.70

- Se parte de `v0.24.69`.
- Se quitó la negrita de **Texto A** y **Texto B** en todos los tipos de quiz: opción múltiple, verdadero/falso, pregunta abierta, drag and drop, completar texto drag and drop y slider.
- Se mantiene la reducción automática por longitud y el tamaño configurado desde la tuerca, pero el peso visual queda normal (`font-weight: 400`).
- Versiones/cache busting actualizados a `0.24.70`.



## v0.24.72

- Se parte de `v0.24.71`.
- Se retiraron del quiz demo los ítems de tipo `drag and drop` / `match` y `completar texto` / `fill_text`.
- El quiz demo queda con ABCD, Verdadero/Falso, Pregunta abierta y Slider.
- Se corrigió el salto vertical del slider al validar: el contenedor mantiene una altura estable antes y después de responder, incluso cuando la respuesta es incorrecta y aparece la marca correcta.
- Versiones/cache busting actualizados a `0.24.72`.


## v0.24.115

- Preparado Montserrat local para quizzes usando `assets/fonts/Montserrat/`.
- Quita dependencia de Google Fonts en `index.html`.
- No se incluyen archivos `.ttf/.woff2` en este ZIP; copiarlos desde `Montserrat.zip` a la carpeta indicada.
- Mantiene `bindQuizTabEvents()` y el arranque de Quizzes corregido.


## v0.24.115
- Limpieza parcial de quiz: retirados flujos JS/CSS legacy de match/fill_text no usados en el demo actual.
- Nuevas opciones de rendimiento en Perfil y apariencia para desactivar animaciones, mallas/brillos, efectos de opciones y animación de banda.
- Corrección de foco al cerrar la tuerquita para evitar advertencias aria-hidden.


## v0.24.115

- Se reemplazo la entrada pesada con blur por una animacion ligera de opacidad + desplazamiento corto sin blur.
- Se aplico la entrada unificada en Home, botones de pestañas, bloques principales de Estudiantes, Rockstars, Quizzes y Clases.
- En Estudiantes/Rockstars/Quizzes se anima la lista como bloque, no cada estudiante/quiz.
- En Clases se elimino el blur restante y se anima cada clase individualmente por ser pocas.
- Version/cache busting actualizado a 0.24.115.


## v0.24.115
- Quiz tipo Organizar: tarjetas con colores estilo Kahoot/quiz (rojo, azul, amarillo y verde) conservando el color al reordenar.
- Se adaptó el patrón visual de arrastre tipo lift: al tomar una tarjeta sube levemente, escala a 1.02 y aumenta sombra, sin cambiar el layout general del quiz.
- Se mantuvo border-radius 6px y se evitó copiar el componente externo sin adaptar tamaños/espacios del AVA.
- Version/cache busting actualizado a 0.24.115.

## v0.24.166

- Se eliminó el uso de la pantalla independiente `Preparando reto` al iniciar o reiniciar un quiz.
- La información del quiz se fusionó en la transición del Ítem 1 únicamente: primero muestra `Preparando reto`, título y descripción con fade; luego aparece `1/Y` con `scale-in-center`.
- La transición del Ítem 1 dura más que las demás para incluir intro + contador + salida sin cortes; las transiciones siguientes conservan el comportamiento previo.
- La barra, los radiales y las figuras permanecen activos desde el inicio de la transición del Ítem 1.
- El modo Continuo respeta la duración especial del Ítem 1 antes de avanzar a la pregunta.

## v0.24.166

- Ajustada la transición especial del Ítem 1: la información del quiz dura 4 segundos y luego el contador X/Y ocupa 3 segundos, para un total de 7 segundos.
- Sincronizados radiales, figuras, countdown/barra y modo Continuo con la nueva duración especial del Ítem 1.
- Las transiciones normales de los demás ítems conservan la duración previa.

## v0.24.168
- Ajuste global de tipografía de quizzes: TEXTO y OPCIONES quedan en 12px como base para los quizzes actuales y futuros.
- Pregunta abierta: el texto escrito en el cuadro de respuesta usa Montserrat Regular real, sin heredar SemiBold de las opciones.

## v0.24.177

- Se ajusta Quiz Flip a partir de `v0.24.170`.
- Las tarjetas de espalda usan colores normales tipo Kahoot; se agregan naranja y morado para completar las 6 opciones.
- Al mostrar la respuesta, cada tarjeta usa fondo del mismo color en versión muy oscura con borde interior de 3px del color normal.
- Se elimina el resaltado/filtro azul de toque en móviles.
- El layout de Flip queda igual al de Organizar: 30/30/40 con imagen y 60/40 sin imagen.

## v0.24.177
- Ajuste de musica de fondo en quizzes: `assets/music_quiz/music1.mp3` inicia desde el comienzo del quiz/transicion inicial y continua sin detenerse entre items, respuestas, feedback y transiciones.
- La musica se detiene al finalizar/cerrar el quiz, no al responder cada pregunta.
- Se conserva `assets/sounds/item.mp3` cuando aparece el contador X/Y de transicion.

## v0.24.178

- Se rehizo solo la pantalla final de resultados/ranking del quiz.
- Se agrego un podio visual construido con HTML/CSS siguiendo la referencia: bloques amarillos `#ebb513`, sombra flat `#c49710`, base inferior amarilla y numeros blancos con Montserrat de peso alto.
- El podio aparece en cascada 3, 2 y 1 usando la animacion tipo `animate__bounceIn` de la transicion X/Y.
- Se agregaron avatares circulares temporales y nombres con Montserrat Medium; el puesto 1 tiene avatar mas grande.
- Se agregaron tarjetas por item que entran en cascada y se pintan verde/rojo segun respuesta correcta/incorrecta, usando `jello-horizontal` para aciertos y `wobble-hor-bottom` para errores.
- Version/cache busting actualizado a 0.24.178.

## v0.24.179

- Ajuste enfocado solo en la pantalla final de ranking/resultados del quiz.
- Se quitó el hero/barra superior de resultados que mostraba el nombre del quiz y `FIN`.
- Se compactó el podio para que los bloques 2, 1 y 3 queden juntos y sobre una base inferior amarilla estable, manteniendo amarillo `#ebb513`, sombra flat `#c49710` y números blancos Montserrat de peso alto.
- Se mantiene la entrada en cascada del podio 3, 2 y 1 con `animate__bounceIn`.
- Las tarjetas de ítems pasan a una grilla fija de 2 columnas y máximo 10 preguntas: 1-2, 3-4, 5-6, 7-8, 9-10.
- Se retiró el chulito/equis lateral de las tarjetas de ítem.
- El ítem de pregunta abierta se muestra siempre azul, sin depender de correcto/incorrecto.
- El fondo de la pantalla de ranking usa malla con degradado según porcentaje: 90+ verde, 70+ amarillo, 60+ naranja, 31-59 rojo y 30 o menos negro con rojo.
- Se estabilizó la pantalla de resultados sin scroll interno para reducir saltos visuales al aparecer el ranking.
- Version/cache busting actualizado a 0.24.179.

## v0.24.180

- Version temporal de calibracion enfocada solo en la pantalla final de ranking/resultados del quiz.
- Se agrego un panel `⚙️ Podio` en resultados para ajustar en vivo el podio.
- El panel permite modificar X, Y y rotacion de los puestos 1, 2 y 3.
- Tambien permite ajustar X/Y de la base amarilla del podio para corregir la alineacion inferior.
- Los valores se guardan en `localStorage` con la clave `encisomath:rankingPodiumTune:v0.24.180`.
- Se mantiene el podio HTML/CSS amarillo `#ebb513`, sombra flat `#c49710`, animacion 3 -> 2 -> 1 y grilla de items de v0.24.179.
- No se tocaron preguntas, tipos de quiz, musica, Rockstars, Clases, Estudiantes ni datos base.
- Version/cache busting actualizado a 0.24.180.

## v0.24.181
- Version temporal de calibracion enfocada solo en la pantalla final de ranking/resultados del quiz.
- Se agrego slider de ancho para la base amarilla del podio.
- Se aplicaron como valores base del podio: puesto 1 X 5px, Y -45px, rotacion 0; puesto 2 X 38px, Y -41px, rotacion -6; puesto 3 X -29px, Y -40px, rotacion 5; base Y -26px.
- Los valores de calibracion ahora usan `localStorage` con la clave `encisomath:rankingPodiumTune:v0.24.181`.
- En la tarjeta de pregunta abierta, si el estudiante envio texto se usa animacion `jello-horizontal`; si envio vacio se usa `wobble-hor-bottom`.
- El contenedor de resultados usa malla animada tipo hero de Quizzes/ROCKSTARS, con degradado segun porcentaje: 90+ verde, 70+ amarillo, 60+ naranja, 31-59 rojo, 30 o menos negro con rojo.
- No se tocaron preguntas, tipos de quiz, musica, Rockstars, Clases, Estudiantes ni datos base.
- Version/cache busting actualizado a 0.24.181.


## v0.24.184
- Cambio enfocado en Quizzes: se reemplaza la música global `music1.mp3` por música aleatoria por pregunta/ítem, según el tiempo del ítem.
- La app busca pistas en `assets/music_quiz/` con nombres `20_X`, `30_X`, `60_X`, `90_X` o `120_X` (por ejemplo `20_1.mp3`, `20_2.mp3`, `30_1.mp3`) y solo usa la familia que coincide con los segundos de la pregunta.
- La detección cuenta las pistas disponibles por duración usando los candidatos `X=1..3`; si no hay pistas para ese tiempo, el quiz continúa sin música y sin romper.
- La música ya no se reproduce durante todo el quiz ni durante transiciones: arranca al entrar a cada pregunta y se detiene con fadeout rápido cuando se responde, se envía respuesta, se valida Organizar/Flip o se acaba el tiempo.
- Version/cache busting actualizado a 0.24.184.
- Validaciones: `node --check app.js`, `node --check sw.js`, JSON/manifest válidos y `unzip -t` sin errores.

## v0.24.182

- Cambio enfocado en Quizzes: se agrega countdown por item/pregunta.
- El contador queda en la esquina superior derecha al nivel del hero del quiz; el hero se compacta para ocupar aproximadamente 70% y el countdown 30%.
- Tiempo inicial por pregunta: 20 segundos, con soporte tecnico para valores por pregunta/quiz hasta 3 digitos mediante `timeLimit`, `timeLimitSeconds`, `seconds`, `questionTimeLimit`, `timePerQuestion` o `defaultTimeLimit` en el JSON.
- El countdown usa poligono blanco de cuatro vertices con numero Montserrat Black, morph aleatorio por segundo, movimiento idle, beat cada 10 segundos y modo peligro en los ultimos 10 segundos con temblor y alternancia rojo/blanco.
- Cuando el estudiante responde o envia respuesta, el contador se detiene y muestra `!`.
- Cuando el tiempo llega a 0, la pregunta queda registrada como incorrecta, no se revela la respuesta correcta y aparece la banda blanca con letra negra `Tiempo!`.
- No se tocaron preguntas, tipos de quiz, ranking, Rockstars, Clases, Estudiantes ni datos base.
- Version/cache busting actualizado a 0.24.182.
- Validacion: `node --check app.js`, `node --check sw.js`, JSON/manifest validos y `unzip -t` sin errores.


## v0.24.184
- Se agrega sistema de puntos por ítem en Quizzes: los puntos por acierto suman 10.000 si todos los ítems están correctos.
- Se agrega sistema de puntos por tiempo: otros 10.000 posibles, calculados con curva de respuesta que evita premiar respuestas demasiado inmediatas y alcanza su máximo alrededor del 75% del tiempo usado.
- El puntaje se guarda en cada respuesta con desglose de ítem, tiempo, total, curva y timing.
- Al revelar una respuesta, el puntaje aparece sobre la tarjeta/opción con texto en cascada carácter por carácter, bounce de entrada, permanencia y salida invertida.
- Para respuestas incorrectas o tiempo agotado se muestra 0; para correctas se muestra +puntaje con punto de miles.
- Se mantiene Montserrat local, sin Google Fonts ni recursos externos.
- Version/cache busting actualizado a 0.24.184.

## v0.24.185

- Ajuste en Quizzes sobre el sistema de puntos de v0.24.184.
- El puntaje por ítem ahora se muestra separado, arriba del contenedor de opciones/respuesta y centrado sobre esa zona; su animación entra desde abajo hacia arriba.
- El puntaje por tiempo ahora se muestra debajo del countdown, separado del puntaje por ítem; su animación entra desde arriba hacia abajo.
- La función de animación en cascada se mantiene reutilizable y usando Montserrat local, sin Google Fonts.
- En pregunta abierta también se dispara la visualización de puntajes, con 0 cuando no hay calificación automática.
- No se tocaron ranking/podio, tipos de pregunta, música random por ítem, Rockstars, Clases, Estudiantes ni datos base.
- Version/cache busting actualizado a 0.24.185.


## v0.24.187

- Corrección enfocada en Quizzes/puntajes visuales.
- Se retiró el fondo negro de los puntajes animados; ahora quedan como texto blanco flotante con resplandor/sombra exterior oscura para contraste.
- Se restauró el layout de los contenedores de opciones/respuesta: el puntaje ya no agrega filas ni modifica el tamaño/estructura de los contenedores.
- El puntaje por ítem aparece flotando sobre el contenedor de opciones/respuesta, centrado, entrando desde abajo hacia arriba.
- El puntaje por tiempo aparece flotando debajo del countdown, visible, entrando desde arriba hacia abajo.
- Se mantiene la lógica de puntos de v0.24.184-v0.24.185, la música random por ítem y el countdown por pregunta.
- Version/cache busting actualizado a 0.24.187.

## v0.24.211
- Correccion puntual en Quizzes desde v0.24.209: botones Enviar respuesta del quiz quedan con estado solido neutro y sin tap azul/cian, sin tocar jello.
- Flip: se reforzo la eliminacion de sombras/resplandores exteriores durante el giro con selectores de mayor especificidad y recorte local de la tarjeta.
- Organizar: se recupero el estado gris intermedio al pulsar Enviar y se mantiene validacion verde/roja con colores solidos sin degradados.
### v0.24.216
- Se restaura exclusivamente el CSS de Flip Card al comportamiento de v0.24.208, retirando los overrides posteriores de v0.24.209/v0.24.213 que alteraban `.quiz-flip-card`, `.quiz-flip-inner`, `.quiz-flip-face`, `.quiz-flip-front` y `.quiz-flip-back`.
- No se tocan Organizar, botones, jello, hero, countdown, puntos, música, ranking/podio, padding ni datos base.

