# Traspaso: migración de Trayecto a Vite + TypeScript

Documento para continuar el trabajo en otra sesión. Léelo completo antes de tocar nada.

## Encargo original (resumen)

Migrar `trayecto.html` (un solo archivo de ~2 900 líneas) a un proyecto mantenible **sin cambiar comportamiento, apariencia ni datos**:

- Vite + `vite-plugin-singlefile`: `npm run build` genera `dist/trayecto.html` autocontenido que funciona por `file://` (File System Access API y MapLibre desde la CDN incluidos).
- TypeScript estricto, Vitest (unitarias), Playwright (E2E contra `dist/trayecto.html`), ESLint + Prettier.
- Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `check` (typecheck → lint → test → build → test:e2e).
- Arquitectura por funcionalidad, repos CRUD, mismas claves de localStorage / misma base IndexedDB / mismo formato de archivo.
- **Proceso: un commit por fase y `npm run check` en verde al final de cada una.** Fases: 1 andamiaje, 2 módulos ES (JS), 3 TypeScript, 4 repos + eventos, 5 pruebas unitarias, 6 pruebas E2E. Al final: borrar `trayecto.html` de la raíz (queda en git) y reescribir `CLAUDE.md`.

## Estado

| Fase                                                         | Estado                                                | Commit    |
| ------------------------------------------------------------ | ----------------------------------------------------- | --------- |
| 1 Andamiaje                                                  | hecha                                                 | `ca927e2` |
| 2 Módulos ES                                                 | hecha                                                 | `3b325c9` |
| 3 TypeScript estricto                                        | hecha                                                 | `7b9c9cb` |
| 4 Repos, eventos, dependencias                               | **hecha**                                             | `f08d60d` |
| 5 Pruebas unitarias                                          | **pendiente**                                         | –         |
| 6 Pruebas E2E                                                | **pendiente** (solo existe `tests/e2e/smoke.spec.ts`) | –         |
| Cierre: `CLAUDE.md` nuevo, borrar `trayecto.html` de la raíz | **pendiente**                                         | –         |

Repo git local en esta carpeta, rama `main`, sin remoto. Los mensajes de commit **no llevan** trailer de coautoría ni atribución a Claude.
Línea base original: commit `d88497a` (`git show d88497a:trayecto.html`). `trayecto.html` sigue en la raíz hasta el cierre; ESLint y Prettier lo ignoran.

## Comandos y entorno

- Node 22, npm 11. Vite 8 (usa Rolldown), TypeScript 6, Vitest 5, ESLint 10, Playwright 1.64.
- Chromium de Playwright ya instalado (`npx playwright install chromium` si falta).
- `npm run check` pasa hoy completo (el E2E es solo la prueba de humo).
- `vite.config.ts`: singlefile + un plugin `closeBundle` que renombra `dist/index.html` → `dist/trayecto.html` (Rolldown no permite reasignar el bundle). La config de Vitest vive ahí (`passWithNoTests`; incluye `src/**/*.test.ts`, entorno `node`). `defineConfig` viene de `vitest/config`.
- Alias `@/` → `src/`. Dentro de una misma funcionalidad se importa con ruta relativa (`./x`); entre capas siempre con `@/`.
- `.gitattributes` fuerza LF. Prettier: comillas simples, 100 columnas, coma final.
- `maplibre-gl@5.7.0` está como devDependency **solo por sus tipos** (la app lo carga de la CDN con SRI; no entra al bundle). `src/types/browser.d.ts` declara `maplibregl` global y la File System Access API.
- Windows: el shell mezcla Git Bash y PowerShell. Para editar código con muchos caracteres especiales fue más fiable escribir un script `.cjs` temporal con pares «buscar → reemplazar» que usar `sed` / `node -e` con comillas. Para reescribir un archivo existente con la herramienta Write hay que haberlo leído antes (o borrarlo y crearlo).

## Arquitectura (regla de dependencias, la hace cumplir ESLint)

```
shared  →  data  →  maps  →  features  →  app
```

