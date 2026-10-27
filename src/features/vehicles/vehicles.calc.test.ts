import { describe, expect, it } from 'vitest';
import { defVeh, vehById, vehName, vehOptions } from './vehicles.calc';
import { S } from '@/data/store';
import { setState, vehicle } from '@/testing/fixtures';

describe('vehicles.calc', () => {
  it('busca por id y nombra «Sin vehículo» si no existe', () => {
    setState({ vehicles: [vehicle('v1', 'Sedán')] });
    expect(vehById('v1')?.name).toBe('Sedán');
    expect(vehById(null)).toBeUndefined();
    expect(vehName('v1')).toBe('Sedán');
    expect(vehName('zz')).toBe('Sin vehículo');
  });
  it('defVeh usa el predeterminado o, si ya no existe, el primero', () => {
    setState({ vehicles: [vehicle('v1'), vehicle('v2')] });
    S.settings.defaultVehicle = 'v2';
    expect(defVeh()).toBe('v2');
    S.settings.defaultVehicle = 'borrado';
    expect(defVeh()).toBe('v1');
  });
  it('vehOptions marca la opción seleccionada y escapa el nombre', () => {
    setState({ vehicles: [vehicle('v1', 'A <b>'), vehicle('v2', 'B')] });
    const html = vehOptions('v2');
    expect(html).toContain('value="v1" ');
    expect(html).toContain('A &lt;b&gt;');
    expect(html).toMatch(/value="v2" selected/);
    expect(html).not.toMatch(/value="v1" selected/);
  });
});
