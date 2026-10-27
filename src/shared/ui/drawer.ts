/** Panel lateral deslizante. */
import { emptyState } from './blocks';
import { hideTip } from './chrome';
import { $$, req } from './dom';
import { icon } from './icons';
import { confirmDialog } from './modal';
import { esc } from '@/shared/utils/format';

/** Ganchos para los mapas que viven dentro del panel; `app/` los enlaza a `maps/registry`. */
export const drawerHooks = {
  park: (_root: HTMLElement) => {},
  mount: (_root: HTMLElement) => {},
};
export const drawer = req('#drawer'),
  backdrop = req('#backdrop');
export const drawerState: {
  open: boolean;
  opener: HTMLElement | null;
  guard: (() => boolean) | null;
} = { open: false, opener: null, guard: null };
export function drawerHead(title: string, ic: string, eyebrow = 'Nuevo registro', ok?: boolean) {
  return `<div class="drawer-head"><div class="dh-ico${ok ? ' ok' : ''}">${icon(ic, 20)}</div><div><div class="eyebrow">${esc(eyebrow)}</div><h2 id="drawerTitle">${esc(title)}</h2></div><div class="close-wrap"><kbd class="hint">Esc</kbd><button type="button" class="icon-btn" data-dz="close" aria-label="Cerrar panel">${icon('x')}</button></div></div>`;
}
export function openDrawer(html: string, focusSel?: string) {
  if (!drawerState.open) drawerState.opener = document.activeElement as HTMLElement | null;
  drawerState.guard = null;
  drawerHooks.park(drawer);
  drawer.innerHTML = html;
  drawerHooks.mount(drawer);
  drawer.inert = false;
  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawerState.open = true;
  hideTip();
  requestAnimationFrame(() => {
    const f =
      (focusSel && drawer.querySelector<HTMLElement>(focusSel)) ||
      drawer.querySelector<HTMLElement>('input,select,button');
    f?.focus({ preventScroll: true });
  });
}
export function closeDrawer() {
  if (!drawerState.open) return;
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
  drawer.inert = true;
  drawerState.open = false;
  drawerState.guard = null;
  const o = drawerState.opener;
  drawerState.opener = null;
  if (o && document.contains(o) && o !== document.body) o.focus({ preventScroll: true });
  /* al terminar de deslizarse, libera el mapa del resumen (y su contexto WebGL) si el panel sigue cerrado */
  setTimeout(() => {
    if (!drawerState.open && drawer.querySelector('[data-tmap]')) {
      drawerHooks.park(drawer);
      drawer.innerHTML = '';
      drawerHooks.mount(drawer);
    }
  }, 450);
}
/* Cierre iniciado por el usuario (Esc, clic fuera, Cancelar, ✕): en modo edición pide confirmar si hay cambios sin guardar */
export async function requestCloseDrawer() {
  if (!drawerState.open) return;
  if (
    drawerState.guard &&
    drawerState.guard() &&
    !(await confirmDialog({
      title: '¿Descartar los cambios?',
      body: 'Tienes cambios sin guardar en este panel. Si lo cierras, se perderán.',
      ok: 'Descartar',
      danger: false,
    }))
  )
    return;
  closeDrawer();
}
backdrop.addEventListener('click', requestCloseDrawer);
drawer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    const f = drawer.querySelector('form');
    if (f) {
      e.preventDefault();
      f.requestSubmit();
    }
  }
  if (e.key === 'Tab') {
    const fs = $$<HTMLInputElement>(
      'button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])',
      drawer,
    ).filter((x) => x.offsetParent !== null || x.type === 'radio');
    if (!fs.length) return;
    const first = fs[0],
      last = fs[fs.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
type DrawerFn = (el: HTMLElement) => void | Promise<void>;
const drawerActions = new Map<string, DrawerFn>();
const deleters = new Map<string, (id: string) => Promise<boolean>>();
/** Acciones `data-dz` del panel (cada funcionalidad registra las suyas). */
export function registerDrawerActions(entries: Record<string, DrawerFn>) {
  for (const [k, fn] of Object.entries(entries)) {
    if (drawerActions.has(k)) throw new Error(`Acción de panel duplicada: ${k}`);
    drawerActions.set(k, fn);
  }
}
/** Qué hace «Eliminar» en el pie del panel de edición de un tipo de registro (`data-kind`). */
export function registerDrawerDelete(kind: string, fn: (id: string) => Promise<boolean>) {
  deleters.set(kind, fn);
}
drawer.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-dz]');
  if (!el) return;
  const a = el.dataset.dz!;
  if (a === 'close') requestCloseDrawer();
  else if (a === 'delete') {
    if (await deleters.get(el.dataset.kind!)?.(el.dataset.id!)) closeDrawer();
  } else await drawerActions.get(a)?.(el);
});
export const noVehicleDrawer = (title: string) =>
  openDrawer(
    drawerHead(title, 'car') +
      `<div class="drawer-body">${emptyState('car', 'Primero agrega un vehículo', 'Necesitas al menos un vehículo para registrar viajes y cargas de gasolina.', `<button class="btn btn-primary" data-dz="go-veh">${icon('car', 16)} Ir a Vehículos</button>`)}</div>`,
  );
/* Pie común de los paneles; en modo edición, "Eliminar" a la izquierda en lugar de la pista de Ctrl+Enter */
export const drawerFoot = (
  formId: string,
  saveLabel: string,
  del?: { kind: string; id: string } | false,
) =>
  `<div class="drawer-foot">${del ? `<button type="button" class="btn btn-danger" data-dz="delete" data-kind="${del.kind}" data-id="${del.id}" style="margin-right:auto">${icon('trash', 16)} Eliminar</button>` : `<span class="foot-hint hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> guarda</span>`}<button type="button" class="btn btn-ghost" data-dz="close">Cancelar</button><button type="submit" form="${formId}" class="btn btn-primary">${icon('check', 16)} ${saveLabel}</button></div>`;
/* Pide confirmar el cierre del panel si algún campo cambió respecto a lo que se abrió (edición y registros nuevos) */
export function guardChanges(f: HTMLFormElement) {
  const snap = () =>
    JSON.stringify(
      [...f.elements].map((el) => {
        const i = el as HTMLInputElement;
        return i.type === 'radio' || i.type === 'checkbox' ? i.checked : i.value;
      }),
    ) + (f.querySelector('#fFull')?.getAttribute('aria-checked') || '');
  const init = snap();
  drawerState.guard = () => snap() !== init;
}
