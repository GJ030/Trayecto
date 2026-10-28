/**
 * Cola de rutas por calles reales. Una sola cola, un solo trabajador y como máximo una petición por segundo:
 * la usan el cálculo al crear o editar un viaje, el lote de viajes existentes y el reintento al volver la conexión.
 * Solo trabaja con «Rutas por calles reales» activado y con la carpeta de datos disponible para escribir (si no, el
 * resultado no se podría guardar), y siempre del viaje más reciente al más antiguo.
 */
import { needsRoute, routeStops } from './routes';
import { ROUTING, RoutingError, fetchRoute, routeSig, type RouteResult } from './routing';
import { tripKey, type RouteError, type Trip } from './schema';
import { S, onChange } from './store';

/** Cómo se aplica el resultado de una consulta a los datos (lo registra tripsRepo). */
export interface RouteSink {
  apply(id: string, sig: string, r: RouteResult): boolean;
  fail(id: string, sig: string, error: RouteError): boolean;
}
let sink: RouteSink | null = null;
export const setRouteSink = (s: RouteSink | null) => {
  sink = s;
};
/** ¿Se puede trabajar ahora? La aplicación lo ata a que la carpeta de datos esté disponible para escribir. */
let guard: () => boolean = () => true;
export const setRoutingGuard = (fn: () => boolean) => {
  guard = fn;
};
/** `fetch` a usar (para pruebas); por omisión el del navegador. */
let doFetch: typeof fetch | undefined;
export const setRoutingFetch = (f: typeof fetch | undefined) => {
  doFetch = f;
};

export type QueueState =
  /** Sin nada que hacer. */
  | 'idle'
  /** Pidiendo una ruta. */
  | 'running'
  /** Esperando: la pausa de 1 petición por segundo o una espera creciente tras un fallo. */
  | 'waiting'
  /** Detenida por el usuario: no trabaja hasta que se la reanude. */
  | 'stopped'
  /** La carpeta de datos no está disponible: no se pide nada que no se pueda guardar. */
  | 'blocked'
  /** Demasiados fallos seguidos (sin conexión o servicio caído): espera a que vuelva la conexión o a que se la lance a mano. */
  | 'stalled';
export interface RoutingStatus {
  enabled: boolean;
  state: QueueState;
  /** De la tanda actual: terminadas, con error definitivo y las que faltan. */
  done: number;
  failed: number;
  remaining: number;
  /** Rutas del historial: calculadas, pendientes (se reintentan) y con error (reintento manual). */
  counts: RouteCounts;
  /** Instante (ms) del próximo intento si está esperando. */
  nextAt: number | null;
}
export interface RouteCounts {
  ok: number;
  pending: number;
  error: number;
}
/** Rutas calculadas, pendientes y con error de un conjunto de viajes (solo los de la app). */
export function routeCounts(trips: readonly Trip[]): RouteCounts {
  const c = { ok: 0, pending: 0, error: 0 };
  for (const t of trips) {
    if (t.pointsSource !== 'auto' || !t.route) continue;
    if (t.route.status === 'ok') c.ok++;
    else if (t.route.error) c.error++;
    else c.pending++;
  }
  return c;
}
/** Tiempo aproximado (ms) de pedir `n` rutas a una por segundo (como máximo: los viajes con los mismos puntos no se piden dos veces). */
export const routeEta = (n: number) => n * (ROUTING.minIntervalMs + ROUTING.safetyMs);

const q = {
  running: false,
  stopped: false,
  state: 'idle' as QueueState,
  nextAt: null as number | null,
  streak: 0,
  lastStart: 0,
  ctl: null as AbortController | null,
  wake: null as (() => void) | null,
  done: 0,
  failed: 0,
};
const listeners = new Set<() => void>(),
  finishers = new Set<(r: { done: number; failed: number }) => void>();
