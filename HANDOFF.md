# Traspaso: migración de Trayecto a Vite + TypeScript

Documento para continuar el trabajo en otra sesión. **La migración está terminada**; lo que queda es publicar los commits y la deuda menor de abajo. La referencia permanente del proyecto es `CLAUDE.md`; este archivo solo cuenta el estado y la historia.

## Aviso: historial reescrito y datos de ejemplo ficticios

Las coordenadas de los lugares de ejemplo (`SEED_GEO`) eran ubicaciones reales; antes de publicar el repo se sustituyeron por ficticias en **todo** el historial (por eso los hashes de este documento son los nuevos). Consecuencias:

- Los lugares de ejemplo y las rutas generadas del demo cambian respecto a versiones anteriores. Los datos que ya guardó el usuario (`localStorage`, `trayecto-datos.json`) no se tocan: sus lat/lng viven en sus datos, no en el código.
- `tools/parity/baseline.html` y los `*.json` locales se generaron con las coordenadas viejas: regenerar con `git show 40db8c5:trayecto.html > tools/parity/baseline.html` y volver a correr el guion antes de comparar.
- No volver a escribir coordenadas, placas ni direcciones reales en el código, las pruebas ni la documentación.

## Encargo original (resumen)

Migrar `trayecto.html` (un solo archivo de ~2 900 líneas) a un proyecto mantenible **sin cambiar comportamiento, apariencia ni datos**: Vite + `vite-plugin-singlefile` (`dist/trayecto.html` autocontenido, funciona por `file://`), TypeScript estricto, Vitest, Playwright, ESLint + Prettier, arquitectura por funcionalidad con repos CRUD, mismas claves de `localStorage`, misma base IndexedDB y mismo formato de archivo. Proceso: un commit por fase y `npm run check` en verde antes de cada commit.

## Estado

| Fase                                           | Estado | Commit    |
| ---------------------------------------------- | ------ | --------- |
| 1 Andamiaje                                    | hecha  | `dd46655` |
| 2 Módulos ES                                   | hecha  | `1a79878` |
| 3 TypeScript estricto                          | hecha  | `247e233` |
| 4 Repos, eventos, dependencias                 | hecha  | `2a96ecc` |
| 5 Pruebas unitarias (Vitest)                   | hecha  | `077492c` |
| 6 Pruebas E2E (Playwright)                     | hecha  | `4053262` |
| Cierre: `CLAUDE.md` nuevo, sin `trayecto.html` | hecho  | `2ba1263` |

`npm run check` pasa completo: typecheck, lint, 283 pruebas unitarias en 16 archivos, build y 38 pruebas E2E. Los mensajes de commit **no llevan** trailer de coautoría ni atribución a Claude. Línea base original: `git show 40db8c5:trayecto.html`.

### Publicado

