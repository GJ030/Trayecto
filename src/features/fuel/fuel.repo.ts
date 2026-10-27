/**
 * Repositorio de cargas de gasolina: único lugar que modifica `S.fuel`.
 * Valida con data/schema.ts y emite el evento de cambio.
 */
import { ValidationError, checkFuel, type Fuel, type FuelInput } from '@/data/schema';
import { S, emitChange } from '@/data/store';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

/** Valida y deja los valores como se guardan (texto limpio, litros y precio a 2 decimales). */
function clean(input: FuelInput, id: string | undefined): Omit<Fuel, 'id'> {
  const st = input.station.trim().replace(/\s+/g, ' ');
  const problem = checkFuel({ ...input, station: st });
  if (problem) throw new ValidationError(problem);
  if (
    S.fuel.some(
      (x) =>
        x.id !== id &&
        x.vehicleId === input.vehicleId &&
        Math.abs(x.odometer - input.odometer) < 0.5,
    )
  )
    throw new ValidationError('Ya hay una carga con ese odómetro.');
  const canon = S.fuel.find((x) => norm(x.station) === norm(st))?.station || st;
  return {
    date: input.date,
    station: canon,
    odometer: input.odometer,
    liters: +input.liters.toFixed(2),
    price: +input.price.toFixed(2),
    full: input.full,
    vehicleId: input.vehicleId,
  };
}

export const fuelRepo = {
  list: (): readonly Fuel[] => S.fuel,
  get: (id: string) => S.fuel.find((x) => x.id === id),
  create(input: FuelInput): Fuel {
    const nf: Fuel = { id: uid('f'), ...clean(input, undefined) };
    S.fuel.push(nf);
    emitChange('fuel');
    return nf;
  },
  /** Edita una carga en su lugar. Devuelve null si ya no existe. */
  update(id: string, input: FuelInput): Fuel | null {
    const cur = S.fuel.find((x) => x.id === id);
    if (!cur) return null;
    Object.assign(cur, clean(input, id));
    emitChange('fuel');
    return cur;
  },
  remove(id: string): boolean {
    if (!S.fuel.some((x) => x.id === id)) return false;
    S.fuel = S.fuel.filter((x) => x.id !== id);
    emitChange('fuel');
    return true;
  },

  /* ---- Operaciones propias ---- */
  /** Elimina todas las cargas de un vehículo. */
  removeByVehicle(vehicleId: string): number {
    const before = S.fuel.length;
    S.fuel = S.fuel.filter((f) => f.vehicleId !== vehicleId);
    if (S.fuel.length !== before) emitChange('fuel');
    return before - S.fuel.length;
  },
};
