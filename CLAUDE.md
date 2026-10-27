# Trayecto

Aplicación de escritorio **100 % local** para registrar viajes en auto, cargas de gasolina y lugares. Idioma de la interfaz: español (es-MX). Versión mostrada en Ajustes: **2.1**.

El código fuente es un proyecto **Vite + TypeScript estricto**; `npm run build` lo empaqueta en **un solo archivo autocontenido, `dist/trayecto.html`**, que se abre con doble clic (`file://`). Ese archivo es el que se usa a diario y el que se respalda; `dist/` no se versiona.

Los datos viven en `localStorage` (caché) y, opcionalmente, en un archivo `trayecto-datos.json` dentro de una carpeta que el usuario elige (Chrome/Edge); nunca salen del equipo. Lo único que usa internet son los mapas reales (MapLibre y el estilo/mosaicos de OpenFreeMap, desde una CDN); sin conexión la app sigue funcionando con los mapas SVG esquemáticos.

## Comandos

Node 22. Instalar con `npm ci`; los E2E necesitan Chromium (`npx playwright install chromium`).

| Comando             | Qué hace                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo de Vite (`localhost`).                              |
| `npm run build`     | Genera `dist/trayecto.html` (singlefile; un plugin renombra `index.html`). |
| `npm run typecheck` | `tsc --noEmit`.                                                            |
| `npm run lint`      | ESLint + `prettier --check`. `npm run format` aplica Prettier.             |
| `npm test`          | Vitest: `src/**/*.test.ts`, entorno `node`.                                |
| `npm run test:e2e`  | Playwright contra `dist/trayecto.html` (hay que construir antes).          |
| `npm run check`     | typecheck → lint → test → build → test:e2e, en ese orden.                  |

**Definición de terminado: `npm run check` en verde.** Un commit por cambio coherente y sin trailer de coautoría ni atribución a ninguna herramienta.

**El repo es público: no escribas coordenadas, placas ni direcciones reales** en el código, las pruebas ni la documentación. Los lugares de ejemplo (`SEED_GEO` en `data/schema.ts`) y las pruebas usan ubicaciones ficticias.

## Arquitectura

Alias `@/` → `src/`. Dentro de una misma funcionalidad se importa con ruta relativa (`./x`); entre capas siempre con `@/`.

```
shared  →  data  →  maps  →  features  →  app
```

Cada capa solo importa de las anteriores (los `import type` están permitidos en cualquier dirección). Las funcionalidades **no se importan entre sí**: de otra solo se puede usar su `*.repo.ts` y su `*.calc.ts`, y se comunican por los eventos del store. La regla la hace cumplir ESLint (`eslint.config.js`, solo vigila imports con `@/`) y `src/architecture.test.ts` (todos los imports, también relativos y dinámicos).

```
src/
  main.ts               importa el CSS, las *.actions, arranca y expone window.__trayecto
  app/                  nav (render/go/búsqueda), sync (onChange → save/chrome/render), shell (menú lateral),
                        events (delegación + ganchos), shortcuts (teclado global), fs-status (indicador de la carpeta)
  shared/utils/         dates, format, norm, uid, math, geo, download
  shared/ui/            dom, icons, charts, blocks, toast, modal, drawer, combo, chrome, actions, navigation, theme
  data/                 schema (tipos + validación), routes (tripPoints/resolvePoints), seed, migrations,
                        store (S + eventos), storage/{local,idb,file}
  maps/                 geo, svg (respaldo), loader, registry (MapReg), routeMap, placesMap, play
  features/<f>/         <f>.repo / .calc / .form / .view / .actions (+ .ui, .locate en places)
                        trips fuel places vehicles dashboard stats settings backup
  testing/              fixtures compartidos por las pruebas (no es parte de la app)
tests/e2e/              Playwright
tools/parity/           guion de paridad contra el monolito original (ver más abajo)
```

### Estado y eventos (`data/store.ts`)

