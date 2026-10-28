/** Ajustes de «Rutas por calles reales (usa OSRM)»: interruptor, confirmaciones, progreso y acciones. */
import { routingHost } from '@/data/routing';
import {
  onRoutingChange,
  onRoutingFinish,
  routeEta,
  routingQueue,
  routingStatus,
  pendingRoutes,
} from '@/data/routingQueue';
import { routeStops } from '@/data/routes';
import { fsLinked } from '@/data/storage/file';
import { S } from '@/data/store';
import { tripsRepo } from '@/features/trips/trips.repo';
import { $, req } from '@/shared/ui/dom';
import { chooseDialog, confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { esc } from '@/shared/utils/format';
import { settingsRepo } from './settings.repo';

const SENT = 'las coordenadas de origen, destino y puntos intermedios';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** «unos 40 s», «unos 3 min» */
export const fmtEta = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s <= 90 ? `unos ${s} s` : `unos ${Math.ceil(s / 60)} min`;
};

/** Texto de privacidad: qué se envía y a dónde. */
export const routingPrivacy = () =>
  `Al activarlo, la app envía ${SENT} de tus viajes a ${routingHost()} (servidor público de OSRM, con datos de OpenStreetMap) para trazar la ruta por las calles. Se envía solo al registrar o editar un viaje, al calcular las rutas de los viajes ya registrados (con tu confirmación) y al reintentar las que fallaron. No se envía nada más. Apagado, no se envía nada, y las rutas ya calculadas se siguen mostrando desde el archivo de datos.`;

/** Viajes de la app con ubicación que aún no tienen ruta calculada ni definitiva (sin ruta o pendientes sin error). */
const missing = () =>
  S.trips.filter(
    (t) =>
      t.pointsSource === 'auto' &&
      !!routeStops(t, S.places) &&
      (!t.route || (t.route.status === 'pending' && !t.route.error)),
  ).length;

export function routingCardHTML() {
  const on = S.settings.routing,
    blocked = !on && !fsLinked();
  return `<section class="card" id="rtCard"><h3 class="sec-title">Rutas por calles reales</h3>
    <div class="set-row"><div><b>Rutas por calles reales (usa OSRM)</b><p>${esc(routingPrivacy())}</p><p id="rtWhy" class="rt-why"${blocked ? '' : ' hidden'}>Primero elige una carpeta de datos en Respaldo: las rutas calculadas se guardan en su archivo, no en el navegador.</p></div><button class="switch-bare" id="rtSwitch" role="switch" aria-checked="${on}" data-action="toggle-routing" aria-label="Rutas por calles reales"${blocked ? ' disabled' : ''}><span class="track"></span></button></div>
    <div id="rtLive" class="rt-live" aria-live="polite">${liveHTML()}</div>
  </section>`;
}
function liveHTML() {
  const st = routingStatus(),
    c = st.counts;
  if (!st.enabled)
    return c.ok
      ? `<p class="rt-line">${plural(c.ok, 'ruta calculada se sigue mostrando', 'rutas calculadas se siguen mostrando')} desde el archivo de datos.</p>`
      : '';
  const total = st.done + st.failed + st.remaining,
    pct = total ? Math.round(((st.done + st.failed) / total) * 100) : 0,
    btn = (action: string, label: string, primary = false) =>
      `<button class="btn${primary ? ' btn-primary' : ''} sm" data-action="${action}">${label}</button>`;
  const summary = `<p class="rt-line" id="rtCounts">${plural(c.ok, 'calculada', 'calculadas')} · ${plural(c.pending, 'pendiente', 'pendientes')} · ${plural(c.error, 'con error', 'con error')}</p>`;
  let msg: string,
    actions = '';
  if (st.state === 'running' || st.state === 'waiting') {
    const wait = st.nextAt ? Math.max(0, st.nextAt - Date.now()) : 0;
    msg = `Calculando rutas… ${st.done + st.failed} de ${total}${st.state === 'waiting' && wait > 2500 ? ` · reintento en ${fmtEta(wait).replace('unos ', '')}` : ''}`;
    actions = btn('rt-stop', 'Detener');
  } else if (st.state === 'stopped') {
    msg = `Detenido. ${st.remaining ? `Faltan ${plural(st.remaining, 'ruta', 'rutas')}.` : ''}`;
    actions = st.remaining ? btn('rt-start', 'Reanudar', true) : '';
  } else if (st.state === 'blocked') {
    msg = 'En pausa: la carpeta de datos no está disponible. Reconéctala en Respaldo y sigue sola.';
  } else if (st.state === 'stalled') {
    msg = 'Sin conexión o servicio no disponible. Se reintentará sola al volver la conexión.';
    actions = btn('rt-start', 'Reintentar ahora', true);
  } else if (st.remaining) {
    msg = `${plural(st.remaining, 'ruta pendiente', 'rutas pendientes')}.`;
    actions = btn('rt-start', 'Calcular rutas pendientes', true);
  } else msg = c.error ? '' : 'Todo al día.';
  if (c.error && st.state !== 'running' && st.state !== 'waiting')
    actions += btn('rt-retry-errors', `Reintentar las ${c.error} con error`);
  const bar =
    st.state === 'running' || st.state === 'waiting' || (st.state === 'stopped' && total)
      ? `<div class="rt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`
      : '';
  return `${summary}${msg ? `<p class="rt-line" id="rtStatus">${esc(msg)}</p>` : ''}${bar}${actions ? `<div class="rt-actions">${actions}</div>` : ''}`;
}
/** Actualiza el interruptor y el progreso sin volver a pintar Ajustes (la cola cambia cada segundo). */
export function paintRoutingCard() {
  const live = $('#rtLive');
  if (!live) return;
  const on = S.settings.routing,
    blocked = !on && !fsLinked(),
    sw = req<HTMLButtonElement>('#rtSwitch');
  sw.setAttribute('aria-checked', String(on));
  sw.disabled = blocked;
  req('#rtWhy').hidden = !blocked;
  live.innerHTML = liveHTML();
}
onRoutingChange(paintRoutingCard);
onRoutingFinish(({ done, failed }) => {
  if (done + failed < 2 && !failed) return;
  toast(
    `Rutas calculadas: ${done}${failed ? ` · ${plural(failed, 'sin camino o inválida', 'sin camino o inválidas')}` : ''}`,
    failed ? 'err' : 'ok',
  );
});

