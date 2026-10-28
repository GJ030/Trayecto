import { routeNote, type RouteNote } from '@/data/routes';
import { FS } from '@/data/storage/file';
import { S } from '@/data/store';
import { priceOf } from '@/features/fuel/fuel.calc';
import {
  compOf,
  filteredTrips,
  fmtComp,
  tripCost,
  tripDur,
  tripKm,
  tripKmpl,
  tripLiters,
  tripSpeed,
} from './trips.calc';
import type { Trip } from '@/data/schema';
import { vehName } from '@/features/vehicles/vehicles.calc';
import { playBarHTML } from '@/maps/play';
import { tripMapHTML } from '@/maps/registry';
import { emptyState } from '@/shared/ui/blocks';
import { icon, tagHTML } from '@/shared/ui/icons';
import { MONTHS, fmtDate, parseDate } from '@/shared/utils/dates';
import { MXN, NF0, NF1, cap, durHTML, esc, fmtDurText, fmtKm, money } from '@/shared/utils/format';
import { sum } from '@/shared/utils/math';

/* Aviso bajo el mapa del detalle cuando la ruta no es calle por calle (o su geometría aún no se ve) */
const NOTES: Record<Exclude<RouteNote, 'none'>, [text: string, retry: boolean]> = {
  pending: ['Ruta pendiente de calcular: mientras tanto se muestra una recta aproximada.', true],
  routingOff: [
    'Ruta aproximada (recta). Activa «Rutas por calles reales» en Ajustes para seguir las calles.',
    false,
  ],
  noroute: ['Sin camino entre esos puntos: se muestra una recta aproximada.', true],
  invalid: ['El servicio devolvió una respuesta inválida: se muestra una recta aproximada.', true],
  reconnect: [
    'La ruta calculada está en la carpeta de datos. Reconéctala (aviso bajo la barra superior) para verla.',
    false,
  ],
};
function routeNoteHTML(t: Trip) {
  const kind = routeNote(t, S.places, {
    routingOn: S.settings.routing,
    folderOff: FS.state === 'off',
  });
  if (kind === 'none') return '';
  const [text, retry] = NOTES[kind];
  return `<div class="route-note" data-route-note="${kind}"><span>${esc(text)}</span>${retry ? `<button class="btn sm" data-action="retry-route" data-id="${esc(t.id)}">Reintentar</button>` : ''}</div>`;
}

