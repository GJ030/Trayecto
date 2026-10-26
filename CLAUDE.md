# Trayecto

Aplicación de escritorio **100 % local** para registrar viajes en auto, cargas de gasolina y lugares. Es un único archivo, `trayecto.html` (HTML + CSS + JS sin dependencias de compilación), que se abre con doble clic (`file://`). Idioma de la interfaz: español (es-MX). Versión mostrada en Ajustes: **2.1**.

Los datos viven en `localStorage` (caché) y, opcionalmente, en un archivo `trayecto-datos.json` dentro de una carpeta que el usuario elige (Chrome/Edge); nunca salen del equipo. Lo único que usa internet son los mapas reales (MapLibre y el estilo/mosaicos de OpenFreeMap); sin conexión la app sigue funcionando con los mapas SVG esquemáticos.

## Funciones

- **Inicio**: último viaje (mapa), resumen semanal, rendimiento promedio y gasto mensual.
- **Viajes**: tabla ordenable y filtrable, detalle con mapa interactivo, **reproducción de la ruta**, tarjeta PNG, edición (tecla `E`) y borrado.
- **Gasolina**: cargas con km/L calculado entre tanques llenos; alta, edición (lápiz) y borrado.
- **Lugares**: mapa con tres capas (Lugares / Todas las rutas / Mapa de calor), tiempos de traslado por trayecto, **ubicar o mover lugares** en el mapa y, por cada lugar, un menú de acciones (⋮): **Editar**, **Mover ubicación**, **Fusionar con…** y **Eliminar**, con **Deshacer** durante 6 s (también `Ctrl+Z`).
- **Estadísticas**, **Vehículos**, **Ajustes** (preferencias, atajos, restablecer/borrar datos) y **Respaldo** (JSON, CSV, **carpeta de datos** y respaldos automáticos).
- **Indicador de guardado** al pie del menú lateral (también contraído) y aviso discreto bajo la barra superior cuando la carpeta necesita atención.
- Atajos: `N` viaje nuevo, `G` carga nueva, `E` editar el viaje seleccionado, `/` buscar, `Esc` cerrar, `Ctrl+Enter` guardar en un panel, `↑ ↓` moverse entre viajes.

## Estructura del código

Todo el JavaScript está en un solo IIFE al final del archivo, dividido en secciones con un comentario `/* ===== Nombre ===== */`. Respeta ese orden al agregar código; las funciones se declaran con `function` (se elevan) y las constantes con `const` (deben estar definidas antes de usarse al arrancar).

