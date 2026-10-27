/** Acciones de Estadísticas: cambiar la métrica de la tendencia mensual. */
import type { StatTab } from '@/data/schema';
import { updateUi } from '@/data/store';
import { registerClick } from '@/shared/ui/actions';

registerClick({
  'stat-tab': (el) => updateUi({ statTab: el.dataset.tab as StatTab }),
});