- `S` es el estado vivo (`export let`; se reasigna solo con `setS`, los demás lo leen por binding vivo). Al importar el módulo carga `localStorage`, migra y normaliza (o siembra los datos de ejemplo).
- Los repos modifican `S` y llaman `emitChange(scope, persist = true, render = true)`. Scopes: `trips fuel places vehicles settings ui chrome all view`.
- `batch(fn)` junta varias modificaciones en un solo evento (persist y render se combinan con OR). `updateUi`, `setQuery` y `requestRender()` cambian solo la pantalla.
- `app/sync.ts` es el único suscriptor: `persist → save()`, scope `chrome → applyChromeState()`, `render → render()`.
- `save()` escribe en `localStorage` al instante y llama al gancho `afterSave` (el archivo de datos, `touch`).
- `render()` reemplaza el HTML del contenido en cada interacción; lo que deba sobrevivir (mapas, reproducción, modo ubicación) vive **fuera del DOM** (`MapReg`, `Play`, `locState`).

### Repositorios (`features/*/*.repo.ts`)

Único lugar que modifica cada colección (`tripsRepo`, `fuelRepo`, `placesRepo`, `vehiclesRepo`, `settingsRepo`). Validan con `checkTrip/checkFuel/checkVehicle/checkPlaceName` de `schema.ts` y lanzan `ValidationError`; aplican las cascadas y emiten el evento.

- `tripsRepo`: `renamePlace`, `regeneratePoints`, `retargetPlace`/`restoreRetargeted` (fusión y deshacer), `removeByVehicle`, `usingPlace`. `update` devuelve `null` si el viaje ya no existe y recuerda `settings.computerUnit`.
- `placesRepo`: `ensure` (nombre canónico, crea si no existe), `update` (renombra con cascada), `remove` y `merge` devuelven `{undo()}`, `setLocation` (regenera rutas `auto`). Depende de `tripsRepo`, nunca al revés.
- `vehiclesRepo.remove` hace cascada a viajes y cargas y limpia `defaultVehicle`, `ui.tf.vehicle`, `ui.ff` y `ui.selTrip`.
- `settingsRepo`: `resetToDemo` y `wipeAll` reemplazan `S` y emiten `all`.
- Cálculo puro: `computeDerived(vehicles, fuel, trips)` en `fuel.calc.ts` (km/L entre tanques llenos); `derive()` solo lo asigna a `D`.

### Acciones de interfaz

Las vistas generan HTML con `data-action` / `data-change`. `shared/ui/actions.ts` registra los manejadores (`registerClick`, `registerChange`, `registerSubmit`, `registerInput`, `registerKeydown`…) y `installDelegation` los conecta en `app/events.ts`. Cada funcionalidad registra lo suyo en su `*.actions.ts`; un nombre de acción repetido lanza error al arrancar. El panel lateral usa `registerDrawerActions`/`registerDrawerDelete` (`shared/ui/drawer.ts`).

Desacoplamientos puntuales: `drawerHooks.park/mount` (el panel no importa `maps`), `shared/ui/navigation.ts` (`go` sin importar `app`), `setPlacesMapData` (Lugares aporta visitas y trayectos al mapa), `onFsChange`/`notifyFs` (el indicador de la carpeta se pinta en `app/fs-status.ts`).

## Dónde agregar

- **Una vista nueva**: `features/<f>/<f>.view.ts` (+ `.actions.ts`, `.css`), alta en `VIEWS` de `app/nav.ts`, `VIEW_NAMES` de `schema.ts` y el menú (`shared/ui/chrome.ts`); importa su `*.actions` en `main.ts`. Prueba E2E de la sección.
- **Un campo nuevo en un registro**: en este orden → tipo y saneado en `data/schema.ts` (`normalize`, `parseBackup`, el `check*` correspondiente) → migración en `data/migrations.ts` si cambia el significado de datos viejos (subir `DATA_VERSION` solo si los respaldos anteriores dejan de ser válidos; los campos opcionales no lo requieren) → repo (`core()` de `trips.repo.ts` define el **orden de las claves**, que importa para la paridad) → `*.form.ts` → `*.view.ts` y CSV si aplica → pruebas (schema, repo, respaldo ida y vuelta, E2E).
- **Un cálculo nuevo**: función pura en el `*.calc.ts` de la funcionalidad, con su `*.calc.test.ts`. Si lo necesita otra funcionalidad, que importe ese `*.calc`.
- **Un servicio externo**: encapsúlalo en `maps/` o `data/storage/` (con su carga bajo demanda y respaldo sin conexión); nada de `fetch` en vistas. Si es un script de CDN, con SRI y bloqueado en los E2E (`page.route`).

