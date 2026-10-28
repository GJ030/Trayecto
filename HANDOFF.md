# Traspaso: migración de Trayecto a Vite + TypeScript

Documento para continuar el trabajo en otra sesión. **La migración está terminada y publicada**; el trabajo vivo es la función «rutas por calles reales» (sección «Traspaso: rutas por calles reales», más abajo). La referencia permanente del proyecto es `CLAUDE.md` (describe el diseño ya implementado de las rutas con todo detalle); este archivo solo cuenta el estado, las decisiones y lo que falta.

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

`npm run check` pasa completo: typecheck, lint, 400 pruebas unitarias en 19 archivos, build y 74 pruebas E2E (cifras tras el bloque 3). Los mensajes de commit **no llevan** trailer de coautoría ni atribución a Claude (se hacen con `git -c user.name=GJ030 -c user.email=gael.isaac@outlook.com commit …`). Línea base original: `git show 40db8c5:trayecto.html`.

### Publicado

Todo está en `origin/main` (https://github.com/GJ030/Trayecto). El push estuvo bloqueado con 403 hasta instalar la app de Claude en el repo; ya quedó resuelto. El repo `Trayecto-privado-respaldo` no se toca.

### Cambio posterior: las rutas generadas ya no se guardan

Para que el `localStorage` y `trayecto-datos.json` no crezcan, `stringifyData` (`data/schema.ts`) omite los `points` de los viajes `pointsSource: 'auto'`; se regeneran al leer (`migrate` y `parseBackup`). Las rutas `'imported'` y el respaldo JSON manual conservan todos los `points`. Riesgo: cambiar `tripPoints` cambia las rutas de los viajes existentes; la prueba «huella del algoritmo» en `routes.test.ts` lo detecta. Detalle en `CLAUDE.md`.

### Cambio posterior: odómetro final o distancia

El formulario de viaje tiene un interruptor para capturar el odómetro final o la distancia que marca la computadora; el otro valor se calcula. Se recuerda en `settings.odoMode`. Detalle en `CLAUDE.md`; pruebas en `trips.calc.test.ts`, `trips.repo.test.ts` y `tests/e2e/odometer.spec.ts`.

### Cambio posterior: el mapa se recupera de un fallo pasajero

Un mapa que fallaba (p. ej. el primero tardó más del plazo) se quedaba en «Mapa sin conexión» hasta recargar. Ahora el aviso es un botón **Reintentar**, hay reintento automático con el evento `online`, el primer mapa espera 15 s en vez de 8 y los avisos idénticos no se apilan. Pruebas: `tests/e2e/maps.spec.ts`.

### En curso: rutas por calles reales (OSRM)

El traspaso completo está en la sección **«Traspaso: rutas por calles reales»** de más abajo. Resumen: bloques 1–3 hechos y publicados (`4f2bfbe`, `1d24a97`, `6612564`, `b60aac2`); **sigue el bloque 4** (dibujar la geometría en todos los mapas).

## Traspaso: rutas por calles reales (OSRM)

Esta sección basta para continuar sin el historial de la sesión anterior. El diseño ya implementado (modelo, persistencia, cola, interfaz, pruebas) está descrito con detalle en `CLAUDE.md`, secciones «Modelo de datos v2» y «Rutas por calles reales (OSRM): datos y persistencia»; léelas antes de tocar código.

### Pedido original del usuario

Todas las rutas, en todas las vistas del mapa, siguen las calles reales (MapLibre + OpenFreeMap, gratis, todo local): 1) OSRM público (`router.project-osrm.org/route/v1/driving/…`, `geometries=geojson`, `overview=full`); 2) se calcula **una sola vez** al crear o editar un viaje y se guarda geometría, distancia y duración con el viaje (nunca se consulta en cada pintado); 3) migrar los viajes existentes en lote, máx. 1 petición/s, con progreso; 4) puntos intermedios (waypoints) para forzar el camino real, con recálculo; 5) si OSRM falla o no hay internet, línea recta punteada y viaje «ruta pendiente» para reintentar; 6) atribución en el mapa «Rutas: OSRM · © OpenStreetMap contributors»; 7) URL del servidor en una constante de configuración; 8) mismo estilo de línea (color, grosor, glow). Se avanza por bloques con un commit al terminar cada uno y `npm run check` en verde.

### Estado

