import './styles/legacy.css';
(function () {
  'use strict';

  /* ================= Utilidades ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ACC = '#FFB020',
    GREEN = '#3DDC97';
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const uid = (p) =>
    (p || 'id') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const toMin = (t) => {
    const [h, m] = String(t || '0:0')
      .split(':')
      .map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const MONTHS = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const MONTHS_L = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const NF2 = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const MXN = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const fmtKm = (n) => NF1.format(n || 0);
  /* Intl es lo más caro de las tablas grandes: se reutilizan los formateadores y los textos ya calculados */
  const DF = new Map(),
    DT = new Map();
  const fmtDate = (s, o) => {
    o = o || { weekday: 'short', day: 'numeric', month: 'short' };
    const k = JSON.stringify(o),
      ck = s + '|' + k;
    let r = DT.get(ck);
    if (r !== undefined) return r;
    let f = DF.get(k);
    if (!f) {
      f = new Intl.DateTimeFormat('es-MX', o);
      DF.set(k, f);
    }
    if (DT.size > 4000) DT.clear();
    r = f.format(parseDate(s));
    DT.set(ck, r);
    return r;
  };
  const fmtDurText = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`);
  const durHTML = (m) =>
    m < 60
      ? `${Math.round(m)}<span class="u">min</span>`
      : `${Math.floor(m / 60)}<span class="u">h</span> ${pad(Math.round(m % 60))}<span class="u">min</span>`;
  const money = (v, dec) => `<span class="u pre">$</span>${(dec ? NF2 : NF0).format(v || 0)}`;
  const fuelTotal = (f) => f.liters * f.price;
  const hashStr = (s) => {
    let h = 2166136261;
    for (const c of s) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const fin = (v) =>
    (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(+v);

  /* ================= Íconos ================= */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
    route:
      '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.8"/>',
    fuel: '<path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h6A2.5 2.5 0 0 1 15 5.5V21"/><path d="M3 21h13"/><path d="M7 8h5"/><path d="M15 10h1.5a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V8.5L18.5 5.5"/>',
    pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    car: '<path d="M5 17H4a1 1 0 0 1-1-1v-3.2a2 2 0 0 1 .4-1.2L6 8a2 2 0 0 1 1.6-.8h8.8A2 2 0 0 1 18 8l2.6 3.6a2 2 0 0 1 .4 1.2V16a1 1 0 0 1-1 1h-1"/><path d="M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M4 12h16"/>',
    sliders:
      '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    archive:
      '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v10.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V8"/><path d="M10 12h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    panel:
      '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/><path d="m15.5 10-2 2 2 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause:
      '<rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="m14 7 3 3"/>',
    trash:
      '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
    swap: '<path d="M7 20V4"/><path d="m3 8 4-4 4 4"/><path d="M17 4v16"/><path d="m21 16-4 4-4-4"/>',
    swapH:
      '<path d="M4 7h16"/><path d="m16 3 4 4-4 4"/><path d="M20 17H4"/><path d="m8 13-4 4 4 4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    gauge:
      '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.3"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    calendar:
      '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 13h18"/>',
    dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    heart:
      '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    refresh:
      '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    speed: '<path d="M3.5 16a8.5 8.5 0 0 1 17 0"/><path d="m12 16 5-5"/>',
    wallet:
      '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>',
    shield:
      '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    drop: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
    keyboard:
      '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
    dots: '<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>',
    folder:
      '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2.2 2.5h7.3A2.5 2.5 0 0 1 21 10v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18z"/>',
  };
  const icon = (n, s = 18) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const kindIcon = (k) =>
    ({ home: 'home', work: 'briefcase', gym: 'dumbbell', family: 'heart' })[k] || 'pin';
  const tagHTML = (t) =>
    `<span class="tag ${t === 'Personal' ? 'personal' : 'trabajo'}">${esc(t)}</span>`;

  /* ================= Almacenamiento ================= */
  const DATA_VERSION = 2,
    KEY = 'trayecto:v2',
    KEY_V1 = 'trayecto:v1';
  const Store = {
    ok: false,
    mem: null,
    legacy: false,
    init() {
      try {
        const k = '__trayecto_test';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        this.ok = true;
      } catch (e) {
        this.ok = false;
      }
    },
    load() {
      if (this.ok) {
        try {
          const s = localStorage.getItem(KEY);
          if (s) return JSON.parse(s);
          const old = localStorage.getItem(KEY_V1);
          if (old) {
            const o = JSON.parse(old);
            this.legacy = true;
            return o;
          }
          return null;
        } catch (e) {
          return this.mem ? JSON.parse(this.mem) : null;
        }
      }
      return this.mem ? JSON.parse(this.mem) : null;
    },
    /* se serializa una sola vez (con 500 viajes son ~1.6 MB); la copia en memoria es ese mismo texto */
    save(d) {
      const j = JSON.stringify(d);
      this.mem = j;
      if (this.ok) {
        try {
          localStorage.setItem(KEY, j);
        } catch (e) {
          this.ok = false;
        }
      }
    },
    /* Borra la clave v1 solo cuando los datos migrados ya quedaron guardados en la v2 */
    retireLegacy(d) {
      if (!this.legacy || !this.ok) return;
      try {
        if (localStorage.getItem(KEY) === JSON.stringify(d)) localStorage.removeItem(KEY_V1);
      } catch (e) {}
      this.legacy = false;
    },
  };

  /* ================= Datos de ejemplo ================= */
  const PALETTE = ['#FFB020', '#6CA8FF', '#C3A6FF', '#3DDC97', '#FF8A65', '#4DD0E1'];
  /* Coordenadas reales (CDMX) de los lugares de ejemplo, por nombre normalizado. x/y = posición que tenían en el mapa SVG de la v1: solo sirven para reconocerlos al migrar */
  const SEED_GEO = {
    casa: { lat: 19.32, lng: -99.11, x: 500, y: 430 },
    oficina: { lat: 19.4, lng: -99.14, x: 300, y: 175 },
    gimnasio: { lat: 19.35, lng: -99.12, x: 420, y: 330 },
    'casa de mis papas': { lat: 19.48, lng: -99.19, x: 135, y: 58 },
    'cliente santa fe': { lat: 19.34, lng: -99.21, x: 88, y: 300 },
  };
  function validGeo(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }
  function rng32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Ruta tipo calle entre dos lugares con lat/lng: tramos ortogonales, 20–60 puntos {lat,lng,t,speed}.
   Determinista por id de viaje; el promedio de speed coincide con la velocidad del viaje. Sin coordenadas en algún extremo devuelve [] */
  function tripPoints(t, places) {
    const byName = (n) => places.find((p) => norm(p.name) === norm(n));
    const a = byName(t.origin),
      b = byName(t.destination);
    if (!a || !b || !validGeo(a.lat, a.lng) || !validGeo(b.lat, b.lng)) return [];
    const rnd = rng32(hashStr('trayecto-ruta|' + t.id));
    const A = { lat: a.lat, lng: a.lng },
      B = { lat: b.lat, lng: b.lng };
    const kx = 111.32 * Math.cos((A.lat * Math.PI) / 180),
      ky = 111.2;
    const km = (p, q) => Math.hypot((q.lng - p.lng) * kx, (q.lat - p.lat) * ky);
    const lerp = (p, q, f) => ({
      lat: p.lat + (q.lat - p.lat) * f,
      lng: p.lng + (q.lng - p.lng) * f,
    });
    const dx = (B.lng - A.lng) * kx,
      dy = (B.lat - A.lat) * ky;
    let way = [A];
    if (Math.hypot(dx, dy) < 0.15) {
      const w = 0.004 * (1 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1),
        h = 0.003 * (1 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1);
      way.push(
        { lat: A.lat, lng: A.lng + w },
        { lat: A.lat + h, lng: A.lng + w },
        { lat: A.lat + h, lng: A.lng },
        B,
      );
    } else {
      const hFirst = Math.abs(dx) >= Math.abs(dy) ? rnd() < 0.75 : rnd() < 0.25,
        steps = 2 + Math.floor(rnd() * 3);
      const split = () => {
        const w = Array.from({ length: steps }, () => 0.35 + rnd()),
          s = sum(w);
        return w.map((x) => x / s);
      };
      const fh = split(),
        fv = split();
      let lat = A.lat,
        lng = A.lng;
      for (let i = 0; i < steps; i++)
        for (const ax of hFirst ? 'hv' : 'vh') {
          if (ax === 'h') lng += (B.lng - A.lng) * fh[i];
          else lat += (B.lat - A.lat) * fv[i];
          way.push({ lat, lng });
        }
      way[way.length - 1] = B;
      if (Math.min(Math.abs(dx), Math.abs(dy)) < 0.6) {
        /* trazo casi recto: un desvío a una calle paralela */
        let j = 0,
          best = -1;
        for (let i = 0; i < way.length - 1; i++) {
          const l = km(way[i], way[i + 1]);
          if (l > best) {
            best = l;
            j = i;
          }
        }
        if (best >= 0.8) {
          const u = way[j],
            v = way[j + 1],
            o = (0.25 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1);
          const horiz = Math.abs(v.lng - u.lng) * kx > Math.abs(v.lat - u.lat) * ky;
          const off = (p) =>
            horiz ? { lat: p.lat + o / ky, lng: p.lng } : { lat: p.lat, lng: p.lng + o / kx };
          const s1 = lerp(u, v, 0.3),
            s3 = lerp(u, v, 0.7);
          way.splice(j + 1, 0, s1, off(s1), off(s3), s3);
        }
      }
    }
    const w2 = [way[0]];
    for (let i = 1; i < way.length - 1; i++)
      if (km(w2[w2.length - 1], way[i]) > 0.03) w2.push(way[i]);
    w2.push(way[way.length - 1]);
    const legs = w2.slice(1).map((p, i) => km(w2[i], p)),
      L = sum(legs) || 1;
    const kmT = Math.max(0, +t.odoEnd - +t.odoStart);
    const N = Math.max(w2.length, Math.min(60, Math.max(20, Math.round(12 + kmT * 1.6)))),
      E = N - w2.length;
    const raw = legs.map((l) => (E * l) / L),
      cnt = raw.map(Math.floor);
    raw
      .map((r, i) => [r - cnt[i], i])
      .sort((p, q) => q[0] - p[0] || p[1] - q[1])
      .slice(0, E - sum(cnt))
      .forEach(([, i]) => cnt[i]++);
    const pts = [{ ...w2[0] }];
    legs.forEach((_, j) => {
      const m = cnt[j];
      for (let k = 1; k <= m; k++) {
        const p = lerp(w2[j], w2[j + 1], (k + (rnd() - 0.5) * 0.5) / (m + 1));
        p.lat += (rnd() - 0.5) * 2.4e-5;
        p.lng += (rnd() - 0.5) * 2.4e-5;
        pts.push(p);
      }
      pts.push({ ...w2[j + 1] });
    });
    const n = pts.length;
    /* perfil de velocidad: arranca y frena despacio, ruido suave y algunos semáforos */
    const r = [],
      slow = new Set();
    let nz = 1;
    for (let k = 0, c = 1 + Math.floor(n / 14); k < c; k++)
      slow.add(2 + Math.floor(rnd() * (n - 4)));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      nz = 0.55 * nz + 0.45 * (0.6 + rnd() * 0.8);
      r.push(
        Math.max(0.05, Math.min(1, 0.2 + 4 * Math.min(u, 1 - u)) * nz * (slow.has(i) ? 0.3 : 1)),
      );
    }
    /* tiempos: de la hora de salida a la de llegada, repartidos según distancia ÷ velocidad relativa */
    const s0 = parseDate(t.date),
      dm = toMin(t.depart);
    s0.setHours(Math.floor(dm / 60), dm % 60, 0, 0);
    let dur = toMin(t.arrive) - dm;
    if (dur <= 0) dur += 1440;
    const T0 = s0.getTime(),
      cum = [0];
    for (let i = 1; i < n; i++)
      cum.push(
        cum[i - 1] + (km(pts[i - 1], pts[i]) + 0.005) / Math.max(0.05, (r[i - 1] + r[i]) / 2),
      );
    /* velocidades en décimas de km/h, ajustadas para que su promedio sea exactamente el del viaje */
    const target = kmT / (dur / 60),
      mr = sum(r) / n,
      sp = r.map((x) => Math.round((x / mr) * target * 10));
    let diff = Math.round(target * n * 10) - sum(sp);
    for (let i = 0, g = n * 60; diff !== 0 && g > 0; i++, g--) {
      const j = 1 + (i % (n - 2)),
        st = Math.sign(diff);
      if (sp[j] + st >= 0) {
        sp[j] += st;
        diff -= st;
      }
    }
    return pts.map((p, i) => ({
      lat: +p.lat.toFixed(5),
      lng: +p.lng.toFixed(5),
      t: new Date(
        i === n - 1 ? T0 + dur * 60000 : T0 + Math.round((cum[i] / cum[n - 1]) * dur * 60) * 1000,
      )
        .toISOString()
        .replace('.000Z', 'Z'),
      speed: sp[i] / 10,
    }));
  }
  /* Puntos válidos de un respaldo: descarta los inválidos y ordena por tiempo; null si no es un arreglo */
  function cleanPoints(arr) {
    if (!Array.isArray(arr)) return null;
    return arr
      .filter(
        (p) =>
          p &&
          validGeo(p.lat, p.lng) &&
          typeof p.t === 'string' &&
          isFinite(Date.parse(p.t)) &&
          typeof p.speed === 'number' &&
          isFinite(p.speed) &&
          p.speed >= 0,
      )
      .map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, speed: p.speed }))
      .sort((p, q) => Date.parse(p.t) - Date.parse(q.t));
  }
  /* Conserva los puntos guardados si son utilizables; si faltan, los genera (o [] si el viaje no tiene coordenadas).
   pointsSource: 'auto' = generados por la app (se regeneran al editar el viaje), 'imported' = ruta ajena (no se sobrescribe).
   Si el origen no se conoce, se compara con lo que generaría la app: idénticos → 'auto', distintos → 'imported' */
  function resolvePoints(t, raw, src, places) {
    const c = cleanPoints(raw);
    if (!c || c.length < 2) return { points: tripPoints(t, places), pointsSource: 'auto' };
    if (src !== 'auto' && src !== 'imported')
      src = JSON.stringify(c) === JSON.stringify(tripPoints(t, places)) ? 'auto' : 'imported';
    return { points: c, pointsSource: src };
  }
  /* Lugar saneado. Los lugares con lat/lng no guardan x/y (se proyectan); sin coordenadas conservan su posición estimada */
  function cleanPlace(p, legacy) {
    const name = String(p.name),
      sg = SEED_GEO[norm(name)];
    let lat = null,
      lng = null;
    if (validGeo(p.lat, p.lng)) {
      lat = p.lat;
      lng = p.lng;
    } else if (
      legacy &&
      sg &&
      (!fin(p.x) || (Math.abs(p.x - sg.x) < 1 && Math.abs(p.y - sg.y) < 1))
    ) {
      lat = sg.lat;
      lng = sg.lng;
    }
    const o = {
      id: String(p.id || uid('p')),
      name,
      area: String(p.area || ''),
      lat,
      lng,
      kind: String(p.kind || 'other'),
    };
    if (lat == null && fin(p.x) && fin(p.y)) {
      o.x = +p.x;
      o.y = +p.y;
    }
    return o;
  }
  /* Rendimiento de la computadora del auto (opcional por viaje): se guarda normalizado en km/L (computerKmpl) y la unidad original (computerUnit) solo sirve para mostrarlo como se capturó.
   Fuera de 3–40 km/L (2.5–33.3 L/100 km) se descarta. Se usa al normalizar, importar y validar para que nunca haya valores absurdos */
  const CK_MIN = 3,
    CK_MAX = 40;
  function cleanComputer(k, u) {
    const v = k == null || k === '' ? NaN : +k;
    return v >= CK_MIN && v <= CK_MAX
      ? { computerKmpl: +v.toFixed(4), computerUnit: u === 'l100' ? 'l100' : 'kmpl' }
      : { computerKmpl: null, computerUnit: null };
  }
  function seed() {
    const T = startOfToday(),
      d = (a) => isoDate(addDays(T, -a));
    const vehicles = [
      {
        id: 'v1',
        name: 'Mazda 3 Sedán',
        year: 2021,
        plate: 'NXR-482-A',
        fuel: 'Magna',
        tank: 51,
        color: '#FFB020',
      },
      {
        id: 'v2',
        name: 'Nissan March',
        year: 2019,
        plate: 'PLM-217-B',
        fuel: 'Magna',
        tank: 41,
        color: '#6CA8FF',
      },
    ];
    const geo = (n) => ({ lat: SEED_GEO[norm(n)].lat, lng: SEED_GEO[norm(n)].lng });
    const places = [
      { id: 'p1', name: 'Casa', area: 'Coyoacán', ...geo('Casa'), kind: 'home' },
      { id: 'p2', name: 'Oficina', area: 'Polanco', ...geo('Oficina'), kind: 'work' },
      { id: 'p3', name: 'Gimnasio', area: 'Del Valle', ...geo('Gimnasio'), kind: 'gym' },
      {
        id: 'p4',
        name: 'Casa de mis papás',
        area: 'Ciudad Satélite',
        ...geo('Casa de mis papás'),
        kind: 'family',
      },
      {
        id: 'p5',
        name: 'Cliente Santa Fe',
        area: 'Santa Fe',
        ...geo('Cliente Santa Fe'),
        kind: 'work',
      },
    ];
    const TR = [
      [41, '08:05', 48, 'Casa', 'Oficina', 17.4, 'v1', 'Trabajo', 48702],
      [38, '18:40', 52, 'Oficina', 'Casa', 17.9, 'v1', 'Trabajo', 48790],
      [34, '10:15', 72, 'Casa', 'Casa de mis papás', 31.2, 'v1', 'Personal', 48880],
      [33, '12:00', 22, 'Casa', 'Gimnasio', 6.1, 'v2', 'Personal', 61580],
      [30, '09:00', 38, 'Oficina', 'Cliente Santa Fe', 12.6, 'v1', 'Trabajo', 48990],
      [25, '07:55', 44, 'Casa', 'Oficina', 17.2, 'v1', 'Trabajo', 49120],
      [21, '19:20', 17, 'Casa', 'Gimnasio', 5.8, 'v1', 'Personal', 49240],
      [15, '08:10', 51, 'Casa', 'Oficina', 17.6, 'v1', 'Trabajo', 49380],
      [12, '16:30', 35, 'Gimnasio', 'Oficina', 11.2, 'v2', 'Trabajo', 61850],
      [8, '08:00', 46, 'Casa', 'Oficina', 17.3, 'v1', 'Trabajo', 49560],
      [6, '13:30', 55, 'Casa', 'Cliente Santa Fe', 20.4, 'v1', 'Trabajo', 49610],
      [4, '07:50', 43, 'Casa', 'Oficina', 17.1, 'v1', 'Trabajo', 49680],
      [3, '18:50', 58, 'Oficina', 'Casa', 18.2, 'v1', 'Trabajo', 49720],
      [2, '20:05', 16, 'Casa', 'Gimnasio', 5.9, 'v1', 'Personal', 49760],
      [1, '11:20', 74, 'Casa', 'Casa de mis papás', 30.8, 'v1', 'Personal', 49790],
    ];
    const trips = TR.map(([a, dep, dur, o, de, km, v, tag, odo], i) => ({
      id: 't' + (i + 1),
      date: d(a),
      depart: dep,
      arrive: fromMin(toMin(dep) + dur),
      origin: o,
      destination: de,
      odoStart: odo,
      odoEnd: +(odo + km).toFixed(1),
      vehicleId: v,
      tag,
    }));
    trips.forEach((t) => {
      t.points = tripPoints(t, places);
      t.pointsSource = 'auto';
    });
    const FU = [
      [100, 'Pemex Av. Universidad', 47640, 33.0, 23.69, true, 'v1'],
      [82, 'Shell Insurgentes Sur', 48080, 34.2, 23.89, true, 'v1'],
      [70, 'BP Río Churubusco', 61420, 28.0, 23.79, true, 'v2'],
      [64, 'G500 Miguel Ángel de Quevedo', 48360, 15.0, 24.05, false, 'v1'],
      [46, 'Pemex Av. Universidad', 48610, 26.8, 24.19, true, 'v1'],
      [28, 'Mobil Periférico Sur', 49055, 33.9, 24.29, true, 'v1'],
      [20, 'BP Río Churubusco', 61815, 26.3, 24.29, true, 'v2'],
      [10, 'Shell Insurgentes Sur', 49505, 35.6, 24.35, true, 'v1'],
    ];
    const fuel = FU.map(([a, st, odo, l, p, full, v], i) => ({
      id: 'f' + (i + 1),
      date: d(a),
      station: st,
      odometer: odo,
      liters: l,
      price: p,
      full,
      vehicleId: v,
    }));
    return {
      version: DATA_VERSION,
      vehicles,
      places,
      trips,
      fuel,
      settings: {
        defaultVehicle: 'v1',
        defaultTag: 'Trabajo',
        hints: true,
        lastBackup: null,
        computerUnit: 'kmpl',
      },
      ui: {},
    };
  }
  /* v1 → v2: asigna lat/lng a los lugares de ejemplo (por nombre) y genera los points que faltan; no borra nada.
   También completa pointsSource en los viajes v2 que aún no lo tienen */
  function migrate(d) {
    if (!d) return d;
    const old = (+d.version || 1) < DATA_VERSION,
      ok = (s) => s === 'auto' || s === 'imported';
    if (!old && !(Array.isArray(d.trips) && d.trips.some((t) => t && !ok(t.pointsSource))))
      return d;
    const places = old
      ? (Array.isArray(d.places) ? d.places : [])
          .filter((p) => p && p.name)
          .map((p) => cleanPlace(p, true))
      : d.places;
    const trips = (Array.isArray(d.trips) ? d.trips : []).map((t) =>
      old || !ok(t.pointsSource)
        ? { ...t, ...resolvePoints(t, t.points, t.pointsSource, places) }
        : t,
    );
    return { ...d, version: DATA_VERSION, places, trips };
  }
  function normalize(d) {
    const o = Object.assign(
      {
        version: DATA_VERSION,
        vehicles: [],
        places: [],
        trips: [],
        fuel: [],
        settings: {},
        ui: {},
      },
      d || {},
    );
    o.places.forEach((p) => {
      if (p.lat === undefined) p.lat = null;
      if (p.lng === undefined) p.lng = null;
    });
    o.trips.forEach((t) => {
      if (!Array.isArray(t.points)) t.points = [];
      if (t.pointsSource !== 'auto' && t.pointsSource !== 'imported')
        t.pointsSource = t.points.length ? 'imported' : 'auto';
      Object.assign(t, cleanComputer(t.computerKmpl, t.computerUnit));
    });
    o.settings = Object.assign(
      {
        defaultVehicle: o.vehicles[0]?.id || null,
        defaultTag: 'Trabajo',
        hints: true,
        lastBackup: null,
        computerUnit: 'kmpl',
      },
      o.settings || {},
    );
    o.ui = Object.assign(
      {
        view: 'inicio',
        collapsed: false,
        q: '',
        sort: { key: 'date', dir: 'desc' },
        selTrip: null,
        ff: 'all',
        statTab: 'km',
        dashVeh: null,
        selPlace: null,
        selPair: null,
        placesLayer: 'lugares',
      },
      o.ui || {},
    );
    o.ui.tf = Object.assign({ tag: 'Todos', vehicle: 'all', from: '', to: '' }, o.ui.tf || {});
    o.ui.q = '';
    return o;
  }
  Store.init();
  let S = Store.load();
  if (!S || !Array.isArray(S.trips)) S = seed();
  else S = migrate(S);
  S = normalize(S);
  /* El archivo de datos (sección "Archivo de datos") se engancha aquí: save() escribe en localStorage al instante y avisa para que se programe la escritura al archivo */
  let afterSave = null;
  const save = () => {
    Store.save(S);
    if (afterSave) afterSave();
  };
  save();
  Store.retireLegacy(S);

  /* ================= Cálculos ================= */
  let D = { kmpl: {}, vs: {}, latestPrice: 24.3 };
  const tripDur = (t) => {
    let m = toMin(t.arrive) - toMin(t.depart);
    if (m <= 0) m += 1440;
    return m;
  };
  const tripKm = (t) => Math.max(0, +t.odoEnd - +t.odoStart);
  const tripSpeed = (t) => {
    const m = tripDur(t);
    return m ? tripKm(t) / (m / 60) : 0;
  };
  const tripKey = (t) => t.date + ' ' + t.depart;
  const tripsDesc = () => [...S.trips].sort((a, b) => tripKey(b).localeCompare(tripKey(a)));
  const vehById = (id) => S.vehicles.find((v) => v.id === id);
  const vehName = (id) => vehById(id)?.name || 'Sin vehículo';
  function derive() {
    const kmpl = {},
      vs = {};
    let lp = null,
      ld = '';
    for (const f of S.fuel) {
      if (f.date >= ld) {
        ld = f.date;
        lp = f.price;
      }
    }
    for (const v of S.vehicles) {
      const loads = S.fuel
        .filter((f) => f.vehicleId === v.id)
        .sort((a, b) => a.odometer - b.odometer);
      let last = null,
        acc = 0,
        first = null,
        lit = 0;
      for (const f of loads) {
        acc += +f.liters;
        if (f.full) {
          if (last == null) {
            first = f.odometer;
          } else if (f.odometer > last) {
            kmpl[f.id] = (f.odometer - last) / acc;
            lit += acc;
          }
          last = f.odometer;
          acc = 0;
        }
      }
      const byDate = [...loads].sort(
        (a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer,
      );
      const odo = Math.max(
        0,
        ...loads.map((f) => +f.odometer),
        ...S.trips.filter((t) => t.vehicleId === v.id).map((t) => +t.odoEnd),
      );
      vs[v.id] = {
        avg: first != null && last > first && lit > 0 ? (last - first) / lit : null,
        lastPrice: byDate[0]?.price ?? null,
        odo,
        loads,
      };
    }
    D = { kmpl, vs, latestPrice: lp ?? 24.3 };
  }
  const kmplOf = (vid) => D.vs[vid]?.avg || 12;
  const priceOf = (vid) => D.vs[vid]?.lastPrice || D.latestPrice;
  /* Con rendimiento de la computadora el viaje usa ese valor; sin él, el promedio del vehículo */
  const compOf = (t) => (t.computerKmpl > 0 ? t.computerKmpl : null);
  const tripKmpl = (t) => compOf(t) || kmplOf(t.vehicleId);
  const tripLiters = (t) => tripKm(t) / tripKmpl(t);
  const tripCost = (t) => tripLiters(t) * priceOf(t.vehicleId);
  const fmtComp = (t) =>
    t.computerUnit === 'l100'
      ? `${NF1.format(100 / t.computerKmpl)} L/100 km`
      : `${NF1.format(t.computerKmpl)} km/L`;
  /* Precisión de la computadora de un vehículo: promedio de los rendimientos capturados contra el real de las cargas de tanque lleno cuyo intervalo
   (desde la carga llena anterior) toca el periodo de esos viajes. Requiere ≥3 viajes con dato y al menos una carga con rendimiento calculado */
  function compAccuracy(vid) {
    const tr = S.trips.filter((t) => t.vehicleId === vid && compOf(t));
    if (tr.length < 3) return null;
    const from = tr.reduce((m, t) => (t.date < m ? t.date : m), tr[0].date),
      to = tr.reduce((m, t) => (t.date > m ? t.date : m), tr[0].date);
    const real = [];
    let prev = null;
    for (const f of D.vs[vid]?.loads || []) {
      if (!f.full) continue;
      if (prev && D.kmpl[f.id] != null && f.date >= from && prev.date <= to)
        real.push(D.kmpl[f.id]);
      prev = f;
    }
    if (!real.length) return null;
    const comp = mean(tr.map(compOf)),
      r = mean(real);
    return {
      n: tr.length,
      loads: real.length,
      comp,
      real: r,
      pct: ((comp - r) / r) * 100,
      from,
      to,
    };
  }
  function compAccHTML(vid, withName) {
    const a = compAccuracy(vid);
    if (!a) return '';
    const v = vehById(vid),
      ab = Math.abs(a.pct);
    const msg =
      ab < 0.5
        ? 'La computadora coincide con el real'
        : `La computadora marca ${NF0.format(ab)} % ${a.pct > 0 ? 'más' : 'menos'} que el real`;
    const rng =
      a.from === a.to
        ? fmtDate(a.from, { day: 'numeric', month: 'short' })
        : `${fmtDate(a.from, { day: 'numeric', month: 'short' })} – ${fmtDate(a.to, { day: 'numeric', month: 'short' })}`;
    return `<div class="comp-acc">${withName ? `<div class="veh-h" style="font-weight:600;margin-bottom:6px"><span class="dot" style="background:${esc(v.color)}"></span>${esc(v.name)}</div>` : `<div class="stat-label">${icon('gauge', 13)} Precisión de la computadora</div>`}<b>${msg}</b><small>Computadora ${NF1.format(a.comp)} km/L (${a.n} viajes) · Real ${NF1.format(a.real)} km/L (${a.loads} ${a.loads === 1 ? 'carga' : 'cargas'} de tanque lleno) · ${esc(rng)}</small></div>`;
  }
  const cpkOf = (vid) => (D.vs[vid]?.avg ? priceOf(vid) / D.vs[vid].avg : null);
  function lastMonths(n) {
    const d = new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ key: monthKey(x), label: MONTHS[x.getMonth()], long: MONTHS_L[x.getMonth()] });
    }
    return out;
  }
  function placeVisits() {
    const m = {};
    for (const p of S.places) {
      const n = norm(p.name);
      m[p.id] = S.trips.filter((t) => norm(t.origin) === n || norm(t.destination) === n).length;
    }
    return m;
  }
  function pairStats() {
    const m = new Map();
    for (const t of S.trips) {
      const k = norm(t.origin) + '→' + norm(t.destination);
      let o = m.get(k);
      if (!o) {
        o = { key: k, from: t.origin, to: t.destination, n: 0, min: 0, km: 0 };
        m.set(k, o);
      }
      o.n++;
      o.min += tripDur(t);
      o.km += tripKm(t);
    }
    return [...m.values()]
      .map((o) => ({ ...o, avgMin: o.min / o.n, avgKm: o.km / o.n }))
      .sort((a, b) => b.n - a.n || a.avgMin - b.avgMin);
  }

  /* ================= Mapas SVG ================= */
  const AVENUES = [
    {
      d: 'M118 0 C 150 110, 52 210, 62 320 S 160 480, 330 520',
      n: 'Periférico',
      w: 5,
      lx: 28,
      ly: 236,
    },
    {
      d: 'M262 140 C 330 84, 520 86, 590 168 S 612 360, 530 404 S 302 424, 248 342 S 196 206, 262 140Z',
      n: 'Circuito Interior',
      w: 3.4,
      lx: 470,
      ly: 104,
    },
    { d: 'M388 0 C 392 150, 404 300, 438 520', n: 'Insurgentes', w: 4, lx: 398, ly: 60 },
    { d: 'M0 268 C 250 262, 520 290, 800 262', n: 'Viaducto', w: 4, lx: 680, ly: 258 },
    { d: 'M90 120 L 320 196 L 540 236', n: 'Reforma', w: 3.4, lx: 160, ly: 132 },
    { d: 'M540 236 C 548 330, 568 420, 610 520', n: 'Tlalpan', w: 3.4, lx: 580, ly: 480 },
    { d: 'M0 372 C 200 378, 420 386, 800 420', n: 'Río Churubusco', w: 3, lx: 660, ly: 404 },
    { d: 'M660 0 C 650 140, 676 260, 720 520', n: 'Eje 3 Ote.', w: 2.6, lx: 670, ly: 40 },
  ];
  function mapBase(k = 1) {
    let s = '<rect x="0" y="0" width="800" height="520" fill="#0F0F12"/>';
    s +=
      '<ellipse cx="228" cy="214" rx="52" ry="30" fill="rgba(61,220,151,.06)"/><ellipse cx="468" cy="398" rx="26" ry="15" fill="rgba(61,220,151,.05)"/><path d="M0 468 C 120 450 180 500 260 520 L0 520Z" fill="rgba(108,168,255,.04)"/>';
    s += `<g stroke="rgba(255,255,255,.038)" stroke-width="${k}">`;
    for (let x = 14; x < 800; x += 28) s += `<path d="M${x} 0V520"/>`;
    for (let y = 14; y < 520; y += 28) s += `<path d="M0 ${y}H800"/>`;
    s += '</g><g fill="none" stroke-linecap="round">';
    for (const a of AVENUES)
      s += `<path d="${a.d}" stroke="#26262D" stroke-width="${(a.w * k).toFixed(2)}"/>`;
    s += `</g><g class="map-lbl" font-size="${(9.5 * k).toFixed(1)}">`;
    for (const a of AVENUES) if (a.lx != null) s += `<text x="${a.lx}" y="${a.ly}">${a.n}</text>`;
    return s + '</g>';
  }
  /* Proyección lineal lat/lng → lienzo SVG de 800×520 sobre el área urbana de la CDMX (estirada al lienzo, como el mapa estilizado) */
  const GEO_BOUNDS = { north: 19.53, south: 19.29, west: -99.28, east: -99.08 };
  function project(lat, lng) {
    const B = GEO_BOUNDS,
      c = (v, a, b) => Math.max(a, Math.min(b, v));
    return {
      x: Math.round(c(((lng - B.west) / (B.east - B.west)) * 800, 40, 760)),
      y: Math.round(c(((B.north - lat) / (B.north - B.south)) * 520, 34, 486)),
    };
  }
  /* Posición en el SVG: proyectada desde lat/lng; sin coordenadas, la posición estimada guardada (x/y) */
  function placeXY(p) {
    if (validGeo(p.lat, p.lng)) return project(p.lat, p.lng);
    return fin(p.x) && fin(p.y) ? { x: +p.x, y: +p.y } : null;
  }
  function placePos(name) {
    const p = S.places.find((p) => norm(p.name) === norm(name)),
      q = p && placeXY(p);
    if (q) return q;
    const h = hashStr(norm(name));
    return { x: 70 + (h % 660), y: 50 + ((h >>> 10) % 420) };
  }
  function routePts(oN, dN) {
    const a = placePos(oN),
      b = placePos(dN);
    const ks = [norm(oN), norm(dN)].sort();
    const rev = ks[0] !== norm(oN);
    const h = hashStr(ks.join('|'));
    const A = rev ? b : a,
      B = rev ? a : b;
    const f1 = 0.25 + (h % 20) / 100,
      f2 = 0.42 + ((h >>> 5) % 18) / 100,
      f3 = 0.62 + ((h >>> 11) % 22) / 100;
    const dx = B.x - A.x,
      dy = B.y - A.y;
    let pts;
    if (Math.hypot(dx, dy) < 6)
      pts = [
        A,
        { x: A.x + 42, y: A.y },
        { x: A.x + 42, y: A.y - 36 },
        { x: A.x, y: A.y - 36 },
        { x: A.x, y: A.y },
      ];
    else if (Math.abs(dy) > Math.abs(dx))
      pts = [
        A,
        { x: A.x, y: A.y + dy * f1 },
        { x: A.x + dx * f2, y: A.y + dy * f1 },
        { x: A.x + dx * f2, y: A.y + dy * f3 },
        { x: B.x, y: A.y + dy * f3 },
        B,
      ];
    else
      pts = [
        A,
        { x: A.x + dx * f1, y: A.y },
        { x: A.x + dx * f1, y: A.y + dy * f2 },
        { x: A.x + dx * f3, y: A.y + dy * f2 },
        { x: A.x + dx * f3, y: B.y },
        B,
      ];
    return rev ? pts.reverse() : pts;
  }
  function roundedPath(pts, r) {
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i],
        a = pts[i - 1],
        b = pts[i + 1];
      const la = Math.hypot(p.x - a.x, p.y - a.y) || 1,
        lb = Math.hypot(b.x - p.x, b.y - p.y) || 1;
      const rr = Math.min(r, la / 2, lb / 2);
      const s = { x: p.x + ((a.x - p.x) / la) * rr, y: p.y + ((a.y - p.y) / la) * rr },
        e = { x: p.x + ((b.x - p.x) / lb) * rr, y: p.y + ((b.y - p.y) / lb) * rr };
      d += ` L${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${l.x.toFixed(1)} ${l.y.toFixed(1)}`;
  }
  function routeMap(o, d, W, H) {
    const pts = routePts(o, d),
      xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const P = 62;
    let bx = Math.min(...xs) - P,
      by = Math.min(...ys) - P,
      bw = Math.max(...xs) - Math.min(...xs) + P * 2,
      bh = Math.max(...ys) - Math.min(...ys) + P * 2;
    const ar = W / H;
    if (bw / bh > ar) {
      const nh = bw / ar;
      by -= (nh - bh) / 2;
      bh = nh;
    } else {
      const nw = bh * ar;
      bx -= (nw - bw) / 2;
      bw = nw;
    }
    if (bw < 240) {
      const s = 240 / bw;
      bx -= (bw * s - bw) / 2;
      by -= (bh * s - bh) / 2;
      bw *= s;
      bh *= s;
    }
    if (bw <= 800) bx = Math.max(0, Math.min(bx, 800 - bw));
    if (bh <= 520) by = Math.max(0, Math.min(by, 520 - bh));
    const k = bw / W,
      path = roundedPath(pts, 14 * k),
      A = pts[0],
      B = pts[pts.length - 1];
    const others = S.places
      .filter((p) => norm(p.name) !== norm(o) && norm(p.name) !== norm(d))
      .map((p) => {
        const q = placePos(p.name);
        return `<circle cx="${q.x}" cy="${q.y}" r="${3.5 * k}" fill="#3A3A44"/><text x="${q.x}" y="${q.y - 8 * k}" text-anchor="middle" class="pin-lbl muted" font-size="${10 * k}">${esc(p.name)}</text>`;
      })
      .join('');
    const lbl = (p, t, dy) => {
      if (p.y + dy - by < 14 * k) dy = -dy + 10 * k;
      return `<text x="${p.x}" y="${p.y + dy}" text-anchor="middle" class="pin-lbl" font-size="${11.5 * k}" stroke="#0F0F12" stroke-width="${3.5 * k}" paint-order="stroke">${esc(t)}</text>`;
    };
    return `<svg viewBox="${bx.toFixed(1)} ${by.toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)}" width="${W}" height="${H}" role="img" aria-label="Mapa de la ruta de ${esc(o)} a ${esc(d)}">
    ${mapBase(k)}${others}
    <path d="${path}" fill="none" stroke="${ACC}" stroke-opacity=".16" stroke-width="${11 * k}" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="route-path" pathLength="1" d="${path}" fill="none" stroke="${ACC}" stroke-width="${3.2 * k}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${A.x}" cy="${A.y}" r="${6 * k}" fill="#0F0F12" stroke="#EDEDF0" stroke-width="${2.4 * k}"/>
    <circle cx="${B.x}" cy="${B.y}" r="${7 * k}" fill="${ACC}" class="pin-pulse"/>
    <circle cx="${B.x}" cy="${B.y}" r="${7 * k}" fill="${ACC}" stroke="#0F0F12" stroke-width="${2.4 * k}"/>
    ${lbl(A, o, -12 * k)}${lbl(B, d, -14 * k)}
  </svg>`;
  }
  function placesMap(vis, pairs) {
    const k = 1.15,
      selP = S.places.find((p) => p.id === S.ui.selPlace),
      selPair = pairs.find((p) => p.key === S.ui.selPair);
    let s = `<svg viewBox="0 0 800 520" role="group" aria-label="Mapa estilizado con ${S.places.length} lugares">${mapBase(k)}`;
    for (const pr of pairs) {
      if (pr === selPair) continue;
      const rel = selP && (norm(pr.from) === norm(selP.name) || norm(pr.to) === norm(selP.name));
      if (!rel && pr.n < 2) continue;
      s += `<path d="${roundedPath(routePts(pr.from, pr.to), 14)}" fill="none" stroke="${rel ? 'rgba(255,176,32,.6)' : 'rgba(255,255,255,.15)'}" stroke-width="${(rel ? 2.4 : 1.6) * k}" ${rel ? '' : `stroke-dasharray="${4 * k} ${5 * k}"`} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (selPair) {
      const d = roundedPath(routePts(selPair.from, selPair.to), 14);
      s += `<path d="${d}" fill="none" stroke="${ACC}" stroke-opacity=".18" stroke-width="${12 * k}" stroke-linecap="round" stroke-linejoin="round"/><path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="${3.4 * k}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    for (const p of S.places) {
      const q = placePos(p.name),
        v = vis[p.id] || 0,
        r = (5.5 + Math.min(9, v * 0.75)) * k * 0.9;
      const sel =
        p.id === S.ui.selPlace ||
        (selPair && (norm(selPair.from) === norm(p.name) || norm(selPair.to) === norm(p.name)));
      s += `<g class="pin" id="pin-${p.id}" role="button" tabindex="0" aria-label="${esc(p.name)}, ${v} visitas" aria-pressed="${!!sel}" data-action="place-select" data-id="${p.id}" transform="translate(${q.x} ${q.y})">
      ${sel ? `<circle r="${r}" fill="${ACC}" class="pin-pulse"/>` : ''}
      <circle r="${r + 6 * k}" fill="rgba(255,176,32,${sel ? 0.18 : 0.08})"/>
      <circle class="pin-dot" r="${r}" fill="${sel ? ACC : '#1C1C21'}" stroke="${ACC}" stroke-width="${2.2 * k}"/>
      <text y="${r + 16 * k}" text-anchor="middle" class="pin-lbl" font-size="${12 * k}" stroke="#0F0F12" stroke-width="${3.5 * k}" paint-order="stroke">${esc(p.name)}</text>
    </g>`;
    }
    return s + '</svg>';
  }

  /* ================= Mapas con MapLibre ================= */
  /* Los mapas de ruta (Inicio, detalle del viaje, resumen) nacen como el SVG de siempre con atributos data-tmap;
   después de cada render, mountMaps() monta encima un mapa MapLibre. Si la librería, el estilo o los mosaicos
   no responden en 5 s, queda el SVG con el aviso "Mapa sin conexión". */
  const ML = {
    base: 'https://unpkg.com/maplibre-gl@5.7.0/dist/',
    style: 'https://tiles.openfreemap.org/styles/dark',
    timeout: 5000,
    firstTimeout: 8000 /* el primer mapa (aún sin librería ni estilo) espera 8 s; los siguientes 5 s */,
    jsSri: 'sha384-Blts4zGbI8Hh/NvhcxTYsF2uLBbYIwHXEhPMxN3XpadJCDgstyLfJA3opgmkfBOc',
    cssSri: 'sha384-gNYNsUmuZqDYiT3gbirWTV5K7rt71RoveS/yXAaU09d4ZUmeDVTD3XoqB6uJAIFR',
  };
  const MapLib = { p: null, style: null, failedAt: 0 };
  /* Al destruir un mapa con mosaicos en vuelo, MapLibre registra un AbortError inofensivo: se omite para no ensuciar la consola */
  (() => {
    const ce = console.error;
    console.error = function (e, ...r) {
      if (e && e.name === 'AbortError') return;
      return ce.call(console, e, ...r);
    };
  })();
  const MapReg =
    []; /* una entrada por contenedor de mapa vivo: {root,slot,tripId,key,mode,ph,host,map,state} */
  const mapsOffline = () => MapLib.failedAt && Date.now() - MapLib.failedAt < 30000;
  function mapAssets() {
    if (window.maplibregl && MapLib.style) return Promise.resolve();
    if (mapsOffline()) return Promise.reject(new Error('offline'));
    if (MapLib.p) return MapLib.p;
    const lib = new Promise((res, rej) => {
      if (window.maplibregl) return res();
      const l = document.createElement('link'),
        s = document.createElement('script');
      let done = false;
      l.rel = 'stylesheet';
      l.href = ML.base + 'maplibre-gl.css';
      l.integrity = ML.cssSri;
      l.crossOrigin = 'anonymous';
      s.src = ML.base + 'maplibre-gl.js';
      s.integrity = ML.jsSri;
      s.crossOrigin = 'anonymous';
      const bad = () => {
        if (done) return;
        done = true;
        l.remove();
        s.remove();
        rej(new Error('maplibre'));
      };
      s.onload = () => {
        if (done) return;
        if (window.maplibregl) {
          done = true;
          res();
        } else bad();
      };
      s.onerror = bad;
      l.onerror = bad;
      document.head.append(l, s);
    });
    const style = fetch(
      ML.style,
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(ML.firstTimeout) }
        : {},
    )
      .then((r) => {
        if (!r.ok) throw new Error('style');
        return r.json();
      })
      .then((j) => {
        const bg = j.layers.find((l) => l.type === 'background');
        if (bg) bg.paint['background-color'] = '#0F0F12';
        MapLib.style = j;
      });
    const p = (MapLib.p = Promise.all([lib, style]).then(
      () => {
        MapLib.p = null;
      },
      (e) => {
        MapLib.p = null;
        MapLib.failedAt = Date.now();
        throw e;
      },
    ));
    return p;
  }
  /* Marcador de posición de un mapa de viaje; sin points válidos devuelve solo el SVG */
  function tripMapHTML(t, W, H, slot, mode) {
    const svg = routeMap(t.origin, t.destination, W, H),
      pts = Array.isArray(t.points) ? t.points : [];
    if (pts.length < 2) return `<div class="map">${svg}</div>`;
    return `<div class="map" data-tmap="${esc(t.id)}" data-key="${hashStr(JSON.stringify(pts))}" data-slot="${slot}" data-mode="${mode}">${svg}</div>`;
  }
  /* Antes de reemplazar el HTML de un contenedor: saca los mapas del DOM sin destruirlos (se reclaman o se eliminan en mountMaps) */
  function parkMaps(root) {
    for (const m of MapReg) if (m.root === root) m.host.remove();
  }
  function destroyMap(m) {
    m.dead = true;
    clearTimeout(m.timer);
    try {
      m.map && m.map.remove();
    } catch (_) {}
    m.map = null;
    m.host.remove();
    const i = MapReg.indexOf(m);
    if (i >= 0) MapReg.splice(i, 1);
  }
  /* Después de reemplazar el HTML: reutiliza la instancia si el contenedor muestra el mismo viaje y ruta, elimina las que ya no
   hacen falta (así nunca se acumulan contextos WebGL) y crea solo las nuevas */
  function mountMaps(root) {
    const claimed = new Set(),
      todo = [];
    for (const ph of $$('[data-tmap],[data-pmap]', root)) {
      const m = MapReg.find(
        (x) =>
          x.root === root &&
          !x.host.isConnected &&
          !claimed.has(x) &&
          x.slot === ph.dataset.slot &&
          x.tripId === (ph.dataset.tmap || '') &&
          x.key === ph.dataset.key &&
          x.mode === ph.dataset.mode,
      );
      if (!m) {
        todo.push(ph);
        continue;
      }
      claimed.add(m);
      m.ph = ph;
      if (m.state === 'failed') mapNote(ph);
      else {
        ph.appendChild(m.host);
        if (m.map) m.map.resize();
        if (m.kind === 'places' && m.state === 'ready') hideSvgPins(ph);
        if (m.loaded)
          m.kind === 'places'
            ? refreshPlaces(m)
            : applyPlay(m); /* el mapa de lugares se actualiza en su sitio, sin recrearlo */
      }
    }
    for (const m of [...MapReg])
      if (m.root === root && !m.host.isConnected && !claimed.has(m)) destroyMap(m);
    todo.forEach((ph) => startMap(ph, root));
  }
  function mapNote(ph) {
    if (!ph.querySelector('.map-note'))
      ph.insertAdjacentHTML('beforeend', '<span class="map-note">Mapa sin conexión</span>');
  }
  function failMap(m) {
    if (m.dead || m.state !== 'pending') return;
    m.state = 'failed';
    clearTimeout(m.timer);
    MapLib.failedAt = Date.now();
    try {
      m.map && m.map.remove();
    } catch (_) {}
    m.map = null;
    m.host.remove();
    if (m.ph && m.ph.isConnected) mapNote(m.ph);
  }
  function startMap(ph, root) {
    const isP = ph.hasAttribute('data-pmap'),
      t = isP ? null : S.trips.find((x) => x.id === ph.dataset.tmap);
    if (!isP && !t) return;
    const m = {
      root,
      kind: isP ? 'places' : 'trip',
      slot: ph.dataset.slot,
      tripId: isP ? '' : t.id,
      key: ph.dataset.key,
      mode: ph.dataset.mode,
      ph,
      host: document.createElement('div'),
      map: null,
      state: 'pending',
      dead: false,
      timer: 0,
      pts: t ? t.points : null,
      o: t?.origin,
      d: t?.destination,
    };
    m.host.className = 'tm-host';
    MapReg.push(m);
    if (mapsOffline()) {
      m.state = 'failed';
      mapNote(ph);
      return;
    }
    ph.appendChild(m.host);
    m.timer = setTimeout(
      () => failMap(m),
      window.maplibregl && MapLib.style ? ML.timeout : ML.firstTimeout,
    );
    mapAssets().then(
      () => {
        if (!m.dead && m.state === 'pending') buildMap(m);
      },
      () => failMap(m),
    );
  }
  function speedColor(v) {
    const st = [
      [0, [255, 107, 107]],
      [20, [255, 176, 32]],
      [40, [61, 220, 151]],
    ];
    if (v <= st[0][0]) return `rgb(${st[0][1]})`;
    for (let i = 1; i < st.length; i++)
      if (v <= st[i][0]) {
        const [a, ca] = st[i - 1],
          [b, cb] = st[i],
          f = (v - a) / (b - a);
        return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f))})`;
      }
    return `rgb(${st[st.length - 1][1]})`;
  }
  const smoothSpeeds = (pts) =>
    pts.map((p, i) => mean(pts.slice(Math.max(0, i - 3), i + 4).map((q) => q.speed)));
  /* line-gradient: color por velocidad (suavizada) en cada parada de line-progress = distancia acumulada / distancia total */
  function speedGradient(pts) {
    const kx = 111.32 * Math.cos((pts[0].lat * Math.PI) / 180),
      n = pts.length,
      cum = [0];
    for (let i = 1; i < n; i++)
      cum.push(
        cum[i - 1] +
          Math.hypot((pts[i].lng - pts[i - 1].lng) * kx, (pts[i].lat - pts[i - 1].lat) * 111.2),
      );
    const tot = cum[n - 1],
      sp = smoothSpeeds(pts);
    const stops = [];
    let last = -1;
    pts.forEach((p, i) => {
      const f = i === 0 ? 0 : i === n - 1 ? 1 : cum[i] / (tot || 1);
      if (f > last + 1e-6) {
        stops.push(f, speedColor(sp[i]));
        last = f;
      }
    });
    if (stops.length < 4) return ['interpolate', ['linear'], ['line-progress'], 0, ACC, 1, ACC];
    return ['interpolate', ['linear'], ['line-progress'], ...stops];
  }
  function revealMap(m) {
    if (m.dead || m.state !== 'pending') return;
    clearTimeout(m.timer);
    m.state = 'ready';
    MapLib.failedAt = 0;
    m.host.classList.add('on');
    if (m.kind === 'places') hideSvgPins(m.ph);
  }
  function buildMap(m) {
    if (m.kind === 'places') return buildPlacesMap(m);
    const pts = m.pts,
      reduce = matchMedia('(prefers-reduced-motion: reduce)').matches,
      live = m.mode === 'interactive';
    const bounds = boundsOf(pts.map(llOf));
    const pad = Math.max(16, Math.min(46, Math.round((m.host.clientHeight || 160) * 0.16)));
    const fit = {
      padding: { top: pad + 12, bottom: pad, left: pad + 10, right: pad + 10 },
      maxZoom: 16,
    };
    let map;
    try {
      map = new maplibregl.Map({
        container: m.host,
        style: structuredClone(MapLib.style),
        bounds,
        fitBoundsOptions: fit,
        interactive: live,
        attributionControl: { compact: true },
        fadeDuration: reduce ? 0 : 200,
        maxPitch: 0,
        dragRotate: false,
        renderWorldCopies: false,
      });
    } catch (e) {
      failMap(m);
      return;
    }
    m.map = map;
    if (live) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.touchZoomRotate.disableRotation();
    }
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    }); /* el estilo pide un patrón que su sprite no trae */
    map.on(
      'error',
      () => {},
    ); /* un mosaico o ícono suelto que falle no invalida el mapa; si no termina de cargar, el temporizador de 5 s activa el SVG */
    map.on('load', () => {
      if (m.dead || m.state !== 'pending') return;
      clearTimeout(
        m.timer,
      ); /* 'load' = estilo y mosaicos descargados: el límite de 5 s ya no aplica, solo falta pintar */
      m.loaded = true;
      map.resize();
      map.fitBounds(bounds, { ...fit, duration: 0 });
      const at = m.host.querySelector('.maplibregl-ctrl-attrib');
      if (at) {
        at.removeAttribute('open');
        at.classList.remove('maplibregl-compact-show');
      } /* atribución compacta: solo el botón (i) hasta que se abre */
      const below = map.getStyle().layers.find((l) => l.type === 'symbol')?.id,
        cap = { 'line-cap': 'round', 'line-join': 'round' };
      map.addSource('route', {
        type: 'geojson',
        lineMetrics: true,
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) },
        },
      });
      map.addLayer(
        {
          id: 'route-halo',
          type: 'line',
          source: 'route',
          layout: cap,
          paint: {
            'line-color': ACC,
            'line-width': live ? 16 : 13,
            'line-blur': 10,
            'line-opacity': 0.34,
          },
        },
        below,
      );
      map.addLayer(
        {
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: cap,
          paint: { 'line-width': live ? 4.2 : 3.4, 'line-gradient': speedGradient(pts) },
        },
        below,
      );
      const pin = (cls, p, name) => {
        const el = document.createElement('div');
        el.className = 'tm-pin ' + cls;
        el.innerHTML =
          (cls === 'tm-end' ? '<span class="tm-pulse"></span>' : '') +
          `<span class="tm-lbl">${esc(name)}</span>`;
        new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      };
      pin('tm-start', pts[0], m.o);
      pin('tm-end', pts[pts.length - 1], m.d);
      if (live) {
        m.host.insertAdjacentHTML(
          'beforeend',
          '<div class="tm-legend"><span>0</span><i></i><span>40+ km/h</span></div>',
        );
        /* capa de la reproducción: tramo recorrido sobre la ruta completa */
        m.ts = pts.map((p) => Date.parse(p.t));
        map.addSource('play', { type: 'geojson', data: EMPTY_FC });
        map.addLayer(
          {
            id: 'play-halo',
            type: 'line',
            source: 'play',
            layout: cap,
            paint: { 'line-color': ACC, 'line-width': 18, 'line-blur': 10, 'line-opacity': 0.5 },
          },
          below,
        );
        map.addLayer(
          {
            id: 'play-line',
            type: 'line',
            source: 'play',
            layout: cap,
            paint: { 'line-color': ACC, 'line-width': 4.8 },
          },
          below,
        );
      }
      map.once('idle', () => revealMap(m));
      setTimeout(() => revealMap(m), 2500);
      if (live) applyPlay(m);
    });
  }
  const EMPTY_FC = { type: 'FeatureCollection', features: [] };
  const llOf = (p) => [p.lng, p.lat];

  /* ---- Reproducción de ruta (detalle del viaje) ----
   El estado vive fuera del DOM (render() lo reemplaza todo): Play.t es la fracción del tiempo del viaje (0–1) */
  const Play = { id: null, t: 0, playing: false, active: false, speed: 1, raf: 0, last: 0 };
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* posición, hora y velocidad interpoladas en la fracción f del tiempo del viaje */
  function playAt(m, f) {
    const pts = m.pts,
      ts = m.ts,
      tt = ts[0] + (ts[ts.length - 1] - ts[0]) * f;
    let i = 0;
    while (i < pts.length - 2 && ts[i + 1] <= tt) i++;
    const a = pts[i],
      b = pts[i + 1],
      u = ts[i + 1] > ts[i] ? Math.max(0, Math.min(1, (tt - ts[i]) / (ts[i + 1] - ts[i]))) : 0;
    return {
      i,
      lat: a.lat + (b.lat - a.lat) * u,
      lng: a.lng + (b.lng - a.lng) * u,
      speed: a.speed + (b.speed - a.speed) * u,
      time: tt,
    };
  }
  function applyPlay(m) {
    if (m.kind !== 'trip' || m.mode !== 'interactive' || !m.map || !m.loaded) return;
    const src = m.map.getSource('play');
    if (!src) return;
    const on = Play.active && Play.id === m.tripId;
    if (on !== !!m.playOn) {
      /* atenúa la ruta completa mientras se dibuja el recorrido */
      m.playOn = on;
      m.map.setPaintProperty('route-line', 'line-opacity', on ? 0.28 : 1);
      m.map.setPaintProperty('route-halo', 'line-opacity', on ? 0.12 : 0.34);
    }
    if (!on) {
      src.setData(EMPTY_FC);
      if (m.playMarker) {
        m.playMarker.remove();
        m.playMarker = null;
      }
      return;
    }
    const c = playAt(m, Play.t);
    src.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [...m.pts.slice(0, c.i + 1).map(llOf), [c.lng, c.lat]],
      },
    });
    if (!m.playMarker) {
      const el = document.createElement('div');
      el.className = 'tm-pin tm-end';
      el.innerHTML = '<span class="tm-pulse"></span>';
      m.playMarker = new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m.map);
    } else m.playMarker.setLngLat([c.lng, c.lat]);
  }
  const applyPlayAll = () =>
    MapReg.forEach((m) => {
      if (m.kind === 'trip') applyPlay(m);
    });
  function playBarHTML(t) {
    if (!Array.isArray(t.points) || t.points.length < 2) return '';
    const me = Play.id === t.id,
      on = me && Play.playing;
    return `<div class="play-bar" data-play="${esc(t.id)}"><div class="play-row"><button class="play-btn" data-action="play-toggle" data-id="${esc(t.id)}" aria-label="${on ? 'Pausar' : 'Reproducir'} ruta" title="${on ? 'Pausar' : 'Reproducir ruta'}">${icon(on ? 'pause' : 'play', 16)}</button><input class="play-range" type="range" min="0" max="1000" value="${me ? Math.round(Play.t * 1000) : 0}" data-play-range="${esc(t.id)}" aria-label="Progreso de la ruta"><div class="seg" role="group" aria-label="Velocidad de reproducción">${[1, 4, 16].map((s) => `<button aria-pressed="${Play.speed === s}" data-action="play-speed" data-speed="${s}">×${s}</button>`).join('')}</div></div><div class="play-info" aria-live="off">Reproduce el recorrido del viaje</div></div>`;
  }
  /* actualiza la barra existente sin volver a renderizar */
  function updatePlayUI() {
    const bar = $('[data-play]', contentEl);
    if (!bar) return;
    const me = Play.id === bar.dataset.play,
      on = me && Play.playing,
      btn = $('.play-btn', bar);
    btn.innerHTML = icon(on ? 'pause' : 'play', 16);
    btn.setAttribute('aria-label', (on ? 'Pausar' : 'Reproducir') + ' ruta');
    btn.title = on ? 'Pausar' : 'Reproducir ruta';
    const r = $('.play-range', bar);
    if (me && document.activeElement !== r) r.value = Math.round(Play.t * 1000);
    $$('[data-action=play-speed]', bar).forEach((b) =>
      b.setAttribute('aria-pressed', String(+b.dataset.speed === Play.speed)),
    );
    const m = MapReg.find(
      (x) => x.kind === 'trip' && x.mode === 'interactive' && x.tripId === bar.dataset.play && x.ts,
    );
    const info = $('.play-info', bar);
    if (me && Play.active && m) {
      const c = playAt(m, Play.t);
      info.textContent = `${new Date(c.time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${NF0.format(c.speed)} km/h`;
    } else info.textContent = 'Reproduce el recorrido del viaje';
  }
  function playTick(now) {
    if (!Play.playing) return;
    Play.t = Math.min(1, Play.t + Math.min(100, now - Play.last) / (8000 / Play.speed));
    Play.last = now;
    if (Play.t >= 1) Play.playing = false;
    applyPlayAll();
    updatePlayUI();
    if (Play.playing) Play.raf = requestAnimationFrame(playTick);
  }
  function togglePlay(id) {
    if (Play.id !== id) Object.assign(Play, { id, t: 0, playing: false, active: false });
    cancelAnimationFrame(Play.raf);
    if (Play.playing) Play.playing = false;
    else {
      Play.active = true;
      if (reduceMotion()) {
        Play.t = 1;
        Play.playing = false;
      } /* sin animación: salta al final */
      else {
        if (Play.t >= 1) Play.t = 0;
        Play.playing = true;
        Play.last = performance.now();
        Play.raf = requestAnimationFrame(playTick);
      }
    }
    applyPlayAll();
    updatePlayUI();
  }
  function scrubPlay(id, v) {
    if (Play.id !== id) Object.assign(Play, { id });
    cancelAnimationFrame(Play.raf);
    Play.playing = false;
    Play.active = true;
    Play.t = v / 1000;
    applyPlayAll();
    updatePlayUI();
  }
  /* Se llama tras cada render: la reproducción se detiene y se libera si el viaje ya no está en el detalle */
  function syncPlay() {
    const bar = $('[data-play]', contentEl);
    if (Play.id && (!bar || bar.dataset.play !== Play.id)) {
      cancelAnimationFrame(Play.raf);
      Object.assign(Play, { id: null, t: 0, playing: false, active: false });
      applyPlayAll();
    }
  }

  /* ---- Mapa de lugares ---- */
  let Loc = null; /* modo ubicación: {id,lat,lng} del lugar que se está colocando o moviendo */
  function hideSvgPins(ph) {
    const s = ph.querySelector('svg');
    if (!s) return;
    s.setAttribute('aria-hidden', 'true');
    s.querySelectorAll('[tabindex]').forEach((e) => e.setAttribute('tabindex', '-1'));
  }
  /* viaje más reciente de un par origen→destino con ruta */
  function latestPairTrip(pair) {
    return S.trips
      .filter(
        (t) =>
          norm(t.origin) + '→' + norm(t.destination) === pair.key &&
          Array.isArray(t.points) &&
          t.points.length >= 2,
      )
      .sort((a, b) => tripKey(b).localeCompare(tripKey(a)))[0];
  }
  function pairLine(pair) {
    const t = latestPairTrip(pair);
    if (t) return t.points;
    const a = S.places.find((p) => norm(p.name) === norm(pair.from)),
      b = S.places.find((p) => norm(p.name) === norm(pair.to));
    return a && b && validGeo(a.lat, a.lng) && validGeo(b.lat, b.lng)
      ? [
          { lat: a.lat, lng: a.lng, speed: 20 },
          { lat: b.lat, lng: b.lng, speed: 20 },
        ]
      : null;
  }
  function buildPlacesMap(m) {
    const reduce = reduceMotion(),
      geo = S.places.filter((p) => validGeo(p.lat, p.lng));
    const opts = {
      container: m.host,
      style: structuredClone(MapLib.style),
      center: [-99.16, 19.4],
      zoom: 10,
      interactive: true,
      attributionControl: { compact: true },
      fadeDuration: reduce ? 0 : 200,
      maxPitch: 0,
      dragRotate: false,
      renderWorldCopies: false,
    };
    if (geo.length)
      ((opts.bounds = boundsOf(geo.map(llOf))),
        (opts.fitBoundsOptions = {
          padding: { top: 50, bottom: 64, left: 60, right: 60 },
          maxZoom: 14,
        }));
    let map;
    try {
      map = new maplibregl.Map(opts);
    } catch (e) {
      failMap(m);
      return;
    }
    m.map = map;
    m.markers = [];
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.touchZoomRotate.disableRotation();
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on('error', () => {});
    map.on('click', (e) => {
      /* modo ubicación: el clic coloca (o mueve) el pin */
      if (!Loc || e.originalEvent.target.closest('.tm-place,.tm-loc')) return;
      const ll = e.lngLat.wrap();
      Loc.lat = ll.lat;
      Loc.lng = ll.lng;
      render();
    });
    map.on('load', () => {
      if (m.dead || m.state !== 'pending') return;
      clearTimeout(
        m.timer,
      ); /* 'load' = estilo y mosaicos descargados: el límite de 5 s ya no aplica, solo falta pintar */
      m.loaded = true;
      map.resize();
      const at = m.host.querySelector('.maplibregl-ctrl-attrib');
      if (at) {
        at.removeAttribute('open');
        at.classList.remove('maplibregl-compact-show');
      }
      const below = map.getStyle().layers.find((l) => l.type === 'symbol')?.id,
        cap = { 'line-cap': 'round', 'line-join': 'round' };
      ['routes', 'heat', 'pairs'].forEach((id) =>
        map.addSource(id, { type: 'geojson', data: EMPTY_FC }),
      );
      map.addSource('pair-route', { type: 'geojson', lineMetrics: true, data: EMPTY_FC });
      map.addLayer(
        {
          id: 'heat',
          type: 'heatmap',
          source: 'heat',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 13, 1],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              7,
              12,
              16,
              15,
              34,
            ] /* se reescalan en refreshPlaces según la cantidad de points */,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(255,176,32,0)',
              0.2,
              'rgba(255,176,32,.22)',
              0.5,
              'rgba(255,176,32,.7)',
              0.8,
              '#FFB020',
              1,
              '#FFF1D6',
            ],
            'heatmap-opacity': 0.9,
          },
        },
        below,
      );
      map.addLayer(
        {
          id: 'routes-base',
          type: 'line',
          source: 'routes',
          layout: { ...cap, visibility: 'none' },
          paint: { 'line-color': ACC, 'line-width': 2.6, 'line-opacity': 0.2 },
        },
        below,
      );
      map.addLayer(
        {
          id: 'pairs-dash',
          type: 'line',
          source: 'pairs',
          layout: cap,
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 1.8,
            'line-opacity': 0.28,
            'line-dasharray': [2, 2.4],
          },
        },
        below,
      );
      map.addLayer(
        {
          id: 'routes-sel',
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'rel'], 1],
          layout: { ...cap, visibility: 'none' },
          paint: { 'line-color': ACC, 'line-width': 3, 'line-opacity': 0.85 },
        },
        below,
      );
      map.addLayer(
        {
          id: 'pair-halo',
          type: 'line',
          source: 'pair-route',
          layout: { ...cap, visibility: 'none' },
          paint: { 'line-color': ACC, 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.34 },
        },
        below,
      );
      map.addLayer(
        {
          id: 'pair-line',
          type: 'line',
          source: 'pair-route',
          layout: { ...cap, visibility: 'none' },
          paint: {
            'line-width': 4.2,
            'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, ACC, 1, ACC],
          },
        },
        below,
      );
      refreshPlaces(m, true);
      map.once('idle', () => revealMap(m));
      setTimeout(() => revealMap(m), 2500);
    });
  }
  function boundsOf(ll) {
    const xs = ll.map((p) => p[0]),
      ys = ll.map((p) => p[1]);
    return [
      [Math.min(...xs), Math.min(...ys)],
      [Math.max(...xs), Math.max(...ys)],
    ];
  }
  const tripSig = (t) =>
    t.id +
    ':' +
    t.points.length +
    ':' +
    t.points[0].t +
    ':' +
    t.points[t.points.length - 1].t +
    ':' +
    t.points[t.points.length - 1].lat +
    ':' +
    t.points[t.points.length - 1].lng;
  /* Aplica el estado actual (capa, lugar o trayecto seleccionado, modo ubicación) al mapa de lugares sin recrearlo */
  function refreshPlaces(m, first) {
    const map = m.map;
    if (!map || !m.loaded || m.dead) return;
    const layer = S.ui.placesLayer || 'lugares',
      selP = S.places.find((p) => p.id === S.ui.selPlace),
      nsel = selP ? norm(selP.name) : null;
    const vis = placeVisits(),
      pairs = pairStats(),
      selPair = pairs.find((p) => p.key === S.ui.selPair);
    const rel = (t) => !!nsel && (norm(t.origin) === nsel || norm(t.destination) === nsel);
    const withPts = S.trips.filter((t) => Array.isArray(t.points) && t.points.length >= 2);
    const set = (id, sig, build) => {
      if (m.sig?.[id] !== sig) {
        (m.sig || (m.sig = {}))[id] = sig;
        map.getSource(id).setData(build());
      }
    };
    set('routes', withPts.map((t) => tripSig(t) + rel(t)).join('|'), () => ({
      type: 'FeatureCollection',
      features: withPts.map((t) => ({
        type: 'Feature',
        properties: { rel: rel(t) ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: t.points.map(llOf) },
      })),
    }));
    set('heat', withPts.map(tripSig).join('|'), () => ({
      type: 'FeatureCollection',
      features: withPts.flatMap((t) =>
        t.points.map((p) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: llOf(p) },
        })),
      ),
    }));
    const freq = pairs.filter(
      (p) => p.n >= 2 && p !== selPair && !(nsel && (norm(p.from) === nsel || norm(p.to) === nsel)),
    );
    const fl = freq.map((p) => [p, pairLine(p)]).filter((x) => x[1]);
    set(
      'pairs',
      fl.map(([p, l]) => p.key + l.length + l[0].lat + l[l.length - 1].lng).join('|'),
      () => ({
        type: 'FeatureCollection',
        features: fl.map(([p, l]) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: l.map(llOf) },
        })),
      }),
    );
    const pl = selPair && pairLine(selPair);
    set(
      'pair-route',
      selPair ? selPair.key + (pl ? pl.length + pl[0].lat + pl[pl.length - 1].lng : '') : '',
      () =>
        pl
          ? { type: 'Feature', geometry: { type: 'LineString', coordinates: pl.map(llOf) } }
          : EMPTY_FC,
    );
    if (pl) map.setPaintProperty('pair-line', 'line-gradient', speedGradient(pl));
    const vs = (id, on) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vs('heat', layer === 'calor');
    vs('routes-base', layer === 'rutas');
    vs('pairs-dash', layer === 'lugares');
    vs('routes-sel', !!selP);
    vs('pair-halo', !!pl);
    vs('pair-line', !!pl);
    /* la densidad crece con el historial: con muchos points se baja el peso y el radio, con pocos se sube; lo mismo con la opacidad de las rutas */
    const np = withPts.reduce((n, t) => n + t.points.length, 0),
      nt = withPts.length || 1,
      cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const hw = cl(Math.sqrt(500 / (np || 1)), 0.1, 1.8),
      hr = cl(Math.sqrt(1200 / (np || 1)), 0.55, 1.3),
      ro = cl(0.8 / Math.sqrt(nt), 0.03, 0.4);
    const hk = hw + '|' + hr;
    if (m.heatKey !== hk) {
      m.heatKey = hk;
      map.setPaintProperty('heat', 'heatmap-weight', hw);
      map.setPaintProperty('heat', 'heatmap-radius', [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        7 * hr,
        12,
        16 * hr,
        15,
        34 * hr,
      ]);
    }
    map.setPaintProperty('routes-base', 'line-width', nt > 150 ? 2 : 2.6);
    map.setPaintProperty('routes-base', 'line-opacity', selP ? ro * 0.35 : ro);
    map.setPaintProperty('routes-sel', 'line-opacity', selPair ? 0.3 : 0.85);
    map.setPaintProperty('pairs-dash', 'line-opacity', selP ? 0.14 : 0.28);
    map.setPaintProperty('heat', 'heatmap-opacity', selP ? 0.4 : 0.9);
    /* pines: se recrean (pocos) con tamaño según visitas y estado de selección */
    m.markers.forEach((k) => k.remove());
    m.markers = [];
    for (const p of S.places) {
      if (!validGeo(p.lat, p.lng) || (Loc && Loc.id === p.id)) continue;
      const v = vis[p.id] || 0,
        r = 5.5 + Math.min(9, v * 0.75);
      const sel =
        p.id === S.ui.selPlace ||
        (!!selPair && (norm(selPair.from) === norm(p.name) || norm(selPair.to) === norm(p.name)));
      const el = document.createElement('button');
      el.type = 'button';
      el.id = 'mpin-' + p.id;
      el.className = 'tm-place' + (sel ? ' sel' : '');
      el.dataset.action = 'place-select';
      el.dataset.id = p.id;
      el.style.setProperty('--r', r + 'px');
      el.setAttribute('aria-label', `${p.name}, ${v} ${v === 1 ? 'visita' : 'visitas'}`);
      el.setAttribute('aria-pressed', String(sel));
      el.innerHTML = `<span class="tm-ph"></span>${sel ? '<span class="tm-pulse"></span>' : ''}<span class="tm-pd"></span><span class="tm-pn">${esc(p.name)}</span>`;
      m.markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
    }
    /* pin de ubicación arrastrable */
    if (Loc && Loc.lat != null) {
      if (!m.locMarker) {
        const el = document.createElement('div');
        el.className = 'tm-loc';
        el.title = 'Arrastra para ajustar';
        m.locMarker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([Loc.lng, Loc.lat])
          .addTo(map);
        m.locMarker.on('dragend', () => {
          const ll = m.locMarker.getLngLat();
          if (Loc) {
            Loc.lat = ll.lat;
            Loc.lng = ll.lng;
          }
        });
      } else m.locMarker.setLngLat([Loc.lng, Loc.lat]);
    } else if (m.locMarker) {
      m.locMarker.remove();
      m.locMarker = null;
    }
    m.host.classList.toggle('locating', !!Loc);
    /* encuadre: al abrir y al cambiar el trayecto seleccionado */
    const fk = selPair ? selPair.key : '';
    if (first || m.fitKey !== fk) {
      const pts = pl ? pl.map(llOf) : S.places.filter((p) => validGeo(p.lat, p.lng)).map(llOf);
      if (m.fitKey !== undefined || pl)
        if (pts.length)
          map.fitBounds(boundsOf(pts), {
            padding: { top: 50, bottom: 64, left: 60, right: 60 },
            maxZoom: pl ? 15 : 14,
            duration: first || reduceMotion() ? 0 : 700,
          });
      m.fitKey = fk;
    }
  }
  function startLocate(id) {
    const p = S.places.find((x) => x.id === id),
      m = MapReg.find((x) => x.kind === 'places');
    if (!p) return;
    if (!m || m.state === 'failed') {
      toast('El mapa no está disponible sin conexión', 'err');
      return;
    }
    const has = validGeo(p.lat, p.lng);
    Loc = { id, lat: has ? p.lat : null, lng: has ? p.lng : null };
    render();
    if (has && m.map) m.map.easeTo({ center: [p.lng, p.lat], duration: reduceMotion() ? 0 : 400 });
  }
  function cancelLocate() {
    if (!Loc) return;
    Loc = null;
    render();
  }
  /* Guarda la ubicación: x/y del SVG pasan a calcularse desde lat/lng y se regeneran las rutas automáticas que usan el lugar */
  function saveLocation() {
    const p = Loc && S.places.find((x) => x.id === Loc.id);
    if (!p || !validGeo(Loc.lat, Loc.lng)) {
      cancelLocate();
      return;
    }
    p.lat = +Loc.lat.toFixed(6);
    p.lng = +Loc.lng.toFixed(6);
    delete p.x;
    delete p.y;
    const n = norm(p.name);
    let k = 0;
    S.trips.forEach((t) => {
      if (t.pointsSource === 'auto' && (norm(t.origin) === n || norm(t.destination) === n)) {
        t.points = tripPoints(t, S.places);
        k++;
      }
    });
    Loc = null;
    save();
    render();
    toast(
      k
        ? `Ubicación guardada · ${k} ${k === 1 ? 'ruta actualizada' : 'rutas actualizadas'}`
        : 'Ubicación guardada',
    );
  }

  /* ================= Gráficas ================= */
  function barChart({
    values,
    labels,
    w = 560,
    h = 180,
    highlight = -1,
    fmt = (v) => NF0.format(v),
    colors = null,
    avg = null,
    avgLabel = '',
    title = '',
  }) {
    const P = { l: 10, r: 10, t: 26, b: 28 },
      n = values.length || 1;
    const maxV = Math.max(1, ...values.map((v) => v || 0), avg || 0) * 1.14;
    const iw = w - P.l - P.r,
      ih = h - P.t - P.b,
      bw = iw / n,
      barW = Math.max(8, Math.min(46, bw * 0.58));
    let s = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(title)}">`;
    for (let i = 0; i < 3; i++) {
      const gy = P.t + (ih * i) / 3;
      s += `<line x1="${P.l}" x2="${w - P.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.045)"/>`;
    }
    s += `<line x1="${P.l}" x2="${w - P.r}" y1="${P.t + ih}" y2="${P.t + ih}" stroke="rgba(255,255,255,.09)"/>`;
    values.forEach((v, i) => {
      const val = v || 0,
        cx = P.l + bw * i + bw / 2,
        x = cx - barW / 2,
        bh = val ? Math.max(3, (val / maxV) * ih) : 2,
        y = P.t + ih - bh;
      const col = colors ? colors[i] : i === highlight ? ACC : '#2E2E36';
      s += `<rect class="bar" style="animation-delay:${i * 35}ms" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(6, barW / 3).toFixed(1)}" fill="${val ? col : '#1F1F25'}"><title>${esc(labels[i])}: ${val ? esc(fmt(val)) : 'Sin datos'}</title></rect>`;
      if (val)
        s += `<text x="${cx.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" class="bar-val${i === highlight ? ' hl' : ''}">${esc(fmt(val))}</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="bar-lbl${i === highlight ? ' hl' : ''}">${esc(labels[i])}</text>`;
    });
    if (avg) {
      const ay = P.t + ih - (avg / maxV) * ih;
      s += `<line x1="${P.l}" x2="${w - P.r}" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${GREEN}" stroke-dasharray="4 5" stroke-opacity=".75"/><text x="${w - P.r}" y="${(ay - 6).toFixed(1)}" text-anchor="end" class="avg-lbl">${esc(avgLabel)}</text>`;
    }
    return s + '</svg>';
  }
  let gid = 0;
  function lineChart({
    values,
    labels,
    w = 900,
    h = 240,
    fmt = (v) => NF1.format(v),
    title = '',
    highlight = -1,
  }) {
    const P = { l: 16, r: 16, t: 34, b: 30 },
      n = values.length,
      iw = w - P.l - P.r,
      ih = h - P.t - P.b;
    const vals = values.filter((v) => v != null);
    if (!vals.length)
      return `<div class="empty sm"><p>Aún no hay suficientes cargas de tanque lleno para calcular el rendimiento.</p></div>`;
    let mn = Math.min(...vals),
      mx = Math.max(...vals);
    const sp = Math.max(1, mx - mn);
    mn -= sp * 0.6;
    mx += sp * 0.5;
    const X = (i) => P.l + (iw * (i + 0.5)) / n,
      Y = (v) => P.t + ih - ((v - mn) / (mx - mn)) * ih;
    const pts = values.map((v, i) => (v == null ? null : { x: X(i), y: Y(v), v, i }));
    const id = 'lg' + ++gid;
    let s = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(title)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACC}" stop-opacity=".28"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i < 3; i++) {
      const gy = P.t + (ih * i) / 3;
      s += `<line x1="${P.l}" x2="${w - P.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.045)"/>`;
    }
    const seq = pts.filter(Boolean);
    if (seq.length > 1) {
      const d = seq.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      s += `<path d="${d} L${seq[seq.length - 1].x.toFixed(1)} ${P.t + ih} L${seq[0].x.toFixed(1)} ${P.t + ih}Z" fill="url(#${id})"/>`;
      s += `<path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    seq.forEach((p) => {
      const hl = p.i === highlight || p === seq[seq.length - 1];
      s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${hl ? 5 : 4}" fill="${hl ? ACC : '#16161A'}" stroke="${ACC}" stroke-width="2"><title>${esc(labels[p.i])}: ${esc(fmt(p.v))}</title></circle><text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="middle" class="bar-val${hl ? ' hl' : ''}">${esc(fmt(p.v))}</text>`;
    });
    labels.forEach((l, i) => {
      s += `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="bar-lbl${i === highlight ? ' hl' : ''}">${esc(l)}</text>`;
    });
    return s + '</svg>';
  }
  function sparkline(values, w = 300, h = 64) {
    if (values.length < 2)
      return `<p class="muted-xs">Registra al menos tres cargas de tanque lleno para ver la tendencia.</p>`;
    const mn = Math.min(...values),
      mx = Math.max(...values),
      sp = Math.max(0.5, mx - mn);
    const X = (i) => 6 + ((w - 12) * i) / (values.length - 1),
      Y = (v) => h - 8 - ((v - mn) / sp) * (h - 20);
    const d = values
      .map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
      .join(' ');
    const id = 'sp' + ++gid,
      l = values.length - 1;
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Tendencia de rendimiento por carga"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACC}" stop-opacity=".25"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(l)} ${h} L${X(0)} ${h}Z" fill="url(#${id})"/><path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(l)}" cy="${Y(values[l])}" r="4" fill="${ACC}"/></svg>`;
  }
  function deltaHTML(cur, prev, { good = null, suffix = 'vs. semana pasada' } = {}) {
    if (!prev) return `<span class="delta flat">Sin datos previos</span>`;
    const pct = ((cur - prev) / prev) * 100,
      up = pct >= 0;
    const cls = Math.abs(pct) < 0.5 || good == null ? 'flat' : up === good ? 'good' : 'bad';
    return `<span class="delta ${cls}">${up ? '▲' : '▼'} ${NF0.format(Math.abs(pct))}% <span class="d-sfx">${esc(suffix)}</span></span>`;
  }
  const emptyState = (ic, title, text, actions = '', sm) =>
    `<div class="empty${sm ? ' sm' : ''}"><div class="e-ico">${icon(ic, 26)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="e-actions">${actions}</div>` : ''}</div>`;
  const quickBtns = () =>
    `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Nuevo viaje <kbd class="hint">N</kbd></button><button class="btn" data-action="new-fuel">${icon('fuel', 16)} Nueva carga <kbd class="hint">G</kbd></button>`;

  /* ================= Vistas ================= */
  function renderInicio() {
    const trips = tripsDesc();
    if (!trips.length && !S.fuel.length)
      return `<div class="view"><section class="card">${emptyState('route', 'Tu tablero está listo', 'Registra tu primer viaje o carga de gasolina y aquí verás tu semana, tu rendimiento y tu gasto mensual.', quickBtns())}</section></div>`;
    const t0 = startOfToday(),
      wd = (t0.getDay() + 6) % 7,
      ws = addDays(t0, -wd),
      we = addDays(ws, 6);
    const wsI = isoDate(ws),
      weI = isoDate(we),
      pwsI = isoDate(addDays(ws, -7)),
      pweI = isoDate(addDays(ws, -1));
    const wk = S.trips.filter((t) => t.date >= wsI && t.date <= weI),
      pw = S.trips.filter((t) => t.date >= pwsI && t.date <= pweI);
    const wKm = sum(wk, tripKm),
      pKm = sum(pw, tripKm),
      wMin = sum(wk, tripDur),
      pMin = sum(pw, tripDur),
      wCost = sum(wk, tripCost),
      pCost = sum(pw, tripCost);
    const days = [...Array(7)].map((_, i) => {
      const d = isoDate(addDays(ws, i));
      return sum(
        wk.filter((t) => t.date === d),
        tripKm,
      );
    });
    const range =
      ws.getMonth() === we.getMonth()
        ? `${ws.getDate()} – ${we.getDate()} ${MONTHS[we.getMonth()]}`
        : `${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]}`;
    const last = trips[0];
    const lastCard = last
      ? `<section class="card span-5 card-last">
      <div class="card-title"><span>Último viaje</span><span class="muted-sm">${esc(cap(fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'short' })))} · ${esc(last.depart)}</span></div>
      <div class="route-title">${esc(last.origin)}<span class="arrow">${icon('arrowRight', 18)}</span>${esc(last.destination)}</div>
      ${tripMapHTML(last, 440, 150, 'inicio', 'static')}
      <div class="stat-row">
        <div><div class="stat-label">Distancia</div><div class="stat-val">${fmtKm(tripKm(last))}<span class="u">km</span></div></div>
        <div><div class="stat-label">Duración</div><div class="stat-val">${durHTML(tripDur(last))}</div></div>
        <div><div class="stat-label">Vel. prom.</div><div class="stat-val">${NF0.format(tripSpeed(last))}<span class="u">km/h</span></div></div>
      </div>
      <div class="card-foot">${tagHTML(last.tag)}<span class="muted-sm">${esc(vehName(last.vehicleId))}</span><button class="link-btn" data-action="open-trip" data-id="${last.id}">Ver detalle ${icon('arrowRight', 14)}</button></div>
    </section>`
      : `<section class="card span-5">${emptyState('route', 'Sin viajes todavía', 'Registra tu primer viaje para verlo aquí.', `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Nuevo viaje <kbd class="hint">N</kbd></button>`)}</section>`;
    const weekCard = `<section class="card span-7">
      <div class="card-title"><span>Esta semana</span><span class="muted-sm">${range} · ${wk.length} ${wk.length === 1 ? 'viaje' : 'viajes'}</span></div>
      <div class="stat-row">
        <div><div class="stat-label">${icon('route', 14)} Kilómetros</div><div class="stat-val xl">${fmtKm(wKm)}<span class="u">km</span></div>${deltaHTML(wKm, pKm)}</div>
        <div><div class="stat-label">${icon('clock', 14)} Tiempo al volante</div><div class="stat-val xl">${durHTML(wMin)}</div>${deltaHTML(wMin, pMin)}</div>
        <div><div class="stat-label">${icon('fuel', 14)} Gasto en gasolina</div><div class="stat-val xl">${money(wCost)}</div>${deltaHTML(wCost, pCost, { good: false })}</div>
      </div>
      <div class="week-bars">${barChart({ values: days, labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], w: 640, h: 150, highlight: wd, fmt: (v) => NF1.format(v) + ' km', title: 'Kilómetros por día esta semana' })}</div>
      <p class="muted-xs">El gasto se estima con el rendimiento de cada vehículo y el último precio por litro registrado.</p>
    </section>`;
    let dv = S.ui.dashVeh;
    if (!vehById(dv))
      dv = vehById(S.settings.defaultVehicle) ? S.settings.defaultVehicle : S.vehicles[0]?.id;
    const vals = dv
      ? S.fuel
          .filter((f) => f.vehicleId === dv && D.kmpl[f.id])
          .sort((a, b) => a.odometer - b.odometer)
          .map((f) => D.kmpl[f.id])
      : [];
    const avgK = dv ? D.vs[dv]?.avg : null;
    const trend =
      vals.length >= 2
        ? deltaHTML(vals[vals.length - 1], mean(vals.slice(0, -1)), {
            good: true,
            suffix: 'última carga vs. promedio',
          })
        : `<span class="delta flat">Tendencia disponible con más cargas</span>`;
    const rendCard = `<section class="card span-4">
      <div class="card-title"><span>Rendimiento promedio</span></div>
      ${S.vehicles.length > 1 ? `<div class="pills" role="group" aria-label="Elegir vehículo" style="margin-bottom:14px">${S.vehicles.map((v) => `<button class="pill" aria-pressed="${v.id === dv}" data-action="dash-veh" data-id="${v.id}">${esc(v.name)}</button>`).join('')}</div>` : ''}
      ${avgK ? `<div class="stat-val xl">${NF1.format(avgK)}<span class="u">km/L</span></div>${trend}` : `<div class="stat-val xl" style="color:#4A4A55">—<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:8px">Necesitas dos cargas de tanque lleno para calcularlo.</p>`}
      <div class="spark">${sparkline(vals)}</div>
    </section>`;
    const ms = lastMonths(6),
      spend = ms.map((m) =>
        sum(
          S.fuel.filter((f) => f.date.startsWith(m.key)),
          fuelTotal,
        ),
      );
    const curL = S.fuel.filter((f) => f.date.startsWith(ms[5].key));
    const spendCard = `<section class="card span-8">
      <div class="card-title"><span>Gasto mensual en gasolina</span><button class="link-btn" data-action="go" data-view="gasolina">Ver cargas ${icon('arrowRight', 14)}</button></div>
      <div class="spend-wrap">
        <div><div class="stat-label">${cap(ms[5].long)}</div><div class="stat-val xl">${money(spend[5])}</div>${deltaHTML(spend[5], spend[4], { good: false, suffix: 'vs. mes anterior' })}<p class="muted-xs" style="margin-top:10px">${curL.length} ${curL.length === 1 ? 'carga' : 'cargas'} · ${NF1.format(sum(curL, (f) => +f.liters))} L</p></div>
        <div>${barChart({ values: spend, labels: ms.map((m) => cap(m.label)), highlight: 5, fmt: (v) => '$' + NF0.format(v), w: 600, h: 170, title: 'Gasto mensual en gasolina, últimos 6 meses' })}</div>
      </div>
    </section>`;
    return `<div class="view grid">${lastCard}${weekCard}${rendCard}${spendCard}</div>`;
  }

  function filteredTrips() {
    const { tag, vehicle, from, to } = S.ui.tf,
      q = norm(S.ui.q);
    const arr = S.trips.filter(
      (t) =>
        (tag === 'Todos' || t.tag === tag) &&
        (vehicle === 'all' || t.vehicleId === vehicle) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        (!q ||
          norm(
            [
              t.origin,
              t.destination,
              vehName(t.vehicleId),
              t.tag,
              fmtDate(t.date, { day: 'numeric', month: 'long' }),
            ].join(' '),
          ).includes(q)),
    );
    const { key, dir } = S.ui.sort,
      m = dir === 'asc' ? 1 : -1;
    const val =
      {
        date: tripKey,
        route: (t) => norm(t.origin + ' ' + t.destination),
        tag: (t) => t.tag,
        vehicle: (t) => norm(vehName(t.vehicleId)),
        km: tripKm,
        dur: tripDur,
        speed: tripSpeed,
        cost: tripCost,
      }[key] || tripKey;
    return arr.sort((a, b) => {
      const x = val(a),
        y = val(b);
      return (x > y ? 1 : x < y ? -1 : 0) * m;
    });
  }
  function renderViajes() {
    if (!S.trips.length)
      return `<div class="view"><section class="card">${emptyState('route', 'Aún no registras viajes', 'Anota origen, destino, horas y odómetro. Trayecto calcula distancia, duración, velocidad y costo por ti.', `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Registrar viaje <kbd class="hint">N</kbd></button>`)}</section></div>`;
    const list = filteredTrips(),
      tf = S.ui.tf,
      sel = S.trips.find((t) => t.id === S.ui.selTrip);
    const active = tf.tag !== 'Todos' || tf.vehicle !== 'all' || tf.from || tf.to || S.ui.q;
    const cols = [
      ['date', 'Fecha', ''],
      ['route', 'Ruta', ''],
      ['tag', 'Etiqueta', 'col-opt'],
      ['vehicle', 'Vehículo', 'col-opt'],
      ['km', 'Distancia', 'r'],
      ['dur', 'Duración', 'r'],
      ['speed', 'Vel. prom.', 'r col-opt'],
      ['cost', 'Costo est.', 'r'],
    ];
    const th = cols
      .map(([k, l, c]) => {
        const on = S.ui.sort.key === k;
        return `<th class="${c}" aria-sort="${on ? (S.ui.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button class="th-sort" data-action="sort" data-key="${k}">${l}<span class="si" aria-hidden="true">${on ? (S.ui.sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}</span></button></th>`;
      })
      .join('');
    const yr = new Date().getFullYear();
    const rows = list
      .map((t) => {
        const s = sel && sel.id === t.id;
        const dt = parseDate(t.date);
        return `<tr id="row-${t.id}" class="clickable${s ? ' selected' : ''}" tabindex="0" aria-selected="${!!s}" data-action="select-trip" data-id="${t.id}">
      <td><div class="cell-date"><b class="num">${dt.getDate()} ${MONTHS[dt.getMonth()]}${dt.getFullYear() === yr ? '' : ' ' + String(dt.getFullYear()).slice(2)}</b><small>${esc(cap(fmtDate(t.date, { weekday: 'short' })))} · ${esc(t.depart)}</small></div></td>
      <td><span class="route-cell">${esc(t.origin)}<span class="arrow">→</span>${esc(t.destination)}</span></td>
      <td class="col-opt">${tagHTML(t.tag)}</td>
      <td class="col-opt muted-sm">${esc(vehName(t.vehicleId))}</td>
      <td class="r num">${fmtKm(tripKm(t))} km</td>
      <td class="r num">${fmtDurText(tripDur(t))}</td>
      <td class="r num col-opt">${NF0.format(tripSpeed(t))} km/h</td>
      <td class="r num">${MXN.format(tripCost(t))}</td></tr>`;
      })
      .join('');
    const table = list.length
      ? `<div class="table-wrap"><table class="table"><caption class="sr" style="position:absolute;left:-9999px">Viajes registrados</caption><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyState(
          'search',
          'Sin resultados',
          'Ningún viaje coincide con la búsqueda o los filtros actuales.',
          `<button class="btn" data-action="clear-filters">Limpiar filtros</button>`,
        );
    let detail = '';
    if (sel) {
      const km = tripKm(sel),
        dur = tripDur(sel);
      detail = `<aside class="card detail" aria-label="Detalle del viaje">
      <div class="detail-head"><div><div class="eyebrow">${esc(cap(fmtDate(sel.date, { weekday: 'long', day: 'numeric', month: 'long' })))}</div><h2 class="detail-title">${esc(sel.origin)}<span class="arrow">→</span>${esc(sel.destination)}</h2></div><button class="icon-btn" data-action="close-detail" aria-label="Cerrar detalle (Esc)" title="Cerrar (Esc)">${icon('x')}</button></div>
      ${tripMapHTML(sel, 324, 200, 'detalle', 'interactive')}${playBarHTML(sel)}
      <div class="kv">
        <div><div class="stat-label">${icon('clock', 13)} Duración</div><div class="stat-val md">${durHTML(dur)}</div></div>
        <div><div class="stat-label">${icon('route', 13)} Distancia</div><div class="stat-val md">${fmtKm(km)}<span class="u">km</span></div></div>
        <div><div class="stat-label">${icon('speed', 13)} Vel. promedio</div><div class="stat-val md">${NF0.format(tripSpeed(sel))}<span class="u">km/h</span></div></div>
        <div><div class="stat-label">${icon('fuel', 13)} Costo estimado</div><div class="stat-val md">${money(tripCost(sel), true)}</div></div>
      </div>
      <dl class="meta">
        <dt>Horario</dt><dd>${esc(sel.depart)} – ${esc(sel.arrive)}</dd>
        <dt>Odómetro</dt><dd>${NF1.format(sel.odoStart)} → ${NF1.format(sel.odoEnd)} km</dd>
        <dt>Vehículo</dt><dd>${esc(vehName(sel.vehicleId))}</dd>
        <dt>Etiqueta</dt><dd>${tagHTML(sel.tag)}</dd>
        ${compOf(sel) ? `<dt>Rendimiento (computadora)</dt><dd>${esc(fmtComp(sel))}</dd>` : ''}
        <dt>Litros estimados</dt><dd>${NF1.format(tripLiters(sel))} L</dd>
        <dt>Base del costo</dt><dd>${NF1.format(tripKmpl(sel))} km/L${compOf(sel) ? ' de la computadora' : ''} · ${MXN.format(priceOf(sel.vehicleId))}/L</dd>
      </dl>
      <div class="detail-actions"><button class="btn btn-primary" data-action="download-trip" data-id="${sel.id}">${icon('download', 16)} Tarjeta PNG</button><button class="btn" data-action="edit-trip" data-id="${sel.id}">${icon('edit', 16)} Editar <kbd class="hint">E</kbd></button><button class="btn btn-danger" data-action="delete-trip" data-id="${sel.id}">${icon('trash', 16)} Eliminar</button></div>
    </aside>`;
    }
    return `<div class="view">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrar por etiqueta">${['Todos', 'Trabajo', 'Personal'].map((t) => `<button aria-pressed="${tf.tag === t}" data-action="filter-tag" data-tag="${t}">${t}</button>`).join('')}</div>
      <select class="input sm" id="fVeh" data-change="f-veh" aria-label="Filtrar por vehículo" style="width:200px"><option value="all">Todos los vehículos</option>${S.vehicles.map((v) => `<option value="${v.id}" ${tf.vehicle === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <div class="date-range">${icon('calendar', 16)}<input type="date" class="input sm" id="fFrom" data-change="f-from" value="${esc(tf.from)}" aria-label="Desde"><span>–</span><input type="date" class="input sm" id="fTo" data-change="f-to" value="${esc(tf.to)}" aria-label="Hasta"></div>
      ${active ? `<button class="btn btn-ghost sm" data-action="clear-filters">${icon('x', 14)} Limpiar</button>` : ''}
      <span class="spacer"></span>
      <span class="toolbar-count num">${list.length} ${list.length === 1 ? 'viaje' : 'viajes'} · ${fmtKm(sum(list, tripKm))} km</span>
      <button class="btn btn-primary sm" data-action="new-trip">${icon('plus', 15)} Nuevo viaje <kbd class="hint">N</kbd></button>
    </div>
    <div class="split${sel ? ' has-detail' : ''}"><section class="card table-card">${table}</section>${detail}</div>
  </div>`;
  }

  function renderGasolina() {
    if (!S.fuel.length)
      return `<div class="view"><section class="card">${emptyState('fuel', 'Aún no registras cargas', 'Anota litros, precio y odómetro. Con dos cargas de tanque lleno calculamos tu rendimiento en km/L.', `<button class="btn btn-primary" data-action="new-fuel">${icon('plus', 16)} Registrar carga <kbd class="hint">G</kbd></button>`)}</section></div>`;
    const ff = vehById(S.ui.ff) ? S.ui.ff : 'all',
      q = norm(S.ui.q);
    const all = S.fuel.filter((f) => ff === 'all' || f.vehicleId === ff);
    const list = all
      .filter((f) => !q || norm(f.station + ' ' + vehName(f.vehicleId)).includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer);
    const ms = lastMonths(2),
      mL = all.filter((f) => f.date.startsWith(ms[1].key)),
      pL = all.filter((f) => f.date.startsWith(ms[0].key));
    const mSp = sum(mL, fuelTotal),
      pSp = sum(pL, fuelTotal),
      mLi = sum(mL, (f) => +f.liters);
    const totLi = sum(all, (f) => +f.liters),
      avgPrice = totLi ? sum(all, fuelTotal) / totLi : 0;
    const kv = all.filter((f) => D.kmpl[f.id]).map((f) => D.kmpl[f.id]),
      avgK = kv.length ? mean(kv) : null;
    const chartL = all
      .filter((f) => D.kmpl[f.id])
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);
    const chart = chartL.length
      ? barChart({
          values: chartL.map((f) => D.kmpl[f.id]),
          labels: chartL.map((f) => {
            const d = parseDate(f.date);
            return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
          }),
          colors: chartL.map((f) =>
            ff === 'all'
              ? vehById(f.vehicleId)?.color || ACC
              : f === chartL[chartL.length - 1]
                ? ACC
                : '#3A3328',
          ),
          fmt: (v) => NF1.format(v),
          avg: avgK,
          avgLabel: `Prom. ${NF1.format(avgK || 0)} km/L`,
          w: 720,
          h: 220,
          title: 'Rendimiento por carga',
        })
      : emptyState(
          'gauge',
          'Rendimiento pendiente',
          'Registra dos cargas con tanque lleno del mismo vehículo para ver el km/L por carga.',
          '',
          true,
        );
    const byVeh = S.vehicles
      .map((v) => ({
        v,
        sp: sum(
          mL.filter((f) => f.vehicleId === v.id),
          fuelTotal,
        ),
      }))
      .filter((x) => ff === 'all' || x.v.id === ff);
    const maxSp = Math.max(1, ...byVeh.map((x) => x.sp));
    const rows = list
      .map((f) => {
        const k = D.kmpl[f.id];
        return `<tr>
      <td><div class="cell-date"><b class="num">${parseDate(f.date).getDate()} ${MONTHS[parseDate(f.date).getMonth()]}</b><small>${esc(cap(fmtDate(f.date, { weekday: 'short' })))}</small></div></td>
      <td>${esc(f.station)}</td>
      <td class="muted-sm"><span class="dot" style="background:${esc(vehById(f.vehicleId)?.color || '#888')};margin-right:8px"></span>${esc(vehName(f.vehicleId))}</td>
      <td class="r num">${NF2.format(f.liters)} L</td>
      <td class="r num">${MXN.format(f.price)}</td>
      <td class="r num"><b>${MXN.format(fuelTotal(f))}</b></td>
      <td class="r num">${NF0.format(f.odometer)} km</td>
      <td class="r num">${k ? `<b style="color:${avgK && k >= avgK ? 'var(--green)' : 'var(--text)'}">${NF1.format(k)}</b> km/L` : f.full ? `<span class="tag muted" title="Primera carga de tanque lleno: sirve como referencia">Referencia</span>` : `<span class="tag muted" title="Se suma al siguiente tanque lleno">Parcial</span>`}</td>
      <td class="r"><button class="icon-btn" data-action="edit-fuel" data-id="${f.id}" aria-label="Editar carga del ${esc(fmtDate(f.date, { day: 'numeric', month: 'long' }))}">${icon('edit', 16)}</button><button class="icon-btn danger" data-action="delete-fuel" data-id="${f.id}" aria-label="Eliminar carga del ${esc(fmtDate(f.date, { day: 'numeric', month: 'long' }))}">${icon('trash', 16)}</button></td></tr>`;
      })
      .join('');
    return `<div class="view">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrar por vehículo"><button aria-pressed="${ff === 'all'}" data-action="fuel-veh" data-id="all">Todos</button>${S.vehicles.map((v) => `<button aria-pressed="${ff === v.id}" data-action="fuel-veh" data-id="${v.id}"><span class="dot" style="background:${esc(v.color)}"></span>${esc(v.name)}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn btn-primary sm" data-action="new-fuel">${icon('plus', 15)} Nueva carga <kbd class="hint">G</kbd></button>
    </div>
    <div class="grid">
      <section class="card span-3"><div class="stat-label">${icon('wallet', 14)} Gasto del mes</div><div class="stat-val">${money(mSp)}</div>${deltaHTML(mSp, pSp, { good: false, suffix: 'vs. mes anterior' })}</section>
      <section class="card span-3"><div class="stat-label">${icon('drop', 14)} Litros del mes</div><div class="stat-val">${NF1.format(mLi)}<span class="u">L</span></div><p class="muted-xs" style="margin-top:12px">${mL.length} ${mL.length === 1 ? 'carga' : 'cargas'} en ${cap(ms[1].long)}</p></section>
      <section class="card span-3"><div class="stat-label">${icon('fuel', 14)} Precio promedio</div><div class="stat-val">${money(avgPrice, true)}<span class="u">/L</span></div><p class="muted-xs" style="margin-top:12px">Ponderado por litros</p></section>
      <section class="card span-3"><div class="stat-label">${icon('gauge', 14)} Rendimiento promedio</div><div class="stat-val">${avgK ? NF1.format(avgK) : '—'}<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:12px">${kv.length} ${kv.length === 1 ? 'tramo calculado' : 'tramos calculados'}</p></section>
      <section class="card span-8"><div class="card-title"><span>km/L por carga</span><span class="muted-sm">${ff === 'all' ? 'Color por vehículo' : 'Últimas 10 cargas'}</span></div>${chart}</section>
      <section class="card span-4"><div class="card-title"><span>Gasto del mes por vehículo</span></div>
        <div class="stack" style="gap:14px">${byVeh.map((x) => `<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="veh-h" style="font-weight:600"><span class="dot" style="background:${esc(x.v.color)}"></span>${esc(x.v.name)}</span><b class="num">${MXN.format(x.sp)}</b></div><div class="hbar"><i style="width:${((x.sp / maxSp) * 100).toFixed(1)}%;background:${esc(x.v.color)}"></i></div></div>`).join('') || '<p class="muted-xs">Sin vehículos.</p>'}</div>
        <p class="muted-xs" style="margin-top:16px">El rendimiento se calcula entre dos cargas de tanque lleno, sumando los litros de las cargas parciales intermedias.</p>
      </section>
      <section class="card span-12 table-card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Gasolinera</th><th>Vehículo</th><th class="r">Litros</th><th class="r">$/L</th><th class="r">Total</th><th class="r">Odómetro</th><th class="r">km/L</th><th class="r"><span style="position:absolute;left:-9999px">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('search', 'Sin resultados', 'Ninguna carga coincide con la búsqueda.', '', true)}</section>
    </div>
  </div>`;
  }

  function addPlaceForm(open) {
    return `<details class="add-place"${open ? ' open' : ''}><summary>${icon('plus', 15)} Agregar lugar</summary><form id="addPlaceForm" autocomplete="off"><input class="input sm" id="plName" placeholder="Nombre (ej. Escuela)" aria-label="Nombre del lugar" required><input class="input sm" id="plArea" placeholder="Colonia o zona" aria-label="Colonia o zona"><button class="btn btn-primary sm" type="submit">Guardar</button><label class="pl-locate"><input type="checkbox" id="plLocate" checked> Ubicar en el mapa después de guardar</label></form></details>`;
  }
  /* Debajo de cada lugar: "Sin ubicación" + "Ubicar en el mapa"; el lugar seleccionado ofrece "Mover ubicación" */
  function placeActions(p) {
    if (Loc && Loc.id === p.id) return '';
    if (!validGeo(p.lat, p.lng))
      return `<div class="p-actions"><span class="tag muted">Sin ubicación</span><button class="link-btn" data-action="locate-start" data-id="${p.id}">Ubicar en el mapa</button></div>`;
    return p.id === S.ui.selPlace
      ? `<div class="p-actions"><button class="link-btn" data-action="locate-start" data-id="${p.id}">Mover ubicación</button></div>`
      : '';
  }
  function renderLugares() {
    if (!S.places.length)
      return `<div class="view"><section class="card">${emptyState('pin', 'Aún no hay lugares', 'Los lugares se agregan solos cuando registras viajes, o puedes crearlos aquí para usarlos en el autocompletado.', addPlaceForm(true))}</section></div>`;
    const vis = placeVisits(),
      pairs = pairStats(),
      q = norm(S.ui.q);
    const selP = S.places.find((p) => p.id === S.ui.selPlace),
      locP = Loc && S.places.find((p) => p.id === Loc.id),
      layer = ['lugares', 'rutas', 'calor'].includes(S.ui.placesLayer)
        ? S.ui.placesLayer
        : 'lugares';
    const places = [...S.places]
      .filter((p) => !q || norm(p.name + ' ' + (p.area || '')).includes(q))
      .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0));
    const maxV = Math.max(1, ...Object.values(vis));
    const shown = pairs.filter(
      (p) =>
        (!selP || norm(p.from) === norm(selP.name) || norm(p.to) === norm(selP.name)) &&
        (!q || norm(p.from + ' ' + p.to).includes(q)),
    );
    return `<div class="view grid">
    <section class="card card-places span-7" style="align-self:start;position:sticky;top:92px">
      <div class="card-title"><span>Mapa de lugares</span><span class="muted-sm">${selP ? `Trayectos de ${esc(selP.name)}` : 'Selecciona un pin o un trayecto'}</span></div>
      <div class="places-layers"><div class="seg" role="group" aria-label="Capa del mapa">${[
        ['lugares', 'Lugares'],
        ['rutas', 'Todas las rutas'],
        ['calor', 'Mapa de calor'],
      ]
        .map(
          ([k, l]) =>
            `<button id="lyr-${k}" aria-pressed="${layer === k}" data-action="places-layer" data-layer="${k}">${l}</button>`,
        )
        .join('')}</div></div>
      <div class="map" data-pmap="1" data-slot="lugares" data-mode="interactive" data-key="places">${placesMap(vis, pairs)}</div>
      ${Loc ? `<div class="loc-bar" role="status"><span>${Loc.lat == null ? `Haz clic en el mapa para ubicar «${esc(locP?.name)}»` : `Arrastra el pin para ajustar «${esc(locP?.name)}»`}</span><button class="btn btn-primary sm" data-action="locate-save"${Loc.lat == null ? ' disabled' : ''}>Guardar ubicación</button><button class="btn btn-ghost sm" data-action="locate-cancel">Cancelar <kbd class="hint">Esc</kbd></button></div>` : ''}
      <div class="map-legend lg-map">${
        {
          lugares:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-line"></i>Trayecto frecuente</span><span><i class="lg-route"></i>Ruta seleccionada</span>',
          rutas:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-ramp"></i>Calles más recorridas</span><span><i class="lg-route"></i>Rutas del lugar seleccionado</span>',
          calor:
            '<span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-heat"></i>Menos → más actividad</span>',
        }[layer]
      }</div>
      <div class="map-legend lg-svg"><span><i class="lg-pin"></i>Lugar (tamaño según visitas)</span><span><i class="lg-line"></i>Trayecto frecuente</span><span><i class="lg-route"></i>Ruta seleccionada</span></div>
    </section>
    <div class="span-5 stack">
      <section class="card">
        <div class="card-title"><span>Lugares frecuentes</span><span class="muted-sm">${S.places.length} guardados</span></div>
        ${
          places.length
            ? `<ul class="list">${places
                .map((p) => {
                  const v = vis[p.id] || 0;
                  return `<li class="pl-li"><button class="row-btn" id="pl-${p.id}" aria-pressed="${p.id === S.ui.selPlace}" data-action="place-select" data-id="${p.id}"><span class="p-ico">${icon(kindIcon(p.kind), 17)}</span><span class="p-main"><b>${esc(p.name)}</b><small>${esc(p.area || 'Sin zona')}</small><div class="p-bar"><i style="width:${((v / maxV) * 100).toFixed(0)}%"></i></div></span><span class="p-val"><b>${v}</b><small>${v === 1 ? 'visita' : 'visitas'}</small></span></button><button type="button" class="icon-btn p-more" id="pm-${p.id}" data-action="place-more" data-id="${p.id}" aria-label="Acciones de ${esc(p.name)}" aria-haspopup="menu" aria-expanded="false">${icon('dots', 18)}</button>${placeActions(p)}</li>`;
                })
                .join('')}</ul>`
            : `<p class="muted-xs">Ningún lugar coincide con la búsqueda.</p>`
        }
        ${addPlaceForm(false)}
      </section>
      <section class="card">
        <div class="card-title"><span>Tiempos de traslado</span>${selP ? `<span class="filter-chip">${esc(selP.name)}<button data-action="clear-place" aria-label="Quitar filtro de lugar">${icon('x', 12)}</button></span>` : '<span class="muted-sm">Promedio por trayecto</span>'}</div>
        ${
          shown.length
            ? `<ul class="list">${shown
                .slice(0, 8)
                .map(
                  (p) =>
                    `<li><button class="row-btn" id="pr-${hashStr(p.key)}" aria-pressed="${p.key === S.ui.selPair}" data-action="pair-select" data-key="${esc(p.key)}"><span class="p-main"><b>${esc(p.from)} <span style="color:var(--accent)">→</span> ${esc(p.to)}</b><small>${p.n} ${p.n === 1 ? 'viaje' : 'viajes'} · ${fmtKm(p.avgKm)} km prom.</small></span><span class="p-val"><b>${NF0.format(p.avgMin)}<span class="muted-xs" style="font-weight:500"> min</span></b><small>promedio</small></span></button></li>`,
                )
                .join('')}</ul>`
            : emptyState(
                'clock',
                'Sin trayectos',
                'Cuando registres viajes entre estos lugares verás aquí sus tiempos promedio.',
                '',
                true,
              )
        }
      </section>
    </div>
  </div>`;
  }

  function renderEstadisticas() {
    if (!S.trips.length && !S.fuel.length)
      return `<div class="view"><section class="card">${emptyState('chart', 'Todavía no hay estadísticas', 'Con algunos viajes y cargas registrados verás tendencias mensuales, costo por km y la comparativa entre tus vehículos.', quickBtns())}</section></div>`;
    const ms = lastMonths(6),
      first = ms[0].key + '-01';
    const kmM = ms.map((m) =>
      sum(
        S.trips.filter((t) => t.date.startsWith(m.key)),
        tripKm,
      ),
    );
    const spM = ms.map((m) =>
      sum(
        S.fuel.filter((f) => f.date.startsWith(m.key)),
        fuelTotal,
      ),
    );
    const rM = ms.map((m) => {
      const v = S.fuel
        .filter((f) => f.date.startsWith(m.key) && D.kmpl[f.id])
        .map((f) => D.kmpl[f.id]);
      return v.length ? mean(v) : null;
    });
    const tr6 = S.trips.filter((t) => t.date >= first),
      fu6 = S.fuel.filter((f) => f.date >= first);
    const km6 = sum(tr6, tripKm),
      sp6 = sum(fu6, fuelTotal),
      kv = fu6.filter((f) => D.kmpl[f.id]).map((f) => D.kmpl[f.id]),
      rAvg = kv.length ? mean(kv) : null;
    let num = 0,
      den = 0;
    S.vehicles.forEach((v) => {
      const c = cpkOf(v.id),
        k = sum(
          tr6.filter((t) => t.vehicleId === v.id),
          tripKm,
        );
      if (c != null && k > 0) {
        num += c * k;
        den += k;
      }
    });
    const cpks = S.vehicles.map((v) => cpkOf(v.id)).filter((x) => x != null);
    const cpk = den ? num / den : cpks.length ? mean(cpks) : null;
    const tab = S.ui.statTab,
      labels = ms.map((m) => cap(m.label));
    const chart =
      tab === 'gasto'
        ? barChart({
            values: spM,
            labels,
            highlight: 5,
            fmt: (v) => '$' + NF0.format(v),
            w: 1000,
            h: 250,
            title: 'Gasto mensual en gasolina',
          })
        : tab === 'rend'
          ? lineChart({
              values: rM,
              labels,
              w: 1000,
              h: 250,
              fmt: (v) => NF1.format(v) + ' km/L',
              title: 'Rendimiento mensual',
              highlight: 5,
            })
          : barChart({
              values: kmM,
              labels,
              highlight: 5,
              fmt: (v) => NF0.format(v) + ' km',
              w: 1000,
              h: 250,
              title: 'Kilómetros registrados por mes',
            });
    const vstat = S.vehicles.map((v) => {
      const tr = S.trips.filter((t) => t.vehicleId === v.id);
      return {
        v,
        n: tr.length,
        km: sum(tr, tripKm),
        rend: D.vs[v.id]?.avg ?? null,
        cpk: cpkOf(v.id),
        sp: sum(
          S.fuel.filter((f) => f.vehicleId === v.id),
          fuelTotal,
        ),
        spd: tr.length ? sum(tr, tripKm) / (sum(tr, tripDur) / 60) : null,
      };
    });
    const metrics = [
      ['Viajes registrados', 'n', (v) => NF0.format(v), null],
      ['Km registrados', 'km', (v) => fmtKm(v) + ' km', null],
      ['Rendimiento', 'rend', (v) => NF1.format(v) + ' km/L', 'max'],
      ['Costo por km', 'cpk', (v) => MXN.format(v), 'min'],
      ['Gasto en gasolina', 'sp', (v) => MXN.format(v), null],
      ['Vel. promedio', 'spd', (v) => NF0.format(v) + ' km/h', null],
    ];
    const cmp = vstat.length
      ? `<div class="cmp" style="--n:${vstat.length}"><div class="c-h"></div>${vstat.map((x) => `<div class="c-h"><span class="veh-h"><span class="dot" style="background:${esc(x.v.color)}"></span>${esc(x.v.name)}</span><small class="muted-xs">${esc(x.v.plate || '')}</small></div>`).join('')}
      ${metrics
        .map(([l, k, f, best]) => {
          const vals = vstat.map((x) => x[k]).filter((v) => v != null);
          const mx = Math.max(1e-9, ...vals);
          const b =
            best && vals.length > 1
              ? best === 'max'
                ? Math.max(...vals)
                : Math.min(...vals)
              : null;
          return `<div class="c-l">${l}</div>${vstat
            .map((x) => {
              const v = x[k];
              return `<div class="c-v"><b>${v != null ? f(v) : '—'}${b != null && v === b ? '<span class="badge green">Mejor</span>' : ''}</b><div class="hbar"><i style="width:${v != null ? ((v / mx) * 100).toFixed(0) : 0}%;background:${esc(x.v.color)}"></i></div></div>`;
            })
            .join('')}`;
        })
        .join('')}
    </div>`
      : emptyState('car', 'Sin vehículos', 'Agrega un vehículo para comparar.', '', true);
    const tags = ['Trabajo', 'Personal'].map((tg) => {
      const a = tr6.filter((t) => t.tag === tg);
      return {
        tg,
        km: sum(a, tripKm),
        n: a.length,
        min: a.length ? sum(a, tripDur) / a.length : 0,
        cost: sum(a, tripCost),
      };
    });
    const tkm = Math.max(1e-9, tags[0].km + tags[1].km);
    const accs = S.vehicles.map((v) => compAccHTML(v.id, true)).filter(Boolean);
    const accCard = accs.length
      ? `<section class="card span-12"><div class="card-title"><span>Precisión de la computadora</span><span class="muted-sm">Rendimiento capturado vs. real con tanque lleno</span></div><div class="acc-list">${accs.join('')}</div></section>`
      : '';
    return `<div class="view grid">
    <section class="card span-3"><div class="stat-label">${icon('route', 14)} Km registrados</div><div class="stat-val">${NF0.format(km6)}<span class="u">km</span></div><p class="muted-xs" style="margin-top:10px">${tr6.length} viajes en 6 meses</p></section>
    <section class="card span-3"><div class="stat-label">${icon('wallet', 14)} Gasto en gasolina</div><div class="stat-val">${money(sp6)}</div><p class="muted-xs" style="margin-top:10px">${fu6.length} cargas · ${NF0.format(sum(fu6, (f) => +f.liters))} L</p></section>
    <section class="card span-3"><div class="stat-label">${icon('gauge', 14)} Rendimiento promedio</div><div class="stat-val">${rAvg ? NF1.format(rAvg) : '—'}<span class="u">km/L</span></div><p class="muted-xs" style="margin-top:10px">Todas las cargas de tanque lleno</p></section>
    <section class="card span-3"><div class="stat-label">${icon('fuel', 14)} Costo por km</div><div class="stat-val">${cpk != null ? money(cpk, true) : '—'}<span class="u">/km</span></div><p class="muted-xs" style="margin-top:10px">Precio por litro ÷ rendimiento</p></section>
    <section class="card span-12">
      <div class="card-title"><span>Tendencia mensual</span><div class="seg" role="group" aria-label="Métrica">${[
        ['km', 'Kilómetros'],
        ['gasto', 'Gasto'],
        ['rend', 'Rendimiento'],
      ]
        .map(
          ([k, l]) =>
            `<button aria-pressed="${tab === k}" data-action="stat-tab" data-tab="${k}">${l}</button>`,
        )
        .join('')}</div></div>
      ${chart}
    </section>
    <section class="card span-7"><div class="card-title"><span>Comparativa entre vehículos</span><span class="muted-sm">Histórico completo</span></div>${cmp}</section>
    <section class="card span-5"><div class="card-title"><span>Trabajo vs. personal</span><span class="muted-sm">Últimos 6 meses</span></div>
      <div class="stack-bar" role="img" aria-label="Trabajo ${NF0.format((tags[0].km / tkm) * 100)}%, personal ${NF0.format((tags[1].km / tkm) * 100)}% de los kilómetros"><i style="width:${((tags[0].km / tkm) * 100).toFixed(1)}%;background:#6CA8FF"></i><i style="flex:1;background:#B69CFF"></i></div>
      <div class="tag-rows">${tags.map((t) => `<div>${tagHTML(t.tg)}<div class="stat-val md" style="margin-top:10px">${NF0.format((t.km / tkm) * 100)}<span class="u">% de km</span></div><dl class="meta" style="margin:12px 0 0"><dt>Kilómetros</dt><dd>${fmtKm(t.km)}</dd><dt>Viajes</dt><dd>${t.n}</dd><dt>Duración prom.</dt><dd>${t.n ? fmtDurText(Math.round(t.min)) : '—'}</dd><dt>Costo est.</dt><dd>${MXN.format(t.cost)}</dd></dl></div>`).join('')}</div>
    </section>
    ${accCard}
  </div>`;
  }

  function renderVehiculos() {
    const cards = S.vehicles
      .map((v) => {
        const st = D.vs[v.id] || {},
          tr = S.trips.filter((t) => t.vehicleId === v.id),
          isDef = S.settings.defaultVehicle === v.id,
          c = cpkOf(v.id);
        return `<section class="card span-6 veh-card">
      <div class="vc-head"><div class="vc-sw" style="background:${esc(v.color)}22;color:${esc(v.color)}">${icon('car', 22)}</div><div><h3>${esc(v.name)}</h3><p>${[v.year, v.plate, v.fuel].filter(Boolean).map(esc).join(' · ')}</p></div>
        <div class="vc-right">${isDef ? `<span class="badge">${icon('star', 13)} Predeterminado</span>` : `<button class="btn btn-ghost sm" data-action="veh-default" data-id="${v.id}">Hacer predeterminado</button>`}<button class="icon-btn danger" data-action="veh-delete" data-id="${v.id}" aria-label="Eliminar ${esc(v.name)}">${icon('trash', 16)}</button></div></div>
      <div class="stat-label">${icon('gauge', 14)} Odómetro actual</div><div class="stat-val xl">${NF0.format(st.odo || 0)}<span class="u">km</span></div>
      <div class="vc-stats"><div><b>${tr.length}</b><small>Viajes</small></div><div><b>${NF0.format(sum(tr, tripKm))}</b><small>Km registrados</small></div><div><b>${st.avg ? NF1.format(st.avg) : '—'}</b><small>km/L prom.</small></div><div><b>${c != null ? MXN.format(c) : '—'}</b><small>Costo por km</small></div></div>
      ${v.tank ? `<p class="muted-xs" style="margin-top:12px">Tanque de ${NF0.format(v.tank)} L${st.avg ? ` · autonomía aprox. ${NF0.format(v.tank * st.avg)} km` : ''}</p>` : ''}
      ${compAccHTML(v.id)}
    </section>`;
      })
      .join('');
    return `<div class="view grid">
    ${S.vehicles.length ? '' : `<section class="card span-12">${emptyState('car', 'Agrega tu primer vehículo', 'Los viajes y las cargas se asocian a un vehículo para calcular rendimiento y costo por km.')}</section>`}
    ${cards}
    <section class="card span-6"><div class="card-title"><span>Agregar vehículo</span></div>
      <form id="addVehForm" class="form-grid" autocomplete="off" novalidate>
        <div class="field" style="grid-column:span 2"><label for="vName">Nombre</label><input class="input" id="vName" placeholder="Ej. Honda City" required><div class="err" data-err="vName"></div></div>
        <div class="field"><label for="vYear">Año</label><input class="input" id="vYear" type="number" min="1950" max="2030" placeholder="2022"></div>
        <div class="field"><label for="vPlate">Placas</label><input class="input" id="vPlate" placeholder="ABC-123-D"></div>
        <div class="field"><label for="vFuel">Combustible</label><select class="input" id="vFuel"><option>Magna</option><option>Premium</option><option>Diésel</option><option>Híbrido</option></select></div>
        <div class="field"><label for="vTank">Tanque (L)</label><input class="input" id="vTank" type="number" min="1" max="200" placeholder="45"></div>
        <div style="grid-column:span 2;display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('plus', 16)} Agregar vehículo</button></div>
      </form>
    </section>
  </div>`;
  }

  function renderAjustes() {
    return `<div class="view settings">
    <div class="stack">
      <section class="card"><h3 class="sec-title">Preferencias</h3>
        <div class="set-row"><div><b>Vehículo predeterminado</b><p>Se preselecciona al registrar viajes y cargas.</p></div><select class="input" id="setVeh" data-change="set-veh" aria-label="Vehículo predeterminado">${S.vehicles.length ? S.vehicles.map((v) => `<option value="${v.id}" ${S.settings.defaultVehicle === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option>Sin vehículos</option>'}</select></div>
        <div class="set-row"><div><b>Etiqueta predeterminada</b><p>La etiqueta con la que empieza cada viaje nuevo.</p></div><div class="seg" role="group" aria-label="Etiqueta predeterminada">${['Trabajo', 'Personal'].map((t) => `<button aria-pressed="${S.settings.defaultTag === t}" data-action="set-tag" data-tag="${t}">${t}</button>`).join('')}</div></div>
        <div class="set-row"><div><b>Mostrar pistas de atajos</b><p>Muestra las teclas N, G, E, / y Esc junto a los botones.</p></div><button class="switch-bare" role="switch" aria-checked="${!!S.settings.hints}" data-action="toggle-hints" aria-label="Mostrar pistas de atajos"><span class="track"></span></button></div>
        <div class="set-row"><div><b>Menú contraído</b><p>Muestra solo los íconos del menú lateral.</p></div><button class="switch-bare" role="switch" aria-checked="${!!S.ui.collapsed}" data-action="toggle-collapse" aria-label="Menú contraído"><span class="track"></span></button></div>
      </section>
      <section class="card"><h3 class="sec-title">Datos</h3>
        <div class="set-row"><div><b>Almacenamiento</b><p>${FS.handle ? `Se guarda automáticamente en la caché del navegador y en ${FS_FILE} (carpeta «${esc(FS.handle.name)}»). ${esc(fsInfo().label)}.` : Store.ok ? `Se guarda automáticamente en la caché de este navegador, sin conexión.${FS.supported ? ' Elige una carpeta de datos en Respaldo para guardarlo también en un archivo.' : ''}` : 'El almacenamiento local no está disponible; los datos viven solo en memoria hasta cerrar.'}</p></div><span class="badge ${FS.handle ? (['ok', 'busy'].includes(fsInfo().tone) ? 'green' : '') : Store.ok ? 'green' : ''}">${FS.handle ? 'Archivo' : Store.ok ? 'Navegador' : 'Memoria'}</span></div>
        <div class="set-row"><div><b>Restablecer datos de ejemplo</b><p>Reemplaza tus datos por los viajes y cargas de muestra.</p></div><button class="btn" data-action="reset-demo">${icon('refresh', 16)} Restablecer</button></div>
        <div class="set-row"><div><b>Borrar todos los datos</b><p>Elimina viajes, cargas, lugares y vehículos de este equipo.</p></div><button class="btn btn-danger" data-action="wipe">${icon('trash', 16)} Borrar todo</button></div>
      </section>
    </div>
    <div class="stack">
      <section class="card"><h3 class="sec-title">Atajos de teclado</h3>
        <div class="kbd-list"><div><span>Nuevo viaje</span><kbd>N</kbd></div><div><span>Nueva carga de gasolina</span><kbd>G</kbd></div><div><span>Editar el viaje seleccionado</span><kbd>E</kbd></div><div><span>Buscar</span><kbd>/</kbd></div><div><span>Cerrar panel o detalle</span><kbd>Esc</kbd></div><div><span>Guardar en un panel</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span></div><div><span>Moverse entre viajes</span><span><kbd>↑</kbd> <kbd>↓</kbd></span></div></div>
      </section>
      <section class="card"><h3 class="sec-title">Acerca de Trayecto</h3><p class="muted-sm" style="margin-top:6px">Versión 2.1. Tus datos nunca salen de este equipo y la app funciona sin conexión: los mapas reales necesitan internet y, sin él, se usa un mapa esquemático. Todas las funciones son gratuitas, sin anuncios ni suscripciones.</p></section>
    </div>
  </div>`;
  }

  function renderRespaldo() {
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

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  };
  const VIEWS = {
    inicio: {
      title: 'Inicio',
      sub: () => `${greet()} · así van tus trayectos`,
      render: renderInicio,
    },
    viajes: {
      title: 'Viajes',
      sub: () =>
        `${S.trips.length} ${S.trips.length === 1 ? 'viaje registrado' : 'viajes registrados'}`,
      render: renderViajes,
      ph: 'Buscar por lugar, vehículo o fecha…',
    },
    gasolina: {
      title: 'Gasolina',
      sub: () =>
        `${S.fuel.length} ${S.fuel.length === 1 ? 'carga registrada' : 'cargas registradas'}`,
      render: renderGasolina,
      ph: 'Buscar gasolinera o vehículo…',
    },
    lugares: {
      title: 'Lugares',
      sub: () =>
        `${S.places.length} ${S.places.length === 1 ? 'lugar guardado' : 'lugares guardados'}`,
      render: renderLugares,
      ph: 'Buscar lugares…',
    },
    estadisticas: {
      title: 'Estadísticas',
      sub: () => 'Tendencias de los últimos 6 meses',
      render: renderEstadisticas,
    },
    vehiculos: {
      title: 'Vehículos',
      sub: () => `${S.vehicles.length} ${S.vehicles.length === 1 ? 'vehículo' : 'vehículos'}`,
      render: renderVehiculos,
    },
    ajustes: {
      title: 'Ajustes',
      sub: () => 'Preferencias de la aplicación',
      render: renderAjustes,
    },
    respaldo: {
      title: 'Respaldo',
      sub: () => 'Tus datos viven solo en este equipo',
      render: renderRespaldo,
    },
  };
  const SEARCHABLE = ['viajes', 'gasolina', 'lugares'];

  /* ================= Render y navegación ================= */
  const app = $('#app'),
    contentEl = $('#content'),
    qEl = $('#q');
  function render(viewChanged) {
    derive();
    const v = VIEWS[S.ui.view] || VIEWS.inicio;
    const ae = document.activeElement;
    let rid = null,
      sel = null;
    if (ae && contentEl.contains(ae) && ae.id) {
      rid = ae.id;
      try {
        if (typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd];
      } catch (_) {}
    }
    $('#pageTitle').textContent = v.title;
    $('#pageSub').textContent = v.sub();
    qEl.placeholder = v.ph || 'Buscar viajes…';
    $$('.nav-item[data-view]').forEach((b) =>
      b.dataset.view === S.ui.view
        ? b.setAttribute('aria-current', 'page')
        : b.removeAttribute('aria-current'),
    );
    if (Loc && S.ui.view !== 'lugares') Loc = null;
    parkMaps(contentEl);
    contentEl.innerHTML = v.render();
    mountMaps(contentEl);
    syncPlay();
    if (viewChanged) contentEl.firstElementChild?.classList.add('fade');
    if (rid) {
      const el = document.getElementById(rid);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel)
          try {
            el.setSelectionRange(sel[0], sel[1]);
          } catch (_) {}
      }
    }
  }
  function go(view, keepQ) {
    if (!VIEWS[view]) return;
    const changed = S.ui.view !== view;
    S.ui.view = view;
    if (!keepQ) {
      S.ui.q = '';
      qEl.value = '';
    }
    save();
    render(changed);
    if (changed) window.scrollTo({ top: 0 });
  }
  function applyChrome() {
    app.classList.toggle('collapsed', !!S.ui.collapsed);
    document.body.classList.toggle('no-hints', !S.settings.hints);
    const cb = $('#btnCollapse');
    if (cb) {
      const l = S.ui.collapsed ? 'Expandir menú' : 'Contraer menú';
      cb.querySelector('.nav-label').textContent = l;
      cb.dataset.tip = l;
      cb.setAttribute('aria-label', l);
      cb.setAttribute('aria-expanded', String(!S.ui.collapsed));
    }
    paintStatusBtn();
  }
  function buildChrome() {
    const nb = ([v, l, ic]) =>
      `<div class="nav-wrap"><button class="nav-item" data-view="${v}" data-tip="${l}">${icon(ic)}<span class="nav-label">${l}</span></button></div>`;
    $('#navMain').innerHTML = [
      ['inicio', 'Inicio', 'home'],
      ['viajes', 'Viajes', 'route'],
      ['gasolina', 'Gasolina', 'fuel'],
      ['lugares', 'Lugares', 'pin'],
      ['estadisticas', 'Estadísticas', 'chart'],
    ]
      .map(nb)
      .join('');
    $('#navBottom').innerHTML =
      [
        ['vehiculos', 'Vehículos', 'car'],
        ['ajustes', 'Ajustes', 'sliders'],
        ['respaldo', 'Respaldo', 'archive'],
      ]
        .map(nb)
        .join('') +
      `<div class="nav-wrap"><button class="nav-item" id="btnCollapse"><span class="collapse-ico">${icon('panel')}</span><span class="nav-label">Contraer menú</span></button></div>`;
    $('#btnNew').innerHTML =
      `${icon('plus', 18)}<span class="nav-label">Nuevo registro</span><span class="chev nav-label">${icon('chevDown', 16)}</span>`;
    $('#newMenu').innerHTML =
      `<button class="menu-item" role="menuitem" data-new="trip"><span class="mi-ico">${icon('route', 16)}</span><span>Viaje</span><kbd class="hint">N</kbd></button><button class="menu-item" role="menuitem" data-new="fuel"><span class="mi-ico">${icon('fuel', 16)}</span><span>Carga de gasolina</span><kbd class="hint">G</kbd></button>`;
    $('#searchIco').innerHTML = icon('search', 16);
    $('#searchIco').style.display = 'flex';
    $('#todayChip').innerHTML =
      icon('calendar', 15) +
      esc(
        cap(
          new Date().toLocaleDateString('es-MX', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        ),
      );
    $$('.nav-item[data-view]').forEach((b) =>
      b.addEventListener('click', () => go(b.dataset.view)),
    );
    $('#btnCollapse').addEventListener('click', () => {
      S.ui.collapsed = !S.ui.collapsed;
      save();
      applyChrome();
      hideTip();
      if (S.ui.view === 'ajustes') render();
    });
  }

  /* ---- Tooltip del menú contraído ---- */
  const tipEl = $('#tip');
  function showTip(el) {
    const r = el.getBoundingClientRect();
    tipEl.textContent = el.dataset.tip;
    tipEl.style.left = r.right + 12 + 'px';
    tipEl.style.top = r.top + r.height / 2 + 'px';
    tipEl.hidden = false;
  }
  function hideTip() {
    tipEl.hidden = true;
  }
  ['mouseover', 'focusin'].forEach((ev) =>
    document.querySelector('.sidebar').addEventListener(ev, (e) => {
      const el = e.target.closest('[data-tip]');
      if (el && app.classList.contains('collapsed') && $('#newMenu').hidden) showTip(el);
      else hideTip();
    }),
  );
  ['mouseout', 'focusout'].forEach((ev) =>
    document.querySelector('.sidebar').addEventListener(ev, hideTip),
  );

  /* ---- Menú "Nuevo registro" ---- */
  const btnNew = $('#btnNew'),
    menu = $('#newMenu');
  function openMenu(focusFirst) {
    menu.hidden = false;
    btnNew.setAttribute('aria-expanded', 'true');
    hideTip();
    if (focusFirst) menu.querySelector('[role=menuitem]').focus();
  }
  function closeMenu(restore) {
    if (menu.hidden) return;
    menu.hidden = true;
    btnNew.setAttribute('aria-expanded', 'false');
    if (restore) btnNew.focus();
  }
  btnNew.addEventListener('click', (e) => {
    menu.hidden ? openMenu(e.detail === 0) : closeMenu();
  });
  btnNew.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu(true);
    }
  });
  menu.addEventListener('keydown', (e) => {
    const items = $$('[role=menuitem]', menu),
      i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Tab') closeMenu();
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-new]');
    if (!b) return;
    closeMenu();
    b.dataset.new === 'trip' ? openTripPanel() : openFuelPanel();
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.new-wrap')) closeMenu();
  });

  /* ---- Búsqueda ---- */
  qEl.addEventListener('input', () => {
    S.ui.q = qEl.value;
    if (!SEARCHABLE.includes(S.ui.view)) {
      S.ui.view = 'viajes';
      render(true);
    } else render();
  });
  function focusSearch() {
    if (drawerOpen) return;
    if (!SEARCHABLE.includes(S.ui.view)) go('viajes');
    qEl.focus();
    qEl.select();
  }

  /* ================= Panel lateral ================= */
  const drawer = $('#drawer'),
    backdrop = $('#backdrop');
  let drawerOpen = false,
    drawerOpener = null,
    drawerGuard = null;
  function drawerHead(title, ic, eyebrow = 'Nuevo registro', ok) {
    return `<div class="drawer-head"><div class="dh-ico${ok ? ' ok' : ''}">${icon(ic, 20)}</div><div><div class="eyebrow">${esc(eyebrow)}</div><h2 id="drawerTitle">${esc(title)}</h2></div><div class="close-wrap"><kbd class="hint">Esc</kbd><button type="button" class="icon-btn" data-dz="close" aria-label="Cerrar panel">${icon('x')}</button></div></div>`;
  }
  function openDrawer(html, focusSel) {
    if (!drawerOpen) drawerOpener = document.activeElement;
    drawerGuard = null;
    parkMaps(drawer);
    drawer.innerHTML = html;
    mountMaps(drawer);
    drawer.inert = false;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawerOpen = true;
    hideTip();
    requestAnimationFrame(() => {
      const f =
        (focusSel && drawer.querySelector(focusSel)) || drawer.querySelector('input,select,button');
      f?.focus({ preventScroll: true });
    });
  }
  function closeDrawer() {
    if (!drawerOpen) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.inert = true;
    drawerOpen = false;
    drawerGuard = null;
    const o = drawerOpener;
    drawerOpener = null;
    if (o && document.contains(o) && o !== document.body) o.focus({ preventScroll: true });
    /* al terminar de deslizarse, libera el mapa del resumen (y su contexto WebGL) si el panel sigue cerrado */
    setTimeout(() => {
      if (!drawerOpen && drawer.querySelector('[data-tmap]')) {
        parkMaps(drawer);
        drawer.innerHTML = '';
        mountMaps(drawer);
      }
    }, 450);
  }
  /* Cierre iniciado por el usuario (Esc, clic fuera, Cancelar, ✕): en modo edición pide confirmar si hay cambios sin guardar */
  async function requestCloseDrawer() {
    if (!drawerOpen) return;
    if (
      drawerGuard &&
      drawerGuard() &&
      !(await confirmDialog({
        title: '¿Descartar los cambios?',
        body: 'Tienes cambios sin guardar en este panel. Si lo cierras, se perderán.',
        ok: 'Descartar',
        danger: false,
      }))
    )
      return;
    closeDrawer();
  }
  backdrop.addEventListener('click', requestCloseDrawer);
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const f = drawer.querySelector('form');
      if (f) {
        e.preventDefault();
        f.requestSubmit();
      }
    }
    if (e.key === 'Tab') {
      const fs = $$(
        'button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])',
        drawer,
      ).filter((x) => x.offsetParent !== null || x.type === 'radio');
      if (!fs.length) return;
      const first = fs[0],
        last = fs[fs.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  drawer.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-dz]');
    if (!el) return;
    const a = el.dataset.dz;
    if (a === 'close') requestCloseDrawer();
    else if (a === 'delete') {
      if (await (el.dataset.kind === 'trip' ? deleteTrip : deleteFuel)(el.dataset.id))
        closeDrawer();
    } else if (a === 'go-veh') {
      closeDrawer();
      go('vehiculos');
    } else if (a === 'swap') {
      const o = $('#tOrigin'),
        d = $('#tDest');
      [o.value, d.value] = [d.value, o.value];
      o.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (a === 'dl-summary') {
      const t = S.trips.find((x) => x.id === el.dataset.id);
      if (t) downloadTripPNG(t);
    } else if (a === 'view-trip') {
      S.ui.selTrip = el.dataset.id;
      S.ui.tf = { tag: 'Todos', vehicle: 'all', from: '', to: '' };
      closeDrawer();
      go('viajes');
      document.getElementById('row-' + el.dataset.id)?.scrollIntoView({ block: 'nearest' });
    } else if (a === 'another') openTripPanel();
  });

  /* ---- Autocompletado ---- */
  function setupCombo(inp, getOpts, newNote) {
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
  const placeOpts = () => {
    const vis = placeVisits();
    return [...S.places]
      .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0))
      .map((p) => ({
        label: p.name,
        meta: [p.area, vis[p.id] ? `${vis[p.id]} visitas` : ''].filter(Boolean).join(' · '),
        icon: kindIcon(p.kind),
      }));
  };
  const stationOpts = () => {
    const m = new Map();
    S.fuel.forEach((f) => m.set(f.station, (m.get(f.station) || 0) + 1));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => ({ label: s, meta: `${n} ${n === 1 ? 'carga' : 'cargas'}`, icon: 'fuel' }));
  };
  function setErr(form, id, msg) {
    const i = form.querySelector('#' + id),
      e = form.querySelector(`[data-err="${id}"]`);
    if (i) {
      i.classList.toggle('invalid', !!msg);
      i.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    if (e) e.textContent = msg || '';
  }
  const vehOptions = (sel) =>
    S.vehicles
      .map(
        (v) => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.name)}</option>`,
      )
      .join('');
  const noVehicleDrawer = (title) =>
    openDrawer(
      drawerHead(title, 'car') +
        `<div class="drawer-body">${emptyState('car', 'Primero agrega un vehículo', 'Necesitas al menos un vehículo para registrar viajes y cargas de gasolina.', `<button class="btn btn-primary" data-dz="go-veh">${icon('car', 16)} Ir a Vehículos</button>`)}</div>`,
    );
  const defVeh = () =>
    vehById(S.settings.defaultVehicle) ? S.settings.defaultVehicle : S.vehicles[0].id;

  /* Pie común de los paneles; en modo edición, "Eliminar" a la izquierda en lugar de la pista de Ctrl+Enter */
  const drawerFoot = (formId, saveLabel, del) =>
    `<div class="drawer-foot">${del ? `<button type="button" class="btn btn-danger" data-dz="delete" data-kind="${del.kind}" data-id="${del.id}" style="margin-right:auto">${icon('trash', 16)} Eliminar</button>` : `<span class="foot-hint hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> guarda</span>`}<button type="button" class="btn btn-ghost" data-dz="close">Cancelar</button><button type="submit" form="${formId}" class="btn btn-primary">${icon('check', 16)} ${saveLabel}</button></div>`;
  /* Pide confirmar el cierre del panel si algún campo cambió respecto a lo que se abrió (edición y registros nuevos) */
  function guardChanges(f) {
    const snap = () =>
      JSON.stringify(
        [...f.elements].map((el) =>
          el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value,
        ),
      ) + (f.querySelector('#fFull')?.getAttribute('aria-checked') || '');
    const init = snap();
    drawerGuard = () => snap() !== init;
  }

  /* ---- Nuevo viaje / Editar viaje ---- */
  function openTripPanel(edit) {
    closeMenu();
    derive();
    if (!S.vehicles.length) return noVehicleDrawer(edit ? 'Editar viaje' : 'Nuevo viaje');
    const dv = edit && vehById(edit.vehicleId) ? edit.vehicleId : defVeh(),
      now = new Date(),
      dep = `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}`;
    const hasC = !!(edit && compOf(edit)),
      cu = hasC ? edit.computerUnit : S.settings.computerUnit === 'l100' ? 'l100' : 'kmpl',
      cval = hasC ? +(cu === 'l100' ? 100 / edit.computerKmpl : edit.computerKmpl).toFixed(2) : '';
    const combo = (id, label, ph, val) =>
      `<div class="field"><label for="${id}">${label}</label><div class="combo"><input class="input" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-lb" placeholder="${ph}" value="${esc(val || '')}" autocomplete="off"><ul class="combo-list" id="${id}-lb" role="listbox" aria-label="Lugares guardados" hidden></ul></div><div class="err" data-err="${id}"></div></div>`;
    openDrawer(
      drawerHead(
        edit ? 'Editar viaje' : 'Nuevo viaje',
        'route',
        edit ? 'Editar registro' : undefined,
      ) +
        `
  <form id="tripForm" class="drawer-body" novalidate autocomplete="off">
    <div class="route-box">${combo('tOrigin', 'Origen', '¿De dónde saliste?', edit?.origin)}<button type="button" class="icon-btn swap-btn" data-dz="swap" aria-label="Intercambiar origen y destino" title="Intercambiar">${icon('swapH', 16)}</button>${combo('tDest', 'Destino', '¿A dónde llegaste?', edit?.destination)}</div>
    <div class="row row-3">
      <div class="field"><label for="tDate">Fecha</label><input class="input" type="date" id="tDate" value="${edit ? edit.date : isoDate(now)}"><div class="err" data-err="tDate"></div></div>
      <div class="field"><label for="tDep">Salida</label><input class="input" type="time" id="tDep" value="${edit ? fromMin(toMin(edit.depart)) : dep}"></div>
      <div class="field"><label for="tArr">Llegada</label><input class="input" type="time" id="tArr" value="${edit ? fromMin(toMin(edit.arrive)) : ''}"><div class="err" data-err="tArr"></div></div>
    </div>
    <div class="row row-2">
      <div class="field"><label for="tOdoS">Odómetro inicial</label><div class="input-unit"><input class="input num" type="number" step="0.1" min="0" id="tOdoS" value="${edit ? edit.odoStart : D.vs[dv]?.odo || ''}" inputmode="decimal"><span>km</span></div><div class="err" data-err="tOdoS"></div></div>
      <div class="field"><label for="tOdoE">Odómetro final</label><div class="input-unit"><input class="input num" type="number" step="0.1" min="0" id="tOdoE" value="${edit ? edit.odoEnd : ''}" inputmode="decimal"><span>km</span></div><div class="err" data-err="tOdoE"></div></div>
    </div>
    <div class="row row-2">
      <div class="field"><label for="tVeh">Vehículo</label><select class="input" id="tVeh">${vehOptions(dv)}</select></div>
      <div class="field"><span class="lbl" id="tTagL">Etiqueta</span><div class="seg" role="radiogroup" aria-labelledby="tTagL">${['Trabajo', 'Personal'].map((t) => `<label><input type="radio" name="tTag" value="${t}" ${(edit ? edit.tag : S.settings.defaultTag) === t ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
    </div>
    <div class="field"><label for="tComp">Rendimiento de la computadora (opcional)</label>
      <div class="comp-row"><input class="input num" type="number" step="any" min="0" id="tComp" value="${cval}" inputmode="decimal" aria-describedby="tCompHelp tCompErr"><select class="input" id="tCompUnit" aria-label="Unidad del rendimiento"><option value="kmpl" ${cu === 'kmpl' ? 'selected' : ''}>km/L</option><option value="l100" ${cu === 'l100' ? 'selected' : ''}>L/100 km</option></select></div>
      <div class="help" id="tCompHelp">El que marca el tablero al terminar el viaje. Si lo capturas, se usa para calcular el costo de este viaje</div><div class="err" id="tCompErr" data-err="tComp"></div></div>
    <div class="calc" aria-live="polite">
      <div><small>Distancia</small><b id="cKm" class="empty-v">—</b></div>
      <div><small>Duración</small><b id="cDur" class="empty-v">—</b></div>
      <div><small>Vel. promedio</small><b id="cSpd" class="empty-v">—</b></div>
    </div>
    <div class="calc-foot"><span>Litros estimados</span><b id="cLit" style="color:var(--text)">—</b></div>
    <div class="calc-foot"><span>Costo estimado de combustible <span class="muted-xs" id="cBasis"></span></span><b id="cCost">—</b></div>
  </form>
  ${drawerFoot('tripForm', edit ? 'Guardar cambios' : 'Guardar viaje', edit && { kind: 'trip', id: edit.id })}`,
      edit ? '#tDate' : '#tOrigin',
    );
    const f = $('#tripForm'),
      g = (id) => f.querySelector('#' + id);
    let odoDirty = !!edit;
    setupCombo(g('tOrigin'), placeOpts, (v) => `“${v}” se guardará como lugar nuevo`);
    setupCombo(g('tDest'), placeOpts, (v) => `“${v}” se guardará como lugar nuevo`);
    const setV = (id, html) => {
      const el = g(id);
      el.innerHTML = html ?? '—';
      el.classList.toggle('empty-v', html == null);
    };
    const upd = () => {
      const sv = g('tOdoS').value,
        ev = g('tOdoE').value,
        s = parseFloat(sv),
        e = parseFloat(ev);
      const km = sv !== '' && ev !== '' && e > s ? e - s : null;
      const dep = g('tDep').value,
        arr = g('tArr').value;
      let dur = null;
      if (dep && arr && dep !== arr) {
        dur = toMin(arr) - toMin(dep);
        if (dur <= 0) dur += 1440;
      }
      const vid = g('tVeh').value;
      setV('cKm', km != null ? `${fmtKm(km)}<span class="u">km</span>` : null);
      setV('cDur', dur != null ? durHTML(dur) : null);
      setV(
        'cSpd',
        km != null && dur ? `${NF0.format(km / (dur / 60))}<span class="u">km/h</span>` : null,
      );
      const cr = readComputer(f),
        kmpl = cr.kmpl || kmplOf(vid);
      g('tComp').placeholder = g('tCompUnit').value === 'l100' ? 'Ej. 7.0' : 'Ej. 14.2';
      setErr(f, 'tComp', cr.err);
      g('cLit').textContent = km != null ? `${NF1.format(km / kmpl)} L` : '—';
      g('cCost').textContent = km != null ? MXN.format((km / kmpl) * priceOf(vid)) : '—';
      g('cBasis').textContent =
        `(${NF1.format(kmpl)} km/L${cr.kmpl ? ' de la computadora' : ''} · ${MXN.format(priceOf(vid))}/L)`;
    };
    f.addEventListener('input', upd);
    f.addEventListener('change', upd);
    g('tOdoS').addEventListener('input', () => {
      odoDirty = true;
    });
    g('tVeh').addEventListener('change', () => {
      if (!odoDirty) g('tOdoS').value = D.vs[g('tVeh').value]?.odo || '';
      upd();
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTrip(f, edit);
    });
    upd();
    guardChanges(f);
  }
  /* Ubica un lugar nuevo: cerca del lugar de referencia según los km del viaje (~18 px/km) y lejos de los demás pines */
  function newPlacePos(name, anchor, km) {
    const h = hashStr(norm(name)),
      a = anchor ? placePos(anchor) : null;
    let best = null,
      bestD = -1;
    for (let i = 0; i < 48; i++) {
      let x, y;
      if (a && km) {
        const ang = (((h % 360) + i * 37) * Math.PI) / 180,
          r = Math.min(380, Math.max(70, km * 18)) * (1 + (i % 4) * 0.08);
        x = a.x + Math.cos(ang) * r;
        y = a.y + Math.sin(ang) * r;
      } else {
        const hh = hashStr(norm(name) + i);
        x = 70 + (hh % 660);
        y = 50 + ((hh >>> 10) % 420);
      }
      x = Math.max(50, Math.min(750, x));
      y = Math.max(40, Math.min(480, y));
      const d = Math.min(
        9999,
        ...S.places
          .map(placeXY)
          .filter(Boolean)
          .map((q) => Math.hypot(q.x - x, q.y - y)),
      );
      if (d >= 90) return { x: Math.round(x), y: Math.round(y) };
      if (d > bestD) {
        bestD = d;
        best = { x: Math.round(x), y: Math.round(y) };
      }
    }
    return best;
  }
  function canonicalPlace(name, anchor, km) {
    const n = name.trim().replace(/\s+/g, ' ');
    const p = S.places.find((p) => norm(p.name) === norm(n));
    if (p) return p.name;
    const pos = newPlacePos(n, anchor, km);
    S.places.push({
      id: uid('p'),
      name: n,
      area: '',
      lat: null,
      lng: null,
      x: pos.x,
      y: pos.y,
      kind: 'other',
    });
    return n;
  }
  /* Lee el rendimiento de la computadora del formulario: {kmpl (normalizado, null si vacío o inválido), unit, err} */
  function readComputer(f) {
    const raw = f.querySelector('#tComp').value.trim(),
      unit = f.querySelector('#tCompUnit').value === 'l100' ? 'l100' : 'kmpl';
    if (raw === '') return { kmpl: null, unit, err: '' };
    const v = parseFloat(raw);
    if (!isFinite(v) || v <= 0) return { kmpl: null, unit, err: 'Escribe un número mayor a 0.' };
    const k = unit === 'l100' ? 100 / v : v;
    if (k < CK_MIN - 1e-9 || k > CK_MAX + 1e-9)
      return {
        kmpl: null,
        unit,
        err:
          unit === 'l100'
            ? `Debe estar entre ${NF1.format(100 / CK_MAX)} y ${NF1.format(100 / CK_MIN)} L/100 km.`
            : `Debe estar entre ${CK_MIN} y ${CK_MAX} km/L.`,
      };
    return { kmpl: k, unit, err: '' };
  }
  function saveTrip(f, edit) {
    const g = (id) => f.querySelector('#' + id);
    let errs = [];
    const o = g('tOrigin').value.trim(),
      d = g('tDest').value.trim(),
      date = g('tDate').value,
      dep = g('tDep').value,
      arr = g('tArr').value;
    const s = parseFloat(g('tOdoS').value),
      e = parseFloat(g('tOdoE').value);
    const chk = (id, msg) => {
      setErr(f, id, msg);
      if (msg) errs.push(id);
    };
    chk('tOrigin', o ? '' : 'Escribe el lugar de origen.');
    chk('tDest', d ? '' : 'Escribe el lugar de destino.');
    chk('tDate', date ? '' : 'Elige la fecha.');
    chk(
      'tArr',
      !dep || !arr
        ? 'Indica la hora de salida y de llegada.'
        : dep === arr
          ? 'La llegada debe ser distinta a la salida.'
          : '',
    );
    chk('tOdoS', isFinite(s) && s >= 0 ? '' : 'Captura el odómetro inicial.');
    chk(
      'tOdoE',
      !isFinite(e)
        ? 'Captura el odómetro final.'
        : isFinite(s) && e <= s
          ? 'Debe ser mayor al inicial.'
          : isFinite(s) && e - s > 2000
            ? 'La distancia parece demasiado grande.'
            : '',
    );
    const cr = readComputer(f);
    chk('tComp', cr.err);
    if (errs.length) {
      g(errs[0]).focus();
      return;
    }
    const oKnown = S.places.some((p) => norm(p.name) === norm(o)),
      origin = canonicalPlace(o, oKnown ? null : d, e - s),
      destination = canonicalPlace(d, origin, e - s);
    const t = {
      id: uid('t'),
      date,
      depart: dep,
      arrive: arr,
      origin,
      destination,
      odoStart: s,
      odoEnd: e,
      vehicleId: g('tVeh').value,
      tag: f.querySelector('input[name=tTag]:checked')?.value || 'Trabajo',
      ...cleanComputer(cr.kmpl, cr.unit),
    };
    if (cr.kmpl) S.settings.computerUnit = cr.unit; /* recuerda la última unidad usada */
    if (edit) {
      /* actualiza en su lugar (mismo id); la ruta se regenera solo si la generó la app y cambió algo de lo que la define */
      const cur = S.trips.find((x) => x.id === edit.id);
      if (!cur) {
        closeDrawer();
        return;
      }
      const sig = (x) =>
        [
          x.date,
          fromMin(toMin(x.depart)),
          fromMin(toMin(x.arrive)),
          x.origin,
          x.destination,
          +x.odoStart,
          +x.odoEnd,
        ].join('|');
      const moved = sig(cur) !== sig(t);
      Object.assign(cur, { ...t, id: cur.id });
      if (cur.pointsSource === 'auto' && moved) cur.points = tripPoints(cur, S.places);
      save();
      render();
      closeDrawer();
      document.getElementById('row-' + cur.id)?.focus({ preventScroll: true });
      toast('Viaje actualizado');
      return;
    }
    t.points = tripPoints(t, S.places);
    t.pointsSource = 'auto';
    S.trips.push(t);
    save();
    render();
    showTripSummary(t);
    toast('Viaje guardado');
  }
  function showTripSummary(t) {
    const km = tripKm(t),
      dur = tripDur(t);
    drawerGuard = null;
    parkMaps(drawer);
    drawer.innerHTML =
      drawerHead('Viaje guardado', 'check', 'Listo', true) +
      `
  <div class="drawer-body">
    <div class="summary">
      <div class="sum-top"><span class="logo">${$('.logo').innerHTML}</span>Trayecto<span class="muted-sm">${esc(cap(fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' })))} · ${esc(t.depart)}–${esc(t.arrive)}</span></div>
      <div class="sum-route">${esc(t.origin)}<span class="arrow">${icon('arrowRight', 18)}</span>${esc(t.destination)}</div>
      <div style="margin-bottom:14px">${tagHTML(t.tag)}</div>
      ${tripMapHTML(t, 380, 180, 'resumen', 'static')}
      <div class="sum-grid">
        <div><div class="stat-label">Distancia</div><div class="stat-val">${fmtKm(km)}<span class="u">km</span></div></div>
        <div><div class="stat-label">Duración</div><div class="stat-val">${durHTML(dur)}</div></div>
        <div><div class="stat-label">Vel. promedio</div><div class="stat-val">${NF0.format(tripSpeed(t))}<span class="u">km/h</span></div></div>
        <div><div class="stat-label">Costo estimado</div><div class="stat-val" style="color:var(--accent)">${money(tripCost(t), true)}</div></div>
      </div>
      <div class="sum-foot"><span>${esc(vehName(t.vehicleId))}</span><span class="num">${NF1.format(t.odoStart)} → ${NF1.format(t.odoEnd)} km</span></div>
    </div>
  </div>
  <div class="drawer-foot"><button type="button" class="btn btn-ghost" data-dz="another">${icon('plus', 16)} Registrar otro</button><button type="button" class="btn" data-dz="view-trip" data-id="${t.id}">Ver en Viajes</button><button type="button" class="btn btn-primary" data-dz="dl-summary" data-id="${t.id}" id="dlSummary">${icon('download', 16)} Descargar PNG</button></div>`;
    mountMaps(drawer);
    $('#dlSummary').focus();
  }

  /* ---- Nueva carga / Editar carga ---- */
  function openFuelPanel(edit) {
    closeMenu();
    derive();
    if (!S.vehicles.length) return noVehicleDrawer(edit ? 'Editar carga' : 'Nueva carga');
    const dv = edit && vehById(edit.vehicleId) ? edit.vehicleId : defVeh(),
      today = isoDate(new Date());
    openDrawer(
      drawerHead(
        edit ? 'Editar carga' : 'Nueva carga de gasolina',
        'fuel',
        edit ? 'Editar registro' : undefined,
      ) +
        `
  <form id="fuelForm" class="drawer-body" novalidate autocomplete="off">
    <div class="row row-2">
      <div class="field"><label for="fDate">Fecha</label><input class="input" type="date" id="fDate" value="${edit ? edit.date : today}"><div class="err" data-err="fDate"></div></div>
      <div class="field"><label for="fVeh">Vehículo</label><select class="input" id="fVeh">${vehOptions(dv)}</select></div>
    </div>
    <div class="field"><label for="fStation">Gasolinera</label><div class="combo"><input class="input" id="fStation" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="fStation-lb" placeholder="Ej. Pemex Av. Universidad" value="${esc(edit?.station || '')}" autocomplete="off"><ul class="combo-list" id="fStation-lb" role="listbox" aria-label="Gasolineras frecuentes" hidden></ul></div><div class="err" data-err="fStation"></div></div>
    <div class="field"><label for="fOdo">Odómetro</label><div class="input-unit"><input class="input num" type="number" step="1" min="0" id="fOdo" value="${edit ? edit.odometer : ''}" inputmode="numeric"><span>km</span></div><div class="help" id="fOdoHelp"></div><div class="err" data-err="fOdo"></div></div>
    <div class="row row-2">
      <div class="field"><label for="fLit">Litros</label><div class="input-unit"><input class="input num" type="number" step="0.01" min="0" id="fLit" value="${edit ? edit.liters : ''}" inputmode="decimal"><span>L</span></div><div class="err" data-err="fLit"></div></div>
      <div class="field"><label for="fPrice">Precio por litro</label><div class="input-unit pre"><input class="input num" type="number" step="0.01" min="0" id="fPrice" value="${edit ? edit.price : priceOf(dv) ? NF2.format(priceOf(dv)).replace(/,/g, '') : ''}" inputmode="decimal"><span>$</span></div><div class="err" data-err="fPrice"></div></div>
    </div>
    <div class="total-box"><span>Total calculado</span><b class="num" id="fTotal">$0.00</b></div>
    <button type="button" class="switch" role="switch" aria-checked="${edit ? !!edit.full : true}" id="fFull"><span><b>Tanque lleno</b><small>Necesario para calcular el km/L entre dos cargas</small></span><span class="track"></span></button>
    <div class="calc two" aria-live="polite"><div><small>Desde el último lleno</small><b id="fKm" class="empty-v">—</b></div><div><small>Rendimiento</small><b id="fKmpl" class="empty-v">—</b></div></div>
    <p class="muted-xs" id="fNote" style="margin-top:10px"></p>
  </form>
  ${drawerFoot('fuelForm', edit ? 'Guardar cambios' : 'Guardar carga', edit && { kind: 'fuel', id: edit.id })}`,
      edit ? '#fDate' : '#fStation',
    );
    const f = $('#fuelForm'),
      g = (id) => f.querySelector('#' + id);
    let priceDirty = !!edit;
    setupCombo(g('fStation'), stationOpts, (v) => `Nueva gasolinera: “${v}”`);
    const setV = (id, html) => {
      const el = g(id);
      el.innerHTML = html ?? '—';
      el.classList.toggle('empty-v', html == null);
    };
    const upd = () => {
      const vid = g('fVeh').value,
        odo = parseFloat(g('fOdo').value),
        lit = parseFloat(g('fLit').value),
        pr = parseFloat(g('fPrice').value),
        full = g('fFull').getAttribute('aria-checked') === 'true';
      g('fTotal').textContent = MXN.format(isFinite(lit) && isFinite(pr) ? lit * pr : 0);
      const loads = S.fuel
        .filter((x) => x.vehicleId === vid && x.id !== edit?.id)
        .sort((a, b) => a.odometer - b.odometer);
      const lastOdo = loads.length ? loads[loads.length - 1].odometer : null;
      g('fOdoHelp').textContent =
        lastOdo != null
          ? `Última carga de este vehículo: ${NF0.format(lastOdo)} km`
          : 'Primera carga registrada para este vehículo';
      let lastFull = null,
        acc = 0;
      if (isFinite(odo))
        for (const x of loads) {
          if (x.odometer >= odo) break;
          if (x.full) {
            lastFull = x.odometer;
            acc = 0;
          } else acc += x.liters;
        }
      const km = lastFull != null && isFinite(odo) ? odo - lastFull : null;
      setV('fKm', km != null ? `${NF0.format(km)}<span class="u">km</span>` : null);
      const kmpl = km != null && full && isFinite(lit) && lit > 0 ? km / (acc + lit) : null;
      setV('fKmpl', kmpl != null ? `${NF1.format(kmpl)}<span class="u">km/L</span>` : null);
      g('fNote').textContent = !isFinite(odo)
        ? 'Captura el odómetro para calcular el rendimiento.'
        : lastFull == null
          ? 'Esta será tu carga de referencia: el rendimiento se calculará en la siguiente carga de tanque lleno.'
          : !full
            ? `Carga parcial: sus litros se sumarán al siguiente tanque lleno.`
            : acc
              ? `Incluye ${NF1.format(acc)} L de cargas parciales intermedias.`
              : '';
    };
    f.addEventListener('input', upd);
    f.addEventListener('change', upd);
    g('fPrice').addEventListener('input', () => {
      priceDirty = true;
    });
    g('fVeh').addEventListener('change', () => {
      if (!priceDirty) {
        const p = priceOf(g('fVeh').value);
        g('fPrice').value = p ? p.toFixed(2) : '';
      }
      upd();
    });
    g('fFull').addEventListener('click', () => {
      const el = g('fFull');
      el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true'));
      upd();
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      saveFuel(f, edit);
    });
    upd();
    guardChanges(f);
  }
  function saveFuel(f, edit) {
    const g = (id) => f.querySelector('#' + id),
      errs = [];
    const chk = (id, msg) => {
      setErr(f, id, msg);
      if (msg) errs.push(id);
    };
    const vid = g('fVeh').value,
      date = g('fDate').value,
      st = g('fStation').value.trim().replace(/\s+/g, ' '),
      odo = parseFloat(g('fOdo').value),
      lit = parseFloat(g('fLit').value),
      pr = parseFloat(g('fPrice').value),
      full = g('fFull').getAttribute('aria-checked') === 'true';
    chk('fDate', date ? '' : 'Elige la fecha.');
    chk('fStation', st ? '' : 'Escribe la gasolinera.');
    chk(
      'fOdo',
      !isFinite(odo) || odo <= 0
        ? 'Captura el odómetro.'
        : S.fuel.some(
              (x) => x.id !== edit?.id && x.vehicleId === vid && Math.abs(x.odometer - odo) < 0.5,
            )
          ? 'Ya hay una carga con ese odómetro.'
          : '',
    );
    chk(
      'fLit',
      !isFinite(lit) || lit <= 0
        ? 'Captura los litros.'
        : lit > 200
          ? 'Revisa la cantidad de litros.'
          : '',
    );
    chk(
      'fPrice',
      !isFinite(pr) || pr <= 0
        ? 'Captura el precio por litro.'
        : pr > 100
          ? 'Revisa el precio por litro.'
          : '',
    );
    if (errs.length) {
      g(errs[0]).focus();
      return;
    }
    const canon = S.fuel.find((x) => norm(x.station) === norm(st))?.station || st;
    const cur = edit && S.fuel.find((x) => x.id === edit.id);
    if (edit && !cur) {
      closeDrawer();
      return;
    }
    const nf = cur || { id: uid('f') };
    Object.assign(nf, {
      date,
      station: canon,
      odometer: odo,
      liters: +lit.toFixed(2),
      price: +pr.toFixed(2),
      full,
      vehicleId: vid,
    });
    if (!cur) S.fuel.push(nf);
    save();
    render();
    derive();
    closeDrawer();
    if (cur)
      document
        .querySelector(`[data-action="edit-fuel"][data-id="${nf.id}"]`)
        ?.focus({ preventScroll: true });
    const k = D.kmpl[nf.id];
    toast(
      cur
        ? k
          ? `Carga actualizada · ${NF1.format(k)} km/L`
          : 'Carga actualizada'
        : k
          ? `Carga guardada · ${NF1.format(k)} km/L`
          : 'Carga guardada',
    );
  }

  /* ================= PNG con canvas ================= */
  function rr(x, X, Y, W, H, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + W, Y, X + W, Y + H, r);
    x.arcTo(X + W, Y + H, X, Y + H, r);
    x.arcTo(X, Y + H, X, Y, r);
    x.arcTo(X, Y, X + W, Y, r);
    x.closePath();
  }
  function tripCanvas(t) {
    const W = 1200,
      H = 630,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const F = '"Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    x.fillStyle = '#0B0B0D';
    x.fillRect(0, 0, W, H);
    const gr = x.createRadialGradient(1020, 60, 10, 1020, 60, 560);
    gr.addColorStop(0, 'rgba(255,176,32,.18)');
    gr.addColorStop(1, 'rgba(255,176,32,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, W, H);
    rr(x, 36, 36, W - 72, H - 72, 28);
    x.fillStyle = '#16161A';
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.lineWidth = 2;
    x.stroke();
    rr(x, 76, 74, 42, 42, 12);
    x.fillStyle = ACC;
    x.fill();
    x.strokeStyle = '#1A1206';
    x.lineWidth = 3.4;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(87, 108);
    x.lineTo(94, 82);
    x.moveTo(107, 108);
    x.lineTo(100, 82);
    x.moveTo(97, 87);
    x.lineTo(97, 89);
    x.moveTo(97, 94);
    x.lineTo(97, 97);
    x.moveTo(97, 102);
    x.lineTo(97, 105);
    x.stroke();
    x.textBaseline = 'middle';
    x.fillStyle = '#EDEDF0';
    x.font = `700 24px ${F}`;
    x.fillText('Trayecto', 132, 96);
    x.textAlign = 'right';
    x.fillStyle = '#8A8A96';
    x.font = `500 20px ${F}`;
    x.fillText(
      `${cap(fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${t.depart}–${t.arrive}`,
      W - 76,
      96,
    );
    x.textAlign = 'left';
    let size = 54;
    const measure = () => {
      x.font = `700 ${size}px ${F}`;
      return x.measureText(t.origin).width + x.measureText(t.destination).width + size * 1.6;
    };
    while (measure() > 620 && size > 28) size -= 2;
    x.font = `700 ${size}px ${F}`;
    x.fillStyle = '#EDEDF0';
    let cx = 76;
    const ry = 196;
    x.fillText(t.origin, cx, ry);
    cx += x.measureText(t.origin).width + size * 0.3;
    x.strokeStyle = ACC;
    x.lineWidth = Math.max(3, size * 0.08);
    x.beginPath();
    x.moveTo(cx, ry);
    x.lineTo(cx + size * 0.8, ry);
    x.moveTo(cx + size * 0.55, ry - size * 0.22);
    x.lineTo(cx + size * 0.8, ry);
    x.lineTo(cx + size * 0.55, ry + size * 0.22);
    x.stroke();
    cx += size * 1.1;
    x.fillText(t.destination, cx, ry);
    const tagCol = t.tag === 'Personal' ? '#C3A6FF' : '#7DB3FF';
    x.font = `600 18px ${F}`;
    const tw = x.measureText(t.tag).width;
    rr(x, 76, 248, tw + 44, 34, 17);
    x.fillStyle = t.tag === 'Personal' ? 'rgba(182,156,255,.14)' : 'rgba(108,168,255,.14)';
    x.fill();
    x.fillStyle = tagCol;
    x.beginPath();
    x.arc(94, 265, 4, 0, Math.PI * 2);
    x.fill();
    x.fillText(t.tag, 106, 266);
    x.fillStyle = '#8A8A96';
    x.font = `500 19px ${F}`;
    x.fillText(
      `${vehName(t.vehicleId)} · odómetro ${NF1.format(t.odoStart)} → ${NF1.format(t.odoEnd)} km`,
      76,
      316,
    );
    if (compOf(t)) {
      x.fillStyle = ACC;
      x.font = `600 19px ${F}`;
      x.fillText(`Rendimiento (computadora): ${fmtComp(t)}`, 76, 350);
    }
    const MX = 760,
      MY = 136,
      MW = 364,
      MH = 210;
    rr(x, MX, MY, MW, MH, 18);
    x.fillStyle = '#0F0F12';
    x.fill();
    x.save();
    rr(x, MX, MY, MW, MH, 18);
    x.clip();
    x.strokeStyle = 'rgba(255,255,255,.045)';
    x.lineWidth = 1;
    for (let i = MX + 11; i < MX + MW; i += 22) {
      x.beginPath();
      x.moveTo(i, MY);
      x.lineTo(i, MY + MH);
      x.stroke();
    }
    for (let j = MY + 11; j < MY + MH; j += 22) {
      x.beginPath();
      x.moveTo(MX, j);
      x.lineTo(MX + MW, j);
      x.stroke();
    }
    const real = Array.isArray(t.points) && t.points.length >= 2;
    let tp,
      cols = null;
    if (real) {
      /* ruta real: lat/lng a km (con la corrección por latitud), encuadrada en el recuadro sin deformarla */
      const kx = 111.32 * Math.cos((t.points[0].lat * Math.PI) / 180),
        q = t.points.map((p) => ({ x: p.lng * kx, y: -p.lat * 111.2 }));
      const x0 = Math.min(...q.map((p) => p.x)),
        x1 = Math.max(...q.map((p) => p.x)),
        y0 = Math.min(...q.map((p) => p.y)),
        y1 = Math.max(...q.map((p) => p.y));
      const bw = Math.max(0.2, x1 - x0),
        bh = Math.max(0.2, y1 - y0),
        sc = Math.min((MW - 90) / bw, (MH - 80) / bh);
      tp = q.map((p) => ({
        x: MX + MW / 2 + (p.x - (x0 + x1) / 2) * sc,
        y: MY + MH / 2 + (p.y - (y0 + y1) / 2) * sc,
      }));
      cols = smoothSpeeds(t.points).map(speedColor);
    } else {
      const pts = routePts(t.origin, t.destination),
        xs = pts.map((p) => p.x),
        ys = pts.map((p) => p.y);
      const bw = Math.max(40, Math.max(...xs) - Math.min(...xs)),
        bh = Math.max(40, Math.max(...ys) - Math.min(...ys));
      const sc = Math.min((MW - 90) / bw, (MH - 80) / bh),
        ox = MX + MW / 2 - (Math.min(...xs) + bw / 2) * sc,
        oy = MY + MH / 2 - (Math.min(...ys) + bh / 2) * sc;
      tp = pts.map((p) => ({ x: p.x * sc + ox, y: p.y * sc + oy }));
    }
    const line = (w, col) => {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.lineJoin = 'round';
      x.lineCap = 'round';
      x.beginPath();
      tp.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
      x.stroke();
    };
    line(14, 'rgba(255,176,32,.18)');
    if (cols) {
      /* degradado de velocidad: cada tramo va del color de un punto al del siguiente */
      x.lineWidth = 4.5;
      x.lineCap = 'round';
      for (let i = 1; i < tp.length; i++) {
        const g = x.createLinearGradient(tp[i - 1].x, tp[i - 1].y, tp[i].x, tp[i].y);
        g.addColorStop(0, cols[i - 1]);
        g.addColorStop(1, cols[i]);
        x.strokeStyle = g;
        x.beginPath();
        x.moveTo(tp[i - 1].x, tp[i - 1].y);
        x.lineTo(tp[i].x, tp[i].y);
        x.stroke();
      }
    } else line(4.5, ACC);
    const a = tp[0],
      b = tp[tp.length - 1];
    x.fillStyle = '#0F0F12';
    x.strokeStyle = '#EDEDF0';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(a.x, a.y, 7, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.fillStyle = 'rgba(255,176,32,.25)';
    x.beginPath();
    x.arc(b.x, b.y, 15, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = ACC;
    x.beginPath();
    x.arc(b.x, b.y, 8, 0, Math.PI * 2);
    x.fill();
    x.restore();
    if (real) {
      const ly = MY + MH + 19,
        lg = x.createLinearGradient(MX + 20, 0, MX + 78, 0);
      lg.addColorStop(0, speedColor(0));
      lg.addColorStop(0.5, speedColor(20));
      lg.addColorStop(1, speedColor(40));
      x.font = `600 13px ${F}`;
      x.fillStyle = '#8A8A96';
      x.textAlign = 'left';
      x.fillText('0', MX, ly);
      rr(x, MX + 20, ly - 3, 58, 6, 3);
      x.fillStyle = lg;
      x.fill();
      x.fillStyle = '#8A8A96';
      x.fillText('40+ km/h', MX + 86, ly);
      x.textAlign = 'right';
      x.fillText(
        `Vel. máx. ${NF0.format(Math.max(...t.points.map((p) => p.speed)))} km/h`,
        MX + MW,
        ly,
      );
      x.textAlign = 'left';
    }
    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(76, 384);
    x.lineTo(W - 76, 384);
    x.stroke();
    const dur = tripDur(t),
      stats = [
        ['DISTANCIA', fmtKm(tripKm(t)), 'km'],
        [
          'DURACIÓN',
          dur < 60 ? String(dur) : `${Math.floor(dur / 60)}:${pad(dur % 60)}`,
          dur < 60 ? 'min' : 'h',
        ],
        ['VEL. PROMEDIO', NF0.format(tripSpeed(t)), 'km/h'],
        ['COSTO EST.', '$' + NF2.format(tripCost(t)), 'MXN'],
      ];
    const colW = (W - 152) / 4;
    stats.forEach(([l, v, u], i) => {
      const sx = 76 + colW * i;
      x.fillStyle = '#8B8B97';
      x.font = `650 15px ${F}`;
      x.fillText(l, sx, 428);
      x.fillStyle = i === 3 ? ACC : '#EDEDF0';
      x.font = `700 58px ${F}`;
      x.fillText(v, sx, 490);
      const vw = x.measureText(v).width;
      x.fillStyle = '#A6A6B0';
      x.font = `500 22px ${F}`;
      x.fillText(u, sx + vw + 8, 498);
    });
    x.fillStyle = '#6E6E7A';
    x.font = `500 16px ${F}`;
    x.fillText('Registrado sin conexión con Trayecto', 76, 556);
    return c;
  }
  function downloadTripPNG(t) {
    try {
      const c = tripCanvas(t);
      const name = `trayecto-${norm(t.origin).replace(/\W+/g, '-')}-${norm(t.destination).replace(/\W+/g, '-')}-${t.date}.png`;
      if (c.toBlob)
        c.toBlob((b) => {
          if (b) {
            download(name, b);
            toast('Tarjeta descargada');
          } else toast('No se pudo generar la imagen', 'err');
        }, 'image/png');
      else {
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = name;
        a.click();
      }
    } catch (e) {
      toast('No se pudo generar la imagen', 'err');
    }
  }
  function download(name, data, mime) {
    const blob =
      data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 800);
  }

  /* ================= Diálogo de confirmación y avisos ================= */
  const modalWrap = $('#modalWrap');
  let modalOpen = false;
  function confirmDialog({ title, body, ok = 'Eliminar', danger = true }) {
    return new Promise((res) => {
      const prev = document.activeElement;
      modalWrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico${danger ? '' : ' neutral'}">${icon(danger ? 'trash' : 'alert', 22)}</div><h2 id="mTitle">${esc(title)}</h2><p id="mBody">${esc(body)}</p><div class="modal-actions"><button class="btn" data-m="0">Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="1">${esc(ok)}</button></div></div>`;
      modalWrap.classList.add('open');
      modalOpen = true;
      const btns = $$('[data-m]', modalWrap);
      btns[0].focus();
      const done = (v) => {
        modalWrap.classList.remove('open');
        modalWrap.innerHTML = '';
        modalOpen = false;
        document.removeEventListener('keydown', onKey, true);
        if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
        res(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          done(false);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const i = btns.indexOf(document.activeElement);
          btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      modalWrap.onclick = (e) => {
        const b = e.target.closest('[data-m]');
        if (b) done(b.dataset.m === '1');
        else if (e.target === modalWrap) done(false);
      };
    });
  }
  function toast(msg, kind = 'ok', opt) {
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

  /* ================= Respaldo ================= */
  const csvCell = (v) => {
    let s = v == null ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    /* evita que Excel interprete texto como fórmula */ return /[",\n;]/.test(s)
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const toCSV = (rows) => '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  /* Datos tal como se guardan en un respaldo (también en el archivo de datos): sin ui y con lastBackup en null */
  const snapshot = () => ({
    vehicles: S.vehicles,
    places: S.places,
    trips: S.trips,
    fuel: S.fuel,
    settings: { ...S.settings, lastBackup: null },
  });
  const backupPayload = () => ({
    app: 'Trayecto',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: snapshot(),
  });
  function exportJSON() {
    const payload = backupPayload();
    download(
      `trayecto-respaldo-${isoDate(new Date())}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    S.settings.lastBackup = new Date().toISOString();
    save();
    render();
    toast('Respaldo exportado');
  }
  function exportCSV(kind) {
    if (kind === 'trips') {
      const rows = [
        [
          'fecha',
          'salida',
          'llegada',
          'origen',
          'destino',
          'vehiculo',
          'etiqueta',
          'odometro_inicial',
          'odometro_final',
          'distancia_km',
          'duracion_min',
          'velocidad_kmh',
          'costo_estimado_mxn',
          'rendimiento_computadora_km_l',
        ],
      ];
      [...S.trips]
        .sort((a, b) => tripKey(a).localeCompare(tripKey(b)))
        .forEach((t) =>
          rows.push([
            t.date,
            t.depart,
            t.arrive,
            t.origin,
            t.destination,
            vehName(t.vehicleId),
            t.tag,
            t.odoStart,
            t.odoEnd,
            tripKm(t).toFixed(1),
            tripDur(t),
            tripSpeed(t).toFixed(1),
            tripCost(t).toFixed(2),
            compOf(t) ? +compOf(t).toFixed(2) : '',
          ]),
        );
      download(`trayecto-viajes-${isoDate(new Date())}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      toast('Viajes exportados a CSV');
    } else {
      const rows = [
        [
          'fecha',
          'vehiculo',
          'gasolinera',
          'odometro',
          'litros',
          'precio_litro',
          'total_mxn',
          'tanque_lleno',
          'km_l',
        ],
      ];
      [...S.fuel]
        .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
        .forEach((f) =>
          rows.push([
            f.date,
            vehName(f.vehicleId),
            f.station,
            f.odometer,
            f.liters,
            f.price,
            fuelTotal(f).toFixed(2),
            f.full ? 'sí' : 'no',
            D.kmpl[f.id] ? D.kmpl[f.id].toFixed(2) : '',
          ]),
        );
      download(`trayecto-cargas-${isoDate(new Date())}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      toast('Cargas exportadas a CSV');
    }
  }
  /* Validación y saneado de un respaldo ya analizado (importar, leer el archivo de datos y validar antes de escribirlo).
   Devuelve {error} o {data:{vehicles,places,trips,fuel,settings}, raw:{conteos originales}}: lo que no pasa el filtro se descarta y se nota en raw */
  function parseBackup(o) {
    const d = o && (o.data || o);
    if (!d || !Array.isArray(d.trips) || !Array.isArray(d.fuel) || !Array.isArray(d.vehicles))
      return { error: 'El archivo no parece un respaldo de Trayecto' };
    const ver = +((o && o.version) || d.version) || 1;
    if (ver > DATA_VERSION) return { error: 'El respaldo es de una versión más nueva de Trayecto' };
    const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
    const okTime = (s) => /^\d{1,2}:\d{2}$/.test(String(s || ''));
    const vehicles = d.vehicles
      .filter((v) => v && v.name)
      .map((v, i) => ({
        id: String(v.id || uid('v')),
        name: String(v.name),
        year: v.year ? +v.year : '',
        plate: String(v.plate || ''),
        fuel: String(v.fuel || 'Magna'),
        tank: +v.tank || '',
        color: String(v.color || PALETTE[i % PALETTE.length]),
      }));
    const places = (Array.isArray(d.places) ? d.places : [])
      .filter((p) => p && p.name)
      .map((p) => cleanPlace(p, ver < DATA_VERSION));
    const trips = d.trips
      .filter(
        (t) =>
          t &&
          okDate(t.date) &&
          okTime(t.depart) &&
          okTime(t.arrive) &&
          isFinite(t.odoStart) &&
          isFinite(t.odoEnd) &&
          t.origin &&
          t.destination,
      )
      .map((t) => {
        const c = {
          id: String(t.id || uid('t')),
          date: String(t.date).slice(0, 10),
          depart: t.depart,
          arrive: t.arrive,
          origin: String(t.origin),
          destination: String(t.destination),
          odoStart: +t.odoStart,
          odoEnd: +t.odoEnd,
          vehicleId: String(t.vehicleId || ''),
          tag: t.tag === 'Personal' ? 'Personal' : 'Trabajo',
        };
        return Object.assign(
          c,
          cleanComputer(t.computerKmpl, t.computerUnit),
          resolvePoints(c, t.points, t.pointsSource, places),
        );
      });
    const fuel = d.fuel
      .filter(
        (f) =>
          f && okDate(f.date) && isFinite(f.odometer) && isFinite(f.liters) && isFinite(f.price),
      )
      .map((f) => ({
        id: String(f.id || uid('f')),
        date: String(f.date).slice(0, 10),
        station: String(f.station || 'Sin nombre'),
        odometer: +f.odometer,
        liters: +f.liters,
        price: +f.price,
        full: f.full !== false,
        vehicleId: String(f.vehicleId || ''),
      }));
    return {
      data: { vehicles, places, trips, fuel, settings: Object.assign({}, d.settings || {}) },
      raw: {
        trips: d.trips.length,
        fuel: d.fuel.length,
        vehicles: d.vehicles.length,
        places: Array.isArray(d.places) ? d.places.length : 0,
      },
    };
  }
  /* Reemplaza los datos de la app por unos ya saneados (conserva las preferencias de pantalla; lastBackup solo si se pide) */
  function adoptData(data, keepLastBackup) {
    const ui = {
      ...S.ui,
      selTrip: null,
      selPlace: null,
      selPair: null,
      tf: { tag: 'Todos', vehicle: 'all', from: '', to: '' },
    };
    const settings = Object.assign({}, data.settings, { hints: S.settings.hints });
    if (keepLastBackup) settings.lastBackup = S.settings.lastBackup;
    S = normalize({
      vehicles: data.vehicles,
      places: data.places,
      trips: data.trips,
      fuel: data.fuel,
      settings,
      ui,
    });
    if (!vehById(S.settings.defaultVehicle)) S.settings.defaultVehicle = S.vehicles[0]?.id || null;
  }
  async function importJSON(text) {
    let o;
    try {
      o = JSON.parse(text);
    } catch (_) {
      toast('El archivo no es un JSON válido', 'err');
      return;
    }
    const r = parseBackup(o);
    if (r.error) {
      toast(r.error, 'err');
      return;
    }
    const { vehicles, places, trips, fuel } = r.data;
    const ok = await confirmDialog({
      title: '¿Reemplazar tus datos?',
      body: `Se importarán ${trips.length} viajes, ${fuel.length} cargas, ${places.length} lugares y ${vehicles.length} vehículos. Tus datos actuales se reemplazarán.${FS.handle ? ' El archivo de la carpeta de datos también se actualizará.' : ''}`,
      ok: 'Importar',
      danger: false,
    });
    if (!ok) return;
    adoptData(r.data);
    save();
    applyChrome();
    render();
    toast('Respaldo importado');
  }

  /* ================= Lugares: editar, eliminar y fusionar ================= */
  /* Los viajes guardan origin/destination como texto y se enlazan por norm(nombre): renombrar o fusionar reescribe ese texto en los viajes (nunca sus points, salvo regenerar las rutas 'auto' al fusionar).
   Eliminar y fusionar se pueden deshacer ~6 s: se guardan solo los campos que cambian y se restauran por referencia. */
  const KINDS = [
    ['home', 'Casa'],
    ['work', 'Trabajo'],
    ['gym', 'Gimnasio'],
    ['family', 'Familia'],
    ['other', 'Otro'],
  ];
  const tripsOf = (p) => {
    const n = norm(p.name);
    return S.trips.filter((t) => norm(t.origin) === n || norm(t.destination) === n);
  };
  const nTrips = (n) => `${n} ${n === 1 ? 'viaje' : 'viajes'}`;
  let pMenu = null,
    Undo = null;

  /* ---- Menú de acciones por lugar ---- */
  function closePlaceMenu(restore) {
    if (!pMenu) return;
    const { btn, el } = pMenu;
    pMenu = null;
    el.remove();
    if (document.contains(btn)) {
      btn.setAttribute('aria-expanded', 'false');
      if (restore) btn.focus({ preventScroll: true });
    }
  }
  function togglePlaceMenu(btn) {
    if (pMenu && pMenu.btn === btn) {
      closePlaceMenu(true);
      return;
    }
    closePlaceMenu();
    const p = S.places.find((x) => x.id === btn.dataset.id);
    if (!p) return;
    const items = [
      ['place-edit', 'edit', 'Editar'],
      ['locate-start', 'pin', validGeo(p.lat, p.lng) ? 'Mover ubicación' : 'Ubicar en el mapa'],
    ];
    if (S.places.length > 1) items.push(['place-merge', 'swapH', 'Fusionar con…']);
    items.push(['place-delete', 'trash', 'Eliminar']);
    const el = document.createElement('div');
    el.className = 'menu pmenu';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', `Acciones de ${p.name}`);
    el.innerHTML = items
      .map(
        ([a, ic, l]) =>
          `<button type="button" class="menu-item${a === 'place-delete' ? ' danger' : ''}" role="menuitem" data-action="${a}" data-id="${p.id}"><span class="mi-ico">${icon(ic, 16)}</span><span>${l}</span></button>`,
      )
      .join('');
    btn.closest('li').appendChild(el);
    btn.setAttribute('aria-expanded', 'true');
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height + 16)
      el.classList.add('up');
    pMenu = { btn, el };
    el.querySelector('[role=menuitem]').focus();
    el.addEventListener('keydown', (e) => {
      const its = $$('[role=menuitem]', el),
        i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        its[(i + 1) % its.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        its[(i - 1 + its.length) % its.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        its[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        its[its.length - 1].focus();
      } else if (e.key === 'Tab') closePlaceMenu(!e.shiftKey);
    });
  }
  document.addEventListener('click', (e) => {
    if (pMenu && !e.target.closest('.pmenu,[data-action=place-more]')) closePlaceMenu();
  });

  /* ---- Deshacer ---- */
  function showUndo(msg, fn) {
    clearUndo();
    const el = toast(msg, 'ok', {
      ms: 6000,
      action: {
        label: 'Deshacer',
        fn: () => {
          Undo = null;
          fn();
        },
      },
    });
    Undo = { el, fn };
    setTimeout(() => {
      if (Undo && Undo.el === el) Undo = null;
    }, 6000);
  }
  function clearUndo() {
    if (Undo) {
      Undo.el.remove();
      Undo = null;
    }
  }
  function runUndo() {
    if (!Undo) return;
    const { el, fn } = Undo;
    Undo = null;
    el.remove();
    fn();
  }
  /* Quita la selección que dependa del lugar (mapa, tiempos de traslado, modo ubicación) */
  function clearPlaceSel(p) {
    const n = norm(p.name);
    if (S.ui.selPlace === p.id) S.ui.selPlace = null;
    if (S.ui.selPair && S.ui.selPair.split('→').includes(n)) S.ui.selPair = null;
    if (Loc && Loc.id === p.id) Loc = null;
  }

  /* ---- Editar ---- */
  function openPlacePanel(p) {
    const cur = KINDS.some((k) => k[0] === p.kind) ? p.kind : 'other';
    openDrawer(
      drawerHead('Editar lugar', kindIcon(cur), 'Editar registro') +
        `
  <form id="placeForm" class="drawer-body" novalidate autocomplete="off">
    <div class="field"><label for="pName">Nombre</label><input class="input" id="pName" value="${esc(p.name)}" maxlength="60"><div class="err" data-err="pName"></div></div>
    <div class="field"><label for="pArea">Colonia o zona</label><input class="input" id="pArea" value="${esc(p.area || '')}" maxlength="60" placeholder="Opcional"></div>
    <div class="field"><span class="lbl" id="pKindL">Ícono</span><div class="kind-pick" role="radiogroup" aria-labelledby="pKindL">${KINDS.map(([k, l]) => `<label><input type="radio" name="pKind" value="${k}" ${cur === k ? 'checked' : ''}><span>${icon(kindIcon(k), 20)}<small>${l}</small></span></label>`).join('')}</div></div>
    <p class="muted-sm" id="pNote" aria-live="polite"></p>
  </form>` +
        drawerFoot('placeForm', 'Guardar cambios'),
      '#pName',
    );
    const f = $('#placeForm'),
      inp = $('#pName', f),
      note = $('#pNote', f),
      n = tripsOf(p).length;
    const upd = () => {
      const v = inp.value.trim().replace(/\s+/g, ' ');
      note.textContent =
        v && v !== p.name && n
          ? `Se actualizarán ${nTrips(n)} que usan «${p.name}»; sus rutas no cambian.`
          : '';
    };
    inp.addEventListener('input', () => {
      setErr(f, 'pName', '');
      upd();
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      savePlace(f, p);
    });
    guardChanges(f);
  }
  function savePlace(f, p) {
    const name = $('#pName', f).value.trim().replace(/\s+/g, ' '),
      area = $('#pArea', f).value.trim(),
      kind = f.querySelector('input[name=pKind]:checked')?.value || 'other';
    const dup = S.places.find((x) => x.id !== p.id && norm(x.name) === norm(name));
    setErr(
      f,
      'pName',
      !name
        ? 'Escribe un nombre para el lugar.'
        : dup
          ? `Ya existe un lugar llamado «${dup.name}».`
          : '',
    );
    if (!name || dup) {
      $('#pName', f).focus();
      return;
    }
    const old = p.name,
      on = norm(old);
    let k = 0;
    if (name !== old) {
      S.trips.forEach((t) => {
        let ch = false;
        if (norm(t.origin) === on) {
          t.origin = name;
          ch = true;
        }
        if (norm(t.destination) === on) {
          t.destination = name;
          ch = true;
        }
        if (ch) k++;
      });
      if (S.ui.selPair)
        S.ui.selPair = S.ui.selPair
          .split('→')
          .map((x) => (x === on ? norm(name) : x))
          .join('→'); /* el trayecto seleccionado sigue siendo el mismo */
    }
    p.name = name;
    p.area = area;
    p.kind = kind;
    save();
    render();
    closeDrawer();
    toast(k ? `Lugar actualizado · ${nTrips(k)} con el nombre nuevo` : 'Lugar actualizado');
  }

  /* ---- Eliminar ---- */
  async function deletePlace(id) {
    const p = S.places.find((x) => x.id === id);
    if (!p) return;
    const n = tripsOf(p).length;
    if (!n) {
      if (
        !(await confirmDialog({
          title: `¿Eliminar «${p.name}»?`,
          body: 'No tiene viajes asociados. Podrás deshacerlo durante unos segundos.',
          ok: 'Eliminar lugar',
        }))
      )
        return;
      removePlace(p, `Lugar «${p.name}» eliminado`);
      return;
    }
    const opts = [
      {
        value: 'keep',
        title: 'Conservar los viajes',
        lines: [
          `${n === 1 ? 'El viaje mantiene' : `Los ${n} viajes mantienen`} su texto y su ruta.`,
          'El lugar desaparece de la lista y del mapa.',
        ],
      },
    ];
    if (S.places.length > 1)
      opts.push({
        value: 'merge',
        title: 'Fusionar con otro lugar',
        lines: [
          `${n === 1 ? 'El viaje pasa' : `Los ${n} viajes pasan`} a usar otro lugar y sus rutas automáticas se ajustan.`,
        ],
      });
    const c = await chooseDialog({
      title: `«${p.name}» tiene ${nTrips(n)}`,
      body: 'Nunca se borran viajes. Elige qué hacer con ellos.',
      options: opts,
      cancel: 'Cancelar',
    });
    if (c === 'keep') removePlace(p, `Lugar «${p.name}» eliminado · ${nTrips(n)} conservados`);
    else if (c === 'merge') mergePlace(id);
  }
  function removePlace(p, msg) {
    const idx = S.places.indexOf(p),
      sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
    if (idx < 0) return;
    S.places.splice(idx, 1);
    clearPlaceSel(p);
    save();
    render();
    showUndo(msg, () => {
      if (S.places.some((x) => x.id === p.id || norm(x.name) === norm(p.name))) {
        toast(`No se pudo deshacer: ya existe un lugar «${p.name}»`, 'err');
        return;
      }
      S.places.splice(Math.min(idx, S.places.length), 0, p);
      Object.assign(S.ui, sel);
      save();
      render();
      toast('Cambios deshechos');
    });
  }

  /* ---- Fusionar ---- */
  function mergeDialog(src) {
    return new Promise((res) => {
      const prev = document.activeElement,
        vis = placeVisits(),
        n = tripsOf(src).length;
      const others = S.places
        .filter((p) => p.id !== src.id)
        .sort((a, b) => (vis[b.id] || 0) - (vis[a.id] || 0));
      modalWrap.innerHTML = `<div class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico neutral">${icon('swapH', 22)}</div><h2 id="mTitle">Fusionar «${esc(src.name)}»</h2><p id="mBody">Elige el lugar que se queda. «${esc(src.name)}» se elimina y sus viajes pasan a usar el nombre del lugar elegido.</p>
      <div class="field" style="margin:16px 0 8px"><label for="mergeDst">Fusionar con</label><select class="input" id="mergeDst"><option value="">Elige un lugar…</option>${others.map((p) => `<option value="${p.id}">${esc(p.name)}${p.area ? ' · ' + esc(p.area) : ''} (${vis[p.id] || 0} ${vis[p.id] === 1 ? 'visita' : 'visitas'})</option>`).join('')}</select></div>
      <p class="merge-sum" id="mergeSum" aria-live="polite"></p>
      <div class="modal-actions"><button type="button" class="btn" data-m="0">Cancelar</button><button type="button" class="btn btn-primary" data-m="1" disabled>Fusionar</button></div></div>`;
      modalWrap.classList.add('open');
      modalOpen = true;
      const sel = $('#mergeDst', modalWrap),
        sum = $('#mergeSum', modalWrap),
        ok = $('[data-m="1"]', modalWrap);
      sel.focus();
      sel.addEventListener('change', () => {
        const d = S.places.find((p) => p.id === sel.value);
        ok.disabled = !d;
        if (!d) {
          sum.textContent = '';
          return;
        }
        const auto = tripsOf(src).some((t) => t.pointsSource === 'auto');
        sum.textContent =
          (n
            ? `${n === 1 ? '1 viaje pasará' : `${n} viajes pasarán`} de «${src.name}» a «${d.name}».`
            : `«${src.name}» no tiene viajes; solo se eliminará el lugar.`) +
          (n && auto
            ? validGeo(d.lat, d.lng)
              ? ` Las rutas automáticas se ajustarán a la ubicación de «${d.name}».`
              : ` «${d.name}» no tiene ubicación: las rutas se conservan hasta que la ubiques.`
            : '');
      });
      const done = (v) => {
        modalWrap.classList.remove('open');
        modalWrap.innerHTML = '';
        modalOpen = false;
        document.removeEventListener('keydown', onKey, true);
        if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
        res(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          done(null);
        } else if (e.key === 'Tab') {
          const fs = [sel, ...$$('[data-m]', modalWrap).filter((b) => !b.disabled)];
          e.preventDefault();
          const i = fs.indexOf(document.activeElement);
          fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      modalWrap.onclick = (e) => {
        const b = e.target.closest('[data-m]');
        if (b && !b.disabled) done(b.dataset.m === '1' ? sel.value : null);
        else if (e.target === modalWrap) done(null);
      };
    });
  }
  async function mergePlace(srcId) {
    const src = S.places.find((x) => x.id === srcId);
    if (!src) return;
    const dstId = await mergeDialog(src),
      dst = dstId && S.places.find((x) => x.id === dstId);
    if (!dst || !S.places.includes(src)) return;
    const sn = norm(src.name),
      changed = [];
    S.trips.forEach((t) => {
      const o = norm(t.origin) === sn,
        d = norm(t.destination) === sn;
      if (!o && !d) return;
      changed.push({ t, origin: t.origin, destination: t.destination, points: t.points });
      if (o) t.origin = dst.name;
      if (d) t.destination = dst.name;
    });
    /* las rutas generadas por la app se rehacen con las coordenadas del destino; si no tiene ubicación (o la ruta ya era ajena) se conservan */
    changed.forEach((c) => {
      if (c.t.pointsSource === 'auto') {
        const pts = tripPoints(c.t, S.places);
        if (pts.length) c.t.points = pts;
      }
    });
    const idx = S.places.indexOf(src),
      sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
    S.places.splice(idx, 1);
    clearPlaceSel(src);
    save();
    render();
    showUndo(
      `«${src.name}» fusionado con «${dst.name}»${changed.length ? ` · ${nTrips(changed.length)}` : ''}`,
      () => {
        if (S.places.some((x) => x.id === src.id || norm(x.name) === norm(src.name))) {
          toast(`No se pudo deshacer: ya existe un lugar «${src.name}»`, 'err');
          return;
        }
        changed.forEach((c) => {
          if (S.trips.includes(c.t)) {
            c.t.origin = c.origin;
            c.t.destination = c.destination;
            c.t.points = c.points;
          }
        });
        S.places.splice(Math.min(idx, S.places.length), 0, src);
        Object.assign(S.ui, sel);
        save();
        render();
        toast('Cambios deshechos');
      },
    );
  }

  /* ================= Archivo de datos ================= */
  /* Persistencia en un archivo real con la File System Access API (Chrome/Edge). localStorage sigue siendo la caché: save() escribe ahí al instante
   y el archivo (trayecto-datos.json, mismo formato que el respaldo JSON v2) se escribe ~800 ms después, agrupando cambios.
   Nunca se escribe sin pasar parseBackup, ni se sobrescribe un archivo que cambió por fuera sin preguntar.
   `dirty` (en localStorage) marca cambios aún no escritos: si la pestaña se cierra antes de tiempo, la próxima sesión los empuja al archivo en lugar de descartarlos. */
  const FS_FILE = 'trayecto-datos.json',
    FS_DIR = 'respaldos',
    FS_KEEP = 14,
    FS_DELAY = 800,
    KEY_FS = 'trayecto:fs';
  const FS_HOLD = [
    'missing',
    'nofile',
    'invalid',
    'conflict',
  ]; /* estados que bloquean la escritura hasta que el usuario decida */
  const FS = {
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
    meta: (() => {
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
  const hasData = (d) => d.trips.length + d.fuel.length + d.places.length + d.vehicles.length > 0;
  const fmtWhen = (ms) =>
    new Date(ms).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const fmtHM = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  /* hints y lastBackup son preferencias de este equipo: no cuentan al decidir si dos versiones difieren */
  const canonKey = (d) =>
    JSON.stringify({ ...d, settings: { ...d.settings, hints: undefined, lastBackup: undefined } });

  /* ---- IndexedDB: guarda el identificador de la carpeta entre sesiones ---- */
  function idbOp(mode, fn) {
    return new Promise((res, rej) => {
      const r = indexedDB.open('trayecto-fs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction('kv', mode);
        let rq;
        try {
          rq = fn(tx.objectStore('kv'));
        } catch (e) {
          db.close();
          rej(e);
          return;
        }
        tx.oncomplete = () => {
          db.close();
          res(rq.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          rej(tx.error);
        };
      };
    });
  }
  const idbGet = (k) => idbOp('readonly', (s) => s.get(k)),
    idbSet = (k, v) => idbOp('readwrite', (s) => s.put(v, k)),
    idbDel = (k) => idbOp('readwrite', (s) => s.delete(k));

  /* ---- Validación y lectura ---- */
  /* Datos actuales pasados por parseBackup; falla si el filtro descartaría algo (el archivo no sería un respaldo fiel) */
  function validated() {
    const payload = backupPayload(),
      r = parseBackup(payload);
    if (r.error) return { error: r.error };
    const lost = [
      ['viaje', 'viajes', 'trips'],
      ['carga', 'cargas', 'fuel'],
      ['lugar', 'lugares', 'places'],
      ['vehículo', 'vehículos', 'vehicles'],
    ]
      .map(([o, m, k]) => {
        const c = S[k].length - r.data[k].length;
        return c > 0 ? `${c} ${c === 1 ? o : m}` : null;
      })
      .filter(Boolean);
    if (lost.length)
      return { error: 'No pasan la validación del respaldo: ' + lost.join(', ') + '.' };
    return { payload, data: r.data, key: canonKey(r.data) };
  }
  async function readFile(fh) {
    const f = await fh.getFile(),
      text = await f.text(),
      o = { mod: f.lastModified, empty: text.trim() === '', data: null, key: null, error: null };
    if (o.empty) return o;
    try {
      const r = parseBackup(JSON.parse(text));
      if (r.error) o.error = r.error;
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

  /* ---- Diálogo de elección entre versiones ---- */
  function chooseDialog({ title, body, options, cancel = 'Decidir después' }) {
    return new Promise((res) => {
      const prev = document.activeElement;
      modalWrap.innerHTML = `<div class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody"><div class="m-ico neutral">${icon('alert', 22)}</div><h2 id="mTitle">${esc(title)}</h2><p id="mBody">${esc(body)}</p><div class="choices">${options.map((o, i) => `<button type="button" class="choice" data-m="${i}"><b>${esc(o.title)}</b><span>${o.lines.map(esc).join('<br>')}</span></button>`).join('')}</div><div class="modal-actions"><button type="button" class="btn" data-m="x">${esc(cancel)}</button></div></div>`;
      modalWrap.classList.add('open');
      modalOpen = true;
      const btns = $$('[data-m]', modalWrap);
      btns[btns.length - 1].focus(); /* lo seguro por omisión: decidir después */
      const done = (v) => {
        modalWrap.classList.remove('open');
        modalWrap.innerHTML = '';
        modalOpen = false;
        document.removeEventListener('keydown', onKey, true);
        if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
        res(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          done(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const i = btns.indexOf(document.activeElement);
          btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      modalWrap.onclick = (e) => {
        const b = e.target.closest('[data-m]');
        if (b) done(b.dataset.m === 'x' ? null : options[+b.dataset.m].value);
        else if (e.target === modalWrap) done(null);
      };
    });
  }
  const sideLines = (d, when) => [
    `${d.trips.length} viajes · ${d.fuel.length} cargas · ${d.places.length} lugares`,
    'Última modificación: ' + when,
  ];
  const appWhen = () =>
    FS.meta.modified ? fmtWhen(Date.parse(FS.meta.modified)) : 'sin fecha registrada';
  function resolveConflict(cur, v) {
    trackModified();
    const opts = [
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
  function fsInfo() {
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
  const FS_NOTICES = {
    off: () => ({
      msg: `Reconectar carpeta de datos: el navegador necesita tu permiso para volver a usar «${FS.handle.name}». Mientras tanto se usa la caché.`,
      btns: [['fs-reconnect', 'Reconectar', 1]],
    }),
    missing: () => ({
      msg: `La carpeta de datos «${FS.handle.name}» ya no existe o no se puede abrir. Tus datos siguen en la caché del navegador.`,
      btns: [
        ['fs-pick', 'Elegir otra carpeta', 1],
        ['fs-resolve', 'Reintentar'],
      ],
    }),
    nofile: () => ({
      msg: `No se encontró ${FS_FILE} en «${FS.handle.name}». Tus datos siguen en la caché del navegador.`,
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
  function paintStatusBtn() {
    const info = fsInfo(),
      el = $('#fsStatus');
    el.hidden = !FS.supported;
    el.dataset.tone = info.tone;
    $('.fs-label', el).textContent = info.label;
    el.dataset.tip = `${info.label} — ${info.tip}`; /* menú contraído: lo muestra el tooltip propio */
    if (S.ui.collapsed) el.removeAttribute('title');
    else el.title = info.tip;
  }
  function paintFS() {
    paintStatusBtn();
    const nt = $('#fsNotice');
    if (nt) {
      const spec = FS.handle && FS_NOTICES[FS.state] ? FS_NOTICES[FS.state]() : null;
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
  function setState(state, detail) {
    const was = FS.state;
    FS.state = state;
    FS.detail = detail || '';
    FS.hold = FS_HOLD.includes(state) ? state : null;
    if (state === 'error' && was !== 'error')
      toast(FS.detail || 'Error al guardar el archivo', 'err');
    paintFS();
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
      ? `Último respaldo automático: ${fmtDate(FS.backups.last, { day: 'numeric', month: 'short', year: 'numeric' })} · ${FS.backups.count} ${FS.backups.count === 1 ? 'copia' : 'copias'} en ${FS_DIR}/ (se conservan las ${FS_KEEP} más recientes)`
      : `Aún no hay respaldos automáticos: se crea uno al primer guardado de cada día en ${FS_DIR}/.`;
    return `<section class="card span-12 banner${info.tone === 'ok' || info.tone === 'busy' ? '' : ' warn'}" id="fsCard"><div class="b-ico">${icon('folder', 22)}</div><div><h3>Carpeta de datos · «${esc(FS.handle.name)}» <span class="badge${info.tone === 'ok' ? ' green' : ''}">${esc(info.label)}</span></h3><p>${esc(info.tip)}</p><p>${esc(bk)}</p></div>
    <div class="fs-actions">${FS.state === 'off' ? `<button class="btn btn-primary" id="fsReconnect" data-action="fs-reconnect">${icon('refresh', 16)} Reconectar</button>` : ''}<button class="btn" id="fsPick" data-action="fs-pick">${icon('folder', 16)} Cambiar carpeta</button><button class="btn btn-ghost" id="fsForget" data-action="fs-forget">Dejar de usar</button></div></section>`;
  }

  /* ---- Respaldos diarios ---- */
  const BK_RE = /^trayecto-\d{4}-\d{2}-\d{2}\.json$/;
  async function listBackups(bd) {
    const names = [];
    for await (const [n, h] of bd.entries()) if (h.kind === 'file' && BK_RE.test(n)) names.push(n);
    return names.sort();
  }
  async function refreshBackups() {
    try {
      let names = [];
      try {
        names = await listBackups(await FS.handle.getDirectoryHandle(FS_DIR));
      } catch (e) {
        if (e.name !== 'NotFoundError') throw e;
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
  async function dailyBackup(fh, text) {
    try {
      const name = `trayecto-${isoDate(new Date())}.json`,
        bd = await FS.handle.getDirectoryHandle(FS_DIR, { create: true });
      try {
        await bd.getFileHandle(name);
        return;
      } catch (e) {
        if (e.name !== 'NotFoundError') throw e;
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
      while (names.length > FS_KEEP) await bd.removeEntry(names.shift());
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
    clearTimeout(FS.timer);
    FS.timer = setTimeout(tick, FS_DELAY);
  }
  async function tick() {
    clearTimeout(FS.timer);
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
  function failWrite(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') {
      FS.perm = 'prompt';
      setState('off');
    } else if (n === 'NotFoundError') setState('missing');
    else
      setState(
        'error',
        n === 'QuotaExceededError'
          ? 'No hay espacio suficiente en el disco para guardar el archivo.'
          : `No se pudo escribir ${FS_FILE}: ${(e && e.message) || n || 'error desconocido'}`,
      );
  }
  function markClean(rev) {
    if (FS.rev === rev && FS.meta.dirty) {
      FS.meta.dirty = false;
      saveMeta();
    }
  }
  function adoptSync(cur, rev) {
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
    if (v.error) {
      setState('error', v.error);
      return;
    }
    if (v.key === FS.syncKey) {
      markClean(rev);
      if (FS.state === 'saving') setState('ok');
      return;
    } /* nada nuevo que escribir (p. ej. solo cambió la pantalla) */
    setState('saving');
    let fh = null,
      f = null;
    try {
      fh = await FS.handle.getFileHandle(FS_FILE);
      f = await fh.getFile();
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
      fh = null;
    }
    if (f && f.lastModified !== FS.known) {
      /* cambió por fuera (otra pestaña o edición manual) */
      const cur = await readFile(fh);
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
    const target = fh || (await FS.handle.getFileHandle(FS_FILE, { create: true }));
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
    FS.syncKey = v.key;
    FS.savedAt = new Date();
    FS.meta.fileMod = FS.known;
    markClean(rev);
    saveMeta();
    setState('ok');
  }
  /* Carga en la app los datos del archivo (la caché se actualiza sin pasar por save(), que reprogramaría una escritura) */
  function applyFile(cur) {
    adoptData(cur.data, true);
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
  async function openLinked() {
    try {
      FS.perm = 'granted';
      FS.hold = null; /* se vuelve a evaluar todo: cada rama deja el estado que le toca */
      try {
        for await (const _ of FS.handle.values()) break;
      } catch (e) {
        if (e.name === 'NotFoundError') {
          setState('missing');
          return;
        }
        throw e;
      }
      let fh;
      try {
        fh = await FS.handle.getFileHandle(FS_FILE);
      } catch (e) {
        if (e.name === 'NotFoundError') {
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
      if (v.error) {
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
  async function linkFolder(dir) {
    trackModified();
    const v = validated();
    if (v.error) {
      toast('Tus datos no pasan la validación del respaldo: ' + v.error, 'err');
      return false;
    }
    let cur = null;
    try {
      cur = await readFile(await dir.getFileHandle(FS_FILE));
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        toast('No se pudo leer la carpeta: ' + (e.message || e.name), 'err');
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
    if (useFile) applyFile(cur);
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
    let dir;
    try {
      dir = await window.showDirectoryPicker({
        id: 'trayecto-datos',
        mode: 'readwrite',
        startIn: 'documents',
      });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('No se pudo abrir el selector de carpetas', 'err');
      return;
    }
    await linkFolder(dir);
  }
  async function reconnectFS() {
    if (!FS.handle) return;
    let p;
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
    clearTimeout(FS.timer);
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
  async function fsAction(a) {
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
  async function initFS() {
    try {
      if (navigator.storage && navigator.storage.persist)
        navigator.storage.persist().catch(() => {});
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
    let p = 'prompt';
    try {
      p = await FS.handle.queryPermission({ mode: 'readwrite' });
    } catch (e) {}
    FS.perm = p;
    if (p === 'granted') await openLinked();
    else setState('off');
  }
  afterSave = touch;
  const flushPending = () => {
    if (FS.timer) tick();
  };
  window.addEventListener('pagehide', flushPending);
  window.addEventListener('beforeunload', flushPending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
  $('#fsNotice').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (b) fsAction(b.dataset.action);
  });
  $('#fsStatus').addEventListener('click', () => {
    if (FS.state === 'off') reconnectFS();
    else go('respaldo');
  });

  /* ================= Eventos de contenido ================= */
  /* Eliminar con confirmación; devuelven true si se eliminó (los usa también el pie del panel en modo edición) */
  async function deleteTrip(id) {
    const t = S.trips.find((x) => x.id === id);
    if (!t) return false;
    if (
      !(await confirmDialog({
        title: '¿Eliminar este viaje?',
        body: `${t.origin} → ${t.destination}, ${fmtDate(t.date, { day: 'numeric', month: 'long' })}. Esta acción no se puede deshacer.`,
        ok: 'Eliminar viaje',
      }))
    )
      return false;
    S.trips = S.trips.filter((x) => x.id !== id);
    S.ui.selTrip = null;
    save();
    render();
    toast('Viaje eliminado');
    return true;
  }
  async function deleteFuel(id) {
    const f = S.fuel.find((x) => x.id === id);
    if (!f) return false;
    if (
      !(await confirmDialog({
        title: '¿Eliminar esta carga?',
        body: `${f.station}, ${fmtDate(f.date, { day: 'numeric', month: 'long' })} · ${MXN.format(fuelTotal(f))}. El rendimiento de las cargas cercanas se recalculará.`,
        ok: 'Eliminar carga',
      }))
    )
      return false;
    S.fuel = S.fuel.filter((x) => x.id !== id);
    save();
    render();
    toast('Carga eliminada');
    return true;
  }
  contentEl.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !contentEl.contains(el) || el.disabled) return;
    const a = el.dataset.action,
      id = el.dataset.id;
    switch (a) {
      case 'go':
        go(el.dataset.view);
        break;
      case 'new-trip':
        openTripPanel();
        break;
      case 'new-fuel':
        openFuelPanel();
        break;
      case 'open-trip':
        S.ui.selTrip = id;
        go('viajes');
        break;
      case 'dash-veh':
        S.ui.dashVeh = id;
        save();
        render();
        break;
      case 'sort': {
        const k = el.dataset.key,
          s = S.ui.sort;
        S.ui.sort =
          s.key === k
            ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
            : { key: k, dir: ['route', 'tag', 'vehicle'].includes(k) ? 'asc' : 'desc' };
        save();
        render();
        break;
      }
      case 'select-trip': {
        S.ui.selTrip = S.ui.selTrip === id ? null : id;
        save();
        render();
        document.getElementById('row-' + id)?.focus({ preventScroll: true });
        break;
      }
      case 'close-detail': {
        const sid = S.ui.selTrip;
        S.ui.selTrip = null;
        save();
        render();
        document.getElementById('row-' + sid)?.focus({ preventScroll: true });
        break;
      }
      case 'filter-tag':
        S.ui.tf.tag = el.dataset.tag;
        save();
        render();
        break;
      case 'clear-filters':
        S.ui.tf = { tag: 'Todos', vehicle: 'all', from: '', to: '' };
        S.ui.q = '';
        qEl.value = '';
        save();
        render();
        break;
      case 'download-trip': {
        const t = S.trips.find((x) => x.id === id);
        if (t) downloadTripPNG(t);
        break;
      }
      case 'edit-trip': {
        const t = S.trips.find((x) => x.id === id);
        if (t) openTripPanel(t);
        break;
      }
      case 'delete-trip':
        deleteTrip(id);
        break;
      case 'fuel-veh':
        S.ui.ff = id;
        save();
        render();
        break;
      case 'edit-fuel': {
        const f = S.fuel.find((x) => x.id === id);
        if (f) openFuelPanel(f);
        break;
      }
      case 'delete-fuel':
        deleteFuel(id);
        break;
      case 'place-more':
        togglePlaceMenu(el);
        break;
      case 'place-edit': {
        const p = S.places.find((x) => x.id === id);
        closePlaceMenu(true);
        if (p) openPlacePanel(p);
        break;
      }
      case 'place-merge':
        closePlaceMenu(true);
        mergePlace(id);
        break;
      case 'place-delete':
        closePlaceMenu(true);
        deletePlace(id);
        break;
      case 'place-select':
        S.ui.selPlace = S.ui.selPlace === id ? null : id;
        S.ui.selPair = null;
        render();
        {
          const f =
            document.getElementById('pl-' + id) && e.target.closest('.row-btn')
              ? document.getElementById('pl-' + id)
              : document.getElementById('mpin-' + id) || document.getElementById('pin-' + id);
          f?.focus({ preventScroll: true });
        }
        break;
      case 'places-layer':
        S.ui.placesLayer = el.dataset.layer;
        save();
        render();
        document.getElementById('lyr-' + el.dataset.layer)?.focus({ preventScroll: true });
        break;
      case 'locate-start':
        closePlaceMenu(true);
        startLocate(id);
        break;
      case 'locate-save':
        saveLocation();
        break;
      case 'locate-cancel':
        cancelLocate();
        break;
      case 'play-toggle':
        togglePlay(id);
        break;
      case 'play-speed':
        Play.speed = +el.dataset.speed;
        updatePlayUI();
        break;
      case 'pair-select':
        S.ui.selPair = S.ui.selPair === el.dataset.key ? null : el.dataset.key;
        render();
        document.getElementById(el.id)?.focus({ preventScroll: true });
        break;
      case 'clear-place':
        S.ui.selPlace = null;
        S.ui.selPair = null;
        render();
        break;
      case 'stat-tab':
        S.ui.statTab = el.dataset.tab;
        save();
        render();
        break;
      case 'veh-default':
        S.settings.defaultVehicle = id;
        save();
        render();
        toast('Vehículo predeterminado actualizado');
        break;
      case 'veh-delete': {
        const v = vehById(id);
        if (!v) break;
        const nt = S.trips.filter((t) => t.vehicleId === id).length,
          nf = S.fuel.filter((f) => f.vehicleId === id).length;
        if (
          await confirmDialog({
            title: `¿Eliminar ${v.name}?`,
            body:
              nt || nf
                ? `También se eliminarán ${nt} viajes y ${nf} cargas asociadas. Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.',
            ok: 'Eliminar vehículo',
          })
        ) {
          S.vehicles = S.vehicles.filter((x) => x.id !== id);
          S.trips = S.trips.filter((t) => t.vehicleId !== id);
          S.fuel = S.fuel.filter((f) => f.vehicleId !== id);
          if (S.settings.defaultVehicle === id)
            S.settings.defaultVehicle = S.vehicles[0]?.id || null;
          if (S.ui.tf.vehicle === id) S.ui.tf.vehicle = 'all';
          if (S.ui.ff === id) S.ui.ff = 'all';
          S.ui.selTrip = null;
          save();
          render();
          toast('Vehículo eliminado');
        }
        break;
      }
      case 'set-tag':
        S.settings.defaultTag = el.dataset.tag;
        save();
        render();
        break;
      case 'toggle-hints':
        S.settings.hints = !S.settings.hints;
        save();
        applyChrome();
        render();
        break;
      case 'toggle-collapse':
        S.ui.collapsed = !S.ui.collapsed;
        save();
        applyChrome();
        render();
        break;
      case 'reset-demo':
        if (
          await confirmDialog({
            title: '¿Restablecer datos de ejemplo?',
            body:
              'Tus viajes, cargas, lugares y vehículos actuales se reemplazarán por los datos de muestra.' +
              (FS.handle
                ? ` También se actualizará ${FS_FILE}; la copia diaria de ${FS_DIR}/ conserva el estado anterior.`
                : ''),
            ok: 'Restablecer',
          })
        ) {
          const ui = { ...S.ui, selTrip: null, selPlace: null, selPair: null };
          S = normalize(Object.assign(seed(), { ui }));
          save();
          applyChrome();
          render();
          toast('Datos de ejemplo restablecidos');
        }
        break;
      case 'wipe':
        if (
          await confirmDialog({
            title: '¿Borrar todos los datos?',
            body: `Se eliminarán ${S.trips.length} viajes, ${S.fuel.length} cargas, ${S.places.length} lugares y ${S.vehicles.length} vehículos de este equipo. Te recomendamos exportar un respaldo antes.${FS.handle ? ` También se vaciará ${FS_FILE}; la copia diaria de ${FS_DIR}/ conserva el estado anterior.` : ''}`,
            ok: 'Borrar todo',
          })
        ) {
          const ui = {
            ...S.ui,
            selTrip: null,
            selPlace: null,
            selPair: null,
            tf: { tag: 'Todos', vehicle: 'all', from: '', to: '' },
          };
          S = normalize({ settings: { hints: S.settings.hints }, ui });
          save();
          render();
          toast('Se borraron todos los datos');
        }
        break;
      case 'fs-pick':
      case 'fs-reconnect':
      case 'fs-forget':
      case 'fs-resolve':
      case 'fs-create':
      case 'fs-replace':
        fsAction(a);
        break; /* sin await antes: el selector de carpetas y requestPermission exigen el clic del usuario */
      case 'export-json':
        exportJSON();
        break;
      case 'import-json':
        $('#importFile')?.click();
        break;
      case 'csv-trips':
        exportCSV('trips');
        break;
      case 'csv-fuel':
        exportCSV('fuel');
        break;
    }
  });
  contentEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'importFile') {
      const file = el.files && el.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => importJSON(String(r.result));
      r.onerror = () => toast('No se pudo leer el archivo', 'err');
      r.readAsText(file);
      el.value = '';
      return;
    }
    const a = el.dataset.change;
    if (!a) return;
    if (a === 'f-veh') S.ui.tf.vehicle = el.value;
    else if (a === 'f-from') S.ui.tf.from = el.value;
    else if (a === 'f-to') S.ui.tf.to = el.value;
    else if (a === 'set-veh') {
      S.settings.defaultVehicle = el.value;
      toast('Vehículo predeterminado actualizado');
    }
    save();
    render();
  });
  contentEl.addEventListener('input', (e) => {
    const r = e.target;
    if (r.matches && r.matches('[data-play-range]')) scrubPlay(r.dataset.playRange, +r.value);
  });
  contentEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'addPlaceForm') {
      const n = $('#plName', f).value.trim().replace(/\s+/g, ' '),
        ar = $('#plArea', f).value.trim();
      if (!n) {
        $('#plName', f).focus();
        return;
      }
      if (S.places.some((p) => norm(p.name) === norm(n))) {
        toast('Ese lugar ya existe', 'err');
        return;
      }
      const pos = newPlacePos(n),
        np = {
          id: uid('p'),
          name: n,
          area: ar,
          lat: null,
          lng: null,
          x: pos.x,
          y: pos.y,
          kind: 'other',
        },
        loc = !!$('#plLocate', f)?.checked;
      S.places.push(np);
      save();
      render();
      toast('Lugar agregado');
      if (loc) startLocate(np.id); /* ofrece ubicarlo de inmediato */
    } else if (f.id === 'addVehForm') {
      const n = $('#vName', f).value.trim();
      setErr(f, 'vName', n ? '' : 'Escribe un nombre para el vehículo.');
      if (!n) {
        $('#vName', f).focus();
        return;
      }
      const v = {
        id: uid('v'),
        name: n,
        year: +$('#vYear', f).value || '',
        plate: $('#vPlate', f).value.trim().toUpperCase(),
        fuel: $('#vFuel', f).value,
        tank: +$('#vTank', f).value || '',
        color: PALETTE[S.vehicles.length % PALETTE.length],
      };
      S.vehicles.push(v);
      if (!vehById(S.settings.defaultVehicle)) S.settings.defaultVehicle = v.id;
      save();
      render();
      toast('Vehículo agregado');
    }
  });
  contentEl.addEventListener('keydown', (e) => {
    const el = e.target;
    if (el.matches('tr[data-id]') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const sib = e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling;
      if (sib) {
        if (S.ui.selTrip) {
          S.ui.selTrip = sib.dataset.id;
          save();
          render();
          document.getElementById('row-' + sib.dataset.id)?.focus();
        } else sib.focus();
      }
      return;
    }
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      el.matches('[data-action]:not(button):not(input):not(select)')
    ) {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });

  /* ================= Atajos globales ================= */
  document.addEventListener('keydown', (e) => {
    if (modalOpen) return;
    const t = e.target,
      typing =
        t instanceof HTMLElement && (t.matches('input,textarea,select') || t.isContentEditable);
    if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && Undo) {
      e.preventDefault();
      runUndo();
      return;
    }
    if (e.key === 'Escape') {
      if (pMenu) {
        e.preventDefault();
        closePlaceMenu(true);
        return;
      }
      if (!menu.hidden) {
        e.preventDefault();
        closeMenu(true);
        return;
      }
      if (drawerOpen) {
        e.preventDefault();
        requestCloseDrawer();
        return;
      }
      if (Loc) {
        e.preventDefault();
        cancelLocate();
        return;
      }
      if (t === qEl) {
        if (qEl.value) {
          qEl.value = '';
          S.ui.q = '';
          render();
        } else qEl.blur();
        return;
      }
      if (S.ui.view === 'viajes' && S.ui.selTrip) {
        const id = S.ui.selTrip;
        S.ui.selTrip = null;
        save();
        render();
        document.getElementById('row-' + id)?.focus({ preventScroll: true });
        return;
      }
      if (S.ui.view === 'lugares' && (S.ui.selPlace || S.ui.selPair)) {
        S.ui.selPlace = null;
        S.ui.selPair = null;
        render();
        return;
      }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (drawerGuard && drawerGuard() && k.length === 1 && 'nge'.includes(k))
      return; /* con cambios sin guardar en un panel, N/G/E no lo reemplazan */
    if (k === 'n') {
      e.preventDefault();
      openTripPanel();
    } else if (k === 'g') {
      e.preventDefault();
      openFuelPanel();
    } else if (k === 'e') {
      const t = !drawerOpen && S.ui.view === 'viajes' && S.trips.find((x) => x.id === S.ui.selTrip);
      if (t) {
        e.preventDefault();
        openTripPanel(t);
      }
    } else if (e.key === '/') {
      e.preventDefault();
      focusSearch();
    }
  });

  /* ================= Inicio ================= */
  buildChrome();
  applyChrome();
  render(true);
  paintFS();
  initFS();
  window.__trayecto = {
    fs: { state: FS, link: linkFolder, flush: tick, open: openLinked, backups: refreshBackups },
    get state() {
      return S;
    },
    get maps() {
      return MapReg.map((m) => ({ slot: m.slot, trip: m.tripId, state: m.state }));
    },
    get play() {
      return Play;
    },
    get mapObjs() {
      return MapReg.map((m) => m.map);
    },
    get loc() {
      return Loc;
    },
    render,
    go,
    openTripPanel,
    openFuelPanel,
  };
})();
