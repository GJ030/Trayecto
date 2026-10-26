/** Avisos temporales. */
import { $ } from './dom';
import { icon } from './icons';
import { esc } from '@/shared/utils/format';

export function toast(msg, kind = 'ok', opt) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert', 16)}<span>${esc(msg)}</span>`;
  if (opt && opt.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-act';
    b.textContent = opt.action.label;
    b.onclick = () => {
      el.remove();
      opt.action.fn();
    };
    el.appendChild(b);
    el.classList.add('act');
  }
  $('#toasts').appendChild(el);
  setTimeout(
    () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    },
    (opt && opt.ms) || 2800,
  );
  return el;
}
