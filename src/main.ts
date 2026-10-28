import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/shared/ui/chrome.css';
import '@/styles/components.css';
import '@/styles/forms.css';
import '@/styles/tables.css';
import '@/maps/maps.css';
import '@/features/places/places-map.css';
import '@/maps/play.css';
import '@/shared/ui/charts.css';
import '@/features/dashboard/dashboard.css';
import '@/features/places/places.css';
import '@/features/stats/stats.css';
import '@/features/vehicles/vehicles.css';
import '@/features/settings/settings.css';
import '@/features/backup/backup.css';
import '@/shared/ui/empty.css';
import '@/shared/ui/drawer.css';
import '@/shared/ui/modal.css';
import '@/features/trips/trips-computer.css';
import '@/features/places/places-menu.css';
import '@/shared/ui/toast.css';
import '@/features/backup/backup-folder.css';
import '@/styles/motion.css';
import '@/styles/responsive.css';
import { paintFS } from '@/app/fs-status';
import { go, render } from '@/app/nav';
import { startShell } from '@/app/shell';
import '@/app/sync';
import '@/app/events';
import '@/app/shortcuts';
import { ROUTING } from '@/data/routing';
import { routingQueue, setRoutingGuard, startRoutingQueue } from '@/data/routingQueue';
import {
  FS,
  fsWritable,
  initFS,
  linkFolder,
  onFsChange,
  openLinked,
  refreshBackups,
  tick,
} from '@/data/storage/file';
import { S } from '@/data/store';
import '@/features/backup/backup.actions';
import '@/features/dashboard/dashboard.actions';
import '@/features/fuel/fuel.actions';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import '@/features/places/places.actions';
import '@/features/settings/settings.actions';
import { paintRoutingCard } from '@/features/settings/settings.routing';
import '@/features/stats/stats.actions';
import '@/features/trips/trips.actions';
import { openTripPanel } from '@/features/trips/trips.form';
import '@/features/vehicles/vehicles.actions';
import { locState } from '@/maps/placesMap';
import { Play } from '@/maps/play';
import { MapReg } from '@/maps/registry';

setRoutingGuard(fsWritable);
startRoutingQueue();
onFsChange(() => {
  routingQueue.kick(); /* la carpeta volvió a estar disponible: sigue sola */
  paintRoutingCard();
});
startShell();
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
    return locState.cur;
  },
  routing: { config: ROUTING, queue: routingQueue },
  render,
  go,
  openTripPanel,
  openFuelPanel,
};
