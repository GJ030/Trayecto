import { S } from '@/data/store';
import { D, fuelTotal } from './fuel.calc';
import { vehById, vehName } from '@/features/vehicles/vehicles.calc';
import { emptyState } from '@/shared/ui/blocks';
import { barChart, deltaHTML } from '@/shared/ui/charts';
import { icon } from '@/shared/ui/icons';
import { ACC } from '@/shared/ui/theme';
import { MONTHS, fmtDate, lastMonths, parseDate } from '@/shared/utils/dates';
import { MXN, NF0, NF1, NF2, cap, esc, money } from '@/shared/utils/format';
import { mean, sum } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

export function renderGasolina() {
  if (!S.fuel.length)
    return `<div class="view"><section class="card">${emptyState('fuel', 'Aún no registras cargas', 'Anota litros, precio y odómetro. Con dos cargas de tanque lleno calculamos tu rendimiento en km/L.', `<button class="btn btn-primary" data-action="new-fuel">${icon('plus', 16)} Registrar carga <kbd class="hint">G</kbd></button>`)}</section></div>`;
  const ff = vehById(S.ui.ff) ? S.ui.ff : 'all',
    q = norm(S.ui.q);
  const all = S.fuel.filter((f) => ff === 'all' || f.vehicleId === ff);
  const list = all
    .filter((f) => !q || norm(f.station + ' ' + vehName(f.vehicleId)).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer);
  const ms = lastMonths(2),
    mL = all.filter((f) => f.date.startsWith(ms[1].key)),
    pL = all.filter((f) => f.date.startsWith(ms[0].key));
  const mSp = sum(mL, fuelTotal),
    pSp = sum(pL, fuelTotal),
    mLi = sum(mL, (f) => +f.liters);
  const totLi = sum(all, (f) => +f.liters),
    avgPrice = totLi ? sum(all, fuelTotal) / totLi : 0;
  const kv = all.filter((f) => D.kmpl[f.id]).map((f) => D.kmpl[f.id]),
    avgK = kv.length ? mean(kv) : null;
  const chartL = all
    .filter((f) => D.kmpl[f.id])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  const chart = chartL.length
    ? barChart({
        values: chartL.map((f) => D.kmpl[f.id]),
        labels: chartL.map((f) => {
          const d = parseDate(f.date);
          return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
        }),
        colors: chartL.map((f) =>
          ff === 'all'
            ? vehById(f.vehicleId)?.color || ACC
            : f === chartL[chartL.length - 1]
              ? ACC
              : '#3A3328',
        ),
        fmt: (v) => NF1.format(v),
        avg: avgK,
        avgLabel: `Prom. ${NF1.format(avgK || 0)} km/L`,
        w: 720,
        h: 220,
        title: 'Rendimiento por carga',
      })
    : emptyState(
        'gauge',
        'Rendimiento pendiente',
        'Registra dos cargas con tanque lleno del mismo vehículo para ver el km/L por carga.',
        '',
        true,
      );
  const byVeh = S.vehicles
    .map((v) => ({
      v,
      sp: sum(
        mL.filter((f) => f.vehicleId === v.id),
        fuelTotal,
      ),
    }))
    .filter((x) => ff === 'all' || x.v.id === ff);
  const maxSp = Math.max(1, ...byVeh.map((x) => x.sp));
  const rows = list
    .map((f) => {
      const k = D.kmpl[f.id];
      return `<tr>
      <td><div class="cell-date"><b class="num">${parseDate(f.date).getDate()} ${MONTHS[parseDate(f.date).getMonth()]}</b><small>${esc(cap(fmtDate(f.date, { weekday: 'short' })))}</small></div></td>
      <td>${esc(f.station)}</td>
      <td class="muted-sm"><span class="dot" style="background:${esc(vehById(f.vehicleId)?.color || '#888')};margin-right:8px"></span>${esc(vehName(f.vehicleId))}</td>
      <td class="r num">${NF2.format(f.liters)} L</td>
      <td class="r num">${MXN.format(f.price)}</td>
      <td class="r num"><b>${MXN.format(fuelTotal(f))}</b></td>
      <td class="r num">${NF0.format(f.odometer)} km</td>
      <td class="r num">${k ? `<b style="color:${avgK && k >= avgK ? 'var(--green)' : 'var(--text)'}">${NF1.format(k)}</b> km/L` : f.full ? `<span class="tag muted" title="Primera carga de tanque lleno: sirve como referencia">Referencia</span>` : `<span class="tag muted" title="Se suma al siguiente tanque lleno">Parcial</span>`}</td>
      <td class="r"><button class="icon-btn" data-action="edit-fuel" data-id="${f.id}" aria-label="Editar carga del ${esc(fmtDate(f.date, { day: 'numeric', month: 'long' }))}">${icon('edit', 16)}</button><button class="icon-btn danger" data-action="delete-fuel" data-id="${f.id}" aria-label="Eliminar carga del ${esc(fmtDate(f.date, { day: 'numeric', month: 'long' }))}">${icon('trash', 16)}</button></td></tr>`;
    })
    .join('');
  return `<div class="view">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrar por vehículo"><button aria-pressed="${ff === 'all'}" data-action="fuel-veh" data-id="all">Todos</button>${S.vehicles.map((v) => `<button aria-pressed="${ff === v.id}" data-action="fuel-veh" data-id="${v.id}"><span class="dot" style="background:${esc(v.color)}"></span>${esc(v.name)}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn btn-primary sm" data-action="new-fuel">${icon('plus', 15)} Nueva carga <kbd class="hint">G</kbd></button>
    </div>
    <div class="grid">
      <section class="card span-3"><div class="stat-label">${icon('wallet', 14)} Gasto del mes</div><div class="stat-val">${money(mSp)}</div>${deltaHTML(mSp, pSp, { good: false, suffix: 'vs. mes anterior' })}</section>
      <section class="card span-3"><div class="stat-label">${icon('drop', 14)} Litros del mes</div><div class="stat-val">${NF1.format(mLi)}<span class="u">L</span></div><p class="muted-xs" style="margin-top:12px">${mL.length} ${mL.length === 1 ? 'carga' : 'cargas'} en ${cap(ms[1].long)}</p></section>
      <section class="card span-3"><div class="stat-label">${icon('fuel', 14)} Precio promedio</div><div class="stat-val">${money(avgPrice, true)}<span class="u">/L</span></div><p class="muted-xs" style="margin-top:12px">Ponderado por litros</p></section>
      <section class="card span-3"><div class="stat-label">${icon('gauge', 14)} Rendimiento promedio</div><div class="stat-val">${avgK ? NF1.format(avgK) : '—'}<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:12px">${kv.length} ${kv.length === 1 ? 'tramo calculado' : 'tramos calculados'}</p></section>
      <section class="card span-8"><div class="card-title"><span>km/L por carga</span><span class="muted-sm">${ff === 'all' ? 'Color por vehículo' : 'Últimas 10 cargas'}</span></div>${chart}</section>
      <section class="card span-4"><div class="card-title"><span>Gasto del mes por vehículo</span></div>
        <div class="stack" style="gap:14px">${byVeh.map((x) => `<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="veh-h" style="font-weight:600"><span class="dot" style="background:${esc(x.v.color)}"></span>${esc(x.v.name)}</span><b class="num">${MXN.format(x.sp)}</b></div><div class="hbar"><i style="width:${((x.sp / maxSp) * 100).toFixed(1)}%;background:${esc(x.v.color)}"></i></div></div>`).join('') || '<p class="muted-xs">Sin vehículos.</p>'}</div>
        <p class="muted-xs" style="margin-top:16px">El rendimiento se calcula entre dos cargas de tanque lleno, sumando los litros de las cargas parciales intermedias.</p>
      </section>
      <section class="card span-12 table-card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Gasolinera</th><th>Vehículo</th><th class="r">Litros</th><th class="r">$/L</th><th class="r">Total</th><th class="r">Odómetro</th><th class="r">km/L</th><th class="r"><span style="position:absolute;left:-9999px">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('search', 'Sin resultados', 'Ninguna carga coincide con la búsqueda.', '', true)}</section>
    </div>
  </div>`;
}
