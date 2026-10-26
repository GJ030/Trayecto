/** Autocompletado y errores de formulario. */
import { icon } from './icons';
import { esc } from '@/shared/utils/format';
import { norm } from '@/shared/utils/norm';

/* ---- Autocompletado ---- */
export function setupCombo(inp, getOpts, newNote) {
  const list = document.getElementById(inp.getAttribute('aria-controls'));
  let items = [],
    act = -1;
  const close = () => {
    list.hidden = true;
    inp.setAttribute('aria-expanded', 'false');
    inp.removeAttribute('aria-activedescendant');
    act = -1;
  };
  const open = () => {
    const q = norm(inp.value);
    items = getOpts()
      .filter((o) => !q || norm(o.label).includes(q))
      .slice(0, 7);
    act = -1;
    if (!items.length) {
      if (inp.value.trim() && newNote) {
        list.innerHTML = `<li class="combo-note">${esc(newNote(inp.value.trim()))}</li>`;
        list.hidden = false;
        inp.setAttribute('aria-expanded', 'true');
      } else close();
      return;
    }
    list.innerHTML = items
      .map(
        (o, i) =>
          `<li role="option" id="${list.id}-${i}" class="combo-opt" aria-selected="false" data-i="${i}">${icon(o.icon || 'pin', 15)}<span>${esc(o.label)}</span><small>${esc(o.meta || '')}</small></li>`,
      )
      .join('');
    list.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  };
  const setAct = (i) => {
    act = i;
    [...list.querySelectorAll('.combo-opt')].forEach((li, j) =>
      li.setAttribute('aria-selected', String(j === i)),
    );
    if (i >= 0) {
      inp.setAttribute('aria-activedescendant', `${list.id}-${i}`);
      list.children[i]?.scrollIntoView({ block: 'nearest' });
    }
  };
  const pick = (i) => {
    inp.value = items[i].label;
    close();
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  };
  inp.addEventListener('input', open);
  inp.addEventListener('focus', open);
  inp.addEventListener('blur', () => setTimeout(close, 120));
  inp.addEventListener('keydown', (e) => {
    if (list.hidden) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) setAct((act + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setAct((act - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' && act >= 0) {
      e.preventDefault();
      pick(act);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') close();
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.combo-opt');
    if (li) {
      e.preventDefault();
      pick(+li.dataset.i);
    }
  });
}
export function setErr(form, id, msg) {
  const i = form.querySelector('#' + id),
    e = form.querySelector(`[data-err="${id}"]`);
  if (i) {
    i.classList.toggle('invalid', !!msg);
    i.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  if (e) e.textContent = msg || '';
}
