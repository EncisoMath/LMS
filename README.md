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