const emit = () => listeners.forEach((fn) => fn());
/** Escucha los cambios de estado de la cola (para pintar el progreso). Devuelve cómo dejar de escuchar. */
export const onRoutingChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
/** Avisa cuando termina una tanda con rutas calculadas o fallidas. */
export const onRoutingFinish = (fn: (r: { done: number; failed: number }) => void) => {
  finishers.add(fn);
  return () => finishers.delete(fn);
};
const enabled = () => S.settings.routing === true;
function setState(s: QueueState, nextAt: number | null = null) {
  q.state = s;
  q.nextAt = nextAt;
  emit();
}

/** Viajes con ruta que pedir, del más reciente al más antiguo (los de huella vencida se ignoran: ya se les puso una nueva). */
export function pendingRoutes(): Trip[] {
  return S.trips
    .filter((t) => {
      if (!needsRoute(t)) return false;
      const stops = routeStops(t, S.places);
      return !!stops && routeSig(stops) === t.route!.sig;
    })
    .sort((a, b) => tripKey(b).localeCompare(tripKey(a)));
}
export function routingStatus(): RoutingStatus {
  return {
    enabled: enabled(),
    state: q.state,
    done: q.done,
    failed: q.failed,
    remaining: enabled() ? pendingRoutes().length : 0,
    counts: routeCounts(S.trips),
    nextAt: q.nextAt,
  };
}

/**
 * Consultas distintas que haría falta enviar para dejar con ruta a los viajes de la app que aún no la tienen (sin ruta o
 * pendientes sin error): los viajes con exactamente los mismos puntos comparten una sola consulta, y los que coinciden
 * con una ruta ya calculada no envían nada.
 */
export function distinctRequests(): number {
  const have = new Set<string>(),
    need = new Set<string>();
  for (const t of S.trips)
    if (t.pointsSource === 'auto' && t.route?.status === 'ok' && t.route.geometry)
      have.add(t.route.sig);
  for (const t of S.trips) {
    if (t.pointsSource !== 'auto' || (t.route && (t.route.status === 'ok' || t.route.error)))
      continue;
    const stops = routeStops(t, S.places);
    if (!stops) continue;
    const sig = routeSig(stops);
    if (!have.has(sig)) need.add(sig);
  }
  return need.size;
}
/* Ruta ya calculada (con geometría) de otro viaje con exactamente los mismos puntos: se reutiliza sin enviar nada */
function reusable(sig: string) {
  for (const t of S.trips) {
    const r = t.route;
    if (
      t.pointsSource === 'auto' &&
      r?.status === 'ok' &&
      r.sig === sig &&
      r.geometry &&
      r.distance != null &&
      r.duration != null
    )
      return { geometry: r.geometry, distance: r.distance, duration: r.duration };
  }
  return null;
}
/* Espera `ms`; se interrumpe antes si se detiene la cola o vuelve la conexión */
const sleep = (ms: number) =>
  new Promise<void>((res) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      q.wake = null;
      res();
    }
    q.wake = done;
  });

