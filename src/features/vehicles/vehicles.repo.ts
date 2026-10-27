/**
 * Repositorio de vehículos: único lugar que modifica `S.vehicles`.
 * Eliminar un vehículo elimina también sus viajes y cargas (a través de sus repositorios).
 */
import {
  PALETTE,
  ValidationError,
  checkVehicle,
  type Vehicle,
  type VehicleInput,
} from '@/data/schema';
import { S, batch, emitChange } from '@/data/store';
import { fuelRepo } from '@/features/fuel/fuel.repo';
import { tripsRepo } from '@/features/trips/trips.repo';
import { uid } from '@/shared/utils/uid';

export const vehiclesRepo = {
  list: (): readonly Vehicle[] => S.vehicles,
  get: (id: string) => S.vehicles.find((x) => x.id === id),
  /** Crea un vehículo; el primero queda como predeterminado. */
  create(input: VehicleInput): Vehicle {
    const problem = checkVehicle(input);
    if (problem) throw new ValidationError(problem);
    const v: Vehicle = {
      id: uid('v'),
      name: input.name.trim(),
      year: input.year,
      plate: input.plate,
      fuel: input.fuel,
      tank: input.tank,
      color: input.color ?? PALETTE[S.vehicles.length % PALETTE.length],
    };
    S.vehicles.push(v);
    if (!S.vehicles.find((x) => x.id === S.settings.defaultVehicle))
      S.settings.defaultVehicle = v.id;
    emitChange(['vehicles', 'settings']);
    return v;
  },
  update(id: string, patch: Partial<VehicleInput>): Vehicle | null {
    const cur = S.vehicles.find((x) => x.id === id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    const problem = checkVehicle(next);
    if (problem) throw new ValidationError(problem);
    Object.assign(cur, { ...patch, name: next.name.trim() });
    emitChange('vehicles');
    return cur;
  },
  /** Elimina el vehículo con sus viajes y cargas y limpia lo que lo referencia. */
  remove(id: string): boolean {
    if (!S.vehicles.some((x) => x.id === id)) return false;
    batch(() => {
      S.vehicles = S.vehicles.filter((x) => x.id !== id);
      tripsRepo.removeByVehicle(id);
      fuelRepo.removeByVehicle(id);
      if (S.settings.defaultVehicle === id) S.settings.defaultVehicle = S.vehicles[0]?.id || null;
      if (S.ui.tf.vehicle === id) S.ui.tf.vehicle = 'all';
      if (S.ui.ff === id) S.ui.ff = 'all';
      S.ui.selTrip = null;
      emitChange(['vehicles', 'settings', 'ui']);
    });
    return true;
  },

  /* ---- Operaciones propias ---- */
  setDefault(id: string) {
    S.settings.defaultVehicle = id;
    emitChange('settings');
  },
};
