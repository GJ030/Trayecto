import { S } from '@/data/store';
import { D, cpkOf } from '@/features/fuel/fuel.calc';
import { tripKm } from '@/features/trips/trips.calc';
import { compAccuracy } from '@/features/trips/trips.calc';
import { compAccHTML } from '@/shared/ui/blocks';
import { emptyState } from '@/shared/ui/blocks';
import { icon } from '@/shared/ui/icons';
import { MXN, NF0, NF1, esc } from '@/shared/utils/format';
import { sum } from '@/shared/utils/math';

export function renderVehiculos() {
  const cards = S.vehicles
    .map((v) => {
      const st = D.vs[v.id] || {},
        tr = S.trips.filter((t) => t.vehicleId === v.id),
        isDef = S.settings.defaultVehicle === v.id,
        c = cpkOf(v.id);
      return `<section class="card span-6 veh-card">
      <div class="vc-head"><div class="vc-sw" style="background:${esc(v.color)}22;color:${esc(v.color)}">${icon('car', 22)}</div><div><h3>${esc(v.name)}</h3><p>${[v.year, v.plate, v.fuel].filter(Boolean).map(esc).join(' · ')}</p></div>
        <div class="vc-right">${isDef ? `<span class="badge">${icon('star', 13)} Predeterminado</span>` : `<button class="btn btn-ghost sm" data-action="veh-default" data-id="${v.id}">Hacer predeterminado</button>`}<button class="icon-btn danger" data-action="veh-delete" data-id="${v.id}" aria-label="Eliminar ${esc(v.name)}">${icon('trash', 16)}</button></div></div>
      <div class="stat-label">${icon('gauge', 14)} Odómetro actual</div><div class="stat-val xl">${NF0.format(st.odo || 0)}<span class="u">km</span></div>
      <div class="vc-stats"><div><b>${tr.length}</b><small>Viajes</small></div><div><b>${NF0.format(sum(tr, tripKm))}</b><small>Km registrados</small></div><div><b>${st.avg ? NF1.format(st.avg) : '—'}</b><small>km/L prom.</small></div><div><b>${c != null ? MXN.format(c) : '—'}</b><small>Costo por km</small></div></div>
      ${v.tank ? `<p class="muted-xs" style="margin-top:12px">Tanque de ${NF0.format(v.tank)} L${st.avg ? ` · autonomía aprox. ${NF0.format(v.tank * st.avg)} km` : ''}</p>` : ''}
      ${compAccHTML(compAccuracy(v.id), v)}
    </section>`;
    })
    .join('');
  return `<div class="view grid">
    ${S.vehicles.length ? '' : `<section class="card span-12">${emptyState('car', 'Agrega tu primer vehículo', 'Los viajes y las cargas se asocian a un vehículo para calcular rendimiento y costo por km.')}</section>`}
    ${cards}
    <section class="card span-6"><div class="card-title"><span>Agregar vehículo</span></div>
      <form id="addVehForm" class="form-grid" autocomplete="off" novalidate>
        <div class="field" style="grid-column:span 2"><label for="vName">Nombre</label><input class="input" id="vName" placeholder="Ej. Honda City" required><div class="err" data-err="vName"></div></div>
        <div class="field"><label for="vYear">Año</label><input class="input" id="vYear" type="number" min="1950" max="2030" placeholder="2022"></div>
        <div class="field"><label for="vPlate">Placas</label><input class="input" id="vPlate" placeholder="ABC-123-D"></div>
        <div class="field"><label for="vFuel">Combustible</label><select class="input" id="vFuel"><option>Magna</option><option>Premium</option><option>Diésel</option><option>Híbrido</option></select></div>
        <div class="field"><label for="vTank">Tanque (L)</label><input class="input" id="vTank" type="number" min="1" max="200" placeholder="45"></div>
        <div style="grid-column:span 2;display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('plus', 16)} Agregar vehículo</button></div>
      </form>
    </section>
  </div>`;
}