## Pruebas

- **Vitest** (`src/**/*.test.ts`, junto a cada módulo). Entorno `node`: sin DOM ni `localStorage` (`Store.init()` lo tolera y queda en memoria). Se pueden importar repos, `*.calc` y `data/*`; los archivos que tocan el DOM al importarse (`shared/ui/dom`, `drawer`, `modal`, `toast`, `maps/*`, `app/*`, `*.actions`, `*.form`, `*.view`) no. `src/testing/fixtures.ts` da datos ficticios, `setState`/`resetState` (llaman a `setS`) y `recordEvents`. No afirmes ids concretos: `uid` usa `Math.random` y `Date.now`.
- **Playwright** (`tests/e2e/`): cada prueba abre `dist/trayecto.html` por `file://` con la CDN bloqueada y falla ante errores de consola (`fixtures.ts`). Cada contexto tiene su propio `localStorage`, así que parte de los datos de ejemplo. El estado se lee con `window.__trayecto.state`. 1 worker, zona horaria y locale fijos en `playwright.config.ts`. La carpeta de datos real no se puede probar por `file://` (OPFS no existe ahí).
- **Paridad con el monolito** (`tools/parity/`, ignorado por ESLint y Prettier): guion de 67 pasos con tiempo congelado y azar con semilla que compara DOM, estado, `localStorage` y exportaciones contra `40db8c5:trayecto.html` (`git show 40db8c5:trayecto.html > tools/parity/baseline.html`, regenerar antes de comparar). Hoy solo sirve como referencia: la única diferencia aceptada desde la fase 4 es que el original consumía un `uid('t')` al editar un viaje.
- A mano, con Chrome real: el selector de carpetas nativo y su aviso de permiso, y los mapas reales con GPU y conexión lenta.

## Datos de desarrollo

En desarrollo (`localhost`) `localStorage` e IndexedDB son **independientes** de los de `file://`: lo que guardes con `npm run dev` no aparece en `dist/trayecto.html` ni al revés. Para probar la carpeta de datos usa una **carpeta de prueba**, nunca la real. `window.__trayecto.fs.link(dirHandle)` permite enlazar un handle (p. ej. de OPFS) sin el selector nativo. `window.__trayecto` también expone `state`, `render`, `go`, `openTripPanel`, `openFuelPanel`, `maps`, `play` y `loc`.

## Funciones

- **Inicio**: último viaje (mapa), resumen semanal, rendimiento promedio y gasto mensual.
- **Viajes**: tabla ordenable y filtrable, detalle con mapa interactivo, **reproducción de la ruta**, tarjeta PNG, edición (tecla `E`) y borrado.
- **Gasolina**: cargas con km/L calculado entre tanques llenos; alta, edición (lápiz) y borrado.
- **Lugares**: mapa con tres capas (Lugares / Todas las rutas / Mapa de calor), tiempos de traslado por trayecto, **ubicar o mover lugares** en el mapa y, por cada lugar, un menú de acciones (⋮): **Editar**, **Mover ubicación**, **Fusionar con…** y **Eliminar**, con **Deshacer** durante 6 s (también `Ctrl+Z`).
- **Estadísticas**, **Vehículos**, **Ajustes** (preferencias, atajos, restablecer/borrar datos) y **Respaldo** (JSON, CSV, **carpeta de datos** y respaldos automáticos).
- **Indicador de guardado** al pie del menú lateral (también contraído) y aviso discreto bajo la barra superior cuando la carpeta necesita atención.
- Atajos: `N` viaje nuevo, `G` carga nueva, `E` editar el viaje seleccionado, `/` buscar, `Esc` cerrar, `Ctrl+Enter` guardar en un panel, `↑ ↓` moverse entre viajes.

## Modelo de datos v2 (`DATA_VERSION = 2`)

