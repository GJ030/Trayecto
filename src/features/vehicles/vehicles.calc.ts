/** Vehículos: búsqueda por id, opciones de selección y vehículo predeterminado. */
import { S } from '@/data/store';
import { esc } from '@/shared/utils/format';

export const vehById = (id: string | null | undefined) => S.vehicles.find((v) => v.id === id);
export const vehName = (id: string) => vehById(id)?.name || 'Sin vehículo';
export const vehOptions = (sel: string) =>
  S.vehicles
    .map((v) => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.name)}</option>`)
    .join('');
export const defVeh = () =>
  vehById(S.settings.defaultVehicle) ? (S.settings.defaultVehicle as string) : S.vehicles[0].id;