| Bloque                           | Estado        | Commit    | Qué hace                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Cliente, modelo y persistencia | hecho         | `4f2bfbe` | `data/routing.ts` (constante `ROUTING`, `fetchRoute`, `routeSig`, `RoutingError`), `data/polyline.ts` (codec 1e-6), modelo `trip.route`/`trip.waypoints`/`settings.routing`, `cleanRoute`, `hydrateRoutes`, `stringifyData` con `routes`/`points`, `canonKey` sin geometría, resguardos del archivo (`FS.geoReady`, `settleRoutes`), pruebas unitarias y E2E (`route-storage`, `data-folder`). |
| 2 Puntos derivados y vigencia    | hecho         | `1d24a97` | `data/routes.ts`: `tripPoints` desde la geometría (remuestreo ~25 m) o desde la recta; `routeStops`, `routeKind`, `hasRealRoute`, `needsRoute`, `syncRoute`; desaparece el recorrido escalonado; mapa de calor y trayectos frecuentes solo con geometría real; la ruta se invalida/«pendiente» al crear, editar, ubicar o fusionar.                                                            |
| 3 Cola, lote e interruptor       | hecho         | `6612564` | `data/routingQueue.ts`, `route.error`, `tripsRepo.applyRoute/failRoute/queueMissingRoutes/retryRouteErrors`, tarjeta «Rutas por calles reales» en Ajustes (`features/settings/settings.routing.ts`), diálogos de privacidad y de lote, Detener/Reanudar, texto de privacidad. Pruebas: `features/trips/trips.routing.test.ts`, `tests/e2e/routing.spec.ts`.                                    |
| 3b Viajes con los mismos puntos  | hecho         | `b60aac2` | Consulta compartida por huella (`sig`), `distinctRequests()`, margen `ROUTING.safetyMs` = 50 ms.                                                                                                                                                                                                                                                                                               |
| **4 Dibujar en todos los mapas** | **siguiente** |           | Ver «Bloque 4».                                                                                                                                                                                                                                                                                                                                                                                |
| 5 Editor de puntos intermedios   | pendiente     |           | Ver «Bloque 5».                                                                                                                                                                                                                                                                                                                                                                                |
| 6 Cierre                         | pendiente     |           | Ver «Bloque 6».                                                                                                                                                                                                                                                                                                                                                                                |

Último commit publicado: `b60aac2` (400 pruebas unitarias en 19 archivos, 74 E2E, todo en verde). **No se ha empezado el bloque 4.**

### Decisiones confirmadas por el usuario

1. **Almacenamiento.** El espacio del navegador importa, el del disco no. La geometría completa (sin simplificar) vive **solo en el archivo de datos y sus copias** (`respaldos/`) y en el respaldo JSON manual; formato **polyline de precisión 1e-6** (es la de OSRM, sin pérdida); en memoria, GeoJSON LineString. El `localStorage` guarda solo lo ligero (`route` sin geometría, `waypoints`). `points` de los viajes `'auto'` se deriva de la geometría completa y no se guarda; los `'imported'` conservan los suyos. El respaldo manual lleva las rutas e **importarlo no consulta a OSRM**.
2. **Interruptor «Rutas por calles reales (usa OSRM)»** en Ajustes: preferencia **de este equipo** (ni un respaldo ni el archivo pueden activarlo; `adoptData` conserva el valor local), **apagado por omisión**, y **exige carpeta de datos enlazada con permiso concedido** (`fsLinked`); si no, aparece desactivado con la explicación. El cálculo en lote pide confirmación explícita. El reintento al volver la conexión y el cálculo al crear/editar solo ocurren con el interruptor encendido. El texto de privacidad dice qué se envía (coordenadas de origen, destino y puntos intermedios) y adónde (`router.project-osrm.org`).
3. **Estados de una ruta** (`trip.route`):
   - **calculada con geometría** (`status:'ok'` y `geometry` en memoria) → se dibuja calle por calle;
   - **calculada sin geometría cargada** (`'ok'` sin `geometry`: la geometría aún no llegó del archivo) → **solo marcadores de origen y destino, sin línea**; se repinta cuando llega la geometría, sin avisos ni diálogos. Con el permiso en «prompt» (`FS.state === 'off'`): lo mismo, más una pista en el detalle del viaje para reconectar la carpeta;
   - **pendiente** (`'pending'`, sin `error`) → **recta punteada**; la etiqueta «ruta pendiente» y el reintento solo aparecen con el interruptor encendido (apagado: el detalle dice «Activa «Rutas por calles reales» en Ajustes»);
   - **con error** (`'pending'` + `route.error` = `'noroute'` | `'invalid'`) → también recta punteada; mensaje del error y reintento manual (no se reintenta solo).
   - Sin ruta (`undefined`) → recta punteada. El recorrido escalonado ya no existe.
