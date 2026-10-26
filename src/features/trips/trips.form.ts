import { render } from '@/app/nav';
import { tripPoints } from '@/data/routes';
import {
  CK_MAX,
  CK_MIN,
  cleanComputer,
  type ComputerUnit,
  type Tag,
  type Trip,
} from '@/data/schema';
import { S, save } from '@/data/store';
import { D, derive, kmplOf, priceOf } from '@/features/fuel/fuel.calc';
import { placeOpts } from '@/features/places/places.form';
import { canonicalPlace } from '@/features/places/places.repo';
import { compOf, tripCost, tripDur, tripKm, tripSpeed } from './trips.calc';
import { defVeh, vehById, vehName, vehOptions } from '@/features/vehicles/vehicles.calc';
import { mountMaps, parkMaps, tripMapHTML } from '@/maps/registry';
import { closeMenu } from '@/shared/ui/chrome';
import { setErr, setupCombo } from '@/shared/ui/combo';
import { req } from '@/shared/ui/dom';
import {
  closeDrawer,
  drawer,
  drawerFoot,
  drawerHead,
  drawerState,
  guardChanges,
  noVehicleDrawer,
  openDrawer,
} from '@/shared/ui/drawer';
import { icon, tagHTML } from '@/shared/ui/icons';
import { toast } from '@/shared/ui/toast';
import { fmtDate, fromMin, isoDate, pad, toMin } from '@/shared/utils/dates';
import { MXN, NF0, NF1, cap, durHTML, esc, fmtKm, money } from '@/shared/utils/format';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

