/** Estado del archivo de datos en pantalla: indicador del menú, aviso bajo la barra superior y repintado de Respaldo/Ajustes. */
import { go, render } from './nav';
import {
  FS,
  FS_FILE,
  fsAction,
  fsInfo,
  onFsChange,
  reconnectFS,
  type FsState,
} from '@/data/storage/file';
import { S } from '@/data/store';
import { req } from '@/shared/ui/dom';
import { icon } from '@/shared/ui/icons';
import { esc } from '@/shared/utils/format';

const FS_NOTICES: Partial<
  Record<FsState, () => { msg: string; btns: [string, string, number?][] }>
> = {
  off: () => ({
    msg: `Reconectar carpeta de datos: el navegador necesita tu permiso para volver a usar «${FS.handle!.name}». Mientras tanto se usa la caché.`,
    btns: [['fs-reconnect', 'Reconectar', 1]],
  }),
  missing: () => ({
    msg: `La carpeta de datos «${FS.handle!.name}» ya no existe o no se puede abrir. Tus datos siguen en la caché del navegador.`,
    btns: [
      ['fs-pick', 'Elegir otra carpeta', 1],
      ['fs-resolve', 'Reintentar'],
    ],
  }),
  nofile: () => ({
    msg: `No se encontró ${FS_FILE} en «${FS.handle!.name}». Tus datos siguen en la caché del navegador.`,
    btns: [
      ['fs-pick', 'Elegir otra carpeta', 1],
      ['fs-create', 'Crear el archivo aquí'],
    ],
  }),
  invalid: () => ({
    msg: `${FS_FILE} no es válido (${FS.detail}). No se tocará hasta que decidas.`,
    btns: [
      ['fs-pick', 'Elegir otra carpeta', 1],
      ['fs-replace', 'Reemplazar con mis datos'],
    ],
  }),
  conflict: () => ({
    msg: `${FS_FILE} cambió por fuera y falta decidir qué versión conservar. Mientras tanto no se escribe nada.`,
    btns: [['fs-resolve', 'Elegir versión', 1]],
  }),
};
let fsSig = '';
export function paintStatusBtn() {
  const info = fsInfo(),
    el = req('#fsStatus');
  el.hidden = !FS.supported;
  el.dataset.tone = info.tone;
  req('.fs-label', el).textContent = info.label;
  el.dataset.tip = `${info.label} — ${info.tip}`; /* menú contraído: lo muestra el tooltip propio */
  if (S.ui.collapsed) el.removeAttribute('title');
  else el.title = info.tip;
}
export function paintFS() {
  paintStatusBtn();
  const nt = req('#fsNotice');
  {
    const make = FS_NOTICES[FS.state];
    const spec = FS.handle && make ? make() : null;
    nt.hidden = !spec;
    nt.innerHTML = spec
      ? `${icon('alert', 16)}<span>${esc(spec.msg)}</span>${spec.btns.map(([a, l, p]) => `<button type="button" class="btn sm${p ? ' btn-primary' : ''}" data-action="${a}">${esc(l)}</button>`).join('')}`
      : '';
  }
  const sig = [
    FS.state,
    FS.detail,
    FS.handle ? FS.handle.name : '',
    FS.backups.count,
    FS.backups.last,
    FS.savedAt ? +FS.savedAt : '',
  ].join('|');
  if (sig !== fsSig) {
    fsSig = sig;
    if (S.ui.view === 'respaldo' || S.ui.view === 'ajustes') render();
  }
}

onFsChange(paintFS);
req('#fsNotice').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (b) fsAction(b.dataset.action!);
});
req('#fsStatus').addEventListener('click', () => {
  if (FS.state === 'off') reconnectFS();
  else go('respaldo');
});