/** Diálogo de confirmación antes de enviar `n` viajes. */
const confirmSend = (n: number, ok: string) =>
  confirmDialog({
    title: `¿Calcular ${plural(n, 'ruta', 'rutas')}?`,
    body: `Se enviarán ${SENT} de ${plural(n, 'viaje', 'viajes')} a ${routingHost()} (servidor público de OSRM). A una petición por segundo tardará ${fmtEta(routeEta(n))}. Puedes detenerlo cuando quieras: lo ya calculado se queda y después sigue con los que faltan. Nada más se envía.`,
    ok,
    danger: false,
  });

export async function toggleRouting() {
  if (S.settings.routing) {
    settingsRepo.setRouting(false);
    toast('Rutas por calles reales desactivadas; las ya calculadas se siguen mostrando');
    return;
  }
  if (!fsLinked()) {
    toast('Primero elige una carpeta de datos en Respaldo', 'err');
    return;
  }
  const n = missing(),
    pend = pendingRoutes().length;
  if (!n) {
    const ok = await confirmDialog({
      title: '¿Activar rutas por calles reales?',
      body: `Cuando registres o edites un viaje se enviarán ${SENT} a ${routingHost()} (servidor público de OSRM, con datos de OpenStreetMap) para trazar la ruta por las calles. Nada más se envía. Puedes desactivarlo cuando quieras; las rutas ya calculadas se siguen mostrando.`,
      ok: 'Activar',
      danger: false,
    });
    if (ok) settingsRepo.setRouting(true);
    return;
  }
  const c = await chooseDialog<'all' | 'new'>({
    title: '¿Activar rutas por calles reales?',
    body: `Se enviarán ${SENT} a ${routingHost()} (servidor público de OSRM, con datos de OpenStreetMap) para trazar las rutas por las calles. Nada más se envía.`,
    cancel: 'Cancelar',
    options: [
      {
        value: 'all',
        title: `Activar y calcular ${plural(n, 'viaje registrado', 'viajes registrados')}`,
        lines: [
          `Se enviarán los datos de ${plural(n, 'viaje', 'viajes')} a ${routingHost()}.`,
          `A una petición por segundo tardará ${fmtEta(routeEta(n))}. Empieza por los más recientes; puedes detenerlo cuando quieras y lo ya calculado se queda.`,
        ],
      },
      {
        value: 'new',
        title: 'Activar solo para los viajes nuevos y editados',
        lines: [
          'No se envía nada de los viajes ya registrados.',
          ...(pend
            ? [`Los ${pend} que ya estaban pendientes se calcularán con el siguiente viaje.`]
            : []),
        ],
      },
    ],
  });
  if (!c) return;
  settingsRepo.setRouting(true);
  if (c === 'all') {
    tripsRepo.queueMissingRoutes();
    routingQueue.resume();
  }
}
export async function startRoutes() {
  const n = pendingRoutes().length;
  if (!n) return;
  if (await confirmSend(n, 'Calcular')) routingQueue.resume();
}
export async function retryRouteErrors() {
  const n = routingStatus().counts.error;
  if (!n) return;
  if (!(await confirmSend(n, 'Reintentar'))) return;
  tripsRepo.retryRouteErrors();
  routingQueue.resume();
}
export const stopRoutes = () => routingQueue.stop();