/* ---- Nuevo viaje / Editar viaje ---- */
export function openTripPanel(edit?: Trip) {
  closeMenu();
  derive();
  if (!S.vehicles.length) return noVehicleDrawer(edit ? 'Editar viaje' : 'Nuevo viaje');
  const dv = edit && vehById(edit.vehicleId) ? edit.vehicleId : defVeh(),
    now = new Date(),
    dep = `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}`;
  const hasC = !!(edit && compOf(edit)),
    cu: ComputerUnit | null = hasC
      ? edit!.computerUnit
      : S.settings.computerUnit === 'l100'
        ? 'l100'
        : 'kmpl',
    cval = hasC
      ? +(cu === 'l100' ? 100 / edit!.computerKmpl! : edit!.computerKmpl!).toFixed(2)
      : '';
  const combo = (id: string, label: string, ph: string, val?: string) =>
    `<div class="field"><label for="${id}">${label}</label><div class="combo"><input class="input" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-lb" placeholder="${ph}" value="${esc(val || '')}" autocomplete="off"><ul class="combo-list" id="${id}-lb" role="listbox" aria-label="Lugares guardados" hidden></ul></div><div class="err" data-err="${id}"></div></div>`;
  openDrawer(
    drawerHead(
      edit ? 'Editar viaje' : 'Nuevo viaje',
      'route',
      edit ? 'Editar registro' : undefined,
    ) +
      `
  <form id="tripForm" class="drawer-body" novalidate autocomplete="off">
    <div class="route-box">${combo('tOrigin', 'Origen', '¿De dónde saliste?', edit?.origin)}<button type="button" class="icon-btn swap-btn" data-dz="swap" aria-label="Intercambiar origen y destino" title="Intercambiar">${icon('swapH', 16)}</button>${combo('tDest', 'Destino', '¿A dónde llegaste?', edit?.destination)}</div>
    <div class="row row-3">
      <div class="field"><label for="tDate">Fecha</label><input class="input" type="date" id="tDate" value="${edit ? edit.date : isoDate(now)}"><div class="err" data-err="tDate"></div></div>
      <div class="field"><label for="tDep">Salida</label><input class="input" type="time" id="tDep" value="${edit ? fromMin(toMin(edit.depart)) : dep}"></div>
      <div class="field"><label for="tArr">Llegada</label><input class="input" type="time" id="tArr" value="${edit ? fromMin(toMin(edit.arrive)) : ''}"><div class="err" data-err="tArr"></div></div>
    </div>
    <div class="row row-2">
      <div class="field"><label for="tOdoS">Odómetro inicial</label><div class="input-unit"><input class="input num" type="number" step="0.1" min="0" id="tOdoS" value="${edit ? edit.odoStart : D.vs[dv]?.odo || ''}" inputmode="decimal"><span>km</span></div><div class="err" data-err="tOdoS"></div></div>
      <div class="field"><label for="tOdoE">Odómetro final</label><div class="input-unit"><input class="input num" type="number" step="0.1" min="0" id="tOdoE" value="${edit ? edit.odoEnd : ''}" inputmode="decimal"><span>km</span></div><div class="err" data-err="tOdoE"></div></div>
    </div>
    <div class="row row-2">
      <div class="field"><label for="tVeh">Vehículo</label><select class="input" id="tVeh">${vehOptions(dv)}</select></div>
      <div class="field"><span class="lbl" id="tTagL">Etiqueta</span><div class="seg" role="radiogroup" aria-labelledby="tTagL">${['Trabajo', 'Personal'].map((t) => `<label><input type="radio" name="tTag" value="${t}" ${(edit ? edit.tag : S.settings.defaultTag) === t ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
    </div>
    <div class="field"><label for="tComp">Rendimiento de la computadora (opcional)</label>
      <div class="comp-row"><input class="input num" type="number" step="any" min="0" id="tComp" value="${cval}" inputmode="decimal" aria-describedby="tCompHelp tCompErr"><select class="input" id="tCompUnit" aria-label="Unidad del rendimiento"><option value="kmpl" ${cu === 'kmpl' ? 'selected' : ''}>km/L</option><option value="l100" ${cu === 'l100' ? 'selected' : ''}>L/100 km</option></select></div>
      <div class="help" id="tCompHelp">El que marca el tablero al terminar el viaje. Si lo capturas, se usa para calcular el costo de este viaje</div><div class="err" id="tCompErr" data-err="tComp"></div></div>
    <div class="calc" aria-live="polite">
      <div><small>Distancia</small><b id="cKm" class="empty-v">—</b></div>
      <div><small>Duración</small><b id="cDur" class="empty-v">—</b></div>
      <div><small>Vel. promedio</small><b id="cSpd" class="empty-v">—</b></div>
    </div>
    <div class="calc-foot"><span>Litros estimados</span><b id="cLit" style="color:var(--text)">—</b></div>
    <div class="calc-foot"><span>Costo estimado de combustible <span class="muted-xs" id="cBasis"></span></span><b id="cCost">—</b></div>
  </form>
  ${drawerFoot('tripForm', edit ? 'Guardar cambios' : 'Guardar viaje', edit && { kind: 'trip', id: edit.id })}`,
    edit ? '#tDate' : '#tOrigin',
  );
  const f = req<HTMLFormElement>('#tripForm'),
    g = (id: string) => f.querySelector<HTMLInputElement>('#' + id)!;
  let odoDirty = !!edit;
  setupCombo(g('tOrigin'), placeOpts, (v) => `“${v}” se guardará como lugar nuevo`);
  setupCombo(g('tDest'), placeOpts, (v) => `“${v}” se guardará como lugar nuevo`);
  const setV = (id: string, html: string | null) => {
    const el = g(id);
    el.innerHTML = html ?? '—';
    el.classList.toggle('empty-v', html == null);
  };
  const upd = () => {
    const sv = g('tOdoS').value,
      ev = g('tOdoE').value,
      s = parseFloat(sv),
      e = parseFloat(ev);
    const km = sv !== '' && ev !== '' && e > s ? e - s : null;
    const dep = g('tDep').value,
      arr = g('tArr').value;
    let dur: number | null = null;
    if (dep && arr && dep !== arr) {
      dur = toMin(arr) - toMin(dep);
      if (dur <= 0) dur += 1440;
    }
    const vid = g('tVeh').value;
    setV('cKm', km != null ? `${fmtKm(km)}<span class="u">km</span>` : null);
    setV('cDur', dur != null ? durHTML(dur) : null);
    setV(
      'cSpd',
      km != null && dur ? `${NF0.format(km / (dur / 60))}<span class="u">km/h</span>` : null,
    );
    const cr = readComputer(f),
      kmpl = cr.kmpl || kmplOf(vid);
    g('tComp').placeholder = g('tCompUnit').value === 'l100' ? 'Ej. 7.0' : 'Ej. 14.2';
    setErr(f, 'tComp', cr.err);
    g('cLit').textContent = km != null ? `${NF1.format(km / kmpl)} L` : '—';
    g('cCost').textContent = km != null ? MXN.format((km / kmpl) * priceOf(vid)) : '—';
    g('cBasis').textContent =
      `(${NF1.format(kmpl)} km/L${cr.kmpl ? ' de la computadora' : ''} · ${MXN.format(priceOf(vid))}/L)`;
  };
  f.addEventListener('input', upd);
  f.addEventListener('change', upd);
  g('tOdoS').addEventListener('input', () => {
    odoDirty = true;
  });
  g('tVeh').addEventListener('change', () => {
    if (!odoDirty) g('tOdoS').value = String(D.vs[g('tVeh').value]?.odo || '');
    upd();
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTrip(f, edit);
  });
  upd();
  guardChanges(f);
}
/* Lee el rendimiento de la computadora del formulario: {kmpl (normalizado, null si vacío o inválido), unit, err} */
function readComputer(f: HTMLFormElement) {
  const raw = f.querySelector<HTMLInputElement>('#tComp')!.value.trim(),
    unit: ComputerUnit =
      f.querySelector<HTMLInputElement>('#tCompUnit')!.value === 'l100' ? 'l100' : 'kmpl';
  if (raw === '') return { kmpl: null, unit, err: '' };
  const v = parseFloat(raw);
  if (!isFinite(v) || v <= 0) return { kmpl: null, unit, err: 'Escribe un número mayor a 0.' };
  const k = unit === 'l100' ? 100 / v : v;
  if (k < CK_MIN - 1e-9 || k > CK_MAX + 1e-9)
    return {
      kmpl: null,
      unit,
      err:
        unit === 'l100'
          ? `Debe estar entre ${NF1.format(100 / CK_MAX)} y ${NF1.format(100 / CK_MIN)} L/100 km.`
          : `Debe estar entre ${CK_MIN} y ${CK_MAX} km/L.`,
    };
  return { kmpl: k, unit, err: '' };
}
function saveTrip(f: HTMLFormElement, edit?: Trip) {
  const g = (id: string) => f.querySelector<HTMLInputElement>('#' + id)!;
  const errs: string[] = [];
  const o = g('tOrigin').value.trim(),
    d = g('tDest').value.trim(),
    date = g('tDate').value,
    dep = g('tDep').value,
    arr = g('tArr').value;
  const s = parseFloat(g('tOdoS').value),
    e = parseFloat(g('tOdoE').value);
  const chk = (id: string, msg: string) => {
    setErr(f, id, msg);
    if (msg) errs.push(id);
  };
  chk('tOrigin', o ? '' : 'Escribe el lugar de origen.');
  chk('tDest', d ? '' : 'Escribe el lugar de destino.');
  chk('tDate', date ? '' : 'Elige la fecha.');
  chk(
    'tArr',
    !dep || !arr
      ? 'Indica la hora de salida y de llegada.'
      : dep === arr
        ? 'La llegada debe ser distinta a la salida.'
        : '',
  );
  chk('tOdoS', isFinite(s) && s >= 0 ? '' : 'Captura el odómetro inicial.');
  chk(
    'tOdoE',
    !isFinite(e)
      ? 'Captura el odómetro final.'
      : isFinite(s) && e <= s
        ? 'Debe ser mayor al inicial.'
        : isFinite(s) && e - s > 2000
          ? 'La distancia parece demasiado grande.'
          : '',
  );
  const cr = readComputer(f);
  chk('tComp', cr.err);
  if (errs.length) {
    g(errs[0]).focus();
    return;
  }
  const oKnown = S.places.some((p) => norm(p.name) === norm(o)),
    origin = canonicalPlace(o, oKnown ? null : d, e - s),
    destination = canonicalPlace(d, origin, e - s);
  const t: Omit<Trip, 'points' | 'pointsSource'> = {
    id: uid('t'),
    date,
    depart: dep,
    arrive: arr,
    origin,
    destination,
    odoStart: s,
    odoEnd: e,
    vehicleId: g('tVeh').value,
    tag: (f.querySelector<HTMLInputElement>('input[name=tTag]:checked')?.value || 'Trabajo') as Tag,
    ...cleanComputer(cr.kmpl, cr.unit),
  };
  if (cr.kmpl) S.settings.computerUnit = cr.unit; /* recuerda la última unidad usada */
  if (edit) {
    /* actualiza en su lugar (mismo id); la ruta se regenera solo si la generó la app y cambió algo de lo que la define */
    const cur = S.trips.find((x) => x.id === edit.id);
    if (!cur) {
      closeDrawer();
      return;
    }
    const sig = (x: Omit<Trip, 'points' | 'pointsSource'>) =>
      [
        x.date,
        fromMin(toMin(x.depart)),
        fromMin(toMin(x.arrive)),
        x.origin,
        x.destination,
        +x.odoStart,
        +x.odoEnd,
      ].join('|');
    const moved = sig(cur) !== sig(t);
    Object.assign(cur, { ...t, id: cur.id });
    if (cur.pointsSource === 'auto' && moved) cur.points = tripPoints(cur, S.places);
    save();
    render();
    closeDrawer();
    document.getElementById('row-' + cur.id)?.focus({ preventScroll: true });
    toast('Viaje actualizado');
    return;
  }
  const nt: Trip = Object.assign(t, {
    points: tripPoints(t, S.places),
    pointsSource: 'auto' as const,
  });
  S.trips.push(nt);
  save();
  render();
  showTripSummary(nt);
  toast('Viaje guardado');
}
function showTripSummary(t: Trip) {
  const km = tripKm(t),
    dur = tripDur(t);
  drawerState.guard = null;
  parkMaps(drawer);
  drawer.innerHTML =
    drawerHead('Viaje guardado', 'check', 'Listo', true) +
    `
  <div class="drawer-body">
    <div class="summary">
      <div class="sum-top"><span class="logo">${req('.logo').innerHTML}</span>Trayecto<span class="muted-sm">${esc(cap(fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' })))} · ${esc(t.depart)}–${esc(t.arrive)}</span></div>
      <div class="sum-route">${esc(t.origin)}<span class="arrow">${icon('arrowRight', 18)}</span>${esc(t.destination)}</div>
      <div style="margin-bottom:14px">${tagHTML(t.tag)}</div>
      ${tripMapHTML(t, 380, 180, 'resumen', 'static')}
      <div class="sum-grid">
        <div><div class="stat-label">Distancia</div><div class="stat-val">${fmtKm(km)}<span class="u">km</span></div></div>
        <div><div class="stat-label">Duración</div><div class="stat-val">${durHTML(dur)}</div></div>
        <div><div class="stat-label">Vel. promedio</div><div class="stat-val">${NF0.format(tripSpeed(t))}<span class="u">km/h</span></div></div>
        <div><div class="stat-label">Costo estimado</div><div class="stat-val" style="color:var(--accent)">${money(tripCost(t), true)}</div></div>
      </div>
      <div class="sum-foot"><span>${esc(vehName(t.vehicleId))}</span><span class="num">${NF1.format(t.odoStart)} → ${NF1.format(t.odoEnd)} km</span></div>
    </div>
  </div>
  <div class="drawer-foot"><button type="button" class="btn btn-ghost" data-dz="another">${icon('plus', 16)} Registrar otro</button><button type="button" class="btn" data-dz="view-trip" data-id="${t.id}">Ver en Viajes</button><button type="button" class="btn btn-primary" data-dz="dl-summary" data-id="${t.id}" id="dlSummary">${icon('download', 16)} Descargar PNG</button></div>`;
  mountMaps(drawer);
  req('#dlSummary').focus();
}