4. **Calor y trayectos frecuentes** solo usan viajes con geometría real (`hasRealRoute`: calculada o importada), para no pintar calor sobre rectas que cruzan edificios. Un trayecto frecuente sin ningún viaje con geometría queda como antes (recta entre los lugares). La tarjeta PNG y la reproducción usan la recta punteada cuando no hay ruta, igual que el mapa.
5. **Vigencia.** `route.sig` = huella (`routeSig`) de origen + puntos intermedios + destino (6 decimales). Si cambia (edición, lugar movido o fusionado, waypoints), la geometría guardada deja de valer: pasa a «pendiente» (interruptor encendido) o se descarta (apagado). También se revisa al cargar (`parseBackup`, `migrate`). Las rutas `'imported'` nunca se tocan.
6. **Resguardos de lectura/escritura del archivo.** `canonKey` ignora la geometría (usa `n`) y las preferencias del equipo (`hints`, `lastBackup`, `routing`), así abrir no provoca «Datos cargados» ni conflictos. **No se escribe hasta haber leído el archivo en la sesión** (`FS.geoReady`). Las geometrías del archivo se reincorporan por id + huella (`hydrateRoutes`) antes de cualquier escritura. Sin archivo/carpeta/API, las rutas «ok» sin geometría pasan a «pendiente». Solo se envían a OSRM los viajes de la app «pendientes» sin `error` y con la huella vigente.
7. **Editor de puntos intermedios** (bloque 5): en el mapa del detalle del viaje (clic para agregar, arrastrar para mover, quitar); el campo «Pasar por…» queda fuera por ahora.

### Cómo funcionan la cola y el lote (`data/routingQueue.ts`)

- **Capas.** La cola vive en `data/` (no importa `features`). `tripsRepo` le registra cómo aplicar resultados con `setRouteSink({apply, fail})`; así `trips` y `settings` usan la cola sin importarse entre sí. `main.ts` registra `setRoutingGuard(fsWritable)` y arranca con `startRoutingQueue()`; `onFsChange` la despierta (`kick`) y repinta la tarjeta.
- **Una sola cola, un solo trabajador**, del viaje **más reciente al más antiguo**, como máximo **1 petición por segundo** (`ROUTING.minIntervalMs` 1000 + `safetyMs` 50 de margen por la imprecisión de los temporizadores; medido 998 ms sin margen, 1049 ms con él). Solo trabaja con `settings.routing` encendido y la carpeta escribible (`fsWritable`); si no, estado `blocked` (un resultado que no se puede guardar se perdería).
- **Disparadores:** crear o editar un viaje (cambio persistente de `trips`, no bloquea guardar), el evento `online` (solo pendientes recuperables) y el usuario (botones). **Al abrir la app no arranca sola**; `adoptData` y los eventos `all` tampoco la despiertan.
- **Lote.** Al activar el interruptor: si hay viajes registrados sin ruta, `chooseDialog` con dos opciones, «Activar y calcular N viajes registrados» (dice cuántos, que se envían coordenadas de origen, destino y puntos intermedios a `router.project-osrm.org`, y el tiempo aproximado a 1 por segundo, con `distinctRequests()`) o «Activar solo para los viajes nuevos y editados»; si no hay, `confirmDialog`. «Calcular rutas pendientes» y «Reintentar con error» también piden confirmación. Aviso final «Rutas calculadas: N».
- **Detener / Reanudar.** `stop()` cancela la petición en curso (el viaje queda pendiente, sin error); lo ya calculado se queda; la cola no vuelve a trabajar sola hasta `resume()` (ni con viajes nuevos ni con `online`). **Apagar el interruptor** cancela la cola y deja de pedir y de marcar viajes como pendientes, pero **no borra** las rutas calculadas (se siguen dibujando desde el archivo) ni las pendientes.
- **Errores manuales vs recuperables.** «Sin camino» (`noroute`) y respuesta inválida (`invalid`) se guardan en `route.error`: **no se reintentan solos** (ni al volver la conexión ni al abrir), solo con «Reintentar las N con error» (`tripsRepo.retryRouteErrors`); el error vale para todos los viajes con los mismos puntos. Sin conexión, tiempo agotado, HTTP 429 y 5xx son **recuperables**: espera creciente que se duplica (`ROUTING.retry`: 5 s, 10 s, 20 s…; base de 30 s con 429; tope 5 min); tras 6 fallos seguidos la cola pasa a `stalled` y espera `online` o un reinicio manual.
- **Deduplicación.** Viajes con la misma huella comparten una consulta: antes de pedir, la cola copia la ruta de otro viaje de la app con la misma `sig` y geometría calculada (`reusable`), y un fallo (`error`) también se comparte. `applyRoute(id, sig, resultado)` descarta resultados de un viaje editado mientras tanto.
- **Interfaz** (`settings.routing.ts`): estados de la cola (`idle running waiting stopped blocked stalled`), calculadas/pendientes/con error, barra de progreso que se actualiza sin repintar Ajustes. `window.__trayecto.routing` expone `config` (`ROUTING`, mutable) y `queue` para acelerar el ritmo en las pruebas.

### Verificación pendiente en Chrome real (la hace el usuario)