| Sección | Contenido |
|---|---|
| Utilidades | `$`, `esc`, `norm`, fechas (`isoDate`, `parseDate`), formatos (`fmtDate` con caché, `NF*`, `MXN`), `hashStr`, `fin` |
| Íconos | `ICONS` y `icon()` |
| Almacenamiento | `Store` (clave `trayecto:v2`, lee y migra `trayecto:v1`, `retireLegacy`) |
| Datos de ejemplo | `SEED_GEO`, `cleanComputer`, `tripPoints` (generador de rutas), `cleanPoints`, `resolvePoints`, `cleanPlace`, `seed`, `migrate`, `normalize` y el arranque |
| Cálculos | `derive` (km/L, precios), `tripKm/Dur/Speed/Cost`, `compOf`/`tripKmpl`/`tripLiters`/`fmtComp`, `compAccuracy`/`compAccHTML`, `placeVisits`, `pairStats` |
| Mapas SVG | `project` / `placeXY` / `placePos`, `routePts`, `routeMap`, `placesMap`: **respaldo sin conexión** |
| Mapas con MapLibre | carga (`mapAssets`), registro `MapReg` (`parkMaps`/`mountMaps`), mapa de viaje (`buildMap`), reproducción (`Play`), mapa de lugares (`buildPlacesMap`, `refreshPlaces`) y modo ubicación (`Loc`) |
| Gráficas | `barChart`, `lineChart`, `sparkline` |
| Vistas | `renderInicio`, `renderViajes`, `renderGasolina`, `renderLugares`, `renderEstadisticas`, `renderVehiculos`, `renderAjustes`, `renderRespaldo` |
| Render y navegación | `render`, `go`, menú lateral, búsqueda |
| Lugares: editar, eliminar y fusionar | `tripsOf`, `togglePlaceMenu`/`closePlaceMenu`, `openPlacePanel`/`savePlace`, `deletePlace`/`removePlace`, `mergeDialog`/`mergePlace`, `showUndo`/`runUndo`, `clearPlaceSel` |
| Panel lateral | `openDrawer`/`closeDrawer`/`requestCloseDrawer`, `guardChanges`, autocompletado, `openTripPanel(edit)`, `openFuelPanel(edit)`, `saveTrip`, `saveFuel`, `showTripSummary` |
| PNG con canvas | `tripCanvas` (ruta real de `points` con degradado; sin points usa `routePts`) |
| Diálogo y avisos | `confirmDialog`, `toast` |
| Respaldo | `snapshot`/`backupPayload`, `exportJSON`, `exportCSV`, `parseBackup` (validación y saneado compartidos), `adoptData`, `importJSON` |
| Archivo de datos | `FS` (estado), IndexedDB (`idbGet/Set/Del`), `validated`, `readFile`, `chooseDialog`, `fsInfo`/`paintFS`/`setState`, respaldos diarios, `touch`/`tick`/`flush`/`writeOnce`, `openLinked`, `linkFolder`, `pickFolder`, `reconnectFS`, `forgetFS`, `fsAction`, `initFS` |
| Eventos de contenido | `deleteTrip`/`deleteFuel` y los manejadores delegados por `data-action` |
| Atajos globales / Inicio | teclado y arranque; `window.__trayecto` expone estado y ganchos de prueba |

`render()` reemplaza el HTML del contenido en cada interacción; cualquier cosa que deba sobrevivir (mapas, reproducción, modo ubicación) vive **fuera del DOM** (`MapReg`, `Play`, `Loc`).

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

- Los lugares se enlazan con los viajes **por nombre** (`norm(name)`), no por id.
- `pointsSource`: `'auto'` = generados por la app (se **regeneran** al editar el viaje o al ubicar/mover un lugar que usa); `'imported'` = ruta ajena (nunca se sobrescribe). Si falta, `resolvePoints` lo deduce comparando con lo que generaría la app.
- `tripPoints` es determinista (semilla = id del viaje): recorrido ortogonal tipo calle, puntos y velocidades coherentes con la hora de salida/llegada; el promedio de `speed` coincide con la velocidad del viaje. Devuelve `[]` si origen o destino no tienen lat/lng.
- **Migración v1 → v2** (`migrate`, también al importar): los lugares de ejemplo reciben lat/lng por nombre solo si conservan su posición original; se generan los `points` y `pointsSource` que falten. La clave `trayecto:v1` se borra únicamente cuando los datos migrados ya quedaron guardados en `trayecto:v2`.
- **Respaldo JSON**: `{ app, version, exportedAt, data }`. Al importar se validan lat/lng (rango), se descartan puntos inválidos, se regeneran los que falten y se rechaza una versión mayor a 2. Los CSV (viajes, cargas) llevan BOM UTF-8 y neutralizan celdas que empiezan con `= + - @`.

## Rendimiento de la computadora por viaje

Campo opcional «Rendimiento de la computadora» (lo que marca el tablero al terminar el viaje) en el formulario de viaje, nuevo y editar.