export function renderViajes() {
  if (!S.trips.length)
    return `<div class="view"><section class="card">${emptyState('route', 'Aún no registras viajes', 'Anota origen, destino, horas y odómetro. Trayecto calcula distancia, duración, velocidad y costo por ti.', `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Registrar viaje <kbd class="hint">N</kbd></button>`)}</section></div>`;
  const list = filteredTrips(),
    tf = S.ui.tf,
    sel = S.trips.find((t) => t.id === S.ui.selTrip);
  const active = tf.tag !== 'Todos' || tf.vehicle !== 'all' || tf.from || tf.to || S.ui.q;
  const cols = [
    ['date', 'Fecha', ''],
    ['route', 'Ruta', ''],
    ['tag', 'Etiqueta', 'col-opt'],
    ['vehicle', 'Vehículo', 'col-opt'],
    ['km', 'Distancia', 'r'],
    ['dur', 'Duración', 'r'],
    ['speed', 'Vel. prom.', 'r col-opt'],
    ['cost', 'Costo est.', 'r'],
  ];
  const th = cols
    .map(([k, l, c]) => {
      const on = S.ui.sort.key === k;
      return `<th class="${c}" aria-sort="${on ? (S.ui.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button class="th-sort" data-action="sort" data-key="${k}">${l}<span class="si" aria-hidden="true">${on ? (S.ui.sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}</span></button></th>`;
    })
    .join('');
  const yr = new Date().getFullYear();
  const rows = list
    .map((t) => {
      const s = sel && sel.id === t.id;
      const dt = parseDate(t.date);
      return `<tr id="row-${t.id}" class="clickable${s ? ' selected' : ''}" tabindex="0" aria-selected="${!!s}" data-action="select-trip" data-id="${t.id}">
      <td><div class="cell-date"><b class="num">${dt.getDate()} ${MONTHS[dt.getMonth()]}${dt.getFullYear() === yr ? '' : ' ' + String(dt.getFullYear()).slice(2)}</b><small>${esc(cap(fmtDate(t.date, { weekday: 'short' })))} · ${esc(t.depart)}</small></div></td>
      <td><span class="route-cell">${esc(t.origin)}<span class="arrow">→</span>${esc(t.destination)}</span></td>
      <td class="col-opt">${tagHTML(t.tag)}</td>
      <td class="col-opt muted-sm">${esc(vehName(t.vehicleId))}</td>
      <td class="r num">${fmtKm(tripKm(t))} km</td>
      <td class="r num">${fmtDurText(tripDur(t))}</td>
      <td class="r num col-opt">${NF0.format(tripSpeed(t))} km/h</td>
      <td class="r num">${MXN.format(tripCost(t))}</td></tr>`;
    })
    .join('');
  const table = list.length
    ? `<div class="table-wrap"><table class="table"><caption class="sr" style="position:absolute;left:-9999px">Viajes registrados</caption><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyState(
        'search',
        'Sin resultados',
        'Ningún viaje coincide con la búsqueda o los filtros actuales.',
        `<button class="btn" data-action="clear-filters">Limpiar filtros</button>`,
      );
  let detail = '';
  if (sel) {
    const km = tripKm(sel),
      dur = tripDur(sel);
    detail = `<aside class="card detail" aria-label="Detalle del viaje">
      <div class="detail-head"><div><div class="eyebrow">${esc(cap(fmtDate(sel.date, { weekday: 'long', day: 'numeric', month: 'long' })))}</div><h2 class="detail-title">${esc(sel.origin)}<span class="arrow">→</span>${esc(sel.destination)}</h2></div><button class="icon-btn" data-action="close-detail" aria-label="Cerrar detalle (Esc)" title="Cerrar (Esc)">${icon('x')}</button></div>
      ${tripMapHTML(sel, 324, 200, 'detalle', 'interactive')}${playBarHTML(sel)}${routeNoteHTML(sel)}
      <div class="kv">
        <div><div class="stat-label">${icon('clock', 13)} Duración</div><div class="stat-val md">${durHTML(dur)}</div></div>
        <div><div class="stat-label">${icon('route', 13)} Distancia</div><div class="stat-val md">${fmtKm(km)}<span class="u">km</span></div></div>
        <div><div class="stat-label">${icon('speed', 13)} Vel. promedio</div><div class="stat-val md">${NF0.format(tripSpeed(sel))}<span class="u">km/h</span></div></div>
        <div><div class="stat-label">${icon('fuel', 13)} Costo estimado</div><div class="stat-val md">${money(tripCost(sel), true)}</div></div>
      </div>
      <dl class="meta">
        <dt>Horario</dt><dd>${esc(sel.depart)} – ${esc(sel.arrive)}</dd>
        <dt>Odómetro</dt><dd>${NF1.format(sel.odoStart)} → ${NF1.format(sel.odoEnd)} km</dd>
        <dt>Vehículo</dt><dd>${esc(vehName(sel.vehicleId))}</dd>
        <dt>Etiqueta</dt><dd>${tagHTML(sel.tag)}</dd>
        ${compOf(sel) ? `<dt>Rendimiento (computadora)</dt><dd>${esc(fmtComp(sel))}</dd>` : ''}
        <dt>Litros estimados</dt><dd>${NF1.format(tripLiters(sel))} L</dd>
        <dt>Base del costo</dt><dd>${NF1.format(tripKmpl(sel))} km/L${compOf(sel) ? ' de la computadora' : ''} · ${MXN.format(priceOf(sel.vehicleId))}/L</dd>
      </dl>
      <div class="detail-actions"><button class="btn btn-primary" data-action="download-trip" data-id="${sel.id}">${icon('download', 16)} Tarjeta PNG</button><button class="btn" data-action="edit-trip" data-id="${sel.id}">${icon('edit', 16)} Editar <kbd class="hint">E</kbd></button><button class="btn btn-danger" data-action="delete-trip" data-id="${sel.id}">${icon('trash', 16)} Eliminar</button></div>
    </aside>`;
  }
  return `<div class="view">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrar por etiqueta">${['Todos', 'Trabajo', 'Personal'].map((t) => `<button aria-pressed="${tf.tag === t}" data-action="filter-tag" data-tag="${t}">${t}</button>`).join('')}</div>
      <select class="input sm" id="fVeh" data-change="f-veh" aria-label="Filtrar por vehículo" style="width:200px"><option value="all">Todos los vehículos</option>${S.vehicles.map((v) => `<option value="${v.id}" ${tf.vehicle === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <div class="date-range">${icon('calendar', 16)}<input type="date" class="input sm" id="fFrom" data-change="f-from" value="${esc(tf.from)}" aria-label="Desde"><span>–</span><input type="date" class="input sm" id="fTo" data-change="f-to" value="${esc(tf.to)}" aria-label="Hasta"></div>
      ${active ? `<button class="btn btn-ghost sm" data-action="clear-filters">${icon('x', 14)} Limpiar</button>` : ''}
      <span class="spacer"></span>
      <span class="toolbar-count num">${list.length} ${list.length === 1 ? 'viaje' : 'viajes'} · ${fmtKm(sum(list, tripKm))} km</span>
      <button class="btn btn-primary sm" data-action="new-trip">${icon('plus', 15)} Nuevo viaje <kbd class="hint">N</kbd></button>
    </div>
    <div class="split${sel ? ' has-detail' : ''}"><section class="card table-card">${table}</section>${detail}</div>
  </div>`;
}
