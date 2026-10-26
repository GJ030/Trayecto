# Trayecto

Aplicación de escritorio **100 % local** para registrar viajes en auto, cargas de gasolina y lugares. Es un único archivo, `trayecto.html` (HTML + CSS + JS sin dependencias de compilación), que se abre con doble clic (`file://`). Idioma de la interfaz: español (es-MX). Versión mostrada en Ajustes: **2.0**.

Los datos viven en `localStorage` del navegador y nunca salen del equipo. Lo único que usa internet son los mapas reales (MapLibre y el estilo/mosaicos de OpenFreeMap); sin conexión la app sigue funcionando con los mapas SVG esquemáticos.

## Funciones

- **Inicio**: último viaje (mapa), resumen semanal, rendimiento promedio y gasto mensual.
- **Viajes**: tabla ordenable y filtrable, detalle con mapa interactivo, **reproducción de la ruta**, tarjeta PNG, edición (tecla `E`) y borrado.
- **Gasolina**: cargas con km/L calculado entre tanques llenos; alta, edición (lápiz) y borrado.
- **Lugares**: mapa con tres capas (Lugares / Todas las rutas / Mapa de calor), tiempos de traslado por trayecto, **ubicar o mover lugares** en el mapa.
- **Estadísticas**, **Vehículos**, **Ajustes** (preferencias, atajos, restablecer/borrar datos) y **Respaldo** (JSON y CSV).
- Atajos: `N` viaje nuevo, `G` carga nueva, `E` editar el viaje seleccionado, `/` buscar, `Esc` cerrar, `Ctrl+Enter` guardar en un panel, `↑ ↓` moverse entre viajes.

## Estructura del código

Todo el JavaScript está en un solo IIFE al final del archivo, dividido en secciones con un comentario `/* ===== Nombre ===== */`. Respeta ese orden al agregar código; las funciones se declaran con `function` (se elevan) y las constantes con `const` (deben estar definidas antes de usarse al arrancar).

| Sección | Contenido |
|---|---|
| Utilidades | `$`, `esc`, `norm`, fechas (`isoDate`, `parseDate`), formatos (`fmtDate` con caché, `NF*`, `MXN`), `hashStr`, `fin` |
| Íconos | `ICONS` y `icon()` |
| Almacenamiento | `Store` (clave `trayecto:v2`, lee y migra `trayecto:v1`, `retireLegacy`) |
| Datos de ejemplo | `SEED_GEO`, `tripPoints` (generador de rutas), `cleanPoints`, `resolvePoints`, `cleanPlace`, `seed`, `migrate`, `normalize` y el arranque |
| Cálculos | `derive` (km/L, precios), `tripKm/Dur/Speed/Cost`, `placeVisits`, `pairStats` |
| Mapas SVG | `project` / `placeXY` / `placePos`, `routePts`, `routeMap`, `placesMap`: **respaldo sin conexión** |
| Mapas con MapLibre | carga (`mapAssets`), registro `MapReg` (`parkMaps`/`mountMaps`), mapa de viaje (`buildMap`), reproducción (`Play`), mapa de lugares (`buildPlacesMap`, `refreshPlaces`) y modo ubicación (`Loc`) |
| Gráficas | `barChart`, `lineChart`, `sparkline` |
| Vistas | `renderInicio`, `renderViajes`, `renderGasolina`, `renderLugares`, `renderEstadisticas`, `renderVehiculos`, `renderAjustes`, `renderRespaldo` |
| Render y navegación | `render`, `go`, menú lateral, búsqueda |
| Panel lateral | `openDrawer`/`closeDrawer`/`requestCloseDrawer`, `guardChanges`, autocompletado, `openTripPanel(edit)`, `openFuelPanel(edit)`, `saveTrip`, `saveFuel`, `showTripSummary` |
| PNG con canvas | `tripCanvas` (ruta real de `points` con degradado; sin points usa `routePts`) |
| Diálogo y avisos | `confirmDialog`, `toast` |
| Respaldo | `exportJSON`, `exportCSV`, `importJSON` |
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
         pointsSource: 'auto' | 'imported' }
fuel:  { id, date, station, odometer, liters, price, full, vehicleId }
ui:    { view, collapsed, sort, tf, selTrip, selPlace, selPair, placesLayer, ... }
```

- Los lugares se enlazan con los viajes **por nombre** (`norm(name)`), no por id.
- `pointsSource`: `'auto'` = generados por la app (se **regeneran** al editar el viaje o al ubicar/mover un lugar que usa); `'imported'` = ruta ajena (nunca se sobrescribe). Si falta, `resolvePoints` lo deduce comparando con lo que generaría la app.
- `tripPoints` es determinista (semilla = id del viaje): recorrido ortogonal tipo calle, puntos y velocidades coherentes con la hora de salida/llegada; el promedio de `speed` coincide con la velocidad del viaje. Devuelve `[]` si origen o destino no tienen lat/lng.
- **Migración v1 → v2** (`migrate`, también al importar): los lugares de ejemplo reciben lat/lng por nombre solo si conservan su posición original; se generan los `points` y `pointsSource` que falten. La clave `trayecto:v1` se borra únicamente cuando los datos migrados ya quedaron guardados en `trayecto:v2`.
- **Respaldo JSON**: `{ app, version, exportedAt, data }`. Al importar se validan lat/lng (rango), se descartan puntos inválidos, se regeneran los que falten y se rechaza una versión mayor a 2. Los CSV (viajes, cargas) llevan BOM UTF-8 y neutralizan celdas que empiezan con `= + - @`.

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

No hay suite automática. Se probó con Chrome real por `file://` (CDP con WebGL por software): abrir cada vista, alternar capas, seleccionar 20 viajes seguidos (1 contexto WebGL vivo, consola limpia), reproducción, modo ubicación, edición, respaldo ida y vuelta, importación v1, datos vacíos y sin conexión. Prueba manual recomendada con GPU real y conexión lenta.

El repositorio git vive en esta carpeta (`curso qlik/trayecto/`); los mensajes de commit no llevan trailer de coautoría.