```
{ version: 2, vehicles, places, trips, fuel, settings, ui }
place: { id, name, area, lat, lng, kind }          // lat/lng reales; null = sin ubicación
                                                    // con lat/lng NO se guarda x/y (se proyecta); sin ellos se conserva x/y estimado
trip:  { id, date, depart, arrive, origin, destination, odoStart, odoEnd, vehicleId, tag,
         points: [{ lat, lng, t (ISO), speed (km/h) }],   // 20–60 puntos
         pointsSource: 'auto' | 'imported',
         computerKmpl: number | null,                     // rendimiento de la computadora, normalizado a km/L (3–40)
         computerUnit: 'kmpl' | 'l100' | null }           // unidad en que se capturó, solo para mostrarlo igual
fuel:  { id, date, station, odometer, liters, price, full, vehicleId }
settings: { defaultVehicle, defaultTag, hints, lastBackup, computerUnit }   // computerUnit = última unidad usada en el formulario
ui:    { view, collapsed, sort, tf, selTrip, selPlace, selPair, placesLayer, ... }
```

- Compatibilidad (no tocar): `localStorage` `trayecto:v2` (datos), `trayecto:v1` (se migra y se borra solo cuando v2 ya quedó guardado) y `trayecto:fs` (metadatos del archivo); IndexedDB `trayecto-fs` / almacén `kv` / clave `dir`; archivo `trayecto-datos.json` y carpeta `respaldos/`.
- Los lugares se enlazan con los viajes **por nombre** (`norm(name)`), no por id.
- `pointsSource`: `'auto'` = generados por la app (se **regeneran** al editar el viaje o al ubicar/mover un lugar que usa); `'imported'` = ruta ajena (nunca se sobrescribe). Si falta, `resolvePoints` lo deduce comparando con lo que generaría la app.
- `tripPoints` (`data/routes.ts`) es determinista (semilla = id del viaje): recorrido ortogonal tipo calle, puntos y velocidades coherentes con la hora de salida/llegada, también si cruza la medianoche; el promedio de `speed` coincide con la velocidad del viaje. Devuelve `[]` si origen o destino no tienen lat/lng.
- **Migración v1 → v2** (`migrate`, también al importar): los lugares de ejemplo reciben lat/lng por nombre solo si conservan su posición original; se generan los `points` y `pointsSource` que falten.
- **Respaldo JSON** (`backupPayload`/`parseBackup`): `{ app, version, exportedAt, data }`. Al importar se validan lat/lng (rango), se descartan puntos inválidos, se regeneran los que falten y se rechaza una versión mayor a 2. Los CSV (viajes, cargas) llevan BOM UTF-8 y neutralizan celdas que empiezan con `= + - @`.

## Rendimiento de la computadora por viaje

Campo opcional «Rendimiento de la computadora» (lo que marca el tablero al terminar el viaje) en el formulario de viaje, nuevo y editar.

- **Captura** (`openTripPanel`, `readComputer` en `trips.form.ts`): número + unidad (km/L o L/100 km; se recuerda la última en `settings.computerUnit`, y al editar se muestra la unidad original). Rangos: 3–40 km/L, equivalente 2.5–33.3 L/100 km; fuera de rango bloquea el guardado y marca el campo. Al capturarlo, la nota de base cambia a «(14.2 km/L de la computadora · $24.30/L)» y se muestran los **litros estimados** (siempre, con o sin dato).
- **Modelo**: `cleanComputer` (`schema.ts`) es la única regla de saneado y se aplica en `normalize`, `parseBackup` y los repos; un valor fuera de rango se vuelve `null` sin descartar el viaje. **No se subió `DATA_VERSION`**: los campos son opcionales. Capturarlo no toca `points`.
- **Costo** (`trips.calc.ts`): `tripKmpl(t)` = rendimiento de la computadora o, si falta, el promedio del vehículo (`kmplOf`, 12 km/L si no hay cargas); `tripLiters` y `tripCost` salen de ahí, así que tablas, Inicio, Estadísticas y el CSV lo usan sin cambios.
- **Dónde se ve**: detalle del viaje («Rendimiento (computadora)», «Litros estimados» y «Base del costo»), tarjeta PNG (línea bajo el vehículo) y CSV de viajes (columna `rendimiento_computadora_km_l`, **al final** para no mover las demás).
- **Precisión de la computadora** (`compAccuracy`, en Vehículos y Estadísticas): promedio de los `computerKmpl` del vehículo contra el promedio de los km/L de las cargas de tanque lleno **cuyo intervalo** (desde la carga llena anterior hasta su fecha) toca el periodo de esos viajes. Solo aparece con ≥ 3 viajes con dato y al menos una carga con rendimiento calculado en ese periodo. Texto: «La computadora marca N % más/menos que el real» (o «coincide con el real» si la diferencia es < 0.5 %).