- **Captura** (`openTripPanel`, `readComputer`): número + unidad (km/L o L/100 km; se recuerda la última en `settings.computerUnit`, y al editar se muestra la unidad original). Rangos: 3–40 km/L, equivalente 2.5–33.3 L/100 km; fuera de rango bloquea el guardado y marca el campo. Al capturarlo, la nota de base cambia a «(14.2 km/L de la computadora · $24.30/L)» y se muestran los **litros estimados** (siempre, con o sin dato).
- **Modelo**: `trip.computerKmpl` (km/L, `null` si no se capturó) y `trip.computerUnit` (`'kmpl'|'l100'|null`). `cleanComputer` es la única regla de saneado y se aplica en `normalize` (migración: datos guardados antes de 2.1 quedan en `null`), `parseBackup` (importar y validar antes de escribir el archivo) y `saveTrip`; un valor fuera de rango se vuelve `null` sin descartar el viaje. **No se subió `DATA_VERSION`**: los campos son opcionales y los respaldos anteriores siguen siendo válidos. Capturarlo no toca `points`.
- **Costo**: `tripKmpl(t)` = rendimiento de la computadora o, si falta, el promedio del vehículo (`kmplOf`); `tripLiters` y `tripCost` salen de ahí, así que tablas, Inicio, Estadísticas y el CSV lo usan sin cambios.
- **Dónde se ve**: detalle del viaje («Rendimiento (computadora)», «Litros estimados» y «Base del costo» con «de la computadora»), tarjeta PNG (línea bajo el vehículo) y CSV de viajes (columna `rendimiento_computadora_km_l`, **al final** para no mover las demás).
- **Precisión de la computadora** (`compAccuracy`, en Vehículos por vehículo y en Estadísticas): promedio aritmético de los `computerKmpl` del vehículo contra el promedio de los km/L de las cargas de tanque lleno **cuyo intervalo** (desde la carga llena anterior hasta su fecha) toca el periodo de esos viajes (primer a último viaje con dato). Solo aparece con ≥ 3 viajes con dato y al menos una carga con rendimiento calculado en ese periodo; si no, se oculta (p. ej. viajes posteriores a la última carga llena). Texto: «La computadora marca N % más/menos que el real» (o «coincide con el real» si la diferencia es < 0.5 %).

## Editar, eliminar y fusionar lugares

Los viajes guardan `origin`/`destination` como **texto** y se enlazan al lugar por `norm(nombre)`, así que cualquier cambio de nombre se propaga a los viajes.

- **Editar** (`openPlacePanel` → `savePlace`): nombre, colonia/zona e ícono (`KINDS`: home, work, gym, family, other). El nombre no puede quedar vacío ni repetirse (sin mayúsculas ni acentos; cambiar solo mayúsculas del propio lugar sí se permite). Si cambia el nombre, se reescribe `origin`/`destination` en todos los viajes que lo usan (también variantes por acentos o mayúsculas) **sin tocar `points`**, y se reasigna `ui.selPair`.
- **Eliminar** (`deletePlace`): sin viajes, confirmación simple. Con viajes, `chooseDialog` muestra cuántos y ofrece «Conservar los viajes» (mantienen texto y ruta; el lugar sale de la lista y del mapa) o «Fusionar con otro lugar». **Nunca se borran viajes.** Si luego se registra un viaje con ese nombre, `canonicalPlace` recrea el lugar como siempre (sin ubicación).
- **Fusionar** (`mergeDialog` → `mergePlace`): el destino se elige de una lista (el botón está desactivado hasta elegir) con el resumen «N viajes pasarán de «A» a «B»». Los viajes de A pasan al nombre de B, las rutas con `pointsSource: 'auto'` se regeneran con las coordenadas de B (si B no tiene ubicación, `tripPoints` daría `[]` y se conservan las rutas anteriores; las `'imported'` nunca se tocan) y A se elimina.
- **Deshacer** (`showUndo`): el aviso lleva el botón «Deshacer» ~6 s (`toast` acepta `{ms, action}`; `Ctrl+Z` fuera de un campo de texto también). Solo se guardan los campos que cambian (texto y `points` de los viajes tocados, el lugar y su posición en la lista, `selPlace`/`selPair`) y se restauran por referencia; si entretanto se creó otro lugar con ese nombre, avisa en lugar de duplicar.
- Tras eliminar o fusionar, `clearPlaceSel` limpia `selPlace`, `selPair` (si involucra el lugar) y el modo ubicación; todo pasa por `save()`, así que también se actualiza el archivo de datos.
- El menú ⋮ (`.pmenu`) se inserta en el DOM al abrirlo (no vive en el estado): Esc o clic fuera lo cierran y el foco vuelve al botón; se voltea hacia arriba si no cabe.