Cada capa solo importa de las anteriores (los `import type` están permitidos en cualquier dirección). Las funcionalidades **no se importan entre sí**; solo pueden usar de otra funcionalidad su `*.repo.ts` y su `*.calc.ts`, y se comunican por los eventos del store. Ver `eslint.config.js` (`@typescript-eslint/no-restricted-imports` con `regex`). El bloque de reglas se probó creando archivos que violan cada regla.

```
src/
  main.ts               importa CSS en el orden original, las *.actions y arranca
  app/                  nav.ts (render/go/búsqueda), sync.ts (onChange → save/chrome/render),
                        shell.ts (menú lateral), events.ts (delegación + acción «go» + ganchos),
                        shortcuts.ts (teclado global), fs-status.ts (indicador/aviso de la carpeta)
  shared/utils/         dates, format, norm, uid, math, geo, download
  shared/ui/            dom ($, $$, req), icons, charts, blocks, toast, modal, drawer, combo,
                        chrome, actions (registro de acciones), navigation (go desacoplado), theme
  data/                 schema (tipos + validación), routes (tripPoints/resolvePoints), seed,
                        migrations, store (S + eventos), storage/{local,idb,file}
  maps/                 geo, svg (respaldo), loader, registry (MapReg), routeMap, placesMap, play
  features/<f>/         <f>.repo / .calc / .form / .view / .actions (+ .ui, .locate en places)
                        trips fuel places vehicles dashboard stats settings backup
tests/e2e/              Playwright
tools/parity/           guion de paridad contra el original (ver abajo)
```

### Modelo de eventos (`src/data/store.ts`)

- `S` es el estado vivo (`export let`, se reasigna solo con `setS`; los demás lo leen por binding vivo).
- Los repos modifican `S` y llaman `emitChange(scope, persist = true, render = true)`. Scopes: `trips fuel places vehicles settings ui chrome all view`.
- `batch(fn)` junta varias modificaciones en un solo evento (persist y render se combinan con OR).
- `updateUi(patch, {persist, render, silent, chrome})` cambia `S.ui`; `setQuery`, `requestRender()` (= evento `view`, sin guardar).
- `app/sync.ts` es el único suscriptor: `persist → save()`, `scope chrome → applyChromeState()`, `render → render()`.
- `save()` escribe en localStorage y llama al gancho `afterSave` (el archivo de datos, `touch`).

### Repositorios (`features/*/*.repo.ts`)

Objetos `tripsRepo`, `fuelRepo`, `placesRepo`, `vehiclesRepo`, `settingsRepo` con `list/get/create/update/remove` (settings: `get/update`) más operaciones propias. Validan con `checkTrip/checkFuel/checkVehicle/checkPlaceName` de `schema.ts` y lanzan `ValidationError`.

- `tripsRepo`: `renamePlace`, `regeneratePoints`, `retargetPlace`/`restoreRetargeted` (fusión + deshacer), `removeByVehicle`, `usingPlace`. `update` devuelve `null` si el viaje ya no existe; recuerda `settings.computerUnit`.
- `placesRepo`: `ensure(name, anchor, km)` (nombre canónico, crea si no existe), `update` (renombra con cascada y reasigna `ui.selPair`), `remove` y `merge` devuelven `{undo()}`, `setLocation` (regenera rutas `auto`). Depende de `tripsRepo` (nunca al revés).
- `vehiclesRepo`: `remove` hace cascada a viajes y cargas, limpia `defaultVehicle`, `ui.tf.vehicle`, `ui.ff`, `ui.selTrip`.
- `settingsRepo`: `setDefaultTag`, `setDefaultVehicle`, `toggleHints`, `markBackup`, `resetToDemo`, `wipeAll` (estos dos reemplazan `S` y emiten `all`).
- Cálculo puro testeable: `computeDerived(vehicles, fuel, trips)` en `fuel.calc.ts` (km/L entre tanques llenos; `derive()` solo lo asigna a `D`).

### Acciones de interfaz

