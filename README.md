## v0.24.246

Cambios v0.24.246:

- Corrección en Resultados: la banda/hero de estados plateado y dorado ahora usa fondos metalizados visibles mediante gradientes explícitos por estado.
- Corrección en Resultados: el polígono de la nota ahora usa los mismos rangos de color que la banda: rojo `#e21b3c`, naranja `#ff7a00`, verde `#58cc02`, plateado metalizado y dorado metalizado.
- Ajustes por defecto de la nota/polígono en la tuerquita de resultados: Pos X polígono `10%`, Pos Y polígono `-16%`, tamaño número nota `90%`, Pos X número nota `7%`, Pos Y número nota `-40%`.
- Se actualizó la clave de calibración de resultados a `encisomath:finalResultsTune:v0.24.246` para aplicar esos valores por defecto.
- Versión/cache busting actualizado a `0.24.246`.

Validaciones esperadas:

- `node --check app.js`
- `node --check sw.js`
- JSON válidos
- `manifest.webmanifest` válido
- `unzip -t` sin errores
