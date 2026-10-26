import { S } from '@/data/store';
import { D, fuelTotal } from '@/features/fuel/fuel.calc';
import { tripCost, tripDur, tripKm, tripSpeed, tripsDesc } from '@/features/trips/trips.calc';
import { vehById, vehName } from '@/features/vehicles/vehicles.calc';
import { tripMapHTML } from '@/maps/registry';
import { emptyState, quickBtns } from '@/shared/ui/blocks';
import { barChart, deltaHTML, sparkline } from '@/shared/ui/charts';
import { icon, tagHTML } from '@/shared/ui/icons';
import { MONTHS, addDays, fmtDate, isoDate, lastMonths, startOfToday } from '@/shared/utils/dates';
import { NF0, NF1, cap, durHTML, esc, fmtKm, money } from '@/shared/utils/format';
import { mean, sum } from '@/shared/utils/math';

export function renderInicio() {
  const trips = tripsDesc();
  if (!trips.length && !S.fuel.length)
    return `<div class="view"><section class="card">${emptyState('route', 'Tu tablero está listo', 'Registra tu primer viaje o carga de gasolina y aquí verás tu semana, tu rendimiento y tu gasto mensual.', quickBtns())}</section></div>`;
  const t0 = startOfToday(),
    wd = (t0.getDay() + 6) % 7,
    ws = addDays(t0, -wd),
    we = addDays(ws, 6);
  const wsI = isoDate(ws),
    weI = isoDate(we),
    pwsI = isoDate(addDays(ws, -7)),
    pweI = isoDate(addDays(ws, -1));
  const wk = S.trips.filter((t) => t.date >= wsI && t.date <= weI),
    pw = S.trips.filter((t) => t.date >= pwsI && t.date <= pweI);
  const wKm = sum(wk, tripKm),
    pKm = sum(pw, tripKm),
    wMin = sum(wk, tripDur),
    pMin = sum(pw, tripDur),
    wCost = sum(wk, tripCost),
    pCost = sum(pw, tripCost);
  const days = [...Array(7)].map((_, i) => {
    const d = isoDate(addDays(ws, i));
    return sum(
      wk.filter((t) => t.date === d),
      tripKm,
    );
  });
  const range =
    ws.getMonth() === we.getMonth()
      ? `${ws.getDate()} – ${we.getDate()} ${MONTHS[we.getMonth()]}`
      : `${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]}`;
  const last = trips[0];
  const lastCard = last
    ? `<section class="card span-5 card-last">
      <div class="card-title"><span>Último viaje</span><span class="muted-sm">${esc(cap(fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'short' })))} · ${esc(last.depart)}</span></div>
      <div class="route-title">${esc(last.origin)}<span class="arrow">${icon('arrowRight', 18)}</span>${esc(last.destination)}</div>
      ${tripMapHTML(last, 440, 150, 'inicio', 'static')}
      <div class="stat-row">
        <div><div class="stat-label">Distancia</div><div class="stat-val">${fmtKm(tripKm(last))}<span class="u">km</span></div></div>
        <div><div class="stat-label">Duración</div><div class="stat-val">${durHTML(tripDur(last))}</div></div>
        <div><div class="stat-label">Vel. prom.</div><div class="stat-val">${NF0.format(tripSpeed(last))}<span class="u">km/h</span></div></div>
      </div>
      <div class="card-foot">${tagHTML(last.tag)}<span class="muted-sm">${esc(vehName(last.vehicleId))}</span><button class="link-btn" data-action="open-trip" data-id="${last.id}">Ver detalle ${icon('arrowRight', 14)}</button></div>
    </section>`
    : `<section class="card span-5">${emptyState('route', 'Sin viajes todavía', 'Registra tu primer viaje para verlo aquí.', `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Nuevo viaje <kbd class="hint">N</kbd></button>`)}</section>`;
  const weekCard = `<section class="card span-7">
      <div class="card-title"><span>Esta semana</span><span class="muted-sm">${range} · ${wk.length} ${wk.length === 1 ? 'viaje' : 'viajes'}</span></div>
      <div class="stat-row">
        <div><div class="stat-label">${icon('route', 14)} Kilómetros</div><div class="stat-val xl">${fmtKm(wKm)}<span class="u">km</span></div>${deltaHTML(wKm, pKm)}</div>
        <div><div class="stat-label">${icon('clock', 14)} Tiempo al volante</div><div class="stat-val xl">${durHTML(wMin)}</div>${deltaHTML(wMin, pMin)}</div>
        <div><div class="stat-label">${icon('fuel', 14)} Gasto en gasolina</div><div class="stat-val xl">${money(wCost)}</div>${deltaHTML(wCost, pCost, { good: false })}</div>
      </div>
      <div class="week-bars">${barChart({ values: days, labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], w: 640, h: 150, highlight: wd, fmt: (v) => NF1.format(v) + ' km', title: 'Kilómetros por día esta semana' })}</div>
      <p class="muted-xs">El gasto se estima con el rendimiento de cada vehículo y el último precio por litro registrado.</p>
    </section>`;
  let dv = S.ui.dashVeh;
  if (!vehById(dv))
    dv = vehById(S.settings.defaultVehicle) ? S.settings.defaultVehicle : S.vehicles[0]?.id;
  const vals = dv
    ? S.fuel
        .filter((f) => f.vehicleId === dv && D.kmpl[f.id])
        .sort((a, b) => a.odometer - b.odometer)
        .map((f) => D.kmpl[f.id])
    : [];
  const avgK = dv ? D.vs[dv]?.avg : null;
  const trend =
    vals.length >= 2
      ? deltaHTML(vals[vals.length - 1], mean(vals.slice(0, -1)), {
          good: true,
          suffix: 'última carga vs. promedio',
        })
      : `<span class="delta flat">Tendencia disponible con más cargas</span>`;
  const rendCard = `<section class="card span-4">
      <div class="card-title"><span>Rendimiento promedio</span></div>
      ${S.vehicles.length > 1 ? `<div class="pills" role="group" aria-label="Elegir vehículo" style="margin-bottom:14px">${S.vehicles.map((v) => `<button class="pill" aria-pressed="${v.id === dv}" data-action="dash-veh" data-id="${v.id}">${esc(v.name)}</button>`).join('')}</div>` : ''}
      ${avgK ? `<div class="stat-val xl">${NF1.format(avgK)}<span class="u">km/L</span></div>${trend}` : `<div class="stat-val xl" style="color:#4A4A55">—<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:8px">Necesitas dos cargas de tanque lleno para calcularlo.</p>`}
      <div class="spark">${sparkline(vals)}</div>
    </section>`;
  const ms = lastMonths(6),
    spend = ms.map((m) =>
      sum(
        S.fuel.filter((f) => f.date.startsWith(m.key)),
        fuelTotal,
      ),
    );
  const curL = S.fuel.filter((f) => f.date.startsWith(ms[5].key));
  const spendCard = `<section class="card span-8">
      <div class="card-title"><span>Gasto mensual en gasolina</span><button class="link-btn" data-action="go" data-view="gasolina">Ver cargas ${icon('arrowRight', 14)}</button></div>
      <div class="spend-wrap">
        <div><div class="stat-label">${cap(ms[5].long)}</div><div class="stat-val xl">${money(spend[5])}</div>${deltaHTML(spend[5], spend[4], { good: false, suffix: 'vs. mes anterior' })}<p class="muted-xs" style="margin-top:10px">${curL.length} ${curL.length === 1 ? 'carga' : 'cargas'} · ${NF1.format(sum(curL, (f) => +f.liters))} L</p></div>
        <div>${barChart({ values: spend, labels: ms.map((m) => cap(m.label)), highlight: 5, fmt: (v) => '$' + NF0.format(v), w: 600, h: 170, title: 'Gasto mensual en gasolina, últimos 6 meses' })}</div>
      </div>
    </section>`;
  return `<div class="view grid">${lastCard}${weekCard}${rendCard}${spendCard}</div>`;
}