## Editar, eliminar y fusionar lugares

Los viajes guardan `origin`/`destination` como **texto** y se enlazan al lugar por `norm(nombre)`, así que cualquier cambio de nombre se propaga a los viajes (siempre a través de `tripsRepo`).

- **Editar** (`places.form.ts` → `placesRepo.update`): nombre, colonia/zona e ícono (`KINDS`: home, work, gym, family, other). El nombre no puede quedar vacío ni repetirse (sin mayúsculas ni acentos; cambiar solo mayúsculas del propio lugar sí se permite). Si cambia, se reescribe `origin`/`destination` en todos los viajes que lo usan **sin tocar `points`** y se reasigna `ui.selPair`.
- **Eliminar** (`deletePlace` en `places.actions.ts`): sin viajes, confirmación simple. Con viajes, `chooseDialog` muestra cuántos y ofrece «Conservar los viajes» (mantienen texto y ruta; el lugar sale de la lista y del mapa) o «Fusionar con otro lugar». **Nunca se borran viajes.** Si luego se registra un viaje con ese nombre, `placesRepo.ensure` recrea el lugar (sin ubicación).
- **Fusionar** (`mergeDialog` → `placesRepo.merge`): los viajes de A pasan al nombre de B, las rutas `'auto'` se regeneran con las coordenadas de B (si B no tiene ubicación se conservan las anteriores; las `'imported'` nunca se tocan) y A se elimina.
- **Deshacer** (`showUndo`/`runUndo` en `places.ui.ts`): el aviso lleva el botón «Deshacer» ~6 s (`toast` acepta `{ms, action}`; `Ctrl+Z` fuera de un campo de texto también). El `undo()` de los repos restaura por referencia y se niega si entretanto se creó otro lugar con ese nombre.
- Tras eliminar o fusionar se limpian `selPlace`, `selPair` (si involucra el lugar) y el modo ubicación. El menú ⋮ (`.pmenu`) se inserta en el DOM al abrirlo: Esc o clic fuera lo cierran y el foco vuelve al botón.

## Persistencia en archivo (`data/storage/file.ts`)

File System Access API (`showDirectoryPicker`, modo `readwrite`). Sin la API (`FS.supported` falso) la sección de Respaldo se reemplaza por la nota «Disponible en Chrome o Edge», se oculta el indicador y la app funciona como antes. `navigator.storage.persist()` se llama al iniciar.

- **Archivo**: `trayecto-datos.json` con el formato del respaldo JSON v2 (`{app, version, exportedAt, data:{vehicles, places, trips, fuel, settings}}`, `lastBackup` en `null`, sin `ui`). El identificador de la carpeta vive en IndexedDB (`data/storage/idb.ts`).
- **`save()`** escribe en `localStorage` al instante y llama a `afterSave` (`touch`): la escritura al archivo es un _debounce_ de 800 ms (`tick` → `flush`, una sola escritura a la vez, serializada con `FS.busy/again`). `pagehide`, `beforeunload` y `visibilitychange` (oculta) disparan lo pendiente. Si el contenido no cambia (solo cambió la pantalla) no se escribe.
- **Validación**: `validated()` pasa los datos por `parseBackup` y falla si el filtro descartaría algún registro; nunca se escribe si falla (estado `error`, el detalle va en el tooltip).
- **Claves de comparación**: `canonKey(data)` (ignora `hints` y `lastBackup`, preferencias de cada equipo). `FS.syncKey` = clave del último contenido sincronizado; `FS.known` = `lastModified` conocido del archivo.
- **Conflicto**: antes de escribir se compara `lastModified` con `FS.known`; si cambió y el contenido ya no es el sincronizado ni igual al de la app, `chooseDialog` pregunta qué versión conservar (archivo / app; Esc = decidir después → estado `conflict`, no se escribe nada hasta resolver con el aviso «Elegir versión»).
- **`dirty`** (`localStorage` clave `trayecto:fs`, junto con `fileMod` y `modified`): se marca en cada `save()` con carpeta enlazada y se limpia solo tras escribir con éxito. En la siguiente sesión, si hay `dirty` y el archivo no cambió se empujan los cambios pendientes; si cambió, se pregunta. Sin `dirty`, al abrir se carga el archivo.
- **Estados** (`FS.state`): `none`, `ok`, `saving`, `error`, `off` (permiso por reconfirmar: aviso «Reconectar carpeta de datos»; `requestPermission` necesita clic), `missing`, `nofile`, `invalid`, `conflict`. Los cuatro últimos son _hold_ (`FS_HOLD`): no se escribe hasta que el usuario decide; la caché sigue intacta. Los manejadores `fs-*` llaman a `fsAction` sin `await` previo para conservar la activación del clic.
- **Respaldos diarios**: antes de la primera escritura del día se crea `respaldos/trayecto-AAAA-MM-DD.json` con el **contenido previo** del archivo (si ya existe el de hoy, no se hace nada) y se conservan los 14 más recientes (`FS_KEEP`). Solo se tocan nombres que cumplen `BK_RE`. Un fallo del respaldo no impide guardar.

