/**
 * Repositorio de lugares: único lugar que modifica `S.places`.
 * Los viajes se enlazan a los lugares por nombre, así que renombrar, fusionar y ubicar un lugar
 * aplica la cascada a los viajes a través de `tripsRepo`.
 */
import { ValidationError, checkPlaceName, type Place } from '@/data/schema';
import { S, batch, emitChange } from '@/data/store';
import { tripsRepo, type RetargetedTrip } from '@/features/trips/trips.repo';
import { newPlacePos } from './places.calc';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
/** Quita la selección que dependa del lugar (mapa y tiempos de traslado). */
function clearSelection(p: Place) {
  const n = norm(p.name);
  if (S.ui.selPlace === p.id) S.ui.selPlace = null;
  if (S.ui.selPair && S.ui.selPair.split('→').includes(n)) S.ui.selPair = null;
}

/** Lo necesario para devolver un lugar eliminado o fusionado a como estaba. */
export interface PlaceUndo {
  /** false si ya existe otro lugar con ese nombre (no se restaura nada). */
  undo(): boolean;
}

export const placesRepo = {
  list: (): readonly Place[] => S.places,
  get: (id: string) => S.places.find((x) => x.id === id),
  /** Crea un lugar sin ubicación en el mapa (con una posición estimada para el mapa esquemático). */
  create(input: { name: string; area?: string; kind?: string }): Place {
    const name = clean(input.name);
    const problem = checkPlaceName(name);
    if (problem) throw new ValidationError(problem);
    if (S.places.some((p) => norm(p.name) === norm(name)))
      throw new ValidationError('Ese lugar ya existe');
    const pos = newPlacePos(name);
    const np: Place = {
      id: uid('p'),
      name,
      area: (input.area ?? '').trim(),
      lat: null,
      lng: null,
      x: pos.x,
      y: pos.y,
      kind: input.kind ?? 'other',
    };
    S.places.push(np);
    emitChange('places');
    return np;
  },
  /**
   * Nombre canónico de un lugar: el existente (sin importar mayúsculas ni acentos) o uno nuevo
   * ubicado cerca de `anchor` según los km del viaje.
   */
  ensure(name: string, anchor?: string | null, km?: number): string {
    const n = clean(name);
    const p = S.places.find((p) => norm(p.name) === norm(n));
    if (p) return p.name;
    const pos = newPlacePos(n, anchor, km);
    S.places.push({
      id: uid('p'),
      name: n,
      area: '',
      lat: null,
      lng: null,
      x: pos.x,
      y: pos.y,
      kind: 'other',
    });
    emitChange('places');
    return n;
  },
  /**
   * Edita nombre, zona e ícono. Si cambia el nombre se reescribe en los viajes (sin tocar sus
   * rutas) y se conserva el trayecto seleccionado. Devuelve cuántos viajes cambiaron de nombre.
   */
  update(id: string, patch: { name: string; area: string; kind: string }): number {
    const p = S.places.find((x) => x.id === id);
    if (!p) return 0;
    const name = clean(patch.name);
    const problem = checkPlaceName(name);
    if (problem) throw new ValidationError(problem);
    const dup = S.places.find((x) => x.id !== id && norm(x.name) === norm(name));
    if (dup) throw new ValidationError(`Ya existe un lugar llamado «${dup.name}».`);
    return batch(() => {
      const old = p.name,
        on = norm(old);
      let k = 0;
      if (name !== old) {
        k = tripsRepo.renamePlace(old, name);
        if (S.ui.selPair)
          S.ui.selPair = S.ui.selPair
            .split('→')
            .map((x) => (x === on ? norm(name) : x))
            .join('→'); /* el trayecto seleccionado sigue siendo el mismo */
      }
      p.name = name;
      p.area = patch.area.trim();
      p.kind = patch.kind;
      emitChange(['places', 'ui']);
      return k;
    });
  },
  /** Elimina un lugar (los viajes nunca se borran). Devuelve cómo deshacerlo. */
  remove(id: string): PlaceUndo | null {
    const p = S.places.find((x) => x.id === id);
    const idx = p ? S.places.indexOf(p) : -1;
    if (!p || idx < 0) return null;
    const sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
    S.places.splice(idx, 1);
    clearSelection(p);
    emitChange(['places', 'ui']);
    return {
      undo() {
        if (S.places.some((x) => x.id === p.id || norm(x.name) === norm(p.name))) return false;
        S.places.splice(Math.min(idx, S.places.length), 0, p);
        Object.assign(S.ui, sel);
        emitChange(['places', 'ui']);
        return true;
      },
    };
  },

  /* ---- Operaciones propias ---- */
  /**
   * Fusiona `srcId` en `dstId`: los viajes de A pasan al nombre de B, las rutas generadas por la
   * app se regeneran con las coordenadas de B y A se elimina. Devuelve cuántos viajes pasaron y cómo deshacerlo.
   */
  merge(srcId: string, dstId: string): ({ moved: number } & PlaceUndo) | null {
    const src = S.places.find((x) => x.id === srcId),
      dst = S.places.find((x) => x.id === dstId);
    if (!src || !dst) return null;
    return batch(() => {
      const changed: RetargetedTrip[] = tripsRepo.retargetPlace(src.name, dst.name);
      const idx = S.places.indexOf(src),
        sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
      S.places.splice(idx, 1);
      clearSelection(src);
      emitChange(['places', 'ui']);
      return {
        moved: changed.length,
        undo() {
          if (S.places.some((x) => x.id === src.id || norm(x.name) === norm(src.name)))
            return false;
          tripsRepo.restoreRetargeted(changed);
          S.places.splice(Math.min(idx, S.places.length), 0, src);
          Object.assign(S.ui, sel);
          emitChange(['places', 'ui']);
          return true;
        },
      };
    });
  },
  /**
   * Guarda la ubicación real de un lugar (el SVG pasa a proyectarla desde lat/lng) y regenera las
   * rutas automáticas que lo usan. Devuelve cuántas rutas se actualizaron.
   */
  setLocation(id: string, lat: number, lng: number): number {
    const p = S.places.find((x) => x.id === id);
    if (!p) return 0;
    return batch(() => {
      p.lat = +lat.toFixed(6);
      p.lng = +lng.toFixed(6);
      delete p.x;
      delete p.y;
      const k = tripsRepo.regeneratePoints(p.name);
      emitChange('places');
      return k;
    });
  },
};