## Persistencia en archivo (v2.1)

File System Access API (`showDirectoryPicker`, modo `readwrite`). Sin la API (`FS.supported` falso) la sección de Respaldo se reemplaza por la nota «Disponible en Chrome o Edge», se oculta el indicador y la app funciona como antes. `navigator.storage.persist()` se llama al iniciar.

- **Archivo**: `trayecto-datos.json` con el formato del respaldo JSON v2 (`{app, version, exportedAt, data:{vehicles, places, trips, fuel, settings}}`, `lastBackup` en `null`, sin `ui`). El identificador de la carpeta vive en IndexedDB (`trayecto-fs` / `kv` / clave `dir`).
- **`save()`** escribe en `localStorage` al instante y llama a `afterSave` (`touch`): la escritura al archivo es un *debounce* de 800 ms (`tick` → `flush`, una sola escritura a la vez, serializada con `FS.busy/again`). `pagehide`, `beforeunload` y `visibilitychange` (oculta) disparan lo pendiente. Si la comparación de contenido no cambia (solo cambió la pantalla) no se escribe.
- **Validación**: `validated()` pasa los datos por `parseBackup` y falla si el filtro descartaría algún registro; nunca se escribe si falla (estado `error`, el detalle va en el tooltip). `parseBackup` es la misma validación de importar.
- **Claves de comparación**: `canonKey(data)` (ignora `hints` y `lastBackup`, preferencias de cada equipo). `FS.syncKey` = clave del último contenido sincronizado; `FS.known` = `lastModified` conocido del archivo.
- **Conflicto**: antes de escribir se compara `lastModified` con `FS.known`; si cambió y el contenido ya no es el sincronizado ni igual al de la app, `chooseDialog` pregunta qué versión conservar (archivo / app; Esc = decidir después → estado `conflict`, no se escribe nada hasta resolver con el aviso «Elegir versión»).
- **`dirty`** (`localStorage` clave `trayecto:fs`, junto con `fileMod` y `modified`): se marca en cada `save()` con carpeta enlazada y se limpia solo tras escribir con éxito. En la siguiente sesión, si hay `dirty` y el archivo no cambió (`lastModified == fileMod`) se empujan los cambios pendientes; si cambió, se pregunta. Sin `dirty`, al abrir se carga el archivo.
- **Estados** (`FS.state`): `none`, `ok`, `saving`, `error`, `off` (permiso por reconfirmar: aviso «Reconectar carpeta de datos»; `requestPermission` necesita clic), `missing` (carpeta inexistente), `nofile`, `invalid`, `conflict`. Los cuatro últimos son *hold* (`FS_HOLD`): no se escribe hasta que el usuario decide; la caché sigue intacta. Los manejadores `fs-*` llaman a `fsAction` sin `await` previo para conservar la activación del clic.
- **Respaldos diarios**: antes de la primera escritura del día se crea `respaldos/trayecto-AAAA-MM-DD.json` (si ya existe el de hoy, no se hace nada) con el **contenido previo** del archivo (el estado antes de los cambios del día; si no hay, los datos nuevos) y se conservan los 14 más recientes (`FS_KEEP`). Solo se tocan nombres que cumplen `BK_RE`. Un fallo del respaldo no impide guardar.
- `window.__trayecto.fs` expone `state`, `link(dirHandle)`, `flush`, `open` y `backups` para pruebas (permite enlazar un handle sin el selector nativo).

## Mapas