En Chrome real desde `file://`: enlazar una carpeta de datos, encender el interruptor, calcular y comprobar que las rutas se calculan y sobreviven a recargar. **Por qué quedó pendiente:** en el entorno de la nube el proxy de salida devuelve 403 a las peticiones de **Chromium** hacia `router.project-osrm.org` (sin cabeceras CORS, cuerpo del proxy) aunque `curl` y Node reciben 200 con `access-control-allow-origin: *`; no es un fallo de la app y no se intentó eludir. Se verificó entregando a la página las respuestas **reales** obtenidas con `route.fetch()` (15 viajes, 7 consultas tras deduplicar, 7 s, separación mínima 1049 ms, archivo de 31 KB, caché de 7 KB). Aviso sin resolver: un respaldo JSON manual exportado con la carpeta desconectada (rutas «ok» sin geometría) no lleva geometrías; podría avisarse con un toast (no implementado).

### Bloque 4 (siguiente): dibujar la geometría en todos los mapas

Archivos: `maps/routeMap.ts` (detalle, Inicio, resumen: fuente `route`, capas `route-halo` y `route-line` con `line-gradient` por velocidad, `play-*`), `maps/placesMap.ts` (capas `routes`, calor, `pairs`, `pair-route`), `maps/play.ts` (reproducción sobre `m.pts`), `features/backup/backup.card.ts` (`tripCanvas`, tarjeta PNG), `maps/svg.ts` (respaldo esquemático), `maps/registry.ts` (`MapReg`), `features/trips/trips.view.ts`.

- Dibujar la geometría guardada (`routeKind === 'geometry'`) calle por calle en todos los mapas; los `points` derivados ya salen de ella.
- **Punteado** para `'straight'` (sin ruta o pendiente/error) en los mapas, la tarjeta PNG y la reproducción; **solo marcadores** (sin línea) para `'loading'`; nada de rectas continuas como hoy (los mapas aún dibujan la recta como línea continua).
- `routeKind` decide el trazo; no confiar solo en `points.length >= 2` (`placesMap.ts:39,246`, `play.ts:79`, `backup.card.ts:144`): un viaje `'loading'` tiene `points = []` y aun así necesita MapLibre con marcadores. Al llegar la geometría (`settleRoutes` emite `trips` sin persistir) el mapa debe repintarse; la clave de reutilización de `MapReg` (id + hash de points) ya cambia.
- Capa `routes` de Lugares: hoy dibuja todos los viajes con points en sólido; debe usar solo geometría real (sólida) y dejar la recta punteada para lo que no la tiene.
- **Atribución:** `attributionControl.customAttribution` = `ROUTING.attribution` en los mapas de rutas (`routeMap.ts:31`, `placesMap.ts:65`, hoy `{ compact: true }`).
- **Estilo sin cambios:** color `ACC`; viaje en curso/«live» 4.2 de ancho y halo 16, los demás 3.4 y 13; `line-blur` 10 y opacidad del halo 0.34; `line-gradient` por velocidad.
- Detalle del viaje: etiqueta «Ruta pendiente» con reintento solo con el interruptor encendido; con él apagado, «Activa «Rutas por calles reales» en Ajustes»; mensaje de `route.error` («Sin camino entre esos puntos» / respuesta inválida) con reintento manual; pista «reconecta la carpeta» cuando `FS.state === 'off'`.
- **Verificación:** los E2E bloquean la CDN y no renderizan MapLibre; comprobar el dibujo con Chromium real y CDN (scripts ad hoc, capturas con banderas swiftshader) y cubrir con pruebas unitarias la lógica de decisión (extraerla a una función pura, p. ej. en `routes.ts` o un `*.calc`).

### Bloque 5: editor de puntos intermedios

Editor en el mapa interactivo del detalle: clic agrega, arrastrar mueve, se pueden quitar; máx. 20 (`MAX_WAYPOINTS`). Falta una operación de repo (tipo `tripsRepo.setWaypoints`) que valide con `cleanWaypoints`, llame a `syncRoute` (cambia la `sig` → «pendiente» → entra a la cola si el interruptor está encendido) y regenere `points` (recta mientras tanto, pasando por los waypoints). Las rutas `'imported'` no se editan. `waypoints` ya se sanea, se guarda ligero en `localStorage` y entra en la huella. Probar la lógica con unitarias; la interacción del mapa, a mano/capturas.

### Bloque 6: cierre

Actualizar `CLAUDE.md` (mapas, detalle del viaje, editor de waypoints) y este archivo, revisar los textos de privacidad (Ajustes y «Acerca de» ya mencionan OSRM), retirar estados provisionales y correr `npm run check`. Posibles detalles menores: el cálculo de tiempo de «Reintentar con error» usa `n` (sobreestima); no hay indicador global de progreso fuera de Ajustes (solo el aviso final).

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
