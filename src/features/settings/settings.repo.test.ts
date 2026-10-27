import { beforeEach, describe, expect, it } from 'vitest';
import { settingsRepo } from './settings.repo';
import { S } from '@/data/store';
import { recordEvents, resetState } from '@/testing/fixtures';

beforeEach(resetState);

describe('settingsRepo', () => {
  it('update, setDefaultTag y setDefaultVehicle emiten settings', () => {
    const { events, stop } = recordEvents();
    settingsRepo.setDefaultTag('Personal');
    settingsRepo.setDefaultVehicle('v2');
    stop();
    expect(settingsRepo.get()).toMatchObject({ defaultTag: 'Personal', defaultVehicle: 'v2' });
    expect(events).toHaveLength(2);
    expect(events[0].scope).toEqual(['settings']);
  });
  it('toggleHints alterna y avisa al menú (chrome)', () => {
    const { events, stop } = recordEvents();
    settingsRepo.toggleHints();
    expect(S.settings.hints).toBe(false);
    settingsRepo.toggleHints();
    stop();
    expect(S.settings.hints).toBe(true);
    expect(events[0].scope).toEqual(['settings', 'chrome']);
  });
  it('markBackup anota la fecha del respaldo', () => {
    settingsRepo.markBackup(new Date('2024-06-15T12:00:00Z'));
    expect(S.settings.lastBackup).toBe('2024-06-15T12:00:00.000Z');
  });
  it('resetToDemo restablece los datos de ejemplo y conserva la pantalla', () => {
    S.ui.view = 'viajes';
    S.ui.selTrip = 't1';
    S.trips.length = 0;
    S.vehicles.length = 0;
    const { events, stop } = recordEvents();
    settingsRepo.resetToDemo();
    stop();
    expect(S.trips.length).toBeGreaterThan(10);
    expect(S.vehicles.length).toBe(2);
    expect(S.ui.view).toBe('viajes');
    expect(S.ui.selTrip).toBeNull();
    expect(events).toEqual([{ scope: ['all', 'chrome'], persist: true, render: true }]);
  });
  it('wipeAll borra los datos pero conserva las pistas y la pantalla', () => {
    S.settings.hints = false;
    S.ui.view = 'gasolina';
    S.ui.tf.tag = 'Personal';
    settingsRepo.wipeAll();
    expect([S.vehicles, S.places, S.trips, S.fuel]).toEqual([[], [], [], []]);
    expect(S.settings.hints).toBe(false);
    expect(S.settings.defaultVehicle).toBeNull();
    expect(S.ui.view).toBe('gasolina');
    expect(S.ui.tf).toEqual({ tag: 'Todos', vehicle: 'all', from: '', to: '' });
  });
});