- `project()` es una proyección lineal sobre `GEO_BOUNDS` (lat 19.29–19.53, lng −99.28 a −99.08) estirada al lienzo SVG de 800×520 y acotada a sus márgenes; es el respaldo, no un mapa fiel.
- MapLibre GL JS 5.7.0 (unpkg, con SRI) y estilo `https://tiles.openfreemap.org/styles/dark` con el fondo ajustado a `#0F0F12`; se cargan bajo demanda. Cada contenedor nace como SVG con `data-tmap` (viaje) o `data-pmap` (lugares) y `mountMaps` monta el mapa encima.
- **Registro `MapReg`**: antes de reemplazar HTML se "aparcan" los mapas (`parkMaps`); después se reutiliza el que muestra el mismo viaje y ruta (clave = id + hash de points), se destruyen los sobrantes y se crean los nuevos. Así nunca hay más de 1–2 contextos WebGL vivos. El mapa de lugares se **actualiza en su sitio** (`refreshPlaces`).
- Respaldo sin conexión: si la librería, el estilo o los mosaicos no responden, queda el SVG con "Mapa sin conexión". Límite de espera: **8 s** para el primer mapa, 5 s para los siguientes; se desactiva cuando el evento `load` confirma que el mapa descargó lo necesario. Tras un fallo no se reintenta durante 30 s.
- Mapa de calor y rutas superpuestas escalan peso, radio y opacidad según la cantidad de points/viajes.

## Decisiones importantes

- Un solo archivo, sin build, para abrirlo con doble clic y poder respaldarlo fácilmente.
- `lat/lng` es la única fuente de verdad de la posición; el SVG se deriva de ellas.
- No se muestran errores de red de MapLibre: el temporizador decide el respaldo. Se filtra el `AbortError` inofensivo que MapLibre registra al destruir un mapa con mosaicos en vuelo.
- Las cifras de rendimiento se midieron con 500 viajes (≈21 000 points) y 150 cargas: render de cada vista < 35 ms, buscar en Viajes ≈ 80 ms, `go()` con guardado < 30 ms. Optimizaciones clave: `fmtDate` con caché y `Store.save` que serializa una sola vez.
- Contraste: `--muted` es `#8B8B97` (≥ 5:1 sobre las superficies).

## Pruebas

No hay suite automática. La persistencia en archivo se probó con Chrome real y un handle de OPFS en lugar del selector nativo (OPFS no existe en `file://`, así que la app se sirvió desde `localhost`; en `file://` se comprobó que la API existe y que la app arranca limpia): elegir carpeta, archivo nuevo y existente, debounce y agrupación, recarga con permiso en `prompt` y reconexión, borrar `localStorage` y recuperar desde el archivo, conflicto (archivo / app / decidir después), archivo borrado, carpeta eliminada, archivo inválido, escritura fallida y recuperación en la siguiente sesión, poda a 14 respaldos, menú contraído y navegador sin la API. El selector de carpetas nativo y su aviso de permiso de Chrome se deben probar a mano. Editar/eliminar/fusionar lugares se probó con Chrome real por `file://` (menú y teclado, validaciones, renombrar con `points` intactos y vuelta atrás idéntica, eliminar con y sin viajes, fusión con rutas regeneradas, Deshacer idéntico al estado previo, caducidad a 6 s, recreación del lugar y pines del mapa real). El rendimiento de la computadora se probó con Chrome real por `file://` (ambas unidades, nuevo y editado, rangos, costo/litros, detalle, PNG, JSON/CSV, importación de respaldos con y sin los campos y la comparación con cargas del ejemplo). El resto de la app se probó con Chrome real por `file://` (CDP con WebGL por software): abrir cada vista, alternar capas, seleccionar 20 viajes seguidos (1 contexto WebGL vivo, consola limpia), reproducción, modo ubicación, edición, respaldo ida y vuelta, importación v1, datos vacíos y sin conexión. Prueba manual recomendada con GPU real y conexión lenta.

El repositorio git vive en esta carpeta (`curso qlik/trayecto/`); los mensajes de commit no llevan trailer de coautoría.
