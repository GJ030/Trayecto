/** Menú lateral y barra superior: conecta los botones con las pantallas y los paneles. */
import { go, render } from './nav';
import { paintStatusBtn } from './fs-status';
import type { ViewName } from '@/data/schema';
import { S, updateUi } from '@/data/store';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import { openTripPanel } from '@/features/trips/trips.form';
import { applyChrome, buildChrome, hideTip } from '@/shared/ui/chrome';

/** Refleja el estado (menú contraído, pistas de teclado, indicador de la carpeta de datos) en el DOM. */
export function applyChromeState() {
  applyChrome({ collapsed: S.ui.collapsed, hints: S.settings.hints });
  paintStatusBtn();
}
export function startShell() {
  buildChrome({
    onNavigate: (v) => go(v as ViewName),
    onToggleCollapse: () => {
      updateUi({ collapsed: !S.ui.collapsed }, { chrome: true, render: false });
      hideTip();
      if (S.ui.view === 'ajustes') render();
    },
    onNewTrip: () => openTripPanel(),
    onNewFuel: () => openFuelPanel(),
  });
  applyChromeState();
}