## Mapas

- `maps/svg.ts`: `project()` es una proyección lineal sobre `GEO_BOUNDS` estirada al lienzo SVG de 800×520 y acotada a sus márgenes; es el respaldo sin conexión, no un mapa fiel.
- `maps/loader.ts`: MapLibre GL JS 5.7.0 (unpkg, con SRI) y estilo `https://tiles.openfreemap.org/styles/dark` con el fondo ajustado a `#0F0F12`; se cargan bajo demanda. `maplibre-gl` está en `devDependencies` **solo por sus tipos** (no entra al bundle); `src/types/browser.d.ts` declara el global `maplibregl` y la File System Access API. Cada contenedor nace como SVG con `data-tmap` (viaje) o `data-pmap` (lugares) y `mountMaps` monta el mapa encima.
- **Registro `MapReg`** (`maps/registry.ts`): antes de reemplazar HTML se «aparcan» los mapas (`parkMaps`); después se reutiliza el que muestra el mismo viaje y ruta (clave = id + hash de points), se destruyen los sobrantes y se crean los nuevos. Así nunca hay más de 1–2 contextos WebGL vivos. El mapa de lugares se **actualiza en su sitio** (`refreshPlaces`).
- Respaldo sin conexión: si la librería, el estilo o los mosaicos no responden, queda el SVG con «Mapa sin conexión». Límite de espera: **8 s** para el primer mapa, 5 s para los siguientes; se desactiva cuando el evento `load` confirma que el mapa descargó lo necesario. Tras un fallo no se reintenta durante 30 s.
- Mapa de calor y rutas superpuestas escalan peso, radio y opacidad según la cantidad de points/viajes.

## Decisiones importantes

- Un solo HTML autocontenido como entregable (`vite-plugin-singlefile`), para abrirlo con doble clic y respaldarlo fácilmente; el código fuente se mantiene por funcionalidad.
- `lat/lng` es la única fuente de verdad de la posición; el SVG se deriva de ellas.
- No se muestran errores de red de MapLibre: el temporizador decide el respaldo. Se filtra el `AbortError` inofensivo que MapLibre registra al destruir un mapa con mosaicos en vuelo.
- Rendimiento medido con 500 viajes (≈21 000 points) y 150 cargas: render de cada vista < 35 ms, buscar en Viajes ≈ 80 ms, `go()` con guardado < 30 ms. Claves: `fmtDate` con caché y `Store.save` que serializa una sola vez.
- Contraste: `--muted` es `#8B8B97` (≥ 5:1 sobre las superficies).
- Estilo: Prettier con comillas simples, 100 columnas y coma final; `.gitattributes` fuerza LF. `Raw = any` en `schema.ts` es la única excepción de lint (entrada no confiable).

## Deuda conocida

- `data/storage/file.ts` aún mezcla lógica con `toast`/`confirmDialog` (permitido: data → shared); `fsInfo()` devuelve textos de interfaz desde `data`.
- `places.calc.ts` importa `maps/svg` (permitido: features → maps).