`shared/ui/actions.ts`: `registerClick` (por `data-action`), `registerChange` (por `data-change`), `registerChangeById`, `registerSubmit` (por id de formulario), `registerInput`, `registerKeydown`; `installDelegation(contentEl)` los conecta (en `app/events.ts`). El panel lateral tiene `registerDrawerActions` / `registerDrawerDelete` en `shared/ui/drawer.ts`. Cada funcionalidad registra lo suyo en su `*.actions.ts`; si un nombre de acción se repite, el registro lanza error al arrancar. Las vistas no cambiaron: siguen generando HTML con `data-action`.

Desacoplamientos puntuales: `drawerHooks.park/mount` (el panel no importa `maps`; se enlazan en `app/events.ts`), `shared/ui/navigation.ts` (`go` sin importar `app`), `setPlacesMapData` en `maps/placesMap.ts` (Lugares aporta visitas y trayectos), `onFsChange`/`notifyFs` en `data/storage/file.ts` (el pintado del indicador vive en `app/fs-status.ts`).

## Compatibilidad de datos (no tocar)

- localStorage: `trayecto:v2` (datos), `trayecto:v1` (se migra y se borra solo cuando v2 ya quedó guardado), `trayecto:fs` (metadatos del archivo).
- IndexedDB `trayecto-fs` / almacén `kv` / clave `dir`. Archivo `trayecto-datos.json` (formato del respaldo JSON v2) y carpeta `respaldos/` (14 copias).
- `DATA_VERSION = 2`. Orden de las claves de los registros importa para la paridad (ver `core()` en `trips.repo.ts`).
- En desarrollo (`localhost`) los datos son independientes de los de `file://`. Para probar la carpeta de datos usar una carpeta de prueba (esto va en el `CLAUDE.md` nuevo).
- `window.__trayecto` se conserva (estado, `fs.link`, `render`, `go`, `openTripPanel`, …) como gancho de pruebas.

## Verificación de paridad con el original (`tools/parity/`)

Guion de 67 pasos con tiempo congelado, `Math.random` con semilla, CDN bloqueada, animaciones reducidas. Compara DOM, estado, localStorage, JSON/CSV exportados y una firma de estilos calculados.

```bash
git show d88497a:trayecto.html > tools/parity/baseline.html      # ya existe, está en .gitignore
node tools/parity/run.mjs tools/parity/baseline.html tools/parity/base.json
npm run build
node tools/parity/run.mjs dist/trayecto.html tools/parity/new.json
NO_SHOTS=1 node tools/parity/compare.mjs tools/parity/base.json tools/parity/new.json
```

- Resultado fases 2 y 3: `IDÉNTICO`. Los hashes de capturas (`shot*`) son inestables entre corridas incluso del original; por eso `NO_SHOTS=1`. La firma de estilos del primer paso (`#0 inicio`) a veces cambia entre corridas (ruido de tiempo).
- **Fase 4: única diferencia conocida y aceptada.** El original llamaba `uid('t')` al _editar_ un viaje (lo descartaba), así que consumía un número aleatorio. Los repos no lo hacen, y desde la edición del guion los ids generados después difieren (~108 diferencias en cascada, solo ids). Para comprobar que es lo único: añadir temporalmente `uid('t');` al inicio de `tripsRepo.update`, reconstruir y comparar → sale `IDÉNTICO` (ya se hizo). Revertir después.
- `tools/` está ignorado por ESLint y Prettier.
- El guion también sirve de base para los E2E: los selectores (`#row-t15`, `#tOrigin`, `button[form=tripForm]`, `#fStation`, `[data-m="1"]`, `#importFile`, …) ya están probados.

## Qué falta

### Fase 5 — pruebas unitarias (Vitest, `src/**/*.test.ts`, junto a cada funcionalidad)

Cubrir al menos: km/L entre tanques llenos con cargas parciales (`computeDerived`), costo por viaje (`tripCost`/`tripLiters` con y sin rendimiento de la computadora), duración que cruza la medianoche (`tripDur`), migración v1→v2 (`migrate`, `cleanPlace`, `resolvePoints`), ida y vuelta del respaldo JSON (`backupPayload` → `parseBackup` → igual), cascadas de repos (renombrar, fusionar + deshacer, eliminar lugar, eliminar vehículo), validaciones de `schema.ts`, determinismo de `tripPoints`. Notas:

