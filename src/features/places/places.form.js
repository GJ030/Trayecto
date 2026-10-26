import { render } from '@/app/nav';
import { S, save } from '@/data/store';
import { KINDS, nTrips, placeVisits, tripsOf } from './places.calc';
import { setErr } from '@/shared/ui/combo';
import { $, $$ } from '@/shared/ui/dom';
import { closeDrawer, drawerFoot, drawerHead, guardChanges, openDrawer } from '@/shared/ui/drawer';
import { icon, kindIcon } from '@/shared/ui/icons';
import { modalState, modalWrap } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { esc } from '@/shared/utils/format';
import { validGeo } from '@/shared/utils/geo';
import { norm } from '@/shared/utils/norm';

export const placeOpts = () => {
  const vis = placeVisits();
  return [...S.places]
    .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0))
    .map((p) => ({
      label: p.name,
      meta: [p.area, vis[p.id] ? `${vis[p.id]} visitas` : ''].filter(Boolean).join(' · '),
      icon: kindIcon(p.kind),
    }));
};
/* ---- Editar ---- */
export function openPlacePanel(p) {
  const cur = KINDS.some((k) => k[0] === p.kind) ? p.kind : 'other';
  openDrawer(
    drawerHead('Editar lugar', kindIcon(cur), 'Editar registro') +
      `
  <form id="placeForm" class="drawer-body" novalidate autocomplete="off">
    <div class="field"><label for="pName">Nombre</label><input class="input" id="pName" value="${esc(p.name)}" maxlength="60"><div class="err" data-err="pName"></div></div>
    <div class="field"><label for="pArea">Colonia o zona</label><input class="input" id="pArea" value="${esc(p.area || '')}" maxlength="60" placeholder="Opcional"></div>
    <div class="field"><span class="lbl" id="pKindL">Ícono</span><div class="kind-pick" role="radiogroup" aria-labelledby="pKindL">${KINDS.map(([k, l]) => `<label><input type="radio" name="pKind" value="${k}" ${cur === k ? 'checked' : ''}><span>${icon(kindIcon(k), 20)}<small>${l}</small></span></label>`).join('')}</div></div>
    <p class="muted-sm" id="pNote" aria-live="polite"></p>
  </form>` +
      drawerFoot('placeForm', 'Guardar cambios'),
    '#pName',
  );
  const f = $('#placeForm'),
    inp = $('#pName', f),
    note = $('#pNote', f),
    n = tripsOf(p).length;
  const upd = () => {
    const v = inp.value.trim().replace(/\s+/g, ' ');
    note.textContent =
      v && v !== p.name && n
        ? `Se actualizarán ${nTrips(n)} que usan «${p.name}»; sus rutas no cambian.`
        : '';
  };
  inp.addEventListener('input', () => {
    setErr(f, 'pName', '');
    upd();
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    savePlace(f, p);
  });
  guardChanges(f);
}
function savePlace(f, p) {
  const name = $('#pName', f).value.trim().replace(/\s+/g, ' '),
    area = $('#pArea', f).value.trim(),
    kind = f.querySelector('input[name=pKind]:checked')?.value || 'other';
  const dup = S.places.find((x) => x.id !== p.id && norm(x.name) === norm(name));
  setErr(
    f,
    'pName',
    !name
      ? 'Escribe un nombre para el lugar.'
      : dup
        ? `Ya existe un lugar llamado «${dup.name}».`
        : '',
  );
  if (!name || dup) {
    $('#pName', f).focus();
    return;
  }
  const old = p.name,
    on = norm(old);
  let k = 0;
  if (name !== old) {
    S.trips.forEach((t) => {
      let ch = false;
      if (norm(t.origin) === on) {
        t.origin = name;
        ch = true;
      }
      if (norm(t.destination) === on) {
        t.destination = name;
        ch = true;
      }
      if (ch) k++;
    });
    if (S.ui.selPair)
      S.ui.selPair = S.ui.selPair
        .split('→')
        .map((x) => (x === on ? norm(name) : x))
        .join('→'); /* el trayecto seleccionado sigue siendo el mismo */
  }
  p.name = name;
  p.area = area;
  p.kind = kind;
  save();
  render();
  closeDrawer();
  toast(k ? `Lugar actualizado · ${nTrips(k)} con el nombre nuevo` : 'Lugar actualizado');
}
/* ---- Fusionar ---- */
export function mergeDialog(src) {
  return new Promise((res) => {
    const prev = document.activeElement,
      vis = placeVisits(),
      n = tripsOf(src).length;
    const others = S.places
      .filter((p) => p.id !== src.id)
      .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0));
    modalWrap.innerHTML = `<div class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico neutral">${icon('swapH', 22)}</div><h2 id="mTitle">Fusionar «${esc(src.name)}»</h2><p id="mBody">Elige el lugar que se queda. «${esc(src.name)}» se elimina y sus viajes pasan a usar el nombre del lugar elegido.</p>
      <div class="field" style="margin:16px 0 8px"><label for="mergeDst">Fusionar con</label><select class="input" id="mergeDst"><option value="">Elige un lugar…</option>${others.map((p) => `<option value="${p.id}">${esc(p.name)}${p.area ? ' · ' + esc(p.area) : ''} (${vis[p.id] || 0} ${vis[p.id] === 1 ? 'visita' : 'visitas'})</option>`).join('')}</select></div>
      <p class="merge-sum" id="mergeSum" aria-live="polite"></p>
      <div class="modal-actions"><button type="button" class="btn" data-m="0">Cancelar</button><button type="button" class="btn btn-primary" data-m="1" disabled>Fusionar</button></div></div>`;
    modalWrap.classList.add('open');
    modalState.open = true;
    const sel = $('#mergeDst', modalWrap),
      sum = $('#mergeSum', modalWrap),
      ok = $('[data-m="1"]', modalWrap);
    sel.focus();
    sel.addEventListener('change', () => {
      const d = S.places.find((p) => p.id === sel.value);
      ok.disabled = !d;
      if (!d) {
        sum.textContent = '';
        return;
      }
      const auto = tripsOf(src).some((t) => t.pointsSource === 'auto');
      sum.textContent =
        (n
          ? `${n === 1 ? '1 viaje pasará' : `${n} viajes pasarán`} de «${src.name}» a «${d.name}».`
          : `«${src.name}» no tiene viajes; solo se eliminará el lugar.`) +
        (n && auto
          ? validGeo(d.lat, d.lng)
            ? ` Las rutas automáticas se ajustarán a la ubicación de «${d.name}».`
            : ` «${d.name}» no tiene ubicación: las rutas se conservan hasta que la ubiques.`
          : '');
    });
    const done = (v) => {
      modalWrap.classList.remove('open');
      modalWrap.innerHTML = '';
      modalState.open = false;
      document.removeEventListener('keydown', onKey, true);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      res(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done(null);
      } else if (e.key === 'Tab') {
        const fs = [sel, ...$$('[data-m]', modalWrap).filter((b) => !b.disabled)];
        e.preventDefault();
        const i = fs.indexOf(document.activeElement);
        fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    modalWrap.onclick = (e) => {
      const b = e.target.closest('[data-m]');
      if (b && !b.disabled) done(b.dataset.m === '1' ? sel.value : null);
      else if (e.target === modalWrap) done(null);
    };
  });
}
