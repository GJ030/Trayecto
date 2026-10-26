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
import { go, render } from '@/app/nav';
import {
  FS,
  initFS,
  linkFolder,
  openLinked,
  paintFS,
  refreshBackups,
  tick,
} from '@/data/storage/file';
import { S } from '@/data/store';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import { openTripPanel } from '@/features/trips/trips.form';
import { locState } from '@/maps/placesMap';
import { Play } from '@/maps/play';
import { MapReg } from '@/maps/registry';
import { applyChrome, buildChrome } from '@/shared/ui/chrome';
import '@/app/events';
import '@/app/shortcuts';

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
    return locState.cur;
  },
  render,
  go,
  openTripPanel,
  openFuelPanel,
};
