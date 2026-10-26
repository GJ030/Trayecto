import { FS, FS_DIR, FS_FILE, FS_KEEP, fsInfo } from '@/data/storage/file';
import { Store } from '@/data/storage/local';
import { S } from '@/data/store';
import { icon } from '@/shared/ui/icons';
import { fmtDate } from '@/shared/utils/dates';
import { esc } from '@/shared/utils/format';

export function renderRespaldo() {
  const lb = S.settings.lastBackup;
  return `<div class="view grid">
    <section class="card span-12 banner${Store.ok ? '' : ' warn'}"><div class="b-ico">${icon(Store.ok ? 'shield' : 'alert', 22)}</div><div><h3>${Store.ok ? 'Tus datos se guardan en este equipo' : 'Modo memoria'}</h3><p>${Store.ok ? (FS.handle ? `Viven en la caché del navegador y en el archivo ${FS_FILE} de tu carpeta de datos. Nada se envía a internet.` : `Hoy viven solo en la caché de este navegador: si se limpia, se pierden. Nada se envía a internet.${FS.supported ? ' Elige una carpeta de datos o exporta un respaldo para tenerlos a salvo.' : ' Exporta un respaldo para moverlos a otra PC o tenerlos a salvo.'}`) : 'Este navegador no permite guardar localmente. Exporta un respaldo antes de cerrar para no perder tus registros.'}${lb ? ` Último respaldo: ${esc(new Date(lb).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}.` : ' Aún no has exportado un respaldo.'}</p></div>
      <div class="chips"><span class="tag muted">${S.trips.length} viajes</span><span class="tag muted">${S.fuel.length} cargas</span><span class="tag muted">${S.places.length} lugares</span><span class="tag muted">${S.vehicles.length} vehículos</span></div></section>
    ${fsCardHTML()}
    <section class="card span-4 backup-card"><div class="b-ico">${icon('download', 20)}</div><h3>Exportar respaldo</h3><p>Descarga un archivo JSON con viajes, cargas, lugares, vehículos y ajustes.</p><button class="btn btn-primary" data-action="export-json">${icon('download', 16)} Exportar JSON</button></section>
    <section class="card span-4 backup-card"><div class="b-ico">${icon('upload', 20)}</div><h3>Importar respaldo</h3><p>Restaura desde un archivo JSON de Trayecto. Reemplaza los datos actuales después de confirmar.</p><button class="btn" data-action="import-json">${icon('file', 16)} Elegir archivo…</button><input type="file" id="importFile" accept=".json,application/json" hidden></section>
    <section class="card span-4 backup-card"><div class="b-ico">${icon('table', 20)}</div><h3>Exportar a CSV</h3><p>Para abrir en Excel u otra hoja de cálculo.</p><div class="btn-col"><button class="btn" data-action="csv-trips" ${S.trips.length ? '' : 'disabled'}>${icon('route', 16)} Viajes (${S.trips.length})</button><button class="btn" data-action="csv-fuel" ${S.fuel.length ? '' : 'disabled'}>${icon('fuel', 16)} Cargas (${S.fuel.length})</button></div></section>
  </div>`;
}
/* Tarjeta de la vista Respaldo */
function fsCardHTML() {
  if (!FS.supported)
    return `<p class="muted-sm fs-note span-12">${icon('folder', 16)}<span>Carpeta de datos: Disponible en Chrome o Edge</span></p>`;
  const info = fsInfo();
  if (!FS.handle)
    return `<section class="card span-12 banner warn" id="fsCard"><div class="b-ico">${icon('folder', 22)}</div><div><h3>Carpeta de datos</h3><p>Guarda tus datos también en un archivo real (${FS_FILE}) dentro de una carpeta de tu laptop, además de la caché del navegador. Se hace una copia diaria en la subcarpeta ${FS_DIR}/.</p></div>
    <div class="fs-actions"><button class="btn btn-primary" id="fsPick" data-action="fs-pick">${icon('folder', 16)} Elegir carpeta</button></div></section>`;
  const bk = FS.backups.count
    ? `Último respaldo automático: ${fmtDate(FS.backups.last!, { day: 'numeric', month: 'short', year: 'numeric' })} · ${FS.backups.count} ${FS.backups.count === 1 ? 'copia' : 'copias'} en ${FS_DIR}/ (se conservan las ${FS_KEEP} más recientes)`
    : `Aún no hay respaldos automáticos: se crea uno al primer guardado de cada día en ${FS_DIR}/.`;
  return `<section class="card span-12 banner${info.tone === 'ok' || info.tone === 'busy' ? '' : ' warn'}" id="fsCard"><div class="b-ico">${icon('folder', 22)}</div><div><h3>Carpeta de datos · «${esc(FS.handle.name)}» <span class="badge${info.tone === 'ok' ? ' green' : ''}">${esc(info.label)}</span></h3><p>${esc(info.tip)}</p><p>${esc(bk)}</p></div>
    <div class="fs-actions">${FS.state === 'off' ? `<button class="btn btn-primary" id="fsReconnect" data-action="fs-reconnect">${icon('refresh', 16)} Reconectar</button>` : ''}<button class="btn" id="fsPick" data-action="fs-pick">${icon('folder', 16)} Cambiar carpeta</button><button class="btn btn-ghost" id="fsForget" data-action="fs-forget">Dejar de usar</button></div></section>`;
}
