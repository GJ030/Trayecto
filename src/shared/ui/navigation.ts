/**
 * Navegación entre pantallas, para quien no puede importar `app/`.
 * `app/nav.ts` enlaza la implementación al arrancar con `bindNavigation`.
 */
import type { ViewName } from '@/data/schema';

type Go = (view: ViewName, keepQuery?: boolean) => void;
let impl: Go = () => {
  throw new Error('La navegación aún no está enlazada');
};
export const bindNavigation = (go: Go) => {
  impl = go;
};
/** Cambia de pantalla (guarda y vuelve a pintar). */
export const go: Go = (view, keepQuery) => impl(view, keepQuery);
