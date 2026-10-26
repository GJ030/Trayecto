import { S } from '@/data/store';
import { D, cpkOf, fuelTotal } from '@/features/fuel/fuel.calc';
import { tripCost, tripDur, tripKm } from '@/features/trips/trips.calc';
import { compAccHTML } from '@/features/vehicles/vehicles.calc';
import { emptyState, quickBtns } from '@/shared/ui/blocks';
import { barChart, lineChart } from '@/shared/ui/charts';
import { icon, tagHTML } from '@/shared/ui/icons';
import { lastMonths } from '@/shared/utils/dates';
import { MXN, NF0, NF1, cap, esc, fmtDurText, fmtKm, money } from '@/shared/utils/format';
import { mean, sum } from '@/shared/utils/math';

export function renderEstadisticas() {
  if (!S.trips.length && !S.fuel.length)
    return `<div class="view"><section class="card">${emptyState('chart', 'Todavía no hay estadísticas', 'Con algunos viajes y cargas registrados verás tendencias mensuales, costo por km y la comparativa entre tus vehículos.', quickBtns())}</section></div>`;
  const ms = lastMonths(6),
    first = ms[0].key + '-01';
  const kmM = ms.map((m) =>
    sum(
      S.trips.filter((t) => t.date.startsWith(m.key)),
      tripKm,
    ),
  );
  const spM = ms.map((m) =>
    sum(
      S.fuel.filter((f) => f.date.startsWith(m.key)),
      fuelTotal,
    ),
  );
  const rM = ms.map((m) => {
    const v = S.fuel
      .filter((f) => f.date.startsWith(m.key) && D.kmpl[f.id])
      .map((f) => D.kmpl[f.id]);
    return v.length ? mean(v) : null;
  });
  const tr6 = S.trips.filter((t) => t.date >= first),
    fu6 = S.fuel.filter((f) => f.date >= first);
  const km6 = sum(tr6, tripKm),
    sp6 = sum(fu6, fuelTotal),
    kv = fu6.filter((f) => D.kmpl[f.id]).map((f) => D.kmpl[f.id]),
    rAvg = kv.length ? mean(kv) : null;
  let num = 0,
    den = 0;
  S.vehicles.forEach((v) => {
    const c = cpkOf(v.id),
      k = sum(
        tr6.filter((t) => t.vehicleId === v.id),
        tripKm,
      );
    if (c != null && k > 0) {
      num += c * k;
      den += k;
    }
  });
  const cpks = S.vehicles.map((v) => cpkOf(v.id)).filter((x) => x != null);
  const cpk = den ? num / den : cpks.length ? mean(cpks) : null;
  const tab = S.ui.statTab,
    labels = ms.map((m) => cap(m.label));
  const chart =
    tab === 'gasto'
      ? barChart({
          values: spM,
          labels,
          highlight: 5,
          fmt: (v) => '$' + NF0.format(v),
          w: 1000,
          h: 250,
          title: 'Gasto mensual en gasolina',
        })
      : tab === 'rend'
        ? lineChart({
            values: rM,
            labels,
            w: 1000,
            h: 250,
            fmt: (v) => NF1.format(v) + ' km/L',
            title: 'Rendimiento mensual',
            highlight: 5,
          })
        : barChart({
            values: kmM,
            labels,
            highlight: 5,
            fmt: (v) => NF0.format(v) + ' km',
            w: 1000,
            h: 250,
            title: 'Kilómetros registrados por mes',
          });
  const vstat = S.vehicles.map((v) => {
    const tr = S.trips.filter((t) => t.vehicleId === v.id);
    return {
      v,
      n: tr.length,
      km: sum(tr, tripKm),
      rend: D.vs[v.id]?.avg ?? null,
      cpk: cpkOf(v.id),
      sp: sum(
        S.fuel.filter((f) => f.vehicleId === v.id),
        fuelTotal,
      ),
      spd: tr.length ? sum(tr, tripKm) / (sum(tr, tripDur) / 60) : null,
    };
  });
  const metrics = [
    ['Viajes registrados', 'n', (v) => NF0.format(v), null],
    ['Km registrados', 'km', (v) => fmtKm(v) + ' km', null],
    ['Rendimiento', 'rend', (v) => NF1.format(v) + ' km/L', 'max'],
    ['Costo por km', 'cpk', (v) => MXN.format(v), 'min'],
    ['Gasto en gasolina', 'sp', (v) => MXN.format(v), null],
    ['Vel. promedio', 'spd', (v) => NF0.format(v) + ' km/h', null],
  ];
  const cmp = vstat.length
    ? `<div class="cmp" style="--n:${vstat.length}"><div class="c-h"></div>${vstat.map((x) => `<div class="c-h"><span class="veh-h"><span class="dot" style="background:${esc(x.v.color)}"></span>${esc(x.v.name)}</span><small class="muted-xs">${esc(x.v.plate || '')}</small></div>`).join('')}
      ${metrics
        .map(([l, k, f, best]) => {
          const vals = vstat.map((x) => x[k]).filter((v) => v != null);
          const mx = Math.max(1e-9, ...vals);
          const b =
            best && vals.length > 1
              ? best === 'max'
                ? Math.max(...vals)
                : Math.min(...vals)
              : null;
          return `<div class="c-l">${l}</div>${vstat
            .map((x) => {
              const v = x[k];
              return `<div class="c-v"><b>${v != null ? f(v) : '—'}${b != null && v === b ? '<span class="badge green">Mejor</span>' : ''}</b><div class="hbar"><i style="width:${v != null ? ((v / mx) * 100).toFixed(0) : 0}%;background:${esc(x.v.color)}"></i></div></div>`;
            })
            .join('')}`;
        })
        .join('')}
    </div>`
    : emptyState('car', 'Sin vehículos', 'Agrega un vehículo para comparar.', '', true);
  const tags = ['Trabajo', 'Personal'].map((tg) => {
    const a = tr6.filter((t) => t.tag === tg);
    return {
      tg,
      km: sum(a, tripKm),
      n: a.length,
      min: a.length ? sum(a, tripDur) / a.length : 0,
      cost: sum(a, tripCost),
    };
  });
  const tkm = Math.max(1e-9, tags[0].km + tags[1].km);
  const accs = S.vehicles.map((v) => compAccHTML(v.id, true)).filter(Boolean);
  const accCard = accs.length
    ? `<section class="card span-12"><div class="card-title"><span>Precisión de la computadora</span><span class="muted-sm">Rendimiento capturado vs. real con tanque lleno</span></div><div class="acc-list">${accs.join('')}</div></section>`
    : '';
  return `<div class="view grid">
    <section class="card span-3"><div class="stat-label">${icon('route', 14)} Km registrados</div><div class="stat-val">${NF0.format(km6)}<span class="u">km</span></div><p class="muted-xs" style="margin-top:10px">${tr6.length} viajes en 6 meses</p></section>
    <section class="card span-3"><div class="stat-label">${icon('wallet', 14)} Gasto en gasolina</div><div class="stat-val">${money(sp6)}</div><p class="muted-xs" style="margin-top:10px">${fu6.length} cargas · ${NF0.format(sum(fu6, (f) => +f.liters))} L</p></section>
    <section class="card span-3"><div class="stat-label">${icon('gauge', 14)} Rendimiento promedio</div><div class="stat-val">${rAvg ? NF1.format(rAvg) : '—'}<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:10px">Todas las cargas de tanque lleno</p></section>
    <section class="card span-3"><div class="stat-label">${icon('fuel', 14)} Costo por km</div><div class="stat-val">${cpk != null ? money(cpk, true) : '—'}<span class="u">/km</span></div><p class="muted-xs" style="margin-top:10px">Precio por litro ÷ rendimiento</p></section>
    <section class="card span-12">
      <div class="card-title"><span>Tendencia mensual</span><div class="seg" role="group" aria-label="Métrica">${[
        ['km', 'Kilómetros'],
        ['gasto', 'Gasto'],
        ['rend', 'Rendimiento'],
      ]
        .map(
          ([k, l]) =>
            `<button aria-pressed="${tab === k}" data-action="stat-tab" data-tab="${k}">${l}</button>`,
        )
        .join('')}</div></div>
      ${chart}
    </section>
    <section class="card span-7"><div class="card-title"><span>Comparativa entre vehículos</span><span class="muted-sm">Histórico completo</span></div>${cmp}</section>
    <section class="card span-5"><div class="card-title"><span>Trabajo vs. personal</span><span class="muted-sm">Últimos 6 meses</span></div>
      <div class="stack-bar" role="img" aria-label="Trabajo ${NF0.format((tags[0].km / tkm) * 100)}%, personal ${NF0.format((tags[1].km / tkm) * 100)}% de los kilómetros"><i style="width:${((tags[0].km / tkm) * 100).toFixed(1)}%;background:#6CA8FF"></i><i style="flex:1;background:#B69CFF"></i></div>
      <div class="tag-rows">${tags.map((t) => `<div>${tagHTML(t.tg)}<div class="stat-val md" style="margin-top:10px">${NF0.format((t.km / tkm) * 100)}<span class="u">% de km</span></div><dl class="meta" style="margin:12px 0 0"><dt>Kilómetros</dt><dd>${fmtKm(t.km)}</dd><dt>Viajes</dt><dd>${t.n}</dd><dt>Duración prom.</dt><dd>${t.n ? fmtDurText(Math.round(t.min)) : '—'}</dd><dt>Costo est.</dt><dd>${MXN.format(t.cost)}</dd></dl></div>`).join('')}</div>
    </section>
    ${accCard}
  </div>`;
}