Todo está en `origin/main` (https://github.com/GJ030/Trayecto). El push estuvo bloqueado con 403 hasta instalar la app de Claude en el repo; ya quedó resuelto. El repo `Trayecto-privado-respaldo` no se toca.

### Cambio posterior: las rutas generadas ya no se guardan

Para que el `localStorage` y `trayecto-datos.json` no crezcan, `stringifyData` (`data/schema.ts`) omite los `points` de los viajes `pointsSource: 'auto'`; se regeneran al leer (`migrate` y `parseBackup`). Las rutas `'imported'` y el respaldo JSON manual conservan todos los `points`. Riesgo: cambiar `tripPoints` cambia las rutas de los viajes existentes; la prueba «huella del algoritmo» en `routes.test.ts` lo detecta. Detalle en `CLAUDE.md`.

### Cambio posterior: odómetro final o distancia

El formulario de viaje tiene un interruptor para capturar el odómetro final o la distancia que marca la computadora; el otro valor se calcula. Se recuerda en `settings.odoMode`. Detalle en `CLAUDE.md`; pruebas en `trips.calc.test.ts`, `trips.repo.test.ts` y `tests/e2e/odometer.spec.ts`.

### Cambio posterior: el mapa se recupera de un fallo pasajero

Un mapa que fallaba (p. ej. el primero tardó más del plazo) se quedaba en «Mapa sin conexión» hasta recargar. Ahora el aviso es un botón **Reintentar**, hay reintento automático con el evento `online`, el primer mapa espera 15 s en vez de 8 y los avisos idénticos no se apilan. Pruebas: `tests/e2e/maps.spec.ts`.

## Entorno

- Node 22, Vite 8 (Rolldown), TypeScript 6, Vitest 5, ESLint 10, Playwright 1.64. Comandos y definición de terminado: ver `CLAUDE.md`.
- Playwright necesita el Chromium de su misma versión: si falla con «Executable doesn't exist», `npx playwright install chromium`.
- `vite.config.ts` contiene también la config de Vitest (`include: src/**/*.test.ts`, entorno `node`, `passWithNoTests`) y un plugin `closeBundle` que renombra `dist/index.html` a `dist/trayecto.html`.
- En Windows el shell mezcla Git Bash y PowerShell; para editar código con muchos caracteres especiales fue más fiable un script `.cjs` temporal con pares «buscar → reemplazar» que `sed` o `node -e`.

## Qué se hizo en las fases 5 y 6

- **Unitarias** junto a cada módulo: `fuel.calc` (km/L con cargas parciales), `trips.calc` (duración con medianoche, costo con y sin computadora, filtros, `compAccuracy`), `vehicles.calc`, `places.calc`, `schema` (validaciones, saneado, `parseBackup`), `routes` (determinismo de `tripPoints`, `resolvePoints`), `migrations` (v1→v2), `store` (ida y vuelta del respaldo, `adoptData`, eventos y `batch`), `storage/local`, repos de viajes, cargas, lugares (renombrar, fusionar + deshacer, eliminar), vehículos (cascada) y ajustes, más utilidades. `src/testing/fixtures.ts` da los datos ficticios y los ayudantes (`setState`, `resetState`, `recordEvents`).
- **`src/architecture.test.ts`** revisa la regla de capas en todos los imports (relativos, dinámicos y reexportaciones) y comprueba que el verificador detecta violaciones.
- **E2E** (`tests/e2e/`): `navigation`, `trips`, `fuel`, `places`, `vehicles`, `backup` y el `smoke` previo, con `fixtures.ts` (abre `dist/trayecto.html` por `file://`, CDN bloqueada, falla ante errores de consola). El caso central es exportar → borrar todo → importar con datos idénticos. `playwright.config.ts` fija viewport, locale `es-MX` y zona horaria.
- Detalles útiles al escribir más E2E: tras cerrar un panel lateral su formulario sigue en el DOM pero inerte, así que se espera con `drawerClosed` (clase `open` fuera e `inert`) en lugar de contar elementos; con datos escritos, `Esc` abre el diálogo «¿Descartar los cambios?»; tras guardar un viaje queda abierto su resumen, que hay que cerrar antes de navegar.

## Verificación de paridad con el original (`tools/parity/`)

Guion de 67 pasos con tiempo congelado y `Math.random` con semilla; compara DOM, estado, `localStorage`, JSON/CSV exportados y una firma de estilos. Ya no es parte de `npm run check`; queda como referencia.

```bash
git show 40db8c5:trayecto.html > tools/parity/baseline.html      # está en .gitignore
node tools/parity/run.mjs tools/parity/baseline.html tools/parity/base.json
npm run build
node tools/parity/run.mjs dist/trayecto.html tools/parity/new.json
NO_SHOTS=1 node tools/parity/compare.mjs tools/parity/base.json tools/parity/new.json
```

- Resultado fases 2 y 3: `IDÉNTICO`. Los hashes de capturas (`shot*`) son inestables incluso entre corridas del original; por eso `NO_SHOTS=1`. La firma de estilos del primer paso a veces cambia (ruido de tiempo).
- **Fase 4: única diferencia conocida y aceptada.** El original llamaba `uid('t')` al _editar_ un viaje (lo descartaba) y consumía un número aleatorio; los repos no, y los ids generados después difieren (~108 diferencias en cascada, solo ids). Añadir temporalmente `uid('t');` al inicio de `tripsRepo.update` y reconstruir da `IDÉNTICO`; revertir después.
- `tools/` está ignorado por ESLint y Prettier.

## Deuda conocida / ideas (no bloquean)

- `src/data/schema.ts` define `Raw = any` (única excepción de lint) para la entrada no confiable (JSON importado, `localStorage`).
- `data/storage/file.ts` aún mezcla lógica con `toast`/`confirmDialog` (permitido: data → shared); `fsInfo()` devuelve textos de interfaz desde `data`. Por eso no tiene pruebas unitarias; la lógica de conflictos, `dirty` y respaldos diarios solo se ha probado a mano.
- `places.calc.ts` importa `maps/svg` (permitido: features → maps).
- El E2E de la carpeta de datos real no es posible por `file://` (OPFS no existe ahí); se probó antes a mano con Chrome real y un handle de OPFS vía `window.__trayecto.fs.link`. El selector nativo y los mapas reales con GPU siguen siendo pruebas manuales.
- Los `*.actions.ts`, `*.form.ts` y `*.view.ts` no tienen pruebas unitarias (tocan el DOM al importarse); los cubren los E2E. Agregar jsdom o happy-dom permitiría probarlos sin navegador.
