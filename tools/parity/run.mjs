// Uso: node run.mjs <url|ruta.html> <salida.json> [carpetaPNG]
// Ejecuta un guion fijo contra la app (tiempo congelado, Math.random con semilla, CDN bloqueada,
// animaciones reducidas) y guarda instantáneas de DOM, estado, localStorage y capturas (hash).
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [, , target, out, pngDir] = process.argv;
const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
if (pngDir) mkdirSync(pngDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
  locale: 'es-MX',
  timezoneId: 'America/Mexico_City',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text());
});
await page.route(/unpkg\.com|openfreemap\.org/, (r) => r.abort());
await page.addInitScript(() => {
  let a = 12345;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
});
await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));

const snaps = [];
let n = 0;
async function snap(label) {
  await page.waitForTimeout(60);
  const data = await page.evaluate(() => ({
    title: document.querySelector('#pageTitle')?.textContent,
    sub: document.querySelector('#pageSub')?.textContent,
    content: document.querySelector('#content')?.innerHTML,
    sidebar: document.querySelector('.sidebar')?.innerHTML,
    drawer: document.querySelector('#drawer')?.innerHTML,
    drawerOpen: document.querySelector('#drawer')?.classList.contains('open'),
    modal: document.querySelector('#modalWrap')?.innerHTML,
    toasts: document.querySelectorAll('#toasts .toast').length>0,
    fsNotice: document.querySelector('#fsNotice')?.innerHTML,
    bodyClass: document.body.className,
    appClass: document.querySelector('#app')?.className,
    state: JSON.stringify(window.__trayecto?.state),
    styles: (() => {
      const props = ['display','position','color','background-color','background-image','border-top-color','border-top-width','border-bottom-color','border-bottom-width','border-radius','font-size','font-weight','font-family','line-height','letter-spacing','text-transform','margin-top','margin-bottom','margin-left','margin-right','padding-top','padding-bottom','padding-left','padding-right','opacity','transform','box-shadow','z-index','overflow','cursor','white-space','text-align','flex-direction','justify-content','align-items','gap','grid-template-columns','visibility','outline-style','animation-name','transition-property','width','height'];
      let out = '';
      for (const el of document.querySelectorAll('.app *, #drawer, #drawer *, #modalWrap, #modalWrap *, #tip')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out += el.tagName + '.' + (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + '|' + props.map((p) => cs.getPropertyValue(p)).join(',') + '|' + [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',') + ';';
      }
      let h = 2166136261;
      for (let i = 0; i < out.length; i++) { h ^= out.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16) + ':' + out.length;
    })(),
    ls: Object.fromEntries(Object.keys(localStorage).filter((k) => k !== 'trayecto:fs').sort().map((k) => [k, localStorage.getItem(k)])),
  }));
  const png = await page.screenshot({ fullPage: false });
  const png2 = await page.screenshot({ fullPage: true });
  data.shot = createHash('sha256').update(png).digest('hex').slice(0, 16);
  data.shotFull = createHash('sha256').update(png2).digest('hex').slice(0, 16);
  if (pngDir) writeFileSync(`${pngDir}/${String(n).padStart(3, '0')}-${label}.png`, png2);
  n++;
  snaps.push({ label, ...data });
}
async function wait(ms = 120) {
  await page.waitForTimeout(ms);
}
const go = async (v) => {
  await page.click(`.nav-item[data-view="${v}"]`);
  await wait();
};

await page.goto(url);
await page.waitForSelector('#content .view');
await page.addStyleTag({content:'*{caret-color:transparent!important;transition:none!important}#toasts{visibility:hidden!important}'});
await wait(300);
await snap('inicio');
for (const v of ['viajes', 'gasolina', 'lugares', 'estadisticas', 'vehiculos', 'ajustes', 'respaldo']) {
  await go(v);
  await snap(v);
}

// --- Viajes: selección, filtros, orden, búsqueda
await go('viajes');
await page.click('#row-t15');
await wait();
await snap('viajes-detalle');
await page.keyboard.press('ArrowUp');
await wait();
await snap('viajes-flecha-arriba');
await page.click('[data-action=sort][data-key=km]');
await wait();
await snap('viajes-orden-km');
await page.click('[data-action=filter-tag][data-tag=Personal]');
await wait();
await snap('viajes-filtro-personal');
await page.selectOption('#fVeh', 'v2');
await wait();
await snap('viajes-filtro-veh');
await page.click('[data-action=clear-filters]');
await wait();
await page.keyboard.press('/');
await page.keyboard.type('gimnasio');
await wait();
await snap('viajes-busqueda');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await wait();
await snap('viajes-busqueda-esc');

// --- Reproducción de ruta (sin mapa real: la barra no aparece con el respaldo SVG)
// --- Nuevo viaje con lugar nuevo y rendimiento de computadora
await page.keyboard.press('n');
await wait(300);
await snap('panel-nuevo-viaje');
await page.fill('#tOrigin', 'Casa');
await page.fill('#tDest', 'Escuela nueva');
await page.fill('#tDate', '2026-10-24');
await page.fill('#tDep', '07:30');
await page.fill('#tArr', '08:05');
await page.fill('#tOdoS', '49800');
await page.fill('#tOdoE', '49812.5');
await page.fill('#tComp', '7.1');
await page.selectOption('#tCompUnit', 'l100');
await wait();
await snap('panel-viaje-lleno');
await page.click('button[form=tripForm]');
await wait(300);
await snap('resumen-viaje');
await page.click('[data-dz=view-trip]');
await wait(300);
await snap('ver-en-viajes');
// editar con E
await page.keyboard.press('e');
await wait(300);
await snap('panel-editar-viaje');
await page.fill('#tArr', '08:20');
await page.fill('#tComp', '14.5');
await page.selectOption('#tCompUnit', 'kmpl');
await page.click('button[form=tripForm]');
await wait(300);
await snap('viaje-editado');
// validaciones
await page.keyboard.press('n');
await wait(300);
await page.click('button[form=tripForm]');
await wait();
await snap('viaje-validacion');
await page.keyboard.press('Escape');
await wait(300);
// viaje que cruza la medianoche
await page.keyboard.press('n');
await wait(300);
await page.fill('#tOrigin', 'Oficina');
await page.fill('#tDest', 'Casa');
await page.fill('#tDate', '2026-10-23');
await page.fill('#tDep', '23:40');
await page.fill('#tArr', '00:25');
await page.fill('#tOdoS', '49900');
await page.fill('#tOdoE', '49918');
await page.click('button[form=tripForm]');
await wait(300);
await snap('viaje-medianoche');
await page.click('[data-dz=dl-summary]').catch(() => {});
await page.keyboard.press('Escape');
await wait(300);
// eliminar un viaje
await go('viajes');
await page.click('#row-t1');
await wait();
await page.click('[data-action=delete-trip]');
await wait();
await snap('confirmar-borrar-viaje');
await page.click('[data-m="1"]');
await wait();
await snap('viaje-borrado');

// --- Gasolina
await go('gasolina');
await page.keyboard.press('g');
await wait(300);
await snap('panel-nueva-carga');
await page.fill('#fStation', 'Pemex Nueva');
await page.fill('#fOdo', '49950');
await page.fill('#fLit', '12.5');
await page.click('#fFull');
await wait();
await snap('carga-parcial');
await page.click('button[form=fuelForm]');
await wait(300);
await snap('carga-guardada');
await page.keyboard.press('g');
await wait(300);
await page.fill('#fStation', 'Pemex Nueva');
await page.fill('#fOdo', '50100');
await page.fill('#fLit', '30');
await page.click('button[form=fuelForm]');
await wait(300);
await snap('carga-llena');
await page.click('[data-action=edit-fuel]');
await wait(300);
await snap('panel-editar-carga');
await page.fill('#fLit', '31.2');
await page.click('button[form=fuelForm]');
await wait(300);
await snap('carga-editada');
await page.click('[data-action=fuel-veh][data-id=v2]');
await wait();
await snap('gasolina-v2');
await page.click('[data-action=fuel-veh][data-id=all]');
await wait();
await page.click('[data-action=delete-fuel] >> nth=0');
await wait();
await snap('confirmar-borrar-carga');
await page.click('[data-m="1"]');
await wait();
await snap('carga-borrada');

// --- Lugares
await go('lugares');
await page.click('#pl-p2');
await wait();
await snap('lugar-seleccionado');
await page.click('[data-action=pair-select] >> nth=0');
await wait();
await snap('trayecto-seleccionado');
await page.click('[data-action=clear-place]');
await wait();
await page.click('details.add-place summary');
await page.fill('#plName', 'Parque');
await page.fill('#plArea', 'Roma');
await page.uncheck('#plLocate');
await page.click('#addPlaceForm button[type=submit]');
await wait();
await snap('lugar-agregado');
await page.click('#pm-p3');
await wait();
await snap('menu-lugar');
await page.click('[data-action=place-edit]');
await wait(300);
await snap('panel-editar-lugar');
await page.fill('#pName', 'Gym Central');
await page.click('button[form=placeForm]');
await wait(300);
await snap('lugar-renombrado');
await page.click('#pm-p4');
await page.click('[data-action=place-merge]');
await wait();
await page.selectOption('#mergeDst', 'p1');
await wait();
await snap('dialogo-fusionar');
await page.click('[data-m="1"]');
await wait();
await snap('lugar-fusionado');
await page.keyboard.press('Control+z');
await wait();
await snap('fusion-deshecha');
await page.click('#pm-p5');
await page.click('[data-action=place-delete]');
await wait();
await snap('dialogo-eliminar-lugar');
await page.click('[data-m="x"]');
await wait();
await page.click('#pm-p5');
await page.click('[data-action=place-delete]');
await wait();
await page.click('[data-m="0"]');
await wait();
await snap('eliminar-lugar-con-viajes');
await page.click('#pm-p1');
await page.click('[data-action=locate-start]');
await wait();
await snap('ubicar-sin-mapa');

// --- Estadísticas
await go('estadisticas');
await page.click('[data-action=stat-tab][data-tab=gasto]');
await wait();
await snap('estadisticas-gasto');
await page.click('[data-action=stat-tab][data-tab=rend]');
await wait();
await snap('estadisticas-rend');

// --- Vehículos
await go('vehiculos');
await page.fill('#vName', 'Honda City');
await page.fill('#vYear', '2022');
await page.fill('#vPlate', 'abc-123-d');
await page.selectOption('#vFuel', 'Premium');
await page.fill('#vTank', '45');
await page.click('#addVehForm button[type=submit]');
await wait();
await snap('vehiculo-agregado');
await page.click('[data-action=veh-default] >> nth=0');
await wait();
await snap('vehiculo-predeterminado');
await page.click('[data-action=veh-delete] >> nth=-1');
await wait();
await snap('confirmar-borrar-vehiculo');
await page.click('[data-m="1"]');
await wait();
await snap('vehiculo-borrado');

// --- Ajustes
await go('ajustes');
await page.click('[data-action=toggle-hints]');
await wait();
await snap('ajustes-sin-pistas');
await page.click('[data-action=toggle-hints]');
await page.click('[data-action=set-tag][data-tag=Personal]');
await wait();
await page.selectOption('#setVeh', 'v2');
await wait();
await snap('ajustes-preferencias');
await page.click('[data-action=toggle-collapse]');
await wait();
await snap('menu-contraido');
await page.click('#btnCollapse');
await wait();
await snap('menu-expandido');

// --- Respaldo: exportar, borrar, importar
await go('respaldo');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export-json]')]);
const jsonPath = await dl.path();
const exported = readFileSync(jsonPath, 'utf8');
await wait(300);
await snap('respaldo-exportado');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=csv-trips]')]);
const csvTrips = readFileSync(await dl2.path(), 'utf8');
const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=csv-fuel]')]);
const csvFuel = readFileSync(await dl3.path(), 'utf8');
await go('ajustes');
await page.click('[data-action=wipe]');
await wait();
await snap('confirmar-borrar-todo');
await page.click('[data-m="1"]');
await wait();
await snap('todo-borrado');
await go('inicio');
await snap('inicio-vacio');
await go('respaldo');
await page.setInputFiles('#importFile', { name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await wait();
await snap('confirmar-importar');
await page.click('[data-m="1"]');
await wait(300);
await snap('importado');
await go('ajustes');
await page.click('[data-action=reset-demo]');
await wait();
await page.click('[data-m="1"]');
await wait();
await snap('datos-ejemplo');
// importar JSON inválido
await go('respaldo');
await page.setInputFiles('#importFile', { name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{no es json') });
await wait();
await snap('importar-invalido');
await page.setInputFiles('#importFile', { name: 'v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 3, data: { trips: [], fuel: [], vehicles: [] } })) });
await wait();
await snap('importar-version-futura');

// --- Migración v1 -> v2 con datos viejos
await page.evaluate(() => {
  const v1 = {
    version: 1,
    vehicles: [{ id: 'v1', name: 'Auto viejo', year: 2010, plate: 'X', fuel: 'Magna', tank: 40, color: '#FFB020' }],
    places: [
      { id: 'p1', name: 'Casa', area: 'Coyoacán', x: 500, y: 430, kind: 'home' },
      { id: 'p2', name: 'Oficina', area: 'Polanco', x: 300, y: 175, kind: 'work' },
      { id: 'p3', name: 'Otro', area: '', x: 100, y: 100, kind: 'other' },
    ],
    trips: [
      { id: 't1', date: '2026-10-01', depart: '08:00', arrive: '08:40', origin: 'Casa', destination: 'Oficina', odoStart: 100, odoEnd: 118, vehicleId: 'v1', tag: 'Trabajo' },
    ],
    fuel: [{ id: 'f1', date: '2026-10-01', station: 'Shell', odometer: 120, liters: 30, price: 24, full: true, vehicleId: 'v1' }],
    settings: { defaultVehicle: 'v1', defaultTag: 'Trabajo', hints: true, lastBackup: null },
    ui: {},
  };
  localStorage.clear();
  localStorage.setItem('trayecto:v1', JSON.stringify(v1));
});
await page.reload();
await page.waitForSelector('#content .view');
await page.addStyleTag({content:'*{caret-color:transparent!important;transition:none!important}#toasts{visibility:hidden!important}'});
await wait(300);
await snap('migracion-v1');
await go('viajes');
await snap('migracion-v1-viajes');

writeFileSync(
  out,
  JSON.stringify({ errors, exported, csvTrips, csvFuel, snaps }, null, 1),
);
await browser.close();
console.log(`${snaps.length} instantáneas, ${errors.length} errores -> ${out}`);
