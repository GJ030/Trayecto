/** Menú lateral, barra superior y menú «Nuevo registro». */
import { go, render } from '@/app/nav';
import { paintStatusBtn } from '@/data/storage/file';
import { S, save } from '@/data/store';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import { openTripPanel } from '@/features/trips/trips.form';
import { $, $$, app } from './dom';
import { icon } from './icons';
import { cap, esc } from '@/shared/utils/format';

export function applyChrome() {
  app.classList.toggle('collapsed', !!S.ui.collapsed);
  document.body.classList.toggle('no-hints', !S.settings.hints);
  const cb = $('#btnCollapse');
  if (cb) {
    const l = S.ui.collapsed ? 'Expandir menú' : 'Contraer menú';
    cb.querySelector('.nav-label').textContent = l;
    cb.dataset.tip = l;
    cb.setAttribute('aria-label', l);
    cb.setAttribute('aria-expanded', String(!S.ui.collapsed));
  }
  paintStatusBtn();
}
export function buildChrome() {
  const nb = ([v, l, ic]) =>
    `<div class="nav-wrap"><button class="nav-item" data-view="${v}" data-tip="${l}">${icon(ic)}<span class="nav-label">${l}</span></button></div>`;
  $('#navMain').innerHTML = [
    ['inicio', 'Inicio', 'home'],
    ['viajes', 'Viajes', 'route'],
    ['gasolina', 'Gasolina', 'fuel'],
    ['lugares', 'Lugares', 'pin'],
    ['estadisticas', 'Estadísticas', 'chart'],
  ]
    .map(nb)
    .join('');
  $('#navBottom').innerHTML =
    [
      ['vehiculos', 'Vehículos', 'car'],
      ['ajustes', 'Ajustes', 'sliders'],
      ['respaldo', 'Respaldo', 'archive'],
    ]
      .map(nb)
      .join('') +
    `<div class="nav-wrap"><button class="nav-item" id="btnCollapse"><span class="collapse-ico">${icon('panel')}</span><span class="nav-label">Contraer menú</span></button></div>`;
  $('#btnNew').innerHTML =
    `${icon('plus', 18)}<span class="nav-label">Nuevo registro</span><span class="chev nav-label">${icon('chevDown', 16)}</span>`;
  $('#newMenu').innerHTML =
    `<button class="menu-item" role="menuitem" data-new="trip"><span class="mi-ico">${icon('route', 16)}</span><span>Viaje</span><kbd class="hint">N</kbd></button><button class="menu-item" role="menuitem" data-new="fuel"><span class="mi-ico">${icon('fuel', 16)}</span><span>Carga de gasolina</span><kbd class="hint">G</kbd></button>`;
  $('#searchIco').innerHTML = icon('search', 16);
  $('#searchIco').style.display = 'flex';
  $('#todayChip').innerHTML =
    icon('calendar', 15) +
    esc(
      cap(
        new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      ),
    );
  $$('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  $('#btnCollapse').addEventListener('click', () => {
    S.ui.collapsed = !S.ui.collapsed;
    save();
    applyChrome();
    hideTip();
    if (S.ui.view === 'ajustes') render();
  });
}
/* ---- Tooltip del menú contraído ---- */
const tipEl = $('#tip');
function showTip(el) {
  const r = el.getBoundingClientRect();
  tipEl.textContent = el.dataset.tip;
  tipEl.style.left = r.right + 12 + 'px';
  tipEl.style.top = r.top + r.height / 2 + 'px';
  tipEl.hidden = false;
}
export function hideTip() {
  tipEl.hidden = true;
}
['mouseover', 'focusin'].forEach((ev) =>
  document.querySelector('.sidebar').addEventListener(ev, (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && app.classList.contains('collapsed') && $('#newMenu').hidden) showTip(el);
    else hideTip();
  }),
);
['mouseout', 'focusout'].forEach((ev) =>
  document.querySelector('.sidebar').addEventListener(ev, hideTip),
);
/* ---- Menú "Nuevo registro" ---- */
export const btnNew = $('#btnNew'),
  menu = $('#newMenu');
function openMenu(focusFirst) {
  menu.hidden = false;
  btnNew.setAttribute('aria-expanded', 'true');
  hideTip();
  if (focusFirst) menu.querySelector('[role=menuitem]').focus();
}
export function closeMenu(restore) {
  if (menu.hidden) return;
  menu.hidden = true;
  btnNew.setAttribute('aria-expanded', 'false');
  if (restore) btnNew.focus();
}
btnNew.addEventListener('click', (e) => {
  menu.hidden ? openMenu(e.detail === 0) : closeMenu();
});
btnNew.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    openMenu(true);
  }
});
menu.addEventListener('keydown', (e) => {
  const items = $$('[role=menuitem]', menu),
    i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(i + 1) % items.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i - 1 + items.length) % items.length].focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    items[0].focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    items[items.length - 1].focus();
  } else if (e.key === 'Tab') closeMenu();
});
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-new]');
  if (!b) return;
  closeMenu();
  b.dataset.new === 'trip' ? openTripPanel() : openFuelPanel();
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('.new-wrap')) closeMenu();
});