async function run() {
  if (q.running) return;
  q.running = true;
  const ctl = (q.ctl = new AbortController());
  try {
    for (;;) {
      if (!enabled()) return setState('idle');
      if (q.stopped) return setState('stopped');
      const next = pendingRoutes()[0];
      if (!next) return setState('idle');
      if (!guard()) return setState('blocked');
      /* mismos puntos que un viaje ya calculado: se copia la ruta, sin petición ni espera */
      const same = reusable(next.route!.sig);
      if (same) {
        if (sink?.apply(next.id, next.route!.sig, same)) q.done++;
        continue;
      }
      /* como máximo una petición por segundo */
      const gap = q.lastStart + ROUTING.minIntervalMs + ROUTING.safetyMs - Date.now();
      if (gap > 0) {
        setState('waiting', Date.now() + gap);
        await sleep(gap);
        continue; /* tras esperar se vuelve a decidir todo: pudo cambiar el interruptor, la cola o el viaje */
      }
      const sig = next.route!.sig,
        stops = routeStops(next, S.places)!;
      setState('running');
      q.lastStart = Date.now();
      try {
        const res = await fetchRoute(stops, { fetch: doFetch, signal: ctl.signal });
        q.streak = 0;
        if (sink?.apply(next.id, sig, res)) q.done++;
      } catch (e) {
        const err = e as RoutingError;
        if (ctl.signal.aborted || err.kind === 'aborted')
          return setState(q.stopped ? 'stopped' : 'idle');
        if (err.kind === 'noroute' || err.kind === 'invalid' || err.kind === 'input') {
          /* sin camino o respuesta inválida: error definitivo, reintento manual; vale para todos los viajes con los mismos puntos */
          const kind = err.kind === 'noroute' ? 'noroute' : 'invalid';
          for (const t of pendingRoutes())
            if (t.route!.sig === sig && sink?.fail(t.id, sig, kind)) q.failed++;
          q.streak = 0;
          continue;
        }
        /* sin conexión, tiempo agotado, 429 o 5xx: espera creciente y se reintenta */
        q.streak++;
        if (q.streak > ROUTING.retry.maxStreak) return setState('stalled');
        const base = err.status === 429 ? ROUTING.retry.rateLimitBaseMs : ROUTING.retry.baseMs,
          ms = Math.min(ROUTING.retry.maxMs, base * 2 ** (q.streak - 1));
        setState('waiting', Date.now() + ms);
        await sleep(ms);
      }
    }
  } finally {
    q.running = false;
    q.ctl = null;
    q.wake = null;
    const r = { done: q.done, failed: q.failed };
    if (r.done + r.failed > 0 && q.state !== 'waiting' && !pendingRoutes().length) {
      q.done = q.failed = 0;
      finishers.forEach((fn) => fn(r));
    }
    emit();
  }
}
export const routingQueue = {
  /** Si hay rutas pendientes, trabaja (no hace nada detenida por el usuario ni con el ruteo apagado). */
  kick() {
    if (enabled() && !q.stopped) void run();
  },
  /** Detiene la tanda: cancela la petición en curso; lo ya calculado se queda. No vuelve a trabajar hasta `resume()`. */
  stop() {
    q.stopped = true;
    q.ctl?.abort(new RoutingError('aborted', 'Detenida'));
    q.wake?.();
    if (!q.running) setState('stopped');
  },
  /** Reanuda y sigue con las pendientes, también tras un «stalled». */
  resume() {
    q.stopped = false;
    q.streak = 0;
    q.wake?.();
    this.kick();
  },
  /** Volvió la conexión: reintenta las pendientes recuperables (si no está detenida). */
  online() {
    if (!enabled() || q.stopped) return;
    q.streak = 0;
    if (q.running) q.wake?.();
    else void run();
  },
};
/**
 * Conecta la cola a los cambios de los datos: un viaje creado o editado (cambio persistente de `trips`) entra a la cola;
 * apagar el interruptor la cancela. Devuelve cómo desconectarla.
 */
export function startRoutingQueue() {
  const off = onChange((e) => {
    if (!enabled()) {
      if (q.running) {
        q.ctl?.abort(new RoutingError('aborted', 'Desactivado'));
        q.wake?.();
      } else if (q.state !== 'idle') setState('idle');
      return;
    }
    if (e.persist && e.scope.includes('trips')) routingQueue.kick();
    else emit();
  });
  const on = () => routingQueue.online();
  if (typeof window !== 'undefined') window.addEventListener('online', on);
  return () => {
    off();
    if (typeof window !== 'undefined') window.removeEventListener('online', on);
  };
}
/** Solo para pruebas: deja la cola como nueva. */
export function resetRoutingQueue() {
  q.ctl?.abort(new RoutingError('aborted', 'Reinicio'));
  q.wake?.();
  Object.assign(q, {
    running: false,
    stopped: false,
    state: 'idle',
    nextAt: null,
    streak: 0,
    lastStart: 0,
    ctl: null,
    wake: null,
    done: 0,
    failed: 0,
  });
  listeners.clear();
  finishers.clear();
}
