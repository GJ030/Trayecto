/** Archivo de datos local (File System Access API). */
import { go, render } from '@/app/nav';
import { parseBackup, type BackupData, type BackupFile } from '@/data/schema';
import { idbDel, idbGet, idbSet } from './idb';
import { Store } from './local';
import { S, adoptData, backupPayload, setAfterSave, snapshot } from '@/data/store';
import { applyChrome } from '@/shared/ui/chrome';
import { req } from '@/shared/ui/dom';
import { icon } from '@/shared/ui/icons';
import { chooseDialog, confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { isoDate } from '@/shared/utils/dates';
import { esc, fmtHM, fmtWhen } from '@/shared/utils/format';

/* Persistencia en un archivo real con la File System Access API (Chrome/Edge). localStorage sigue siendo la caché: save() escribe ahí al instante
   y el archivo (trayecto-datos.json, mismo formato que el respaldo JSON v2) se escribe ~800 ms después, agrupando cambios.
   Nunca se escribe sin pasar parseBackup, ni se sobrescribe un archivo que cambió por fuera sin preguntar.
   `dirty` (en localStorage) marca cambios aún no escritos: si la pestaña se cierra antes de tiempo, la próxima sesión los empuja al archivo en lugar de descartarlos. */
export const FS_FILE = 'trayecto-datos.json',
  FS_DIR = 'respaldos',
  FS_KEEP = 14,
  FS_DELAY = 800,
  KEY_FS = 'trayecto:fs';
export type FsState =
  'none' | 'ok' | 'saving' | 'error' | 'off' | 'missing' | 'nofile' | 'invalid' | 'conflict';
interface FsMeta {
  dirty: boolean;
  fileMod: number | null;
  modified: string | null;
}
/** Resultado de leer el archivo de datos. */
interface FsRead {
  mod: number;
  empty: boolean;
  data: BackupData | null;
  key: string | null;
  error: string | null;
}
type Validated =
  | { error: string; payload?: undefined; data?: undefined; key?: undefined }
  | { error?: undefined; payload: BackupFile; data: BackupData; key: string };
type Valid = Extract<Validated, { payload: BackupFile }>;
const FS_HOLD: FsState[] = ['missing', 'nofile', 'invalid', 'conflict'];
/* estados que bloquean la escritura hasta que el usuario decida */
export const FS: {
  supported: boolean;
  handle: FileSystemDirectoryHandle | null;
  perm: PermissionState | 'none';
  state: FsState;
  detail: string;
  hold: FsState | null;
  known: number | null;
  syncKey: string | null;
  rawKey: string | null;
  savedAt: Date | null;
  rev: number;
  busy: boolean;
  again: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  backups: { count: number; last: string | null };
  meta: FsMeta;
} = {
  supported: typeof window.showDirectoryPicker === 'function',
  handle: null,
  perm: 'none',
  state: 'none',
  detail: '',
  hold: null,
  known: null,
  syncKey: null,
  rawKey: null,
  savedAt: null,
  rev: 0,
  busy: false,
  again: false,
  timer: null,
  backups: { count: 0, last: null },
  meta: ((): FsMeta => {
    try {
      return Object.assign(
        { dirty: false, fileMod: null, modified: null },
        JSON.parse(localStorage.getItem(KEY_FS) || '{}'),
      );
    } catch (e) {
      return { dirty: false, fileMod: null, modified: null };
    }
  })(),
};
const saveMeta = () => {
  try {
    localStorage.setItem(KEY_FS, JSON.stringify(FS.meta));
  } catch (e) {}
};
const canWrite = () => !!FS.handle && FS.perm === 'granted' && !FS.hold;
const hasData = (d: BackupData) =>
  d.trips.length + d.fuel.length + d.places.length + d.vehicles.length > 0;
/* hints y lastBackup son preferencias de este equipo: no cuentan al decidir si dos versiones difieren */
const canonKey = (d: BackupData) =>
  JSON.stringify({ ...d, settings: { ...d.settings, hints: undefined, lastBackup: undefined } });
/* ---- Validación y lectura ---- */
/* Datos actuales pasados por parseBackup; falla si el filtro descartaría algo (el archivo no sería un respaldo fiel) */
function validated(): Validated {
  const payload = backupPayload(),
    r = parseBackup(payload);
  if (r.error !== undefined) return { error: r.error };
  const lost = [
    ['viaje', 'viajes', 'trips'],
    ['carga', 'cargas', 'fuel'],
    ['lugar', 'lugares', 'places'],
    ['vehículo', 'vehículos', 'vehicles'],
  ]
    .map(([o, m, k]: string[]) => {
      const c = S[k as 'trips'].length - r.data[k as 'trips'].length;
      return c > 0 ? `${c} ${c === 1 ? o : m}` : null;
    })
    .filter(Boolean);
  if (lost.length)
    return { error: 'No pasan la validación del respaldo: ' + lost.join(', ') + '.' };
  return { payload, data: r.data, key: canonKey(r.data) };
}
async function readFile(fh: FileSystemFileHandle): Promise<FsRead> {
  const f = await fh.getFile(),
    text = await f.text(),
    o: FsRead = {
      mod: f.lastModified,
      empty: text.trim() === '',
      data: null,
      key: null,
      error: null,
    };
  if (o.empty) return o;
  try {
    const r = parseBackup(JSON.parse(text));
    if (r.error !== undefined) o.error = r.error;
    else {
      o.data = r.data;
      o.key = canonKey(r.data);
    }
  } catch (e) {
    o.error = 'El archivo no es un JSON válido';
  }
  return o;
}
/* Fecha de la última modificación de los datos de la app (se compara el contenido, no los clics de pantalla) */
function trackModified() {
  const raw = JSON.stringify(snapshot());
  if (FS.rawKey === null) {
    FS.rawKey = raw;
    return;
  }
  if (raw !== FS.rawKey) {
    FS.rawKey = raw;
    FS.meta.modified = new Date().toISOString();
    saveMeta();
  }
}
const sideLines = (d: BackupData, when: string) => [
  `${d.trips.length} viajes · ${d.fuel.length} cargas · ${d.places.length} lugares`,
  'Última modificación: ' + when,
];
const appWhen = () =>
  FS.meta.modified ? fmtWhen(Date.parse(FS.meta.modified)) : 'sin fecha registrada';
function resolveConflict(cur: FsRead, v: Valid) {
  trackModified();
  const opts: { value: string; title: string; lines: string[] }[] = [
    { value: 'app', title: 'Conservar la de la app', lines: sideLines(v.data, appWhen()) },
  ];
  if (cur.data)
    opts.unshift({
      value: 'file',
      title: 'Conservar la del archivo',
      lines: sideLines(cur.data, fmtWhen(cur.mod)),
    });
  return chooseDialog({
    title: 'El archivo de datos cambió por fuera',
    body: `${FS_FILE} ya no coincide con lo último que guardó la app (otra pestaña o una edición manual). Elige qué versión conservar; la otra se reemplazará.${cur.data ? '' : ' El archivo actual está vacío o no es válido.'}`,
    options: opts,
  });
}
/* ---- Estado visible: indicador del menú, aviso y tarjeta de Respaldo ---- */
export function fsInfo(): { label: string; tone: string; tip: string } {
  const n = FS.handle ? FS.handle.name : '',
    when = FS.savedAt ? ` · última sincronización a las ${fmtHM(FS.savedAt)}` : '';
  switch (FS.state) {
    case 'ok':
      return { label: 'Guardado en archivo', tone: 'ok', tip: `${FS_FILE} en «${n}»${when}` };
    case 'saving':
      return { label: 'Guardando…', tone: 'busy', tip: `Escribiendo ${FS_FILE} en «${n}»` };
    case 'error':
      return {
        label: 'Error al guardar',
        tone: 'err',
        tip:
          FS.detail ||
          'No se pudo escribir el archivo. Tus datos siguen a salvo en la caché del navegador.',
      };
    case 'off':
      return {
        label: 'Carpeta desconectada',
        tone: 'warn',
        tip: `El navegador necesita tu permiso para usar «${n}». Haz clic para reconectar; mientras tanto se usa la caché del navegador.`,
      };
    case 'missing':
      return {
        label: 'Carpeta no disponible',
        tone: 'warn',
        tip: `La carpeta «${n}» ya no existe o no se puede abrir. Tus datos siguen en la caché del navegador.`,
      };
    case 'nofile':
      return {
        label: 'Archivo no encontrado',
        tone: 'warn',
        tip: `No hay ${FS_FILE} en «${n}». Tus datos siguen en la caché del navegador.`,
      };
    case 'invalid':
      return {
        label: 'Archivo no válido',
        tone: 'err',
        tip: `${FS_FILE} no se pudo leer: ${FS.detail}`,
      };
    case 'conflict':
      return {
        label: 'Elegir versión',
        tone: 'warn',
        tip: `${FS_FILE} cambió por fuera; falta decidir qué versión conservar. No se escribe nada mientras tanto.`,
      };
    default:
      return {
        label: 'Sin carpeta de datos',
        tone: 'none',
        tip: 'Los datos solo viven en la caché de este navegador. Elige una carpeta en Respaldo para guardarlos también en un archivo.',
      };
  }
}
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
function setState(state: FsState, detail?: string) {
  const was = FS.state;
  FS.state = state;
  FS.detail = detail || '';
  FS.hold = FS_HOLD.includes(state) ? state : null;
  if (state === 'error' && was !== 'error')
    toast(FS.detail || 'Error al guardar el archivo', 'err');
  paintFS();
}
/* ---- Respaldos diarios ---- */
const BK_RE = /^trayecto-\d{4}-\d{2}-\d{2}\.json$/;
async function listBackups(bd: FileSystemDirectoryHandle) {
  const names = [];
  for await (const [n, h] of bd.entries()) if (h.kind === 'file' && BK_RE.test(n)) names.push(n);
  return names.sort();
}
export async function refreshBackups() {
  try {
    let names: string[] = [];
    try {
      names = await listBackups(await FS.handle!.getDirectoryHandle(FS_DIR));
    } catch (e) {
      if ((e as Error).name !== 'NotFoundError') throw e;
    }
    FS.backups = {
      count: names.length,
      last: names.length ? names[names.length - 1].slice(9, 19) : null,
    };
  } catch (e) {
    FS.backups = { count: 0, last: null };
  }
}
/* Una vez al día, antes del primer guardado: copia lo que había en el archivo (el estado previo a los cambios del día; si no hay, los datos nuevos).
   Un fallo aquí no impide guardar los datos */
async function dailyBackup(fh: FileSystemFileHandle | null, text: string) {
  try {
    const name = `trayecto-${isoDate(new Date())}.json`,
      bd = await FS.handle!.getDirectoryHandle(FS_DIR, { create: true });
    try {
      await bd.getFileHandle(name);
      return;
    } catch (e) {
      if ((e as Error).name !== 'NotFoundError') throw e;
    }
    let body = text;
    if (fh) {
      try {
        const t = await (await fh.getFile()).text(),
          r = parseBackup(JSON.parse(t));
        if (r.data && hasData(r.data)) body = t;
      } catch (_) {}
    }
    const w = await (await bd.getFileHandle(name, { create: true })).createWritable();
    try {
      await w.write(body);
      await w.close();
    } catch (e) {
      try {
        await w.abort();
      } catch (_) {}
      throw e;
    }
    const names = await listBackups(bd);
    while (names.length > FS_KEEP) await bd.removeEntry(names.shift()!);
    FS.backups = { count: names.length, last: names[names.length - 1].slice(9, 19) };
  } catch (e) {}
}
/* ---- Escritura ---- */
function touch() {
  if (!FS.supported) return;
  FS.rev++;
  if (FS.handle && !FS.meta.dirty) {
    FS.meta.dirty = true;
    saveMeta();
  }
  if (FS.timer) clearTimeout(FS.timer);
  FS.timer = setTimeout(tick, FS_DELAY);
}
export async function tick() {
  if (FS.timer) clearTimeout(FS.timer);
  FS.timer = null;
  trackModified();
  await flush();
}
async function flush() {
  if (!canWrite()) return;
  if (FS.busy) {
    FS.again = true;
    return;
  }
  FS.busy = true;
  try {
    do {
      FS.again = false;
      await writeOnce();
    } while (FS.again && canWrite());
  } catch (e) {
    failWrite(e);
  } finally {
    FS.busy = false;
  }
}
function failWrite(e: unknown) {
  const n = e && (e as Error).name;
  if (n === 'NotAllowedError' || n === 'SecurityError') {
    FS.perm = 'prompt';
    setState('off');
  } else if (n === 'NotFoundError') setState('missing');
  else
    setState(
      'error',
      n === 'QuotaExceededError'
        ? 'No hay espacio suficiente en el disco para guardar el archivo.'
        : `No se pudo escribir ${FS_FILE}: ${(e && (e as Error).message) || n || 'error desconocido'}`,
    );
}
function markClean(rev: number) {
  if (FS.rev === rev && FS.meta.dirty) {
    FS.meta.dirty = false;
    saveMeta();
  }
}
function adoptSync(cur: FsRead, rev: number) {
  FS.known = cur.mod;
  FS.syncKey = cur.key;
  FS.meta.fileMod = cur.mod;
  FS.savedAt = new Date();
  markClean(rev);
  saveMeta();
  setState('ok');
}
async function writeOnce() {
  trackModified();
  const rev = FS.rev,
    v = validated();
  if (v.error !== undefined) {
    setState('error', v.error);
    return;
  }
  if (v.key === FS.syncKey) {
    markClean(rev);
    if (FS.state === 'saving') setState('ok');
    return;
  } /* nada nuevo que escribir (p. ej. solo cambió la pantalla) */
  setState('saving');
  let fh: FileSystemFileHandle | null,
    f: File | null = null;
  try {
    fh = await FS.handle!.getFileHandle(FS_FILE);
    f = await fh.getFile();
  } catch (e) {
    if ((e as Error).name !== 'NotFoundError') throw e;
    fh = null;
  }
  if (f && f.lastModified !== FS.known) {
    /* cambió por fuera (otra pestaña o edición manual) */
    const cur = await readFile(fh!);
    if (cur.key && cur.key === v.key) {
      adoptSync(cur, rev);
      return;
    }
    if (!(cur.empty || (cur.key && cur.key === FS.syncKey))) {
      const c = await resolveConflict(cur, v);
      if (c === 'file') {
        applyFile(cur);
        return;
      }
      if (c !== 'app') {
        setState('conflict');
        return;
      }
    }
  }
  const text = JSON.stringify(v.payload, null, 2);
  await dailyBackup(fh, text);
  const target = fh || (await FS.handle!.getFileHandle(FS_FILE, { create: true }));
  const w = await target.createWritable();
  try {
    await w.write(text);
    await w.close();
  } catch (e) {
    try {
      await w.abort();
    } catch (_) {}
    throw e;
  }
  const nf = await target.getFile();
  FS.known = nf.lastModified;
  FS.syncKey = v.key ?? null;
  FS.savedAt = new Date();
  FS.meta.fileMod = FS.known;
  markClean(rev);
  saveMeta();
  setState('ok');
}
/* Carga en la app los datos del archivo (la caché se actualiza sin pasar por save(), que reprogramaría una escritura) */
function applyFile(cur: FsRead) {
  adoptData(cur.data!, true);
  Store.save(S);
  FS.known = cur.mod;
  FS.syncKey = cur.key;
  FS.savedAt = new Date();
  FS.meta.fileMod = cur.mod;
  FS.meta.dirty = false;
  FS.meta.modified = new Date(cur.mod).toISOString();
  saveMeta();
  FS.rawKey = JSON.stringify(snapshot());
  applyChrome();
  render();
  setState('ok');
}
/* ---- Conexión ---- */
/* Al abrir la app (o reconectar): decide si el archivo se carga, se actualiza o hay que preguntar */
export async function openLinked() {
  try {
    FS.perm = 'granted';
    FS.hold = null; /* se vuelve a evaluar todo: cada rama deja el estado que le toca */
    try {
      await FS.handle!.values().next();
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        setState('missing');
        return;
      }
      throw e;
    }
    let fh: FileSystemFileHandle;
    try {
      fh = await FS.handle!.getFileHandle(FS_FILE);
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        FS.known = null;
        await refreshBackups();
        setState('nofile');
        return;
      }
      throw e;
    }
    const cur = await readFile(fh),
      v = validated();
    await refreshBackups();
    if (cur.error) {
      FS.known = cur.mod;
      setState('invalid', cur.error);
      return;
    }
    if (v.error !== undefined) {
      FS.known = cur.mod;
      setState('error', v.error);
      return;
    }
    if (cur.empty) {
      FS.known = cur.mod;
      FS.syncKey = null;
      FS.meta.dirty = true;
      saveMeta();
      await flush();
      return;
    }
    if (cur.key === v.key) {
      adoptSync(cur, FS.rev);
      return;
    }
    if (!FS.meta.dirty) {
      applyFile(cur);
      toast(`Datos cargados desde ${FS_FILE}`);
      return;
    }
    if (cur.mod === FS.meta.fileMod) {
      FS.known = cur.mod;
      FS.syncKey = cur.key;
      await flush();
      return;
    } /* el archivo sigue como lo dejamos: los cambios pendientes son más nuevos */
    const c = await resolveConflict(cur, v);
    if (c === 'file') {
      applyFile(cur);
    } else if (c === 'app') {
      FS.known = cur.mod;
      FS.syncKey = cur.key;
      await flush();
    } else {
      FS.known = FS.meta.fileMod;
      setState('conflict');
    }
  } catch (e) {
    failWrite(e);
  }
}
/* Enlaza una carpeta ya elegida: compara con el archivo que tenga y pregunta cuál conservar */
export async function linkFolder(dir: FileSystemDirectoryHandle) {
  trackModified();
  const v = validated();
  if (v.error !== undefined) {
    toast('Tus datos no pasan la validación del respaldo: ' + v.error, 'err');
    return false;
  }
  let cur: FsRead | null = null;
  try {
    cur = await readFile(await dir.getFileHandle(FS_FILE));
  } catch (e) {
    if ((e as Error).name !== 'NotFoundError') {
      toast('No se pudo leer la carpeta: ' + ((e as Error).message || (e as Error).name), 'err');
      return false;
    }
  }
  let useFile = false;
  if (cur && cur.error) {
    if (
      !(await confirmDialog({
        title: 'El archivo de datos no es válido',
        body: `${FS_FILE} en «${dir.name}» no se pudo leer (${cur.error}). ¿Reemplazarlo con los datos de la app?`,
        ok: 'Reemplazar',
      }))
    )
      return false;
  } else if (cur && cur.data && hasData(cur.data) && cur.key !== v.key) {
    const c = await chooseDialog({
      title: 'Ya hay datos en esa carpeta',
      body: `${FS_FILE} ya existe y tiene datos distintos a los de la app. ¿Cuáles quieres conservar? Los otros se reemplazarán.`,
      cancel: 'Cancelar',
      options: [
        {
          value: 'file',
          title: 'Conservar los del archivo',
          lines: sideLines(cur.data, fmtWhen(cur.mod)),
        },
        {
          value: 'app',
          title: 'Conservar los actuales de la app',
          lines: sideLines(v.data, appWhen()),
        },
      ],
    });
    if (!c) return false;
    useFile = c === 'file';
  }
  FS.handle = dir;
  FS.perm = 'granted';
  FS.hold = null;
  try {
    await idbSet('dir', dir);
  } catch (e) {
    toast('No se pudo recordar la carpeta para la próxima vez', 'err');
  }
  FS.known = cur ? cur.mod : null;
  FS.syncKey = (cur && cur.key) || null;
  FS.meta.fileMod = FS.known;
  if (useFile) applyFile(cur!);
  else {
    FS.meta.dirty = true;
    saveMeta();
    setState('ok');
    await flush();
  }
  await refreshBackups();
  paintFS();
  toast(`Carpeta de datos: ${dir.name}`);
  return true;
}
async function pickFolder() {
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await window.showDirectoryPicker!({
      id: 'trayecto-datos',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (e) {
    if (e && (e as Error).name !== 'AbortError')
      toast('No se pudo abrir el selector de carpetas', 'err');
    return;
  }
  await linkFolder(dir);
}
async function reconnectFS() {
  if (!FS.handle) return;
  let p: PermissionState;
  try {
    p = await FS.handle.requestPermission({ mode: 'readwrite' });
  } catch (e) {
    p = 'denied';
  }
  FS.perm = p;
  if (p !== 'granted') {
    setState('off');
    toast('No se concedió el permiso a la carpeta', 'err');
    return;
  }
  await openLinked();
}
async function forgetFS() {
  try {
    await idbDel('dir');
  } catch (e) {}
  if (FS.timer) clearTimeout(FS.timer);
  FS.timer = null;
  Object.assign(FS, {
    handle: null,
    perm: 'none',
    known: null,
    syncKey: null,
    savedAt: null,
    backups: { count: 0, last: null },
  });
  FS.meta.dirty = false;
  FS.meta.fileMod = null;
  saveMeta();
  setState('none');
  toast('Carpeta de datos desconectada; tus datos siguen en el navegador');
}
export async function fsAction(a: string) {
  if (a === 'fs-pick') await pickFolder();
  else if (a === 'fs-reconnect') await reconnectFS();
  else if (a === 'fs-forget') await forgetFS();
  else if (a === 'fs-resolve') await openLinked();
  else if (a === 'fs-create') {
    FS.hold = null;
    FS.known = null;
    FS.syncKey = null;
    FS.meta.dirty = true;
    saveMeta();
    await flush();
  } else if (a === 'fs-replace') {
    if (
      await confirmDialog({
        title: `¿Reemplazar ${FS_FILE}?`,
        body: 'El archivo actual no se puede leer. Se escribirán en su lugar los datos de la app.',
        ok: 'Reemplazar',
      })
    ) {
      FS.hold = null;
      FS.syncKey = null;
      FS.meta.dirty = true;
      saveMeta();
      await flush();
    }
  }
}
export async function initFS() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {} /* reduce el riesgo de que el navegador borre la caché por falta de espacio */
  if (!FS.supported) {
    paintFS();
    return;
  }
  FS.rawKey = JSON.stringify(snapshot());
  try {
    FS.handle = (await idbGet('dir')) || null;
  } catch (e) {
    FS.handle = null;
  }
  if (!FS.handle) {
    setState('none');
    return;
  }
  let p: PermissionState = 'prompt';
  try {
    p = await FS.handle.queryPermission({ mode: 'readwrite' });
  } catch (e) {}
  FS.perm = p;
  if (p === 'granted') await openLinked();
  else setState('off');
}
setAfterSave(touch);
const flushPending = () => {
  if (FS.timer) tick();
};
window.addEventListener('pagehide', flushPending);
window.addEventListener('beforeunload', flushPending);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPending();
});
req('#fsNotice').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (b) fsAction(b.dataset.action!);
});
req('#fsStatus').addEventListener('click', () => {
  if (FS.state === 'off') reconnectFS();
  else go('respaldo');
});
