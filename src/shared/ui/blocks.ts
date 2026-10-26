/** Bloques de interfaz reutilizables. */
import { icon } from './icons';
import { esc } from '@/shared/utils/format';

export const emptyState = (ic: string, title: string, text: string, actions = '', sm?: boolean) =>
  `<div class="empty${sm ? ' sm' : ''}"><div class="e-ico">${icon(ic, 26)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="e-actions">${actions}</div>` : ''}</div>`;
export const quickBtns = () =>
  `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Nuevo viaje <kbd class="hint">N</kbd></button><button class="btn" data-action="new-fuel">${icon('fuel', 16)} Nueva carga <kbd class="hint">G</kbd></button>`;
