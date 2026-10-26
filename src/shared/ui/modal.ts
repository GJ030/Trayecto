/** Diálogos modales de confirmación y elección. */
import { $$, req } from './dom';
import { icon } from './icons';
import { esc } from '@/shared/utils/format';

export const modalWrap = req('#modalWrap');
export const modalState = { open: false };
export function confirmDialog({
  title,
  body,
  ok = 'Eliminar',
  danger = true,
}: {
  title: string;
  body: string;
  ok?: string;
  danger?: boolean;
}) {
  return new Promise<boolean>((res) => {
    const prev = document.activeElement as HTMLElement | null;
    modalWrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico${danger ? '' : ' neutral'}">${icon(danger ? 'trash' : 'alert', 22)}</div><h2 id="mTitle">${esc(title)}</h2><p id="mBody">${esc(body)}</p><div class="modal-actions"><button class="btn" data-m="0">Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="1">${esc(ok)}</button></div></div>`;
    modalWrap.classList.add('open');
    modalState.open = true;
    const btns = $$('[data-m]', modalWrap);
    btns[0].focus();
    const done = (v: boolean) => {
      modalWrap.classList.remove('open');
      modalWrap.innerHTML = '';
      modalState.open = false;
      document.removeEventListener('keydown', onKey, true);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      res(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    modalWrap.onclick = (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLElement>('[data-m]');
      if (b) done(b.dataset.m === '1');
      else if (t === modalWrap) done(false);
    };
  });
}
export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  lines: string[];
}
/* ---- Diálogo de elección entre versiones ---- */
export function chooseDialog<T extends string>({
  title,
  body,
  options,
  cancel = 'Decidir después',
}: {
  title: string;
  body: string;
  options: ChoiceOption<T>[];
  cancel?: string;
}) {
  return new Promise<T | null>((res) => {
    const prev = document.activeElement as HTMLElement | null;
    modalWrap.innerHTML = `<div class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico neutral">${icon('alert', 22)}</div><h2 id="mTitle">${esc(title)}</h2><p id="mBody">${esc(body)}</p><div class="choices">${options.map((o, i) => `<button type="button" class="choice" data-m="${i}"><b>${esc(o.title)}</b><span>${o.lines.map(esc).join('<br>')}</span></button>`).join('')}</div><div class="modal-actions"><button type="button" class="btn" data-m="x">${esc(cancel)}</button></div></div>`;
    modalWrap.classList.add('open');
    modalState.open = true;
    const btns = $$('[data-m]', modalWrap);
    btns[btns.length - 1].focus(); /* lo seguro por omisión: decidir después */
    const done = (v: T | null) => {
      modalWrap.classList.remove('open');
      modalWrap.innerHTML = '';
      modalState.open = false;
      document.removeEventListener('keydown', onKey, true);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      res(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done(null);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    modalWrap.onclick = (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLElement>('[data-m]');
      if (b) done(b.dataset.m === 'x' ? null : options[+b.dataset.m!].value);
      else if (t === modalWrap) done(null);
    };
  });
}
