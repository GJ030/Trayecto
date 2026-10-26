import type { Place } from '@/data/schema';
import { S } from '@/data/store';
import { pairStats, placeVisits } from './places.calc';
import { locState } from '@/maps/placesMap';
import { placesMap } from '@/maps/svg';
import { emptyState } from '@/shared/ui/blocks';
import { icon, kindIcon } from '@/shared/ui/icons';
import { NF0, esc, fmtKm } from '@/shared/utils/format';
import { validGeo } from '@/shared/utils/geo';
import { hashStr } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

function addPlaceForm(open?: boolean) {
  return `<details class="add-place"${open ? ' open' : ''}><summary>${icon('plus', 15)} Agregar lugar</summary><form id="addPlaceForm" autocomplete="off"><input class="input sm" id="plName" placeholder="Nombre (ej. Escuela)" aria-label="Nombre del lugar" required><input class="input sm" id="plArea" placeholder="Colonia o zona" aria-label="Colonia o zona"><button class="btn btn-primary sm" type="submit">Guardar</button><label class="pl-locate"><input type="checkbox" id="plLocate" checked> Ubicar en el mapa después de guardar</label></form></details>`;
}
/* Debajo de cada lugar: "Sin ubicación" + "Ubicar en el mapa"; el lugar seleccionado ofrece "Mover ubicación" */
function placeActions(p: Place) {
  if (locState.cur && locState.cur.id === p.id) return '';
  if (!validGeo(p.lat, p.lng))
    return `<div class="p-actions"><span class="tag muted">Sin ubicación</span><button class="link-btn" data-action="locate-start" data-id="${p.id}">Ubicar en el mapa</button></div>`;
  return p.id === S.ui.selPlace
    ? `<div class="p-actions"><button class="link-btn" data-action="locate-start" data-id="${p.id}">Mover ubicación</button></div>`
    : '';
}
export function renderLugares() {
  if (!S.places.length)
    return `<div class="view"><section class="card">${emptyState('pin', 'Aún no hay lugares', 'Los lugares se agregan solos cuando registras viajes, o puedes crearlos aquí para usarlos en el autocompletado.', addPlaceForm(true))}</section></div>`;
  const vis = placeVisits(),
    pairs = pairStats(),
    q = norm(S.ui.q);
  const selP = S.places.find((p) => p.id === S.ui.selPlace),
    locP = locState.cur && S.places.find((p) => p.id === locState.cur!.id),
    layer = ['lugares', 'rutas', 'calor'].includes(S.ui.placesLayer) ? S.ui.placesLayer : 'lugares';
  const places = [...S.places]
    .filter((p) => !q || norm(p.name + ' ' + (p.area || '')).includes(q))
    .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0));
  const maxV = Math.max(1, ...Object.values(vis));
  const shown = pairs.filter(
    (p) =>
      (!selP || norm(p.from) === norm(selP.name) || norm(p.to) === norm(selP.name)) &&
      (!q || norm(p.from + ' ' + p.to).includes(q)),
  );
  return `<div class="view grid">
    <section class="card card-places span-7" style="align-self:start;position:sticky;top:92px">
      <div class="card-title"><span>Mapa de lugares</span><span class="muted-sm">${selP ? `Trayectos de ${esc(selP.name)}` : 'Selecciona un pin o un trayecto'}</span></div>
      <div class="places-layers"><div class="seg" role="group" aria-label="Capa del mapa">${[
        ['lugares', 'Lugares'],
        ['rutas', 'Todas las rutas'],
        ['calor', 'Mapa de calor'],
      ]
        .map(
          ([k, l]) =>
            `<button id="lyr-${k}" aria-pressed="${layer === k}" data-action="places-layer" data-layer="${k}">${l}</button>`,
        )
        .join('')}</div></div>
      <div class="map" data-pmap="1" data-slot="lugares" data-mode="interactive" data-key="places">${placesMap(vis, pairs)}</div>
      ${locState.cur ? `<div class="loc-bar" role="status"><span>${locState.cur.lat == null ? `Haz clic en el mapa para ubicar «${esc(locP?.name)}»` : `Arrastra el pin para ajustar «${esc(locP?.name)}»`}</span><button class="btn btn-primary sm" data-action="locate-save"${locState.cur.lat == null ? ' disabled' : ''}>Guardar ubicación</button><button class="btn btn-ghost sm" data-action="locate-cancel">Cancelar <kbd class="hint">Esc</kbd></button></div>` : ''}
      <div class="map-legend lg-map">${
        {
          lugares:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-line"></i>Trayecto frecuente</span><span><i class="lg-route"></i>Ruta seleccionada</span>',
          rutas:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-ramp"></i>Calles más recorridas</span><span><i class="lg-route"></i>Rutas del lugar seleccionado</span>',
          calor:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-heat"></i>Menos → más actividad</span>',
        }[layer]
      }</div>
      <div class="map-legend lg-svg"><span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-line"></i>Trayecto frecuente</span><span><i class="lg-route"></i>Ruta seleccionada</span></div>
    </section>
    <div class="span-5 stack">
      <section class="card">
        <div class="card-title"><span>Lugares frecuentes</span><span class="muted-sm">${S.places.length} guardados</span></div>
        ${
          places.length
            ? `<ul class="list">${places
                .map((p) => {
                  const v = vis[p.id] || 0;
                  return `<li class="pl-li"><button class="row-btn" id="pl-${p.id}" aria-pressed="${p.id === S.ui.selPlace}" data-action="place-select" data-id="${p.id}"><span class="p-ico">${icon(kindIcon(p.kind), 17)}</span><span class="p-main"><b>${esc(p.name)}</b><small>${esc(p.area || 'Sin zona')}</small><div class="p-bar"><i style="width:${((v / maxV) * 100).toFixed(0)}%"></i></div></span><span class="p-val"><b>${v}</b><small>${v === 1 ? 'visita' : 'visitas'}</small></span></button><button type="button" class="icon-btn p-more" id="pm-${p.id}" data-action="place-more" data-id="${p.id}" aria-label="Acciones de ${esc(p.name)}" aria-haspopup="menu" aria-expanded="false">${icon('dots', 18)}</button>${placeActions(p)}</li>`;
                })
                .join('')}</ul>`
            : `<p class="muted-xs">Ningún lugar coincide con la búsqueda.</p>`
        }
        ${addPlaceForm(false)}
      </section>
      <section class="card">
        <div class="card-title"><span>Tiempos de traslado</span>${selP ? `<span class="filter-chip">${esc(selP.name)}<button data-action="clear-place" aria-label="Quitar filtro de lugar">${icon('x', 12)}</button></span>` : '<span class="muted-sm">Promedio por trayecto</span>'}</div>
        ${
          shown.length
            ? `<ul class="list">${shown
                .slice(0, 8)
                .map(
                  (p) =>
                    `<li><button class="row-btn" id="pr-${hashStr(p.key)}" aria-pressed="${p.key === S.ui.selPair}" data-action="pair-select" data-key="${esc(p.key)}"><span class="p-main"><b>${esc(p.from)} <span style="color:var(--accent)">→</span> ${esc(p.to)}</b><small>${p.n} ${p.n === 1 ? 'viaje' : 'viajes'} · ${fmtKm(p.avgKm)} km prom.</small></span><span class="p-val"><b>${NF0.format(p.avgMin)}<span class="muted-xs" style="font-weight:500"> min</span></b><small>promedio</small></span></button></li>`,
                )
                .join('')}</ul>`
            : emptyState(
                'clock',
                'Sin trayectos',
                'Cuando registres viajes entre estos lugares verás aquí sus tiempos promedio.',
                '',
                true,
              )
        }
      </section>
    </div>
  </div>`;
}
