/** Eventos de la interfaz: conecta las acciones registradas por cada funcionalidad. */
import { go } from './nav';
import type { ViewName } from '@/data/schema';
import { installDelegation, registerClick } from '@/shared/ui/actions';
import { contentEl } from '@/shared/ui/dom';
import { drawerHooks } from '@/shared/ui/drawer';
import { bindNavigation } from '@/shared/ui/navigation';
import { mountMaps, parkMaps } from '@/maps/registry';

registerClick({ go: (el) => go(el.dataset.view as ViewName) });
installDelegation(contentEl);
bindNavigation(go);
drawerHooks.park = parkMaps;
drawerHooks.mount = mountMaps;
