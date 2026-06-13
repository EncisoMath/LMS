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
