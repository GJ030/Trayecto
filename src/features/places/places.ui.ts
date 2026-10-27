import { S } from '@/data/store';
import { $$ } from '@/shared/ui/dom';
import { icon } from '@/shared/ui/icons';
import { toast } from '@/shared/ui/toast';
import { validGeo } from '@/shared/utils/geo';

/** Estado de la interfaz de Lugares que vive fuera del DOM: menú ⋮ abierto y aviso de deshacer. */
export const placeUi: {
  menu: { btn: HTMLElement; el: HTMLElement } | null;
  undo: { el: HTMLElement; fn: () => void } | null;
} = { menu: null, undo: null };
/* ---- Menú de acciones por lugar ---- */
export function closePlaceMenu(restore?: boolean) {
  if (!placeUi.menu) return;
  const { btn, el } = placeUi.menu;
  placeUi.menu = null;
  el.remove();
  if (document.contains(btn)) {
    btn.setAttribute('aria-expanded', 'false');
    if (restore) btn.focus({ preventScroll: true });
  }
}
export function togglePlaceMenu(btn: HTMLElement) {
  if (placeUi.menu && placeUi.menu.btn === btn) {
    closePlaceMenu(true);
    return;
  }
  closePlaceMenu();
  const p = S.places.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  const items: [string, string, string][] = [
    ['place-edit', 'edit', 'Editar'],
    ['locate-start', 'pin', validGeo(p.lat, p.lng) ? 'Mover ubicación' : 'Ubicar en el mapa'],
  ];
  if (S.places.length > 1) items.push(['place-merge', 'swapH', 'Fusionar con…']);
  items.push(['place-delete', 'trash', 'Eliminar']);
  const el = document.createElement('div');
  el.className = 'menu pmenu';
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', `Acciones de ${p.name}`);
  el.innerHTML = items
    .map(
      ([a, ic, l]) =>
        `<button type="button" class="menu-item${a === 'place-delete' ? ' danger' : ''}" role="menuitem" data-action="${a}" data-id="${p.id}"><span class="mi-ico">${icon(ic, 16)}</span><span>${l}</span></button>`,
    )
    .join('');
  btn.closest('li')!.appendChild(el);
  btn.setAttribute('aria-expanded', 'true');
  const r = el.getBoundingClientRect();
  if (r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height + 16)
    el.classList.add('up');
  placeUi.menu = { btn, el };
  el.querySelector<HTMLElement>('[role=menuitem]')!.focus();
  el.addEventListener('keydown', (e) => {
    const its = $$('[role=menuitem]', el),
      i = its.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      its[(i + 1) % its.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      its[(i - 1 + its.length) % its.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      its[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      its[its.length - 1].focus();
    } else if (e.key === 'Tab') closePlaceMenu(!e.shiftKey);
  });
}
document.addEventListener('click', (e) => {
  if (placeUi.menu && !(e.target as HTMLElement).closest('.pmenu,[data-action=place-more]'))
    closePlaceMenu();
});
/* ---- Deshacer ---- */
export function showUndo(msg: string, fn: () => void) {
  clearUndo();
  const el = toast(msg, 'ok', {
    ms: 6000,
    action: {
      label: 'Deshacer',
      fn: () => {
        placeUi.undo = null;
        fn();
      },
    },
  });
  placeUi.undo = { el, fn };
  setTimeout(() => {
    if (placeUi.undo && placeUi.undo.el === el) placeUi.undo = null;
  }, 6000);
}
function clearUndo() {
  if (placeUi.undo) {
    placeUi.undo.el.remove();
    placeUi.undo = null;
  }
}
export function runUndo() {
  if (!placeUi.undo) return;
  const { el, fn } = placeUi.undo;
  placeUi.undo = null;
  el.remove();
  fn();
}