- Entorno `node`: `localStorage` no existe; `Store.init()` ya lo tolera (queda en memoria). `src/data/store.ts` ejecuta código al importarse (carga o siembra `S`), así que en pruebas basta importar y llamar `setS(normalize(seed()))` para partir de datos conocidos.
- Los repos usan `S` y `emitChange`; en pruebas se puede escuchar con `onChange`. `uid` usa `Math.random`/`Date.now`: no afirmar ids concretos.
- Archivos que tocan el DOM al importarse (`shared/ui/dom.ts`, `drawer`, `chrome`, `modal`, `toast`, `maps/*`, `app/*`, `*.actions`, `*.form`, `*.view` que importan `dom`) **no** se pueden importar en `node` sin DOM. Los repos, `*.calc` y `data/*` sí (verificar que `places.calc`/`trips.calc` no arrastren `shared/ui/icons`→`dom`; `places.calc` importa `shared/ui/icons` que no toca el DOM, pero `maps/svg` sí es puro; si algo falla, usar `// @vitest-environment jsdom` o happy-dom y añadir la dependencia).
- Opcional pero recomendable: una prueba de arquitectura que recorra `src/**/*.ts` y verifique la regla de capas también para imports relativos (ESLint solo vigila los imports con `@/`).

### Fase 6 — E2E (Playwright, `tests/e2e/`, contra `dist/trayecto.html`)

Ya hay `smoke.spec.ts` (abre por `file://`, sin errores en consola). Añadir: navegar por las 8 secciones, crear y editar un viaje, registrar una carga, y **exportar → borrar todo → importar deja los datos idénticos** (comparar `window.__trayecto.state` o el JSON). Notas:

- Bloquear la CDN con `page.route(/unpkg\.com|openfreemap\.org/, r => r.abort())`; el navegador registra esos fallos como errores de consola, por eso el filtro `Failed to load resource|net::ERR_`. Sin mapa aparece «Mapa sin conexión» y los botones de capa de Lugares quedan ocultos.
- Las descargas se leen con `page.waitForEvent('download')`; la importación con `setInputFiles('#importFile', …)`.
- `playwright.config.ts` usa 1 worker y `dist/trayecto.html` hay que construirlo antes (`npm run check` ya lo hace en orden).

### Cierre

1. Reescribir `CLAUDE.md` (hoy describe el monolito): comandos y propósito; definición de terminado = `npm run check` en verde; arquitectura, regla de dependencias y «dónde agregar» (nueva vista, nuevo campo de un registro: schema → migración → repo → form → view → pruebas, nuevo cálculo, nuevo servicio externo); el archivo de uso diario es `dist/trayecto.html`; datos de desarrollo independientes (localhost) y carpeta de prueba. Conservar de la versión actual lo que sigue siendo cierto (modelo de datos v2, rendimiento de la computadora, lugares editar/eliminar/fusionar, persistencia en archivo, mapas).
2. `git rm trayecto.html` (queda en el historial) y quitarlo de `.prettierignore` / `eslint.config.js` si ya no hace falta.
3. Commit de las fases 5 y 6 por separado, `npm run check` en verde en cada una.

## Deuda conocida / ideas (no bloquean)

- `src/data/schema.ts` define `Raw = any` (una sola excepción de lint) para la entrada no confiable (JSON importado, localStorage).
- `data/storage/file.ts` aún mezcla lógica con `toast`/`confirmDialog` (permitido: data → shared). `fsInfo()` devuelve textos de interfaz desde `data`.
- `places.calc.ts` importa `maps/svg` (permitido: features → maps).
- El E2E de carpeta de datos real no es posible por `file://` (OPFS no existe ahí); se probó antes a mano con Chrome real y un handle de OPFS vía `window.__trayecto.fs.link`.
