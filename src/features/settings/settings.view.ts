import { FS, FS_FILE, fsInfo } from '@/data/storage/file';
import { Store } from '@/data/storage/local';
import { S } from '@/data/store';
import { icon } from '@/shared/ui/icons';
import { esc } from '@/shared/utils/format';
import { routingHost } from '@/data/routing';
import { routingCardHTML } from './settings.routing';

export function renderAjustes() {
  return `<div class="view settings">
    <div class="stack">
      <section class="card"><h3 class="sec-title">Preferencias</h3>
        <div class="set-row"><div><b>Vehículo predeterminado</b><p>Se preselecciona al registrar viajes y cargas.</p></div><select class="input" id="setVeh" data-change="set-veh" aria-label="Vehículo predeterminado">${S.vehicles.length ? S.vehicles.map((v) => `<option value="${v.id}" ${S.settings.defaultVehicle === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option>Sin vehículos</option>'}</select></div>
        <div class="set-row"><div><b>Etiqueta predeterminada</b><p>La etiqueta con la que empieza cada viaje nuevo.</p></div><div class="seg" role="group" aria-label="Etiqueta predeterminada">${['Trabajo', 'Personal'].map((t) => `<button aria-pressed="${S.settings.defaultTag === t}" data-action="set-tag" data-tag="${t}">${t}</button>`).join('')}</div></div>
        <div class="set-row"><div><b>Mostrar pistas de atajos</b><p>Muestra las teclas N, G, E, / y Esc junto a los botones.</p></div><button class="switch-bare" role="switch" aria-checked="${!!S.settings.hints}" data-action="toggle-hints" aria-label="Mostrar pistas de atajos"><span class="track"></span></button></div>
        <div class="set-row"><div><b>Menú contraído</b><p>Muestra solo los íconos del menú lateral.</p></div><button class="switch-bare" role="switch" aria-checked="${!!S.ui.collapsed}" data-action="toggle-collapse" aria-label="Menú contraído"><span class="track"></span></button></div>
      </section>
      ${routingCardHTML()}
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
      <section class="card"><h3 class="sec-title">Acerca de Trayecto</h3><p class="muted-sm" style="margin-top:6px">Versión 2.1. Tus datos viven solo en este equipo y la app funciona sin conexión. Los mapas reales cargan la librería, el estilo y los mosaicos desde internet (unpkg y OpenFreeMap) y, sin conexión, se usa un mapa esquemático. Con «Rutas por calles reales» activado (apagado por omisión), las coordenadas de origen, destino y puntos intermedios de tus viajes se envían a ${routingHost()} para trazar la ruta por las calles; nada más sale de este equipo. Todas las funciones son gratuitas, sin anuncios ni suscripciones.</p></section>
    </div>
  </div>`;
}
