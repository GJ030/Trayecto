/** Acciones del Inicio: elegir el vehículo del rendimiento promedio. */
import { updateUi } from '@/data/store';
import { registerClick } from '@/shared/ui/actions';

registerClick({
  'dash-veh': (el) => updateUi({ dashVeh: el.dataset.id! }),
});
