/** Avisos temporales. */
import { req } from './dom';
import { icon } from './icons';
import { esc } from '@/shared/utils/format';

export interface ToastOptions {
  ms?: number;
  action?: { label: string; fn: () => void };
}
export function toast(msg: string, kind: 'ok' | 'err' = 'ok', opt?: ToastOptions) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert', 16)}<span>${esc(msg)}</span>`;
  if (opt && opt.action) {
    const action = opt.action;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-act';
    b.textContent = action.label;
    b.onclick = () => {
      el.remove();
      action.fn();
    };
    el.appendChild(b);
    el.classList.add('act');
  }
  req('#toasts').appendChild(el);
  setTimeout(
    () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    },
    (opt && opt.ms) || 2800,
  );
  return el;
}
