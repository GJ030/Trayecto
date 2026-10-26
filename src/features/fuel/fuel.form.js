import { render } from '@/app/nav';
import { S, save } from '@/data/store';
import { D, derive, priceOf } from './fuel.calc';
import { defVeh, vehById, vehOptions } from '@/features/vehicles/vehicles.calc';
import { closeMenu } from '@/shared/ui/chrome';
import { setErr, setupCombo } from '@/shared/ui/combo';
import { $ } from '@/shared/ui/dom';
import {
  closeDrawer,
  drawerFoot,
  drawerHead,
  guardChanges,
  noVehicleDrawer,
  openDrawer,
} from '@/shared/ui/drawer';
import { toast } from '@/shared/ui/toast';
import { isoDate } from '@/shared/utils/dates';
import { MXN, NF0, NF1, NF2, esc } from '@/shared/utils/format';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

const stationOpts = () => {
  const m = new Map();
  S.fuel.forEach((f) => m.set(f.station, (m.get(f.station) || 0) + 1));
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => ({ label: s, meta: `${n} ${n === 1 ? 'carga' : 'cargas'}`, icon: 'fuel' }));
};
/* ---- Nueva carga / Editar carga ---- */
export function openFuelPanel(edit) {
  closeMenu();
  derive();
  if (!S.vehicles.length) return noVehicleDrawer(edit ? 'Editar carga' : 'Nueva carga');
  const dv = edit && vehById(edit.vehicleId) ? edit.vehicleId : defVeh(),
    today = isoDate(new Date());
  openDrawer(
    drawerHead(
      edit ? 'Editar carga' : 'Nueva carga de gasolina',
      'fuel',
      edit ? 'Editar registro' : undefined,
    ) +
      `
  <form id="fuelForm" class="drawer-body" novalidate autocomplete="off">
    <div class="row row-2">
      <div class="field"><label for="fDate">Fecha</label><input class="input" type="date" id="fDate" value="${edit ? edit.date : today}"><div class="err" data-err="fDate"></div></div>
      <div class="field"><label for="fVeh">Vehículo</label><select class="input" id="fVeh">${vehOptions(dv)}</select></div>
    </div>
    <div class="field"><label for="fStation">Gasolinera</label><div class="combo"><input class="input" id="fStation" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="fStation-lb" placeholder="Ej. Pemex Av. Universidad" value="${esc(edit?.station || '')}" autocomplete="off"><ul class="combo-list" id="fStation-lb" role="listbox" aria-label="Gasolineras frecuentes" hidden></ul></div><div class="err" data-err="fStation"></div></div>
    <div class="field"><label for="fOdo">Odómetro</label><div class="input-unit"><input class="input num" type="number" step="1" min="0" id="fOdo" value="${edit ? edit.odometer : ''}" inputmode="numeric"><span>km</span></div><div class="help" id="fOdoHelp"></div><div class="err" data-err="fOdo"></div></div>
    <div class="row row-2">
      <div class="field"><label for="fLit">Litros</label><div class="input-unit"><input class="input num" type="number" step="0.01" min="0" id="fLit" value="${edit ? edit.liters : ''}" inputmode="decimal"><span>L</span></div><div class="err" data-err="fLit"></div></div>
      <div class="field"><label for="fPrice">Precio por litro</label><div class="input-unit pre"><input class="input num" type="number" step="0.01" min="0" id="fPrice" value="${edit ? edit.price : priceOf(dv) ? NF2.format(priceOf(dv)).replace(/,/g, '') : ''}" inputmode="decimal"><span>$</span></div><div class="err" data-err="fPrice"></div></div>
    </div>
    <div class="total-box"><span>Total calculado</span><b class="num" id="fTotal">$0.00</b></div>
    <button type="button" class="switch" role="switch" aria-checked="${edit ? !!edit.full : true}" id="fFull"><span><b>Tanque lleno</b><small>Necesario para calcular el km/L entre dos cargas</small></span><span class="track"></span></button>
    <div class="calc two" aria-live="polite"><div><small>Desde el último lleno</small><b id="fKm" class="empty-v">—</b></div><div><small>Rendimiento</small><b id="fKmpl" class="empty-v">—</b></div></div>
    <p class="muted-xs" id="fNote" style="margin-top:10px"></p>
  </form>
  ${drawerFoot('fuelForm', edit ? 'Guardar cambios' : 'Guardar carga', edit && { kind: 'fuel', id: edit.id })}`,
    edit ? '#fDate' : '#fStation',
  );
  const f = $('#fuelForm'),
    g = (id) => f.querySelector('#' + id);
  let priceDirty = !!edit;
  setupCombo(g('fStation'), stationOpts, (v) => `Nueva gasolinera: “${v}”`);
  const setV = (id, html) => {
    const el = g(id);
    el.innerHTML = html ?? '—';
    el.classList.toggle('empty-v', html == null);
  };
  const upd = () => {
    const vid = g('fVeh').value,
      odo = parseFloat(g('fOdo').value),
      lit = parseFloat(g('fLit').value),
      pr = parseFloat(g('fPrice').value),
      full = g('fFull').getAttribute('aria-checked') === 'true';
    g('fTotal').textContent = MXN.format(isFinite(lit) && isFinite(pr) ? lit * pr : 0);
    const loads = S.fuel
      .filter((x) => x.vehicleId === vid && x.id !== edit?.id)
      .sort((a, b) => a.odometer - b.odometer);
    const lastOdo = loads.length ? loads[loads.length - 1].odometer : null;
    g('fOdoHelp').textContent =
      lastOdo != null
        ? `Última carga de este vehículo: ${NF0.format(lastOdo)} km`
        : 'Primera carga registrada para este vehículo';
    let lastFull = null,
      acc = 0;
    if (isFinite(odo))
      for (const x of loads) {
        if (x.odometer >= odo) break;
        if (x.full) {
          lastFull = x.odometer;
          acc = 0;
        } else acc += x.liters;
      }
    const km = lastFull != null && isFinite(odo) ? odo - lastFull : null;
    setV('fKm', km != null ? `${NF0.format(km)}<span class="u">km</span>` : null);
    const kmpl = km != null && full && isFinite(lit) && lit > 0 ? km / (acc + lit) : null;
    setV('fKmpl', kmpl != null ? `${NF1.format(kmpl)}<span class="u">km/L</span>` : null);
    g('fNote').textContent = !isFinite(odo)
      ? 'Captura el odómetro para calcular el rendimiento.'
      : lastFull == null
        ? 'Esta será tu carga de referencia: el rendimiento se calculará en la siguiente carga de tanque lleno.'
        : !full
          ? `Carga parcial: sus litros se sumarán al siguiente tanque lleno.`
          : acc
            ? `Incluye ${NF1.format(acc)} L de cargas parciales intermedias.`
            : '';
  };
  f.addEventListener('input', upd);
  f.addEventListener('change', upd);
  g('fPrice').addEventListener('input', () => {
    priceDirty = true;
  });
  g('fVeh').addEventListener('change', () => {
    if (!priceDirty) {
      const p = priceOf(g('fVeh').value);
      g('fPrice').value = p ? p.toFixed(2) : '';
    }
    upd();
  });
  g('fFull').addEventListener('click', () => {
    const el = g('fFull');
    el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true'));
    upd();
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    saveFuel(f, edit);
  });
  upd();
  guardChanges(f);
}
function saveFuel(f, edit) {
  const g = (id) => f.querySelector('#' + id),
    errs = [];
  const chk = (id, msg) => {
    setErr(f, id, msg);
    if (msg) errs.push(id);
  };
  const vid = g('fVeh').value,
    date = g('fDate').value,
    st = g('fStation').value.trim().replace(/\s+/g, ' '),
    odo = parseFloat(g('fOdo').value),
    lit = parseFloat(g('fLit').value),
    pr = parseFloat(g('fPrice').value),
    full = g('fFull').getAttribute('aria-checked') === 'true';
  chk('fDate', date ? '' : 'Elige la fecha.');
  chk('fStation', st ? '' : 'Escribe la gasolinera.');
  chk(
    'fOdo',
    !isFinite(odo) || odo <= 0
      ? 'Captura el odómetro.'
      : S.fuel.some(
            (x) => x.id !== edit?.id && x.vehicleId === vid && Math.abs(x.odometer - odo) < 0.5,
          )
        ? 'Ya hay una carga con ese odómetro.'
        : '',
  );
  chk(
    'fLit',
    !isFinite(lit) || lit <= 0
      ? 'Captura los litros.'
      : lit > 200
        ? 'Revisa la cantidad de litros.'
        : '',
  );
  chk(
    'fPrice',
    !isFinite(pr) || pr <= 0
      ? 'Captura el precio por litro.'
      : pr > 100
        ? 'Revisa el precio por litro.'
        : '',
  );
  if (errs.length) {
    g(errs[0]).focus();
    return;
  }
  const canon = S.fuel.find((x) => norm(x.station) === norm(st))?.station || st;
  const cur = edit && S.fuel.find((x) => x.id === edit.id);
  if (edit && !cur) {
    closeDrawer();
    return;
  }
  const nf = cur || { id: uid('f') };
  Object.assign(nf, {
    date,
    station: canon,
    odometer: odo,
    liters: +lit.toFixed(2),
    price: +pr.toFixed(2),
    full,
    vehicleId: vid,
  });
  if (!cur) S.fuel.push(nf);
  save();
  render();
  derive();
  closeDrawer();
  if (cur)
    document
      .querySelector(`[data-action="edit-fuel"][data-id="${nf.id}"]`)
      ?.focus({ preventScroll: true });
  const k = D.kmpl[nf.id];
  toast(
    cur
      ? k
        ? `Carga actualizada · ${NF1.format(k)} km/L`
        : 'Carga actualizada'
      : k
        ? `Carga guardada · ${NF1.format(k)} km/L`
        : 'Carga guardada',
  );
}
